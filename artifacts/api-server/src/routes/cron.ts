/**
 * Cron routes — server-side scheduled job triggers.
 *
 * POST /api/cron/digest
 *   Generates and sends today's digest for every eligible user.
 *   Protected by a CRON_SECRET header — not by user auth.
 *
 * ─────────────────────────────────────────────────────────────
 * HOW TO WIRE THIS TO A SCHEDULER
 * ─────────────────────────────────────────────────────────────
 *
 * 1. Set a CRON_SECRET environment variable (any long random string).
 *    Keep it private — this is the only protection on this endpoint.
 *
 * 2. Choose a scheduler:
 *
 *    ── Option A: Supabase Edge Function (recommended for this stack) ──
 *    a. Create a Supabase Edge Function (supabase/functions/send-digests/index.ts)
 *       that calls:
 *         await fetch("https://<your-api>/api/cron/digest", {
 *           method: "POST",
 *           headers: { "x-cron-secret": Deno.env.get("CRON_SECRET") },
 *         });
 *    b. Schedule it in supabase/config.toml:
 *         [functions.send-digests]
 *         schedule = "0 7 * * *"   # every day at 07:00 UTC
 *    c. Set CRON_SECRET in the Edge Function's secrets via Supabase dashboard.
 *
 *    ── Option B: External cron service (cron-job.org, EasyCron, Render cron) ──
 *    Configure a daily HTTP POST to:
 *      https://<your-api>/api/cron/digest
 *    with header:
 *      x-cron-secret: <CRON_SECRET value>
 *    and an empty body.
 *
 *    ── Option C: GitHub Actions scheduled workflow ──
 *    Add a workflow that runs on schedule and calls the endpoint with curl.
 *
 * 3. To test manually without a scheduler, call:
 *      curl -X POST https://<your-api>/api/cron/digest \
 *           -H "x-cron-secret: <CRON_SECRET value>"
 * ─────────────────────────────────────────────────────────────
 */

import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger.js";
import { getSupabaseClient } from "../lib/supabase.js";
import { generateDigest, renderHtml } from "../lib/digest.js";
import { ingestNewGmailMessages } from "../lib/gmail-ingest.js";

const router = Router();

// ── Auth check for cron endpoints ─────────────────────────────────────────

function requireCronSecret(req: Request, res: Response): boolean {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    // If no secret is configured, block all calls to force intentional setup.
    res.status(503).json({
      error: "Cron not configured. Set the CRON_SECRET environment variable.",
    });
    return false;
  }
  if (req.headers["x-cron-secret"] !== secret) {
    res.status(401).json({ error: "Invalid cron secret." });
    return false;
  }
  return true;
}

// ── POST /cron/digest ─────────────────────────────────────────────────────

router.post("/cron/digest", async (req: Request, res: Response) => {
  if (!requireCronSecret(req, res)) return;

  const RESEND_API_KEY = process.env["RESEND_API_KEY"];
  if (!RESEND_API_KEY) {
    res.status(503).json({
      error: "Email sending not configured — add RESEND_API_KEY to environment secrets.",
    });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  logger.info({ today }, "Cron digest job started");

  const sb = getSupabaseClient();

  // ── Find all users who have data (events, deadlines, or action items) ──
  // We use auth.users to get emails. This requires the service role key.
  // If you only have the anon key, replace this with a `profiles` table query.
  const { Resend } = await import("resend");
  const resend      = new Resend(RESEND_API_KEY);
  const fromEmail   = process.env["RESEND_FROM_EMAIL"] ?? "FamOS <onboarding@resend.dev>";

  // Query distinct user_ids that have any events this week or any incomplete actions.
  // This avoids sending blank digests to inactive users.
  const weekEnd = (() => {
    const d   = new Date(today + "T00:00:00Z");
    const dow = d.getUTCDay();
    const toSun = dow === 0 ? 0 : 7 - dow;
    d.setUTCDate(d.getUTCDate() + toSun);
    return d.toISOString().split("T")[0];
  })();

  const { data: activeUsers, error: usersErr } = await sb
    .from("events")
    .select("user_id")
    .gte("date", today)
    .lte("date", weekEnd)
    .limit(500);

  if (usersErr) {
    logger.error({ err: usersErr }, "Cron: failed to query active users");
    res.status(500).json({ error: "Failed to query active users", details: usersErr.message });
    return;
  }

  // Deduplicate user IDs
  const userIds = [...new Set((activeUsers ?? []).map(r => r.user_id as string))];
  logger.info({ count: userIds.length }, "Cron: users with events this week");

  const results: Array<{ userId: string; status: "ok" | "error"; detail?: string }> = [];

  for (const userId of userIds) {
    try {
      // Generate the digest for this user
      const digest = await generateDigest(userId, today);
      const digestJson = digest.content_json as Record<string, unknown> | null;

      // Resolve user email via Supabase admin API (requires service role key).
      // If using the anon key, store user emails in a profiles table instead.
      const { data: authData, error: authErr } = await sb.auth.admin.getUserById(userId);
      const toEmail = authData?.user?.email;

      if (authErr || !toEmail) {
        logger.warn({ userId, authErr }, "Cron: could not resolve email for user, skipping");
        results.push({ userId, status: "error", detail: "no email" });
        continue;
      }

      const subjectDate = new Date(today + "T00:00:00Z").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
      });

      const html = digestJson
        ? renderHtml(digestJson as Parameters<typeof renderHtml>[0])
        : `<pre>${digest.content_text}</pre>`;

      const { error: sendErr } = await resend.emails.send({
        from:    fromEmail,
        to:      [toEmail],
        subject: `FamOS Digest — ${subjectDate}`,
        html,
        text:    digest.content_text,
      });

      if (sendErr) {
        logger.error({ userId, sendErr }, "Cron: Resend failed");
        results.push({ userId, status: "error", detail: sendErr.message });
        continue;
      }

      // Mark sent
      await sb
        .from("digests")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", digest.id)
        .eq("user_id", userId);

      logger.info({ userId, toEmail }, "Cron: digest sent");
      results.push({ userId, status: "ok" });

    } catch (err) {
      logger.error({ userId, err }, "Cron: unexpected error for user");
      results.push({ userId, status: "error", detail: err instanceof Error ? err.message : String(err) });
    }
  }

  const ok    = results.filter(r => r.status === "ok").length;
  const error = results.filter(r => r.status === "error").length;
  logger.info({ ok, error }, "Cron digest job complete");

  res.json({ ok, error, total: results.length, results });
});

// ── POST /cron/gmail-sync ─────────────────────────────────────────────────
//
// Polls inbox@famops.app for new unread messages and ingests them into the
// existing email pipeline. Safe to call repeatedly — duplicate messages are
// skipped via source_message_id dedup.
//
// Schedule: every 10 minutes via cron-job.org or equivalent.
// Manual test:
//   curl -X POST https://<your-api>/api/cron/gmail-sync \
//        -H "x-cron-secret: <CRON_SECRET value>"

router.post("/cron/gmail-sync", async (req: Request, res: Response) => {
  if (!requireCronSecret(req, res)) return;

  const log = logger.child({ route: "cron/gmail-sync" });
  log.info("Gmail sync cron started");

  try {
    const result = await ingestNewGmailMessages();
    log.info(result, "Gmail sync cron complete");
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err }, "Gmail sync cron failed");
    res.status(500).json({ error: message });
  }
});

export default router;
