/**
 * Gmail inbound ingestion module.
 *
 * Polls inbox@famops.app (Google Workspace) for unread messages using a
 * service account with domain-wide delegation, normalises each message into
 * the existing email ingestion shape, and hands off to runExtractionAndSave().
 *
 * Authentication setup (one-time, done by Workspace admin):
 *   1. Create a Google Cloud service account.
 *   2. Enable Gmail API for the project.
 *   3. Generate a JSON key — set GMAIL_CLIENT_EMAIL and GMAIL_PRIVATE_KEY.
 *   4. In Google Workspace Admin → Security → API controls → Domain-wide
 *      delegation, add the service account client ID with scope:
 *        https://www.googleapis.com/auth/gmail.modify
 *   5. Set GMAIL_INBOUND_ADDRESS=inbox@famops.app (or leave default).
 *
 * Idempotency:
 *   Each Gmail message id is stored as emails.source_message_id.
 *   Before inserting, we check for an existing row — duplicates are skipped.
 *   After processing (or skipping), the message is marked as read so it does
 *   not appear in future "is:unread" polls.
 */

import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { logger } from "./logger.js";
import { getSupabaseClient } from "./supabase.js";
import { runExtractionAndSave } from "./process-email.js";

// ── HTML stripper (matches logic in routes/inbound.ts) ────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Email address extraction ───────────────────────────────────────────────

/**
 * Extract the bare email address from a header value.
 * Handles "Display Name <email@example.com>" and plain "email@example.com".
 */
function parseEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

// ── Gmail client ──────────────────────────────────────────────────────────

function getGmailClient(): gmail_v1.Gmail {
  const clientEmail     = process.env["GMAIL_CLIENT_EMAIL"];
  const rawPrivateKey   = process.env["GMAIL_PRIVATE_KEY"] ?? "";
  const inboundAddress  = process.env["GMAIL_INBOUND_ADDRESS"] ?? "inbox@famops.app";

  if (!clientEmail || !rawPrivateKey) {
    throw new Error(
      "Gmail ingestion not configured. Set GMAIL_CLIENT_EMAIL and GMAIL_PRIVATE_KEY environment variables."
    );
  }

  // The private key may have literal \n sequences when stored as an env var.
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email:   clientEmail,
    key:     privateKey,
    scopes:  ["https://www.googleapis.com/auth/gmail.modify"],
    subject: inboundAddress,
  });

  return google.gmail({ version: "v1", auth });
}

// ── Message body extraction ───────────────────────────────────────────────

/**
 * Recursively walk Gmail message parts to find text/plain and text/html body.
 * Returns decoded strings; prefers text/plain.
 */
function extractBodyParts(
  payload: gmail_v1.Schema$MessagePart | undefined,
  result: { text: string; html: string } = { text: "", html: "" }
): { text: string; html: string } {
  if (!payload) return result;

  const mimeType = payload.mimeType ?? "";
  const data     = payload.body?.data ?? "";

  if (mimeType === "text/plain" && data && !result.text) {
    result.text = Buffer.from(data, "base64").toString("utf-8");
  } else if (mimeType === "text/html" && data && !result.html) {
    result.html = Buffer.from(data, "base64").toString("utf-8");
  }

  for (const part of payload.parts ?? []) {
    extractBodyParts(part, result);
  }

  return result;
}

// ── User lookup (mirrors routes/inbound.ts) ───────────────────────────────

async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  const sb = getSupabaseClient();
  try {
    const { data: { users }, error } = await sb.auth.admin.listUsers({
      page:    1,
      perPage: 1000,
    });
    if (error) throw error;
    const match = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    return match ? { id: match.id } : null;
  } catch (err) {
    logger.error({ err }, "gmail-ingest: findUserByEmail failed");
    return null;
  }
}

// ── Mark message as read ──────────────────────────────────────────────────

async function markAsRead(gmail: gmail_v1.Gmail, messageId: string): Promise<void> {
  try {
    await gmail.users.messages.modify({
      userId:      "me",
      id:          messageId,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });
  } catch (err) {
    logger.warn({ err, messageId }, "gmail-ingest: failed to mark message as read");
  }
}

// ── Main polling function ─────────────────────────────────────────────────

export interface GmailIngestResult {
  processed: number;
  skipped:   number;
  errors:    number;
}

/**
 * Poll inbox@famops.app for unread messages, ingest new ones, mark all as read.
 * Safe to call repeatedly — duplicate messages are skipped via source_message_id.
 */
export async function ingestNewGmailMessages(): Promise<GmailIngestResult> {
  const log = logger.child({ service: "gmail-ingest" });
  const sb  = getSupabaseClient();

  let gmail: gmail_v1.Gmail;
  try {
    gmail = getGmailClient();
  } catch (err) {
    log.error({ err }, "Gmail client initialization failed");
    throw err;
  }

  // ── 1. List unread messages (cap at 50 per poll) ──────────────────────

  const listRes = await gmail.users.messages.list({
    userId:     "me",
    q:          "is:unread",
    maxResults: 50,
  });

  const messages = listRes.data.messages ?? [];
  log.info({ count: messages.length }, "Gmail: unread messages found");

  const stats: GmailIngestResult = { processed: 0, skipped: 0, errors: 0 };

  for (const stub of messages) {
    const gmailId = stub.id;
    if (!gmailId) continue;

    try {
      // ── 2. Fetch full message ────────────────────────────────────────

      const msgRes = await gmail.users.messages.get({
        userId: "me",
        id:     gmailId,
        format: "full",
      });

      const msg     = msgRes.data;
      const headers = msg.payload?.headers ?? [];

      const getHeader = (name: string): string =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const fromRaw        = getHeader("from");
      const fromEmail      = parseEmailAddress(fromRaw);
      const subject        = getHeader("subject").trim() || "(no subject)";
      const rfc822Id       = getHeader("message-id").trim() || null;

      // Use the Gmail message ID as the primary dedup key (stable, unique)
      const sourceMessageId = gmailId;

      // ── 3. Dedup check ───────────────────────────────────────────────

      const { data: existing } = await sb
        .from("emails")
        .select("id")
        .eq("source_message_id", sourceMessageId)
        .maybeSingle();

      if (existing) {
        log.debug({ gmailId, subject }, "Gmail: already processed — skipping");
        await markAsRead(gmail, gmailId);
        stats.skipped++;
        continue;
      }

      // ── 4. Extract body ──────────────────────────────────────────────

      const { text, html } = extractBodyParts(msg.payload);
      const body = text.trim() || stripHtml(html);

      if (!body) {
        log.warn({ gmailId, subject }, "Gmail: empty body — skipping");
        await markAsRead(gmail, gmailId);
        stats.skipped++;
        continue;
      }

      if (!fromEmail) {
        log.warn({ gmailId, subject }, "Gmail: missing From address — skipping");
        await markAsRead(gmail, gmailId);
        stats.skipped++;
        continue;
      }

      // ── 5. Identify registered user ──────────────────────────────────

      const user = await findUserByEmail(fromEmail);

      if (!user) {
        log.info({ fromEmail, subject }, "Gmail: no registered user for sender — skipping");
        await markAsRead(gmail, gmailId);
        stats.skipped++;
        continue;
      }

      // ── 6. Insert email row ──────────────────────────────────────────

      const { data: emailRow, error: insertError } = await sb
        .from("emails")
        .insert({
          user_id:           user.id,
          subject,
          body,
          sender:            fromEmail,
          source_message_id: sourceMessageId,
          processing_status: "pending",
        })
        .select()
        .single();

      if (insertError || !emailRow) {
        log.error({ insertError, gmailId, fromEmail }, "Gmail: failed to insert email row");
        stats.errors++;
        continue;
      }

      log.info(
        { emailId: emailRow.id, userId: user.id, subject },
        "Gmail: email stored — starting extraction"
      );

      // ── 7. Mark as read ──────────────────────────────────────────────
      // Do this before extraction so a crash during extraction doesn't
      // cause the message to be re-fetched and double-inserted.

      await markAsRead(gmail, gmailId);

      // ── 8. Run extraction asynchronously ────────────────────────────
      // Mirrors the pattern in routes/inbound.ts — fire-and-forget.

      runExtractionAndSave(emailRow.id, subject, body, user.id)
        .then((result) => {
          if (result.ok) {
            log.info({ emailId: emailRow.id }, "Gmail: extraction complete");
          } else {
            log.error({ emailId: emailRow.id, error: result.error }, "Gmail: extraction failed");
          }
        })
        .catch((err) => {
          log.error({ err, emailId: emailRow.id }, "Gmail: extraction threw unexpectedly");
        });

      stats.processed++;

    } catch (err) {
      log.error({ err, gmailId }, "Gmail: unexpected error processing message");
      stats.errors++;
    }
  }

  log.info(stats, "Gmail ingest poll complete");
  return stats;
}
