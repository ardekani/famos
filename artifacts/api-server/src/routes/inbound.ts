/**
 * Postmark inbound email webhook.
 *
 * Postmark POSTs a JSON payload for every email received at the inbound
 * domain. This handler:
 *   1. Verifies the token in the URL path (shared secret)
 *   2. Parses the sender address, subject, and body
 *   3. Looks up the registered user by sender email
 *   4. Stores the email and fires extraction asynchronously
 *
 * Always returns 200 — even on silent drops — so Postmark never retries.
 *
 * Postmark webhook URL format:
 *   https://<your-domain>/api/inbound/email/<POSTMARK_INBOUND_TOKEN>
 */

import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger.js";
import { getSupabaseClient } from "../lib/supabase.js";
import { runExtractionAndSave } from "../lib/process-email.js";

const router = Router();

// ── Postmark payload shape (fields we care about) ─────────────────────────

interface PostmarkInboundPayload {
  From?:    string;
  FromFull?: { Email?: string; Name?: string };
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  MessageID?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Very minimal HTML stripper — removes tags and decodes common entities.
 * Used only when no TextBody is present.
 */
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

/**
 * Find the Supabase Auth user whose email matches the sender.
 * Uses the admin API (requires service role key).
 * Returns null if not found or on error.
 */
async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  const sb = getSupabaseClient();
  try {
    // listUsers is fine at MVP scale; replace with a DB lookup if user count grows.
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
    logger.error({ err }, "findUserByEmail: admin API call failed");
    return null;
  }
}

// ── POST /api/inbound/email/:token ────────────────────────────────────────
//
// BYPASSED: Gmail ingestion via POST /api/cron/gmail-sync is now the active
// inbound path. This Postmark webhook is disabled but kept intact so it can
// be re-enabled instantly if needed (remove the early return below).

router.post("/inbound/email/:token", async (req: Request, res: Response) => {
  // ── BYPASS — Gmail ingestion is active; Postmark is disabled ──────────
  res.status(200).send("ok");
  return;
  const log = logger.child({ route: "inbound" });

  // ── 1. Verify shared-secret token ─────────────────────────────────────
  const expectedToken = process.env.POSTMARK_INBOUND_TOKEN;

  if (!expectedToken) {
    log.error("POSTMARK_INBOUND_TOKEN env var is not set — rejecting inbound webhook");
    res.status(200).send("ok");
    return;
  }

  if (req.params.token !== expectedToken) {
    log.warn({ token: req.params.token?.slice(0, 8) }, "Inbound: invalid token");
    res.status(200).send("ok"); // always 200 to avoid leaking info
    return;
  }

  // ── 2. Parse Postmark payload ──────────────────────────────────────────
  const payload = req.body as PostmarkInboundPayload;

  const fromEmail = (payload?.FromFull?.Email ?? payload?.From ?? "").trim();
  const subject   = (payload?.Subject ?? "(no subject)").trim();
  const body      = (payload?.TextBody ?? "").trim() || stripHtml(payload?.HtmlBody ?? "");
  const messageId = payload?.MessageID ?? null;

  if (!fromEmail) {
    log.warn("Inbound: missing From address — dropping");
    res.status(200).send("ok");
    return;
  }

  if (!body) {
    log.warn({ fromEmail, subject }, "Inbound: empty body — dropping");
    res.status(200).send("ok");
    return;
  }

  log.info({ fromEmail, subject }, "Inbound email received");

  // ── 3. Identify the registered user by sender email ───────────────────
  const user = await findUserByEmail(fromEmail);

  if (!user) {
    log.info({ fromEmail }, "Inbound: no registered user for sender — dropping silently");
    res.status(200).send("ok");
    return;
  }

  // ── 4. Store the email row ─────────────────────────────────────────────
  const sb = getSupabaseClient();

  const { data: email, error: insertError } = await sb
    .from("emails")
    .insert({
      user_id:           user.id,
      subject,
      body,
      sender:            fromEmail,
      source_message_id: messageId ?? null,
      processing_status: "pending",
    })
    .select()
    .single();

  if (insertError || !email) {
    log.error({ insertError, fromEmail }, "Inbound: failed to insert email row");
    res.status(200).send("ok");
    return;
  }

  log.info({ emailId: email.id, userId: user.id }, "Inbound email stored");

  // ── 5. Return 200 immediately, extract asynchronously ─────────────────
  // Postmark has a 10-second webhook timeout. We never block on extraction.
  res.status(200).send("ok");

  runExtractionAndSave(email.id, subject, body, user.id)
    .then((result) => {
      if (result.ok) {
        log.info({ emailId: email.id }, "Inbound extraction complete");
      } else {
        log.error({ emailId: email.id, error: result.error }, "Inbound extraction failed");
      }
    })
    .catch((err) => {
      log.error({ err, emailId: email.id }, "Inbound extraction threw unexpectedly");
    });
});

export default router;
