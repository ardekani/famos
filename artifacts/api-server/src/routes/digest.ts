/**
 * Digest routes.
 *
 * POST /api/digest/generate          — build & save today's digest from stored data
 * POST /api/digest/send              — send the latest digest to the authenticated user's email
 * POST /api/digest/generate-and-send — generate + send in one call (used by cron)
 * GET  /api/digest/latest            — fetch the most recently generated digest
 *
 * All routes require a valid Supabase Bearer token (set by requireAuth).
 * The recipient email is ALWAYS taken from the verified token (req.userEmail),
 * never from the request body, so no user can redirect digest email elsewhere.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod/v4";
import { logger } from "../lib/logger.js";
import { getSupabaseClient } from "../lib/supabase.js";
import { requireAuth } from "../lib/auth.js";
import { generateDigest, renderHtml } from "../lib/digest.js";

const router = Router();

// ── Request schemas ───────────────────────────────────────────────────────

const GenerateBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ── Shared send helper ────────────────────────────────────────────────────

/**
 * Sends the most recent digest for a user via Resend.
 * Uses the email address from the verified Supabase auth token — never arbitrary input.
 */
async function sendDigestEmail(
  userId: string,
  toEmail: string,
  digestId?: string
): Promise<{ messageId: string; sentTo: string }> {
  const RESEND_API_KEY = process.env["RESEND_API_KEY"];
  if (!RESEND_API_KEY) {
    throw Object.assign(new Error("Email sending not configured — add RESEND_API_KEY"), { status: 503 });
  }

  const sb = getSupabaseClient();

  // Fetch digest scoped to this user (never leaks another user's digest)
  let q = sb.from("digests").select("*").eq("user_id", userId);
  q = digestId
    ? q.eq("id", digestId)
    : q.order("created_at", { ascending: false }).limit(1);
  const { data: digestData, error: fetchErr } = await q.single();

  if (fetchErr || !digestData) {
    throw Object.assign(new Error("Digest not found — generate one first"), { status: 404 });
  }

  const digestJson  = digestData.content_json as Record<string, unknown> | null;
  const fromEmail   = process.env["RESEND_FROM_EMAIL"] ?? "FamOS <onboarding@resend.dev>";
  const subjectDate = new Date(
    ((digestJson?.["date"] as string | undefined) ?? digestData.digest_date) + "T00:00:00Z"
  ).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  });

  const { Resend } = await import("resend");
  const resend     = new Resend(RESEND_API_KEY);

  const html = digestJson
    ? renderHtml(digestJson as Parameters<typeof renderHtml>[0])
    : `<pre>${digestData.content_text}</pre>`;

  const { data: sendData, error: sendErr } = await resend.emails.send({
    from:    fromEmail,
    to:      [toEmail],
    subject: `FamOS Digest — ${subjectDate}`,
    html,
    text:    digestData.content_text,
  });

  if (sendErr) {
    throw Object.assign(new Error(`Resend error: ${sendErr.message}`), { status: 502 });
  }

  // Mark sent_at — scoped to this user so no cross-user update is possible
  await sb
    .from("digests")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", digestData.id)
    .eq("user_id", userId);

  logger.info({ digestId: digestData.id, toEmail }, "Digest sent via Resend");
  return { messageId: sendData?.id ?? "", sentTo: toEmail };
}

// ── POST /digest/generate ─────────────────────────────────────────────────

router.post("/digest/generate", requireAuth, async (req: Request, res: Response) => {
  const parse = GenerateBodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body", details: parse.error.issues });
    return;
  }

  try {
    const digest = await generateDigest(req.userId, parse.data.date);
    res.status(201).json({
      digest_id:    digest.id,
      digest_date:  digest.digest_date,
      content_text: digest.content_text,
      content_json: digest.content_json,
      created_at:   digest.created_at,
    });
  } catch (err) {
    logger.error({ err }, "Digest generation failed");
    res.status(500).json({
      error:   "Failed to generate digest",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// ── POST /digest/send ─────────────────────────────────────────────────────
//
// Sends the latest digest to the authenticated user's email address.
// The recipient is resolved from the verified Supabase JWT — never from
// the request body — so the caller cannot redirect the email.

router.post("/digest/send", requireAuth, async (req: Request, res: Response) => {
  const { userEmail, userId } = req;

  if (!userEmail) {
    res.status(400).json({
      error: "No email address on your account. Update your Supabase auth profile and try again.",
    });
    return;
  }

  // Optional: allow sending a specific digest_id
  const digestId = (req.body as { digest_id?: string }).digest_id;

  try {
    const result = await sendDigestEmail(userId, userEmail, digestId);
    res.json({ ok: true, message_id: result.messageId, sent_to: result.sentTo });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const msg    = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Digest send failed");
    if (status === 503) {
      res.status(503).json({ error: msg, hint: "Add RESEND_API_KEY to environment secrets." });
    } else if (status === 404) {
      res.status(404).json({ error: msg });
    } else {
      res.status(status).json({ error: msg });
    }
  }
});

// ── POST /digest/generate-and-send ───────────────────────────────────────
//
// Convenience endpoint: generate today's digest and immediately email it.
// The authenticated user's email is used as the recipient.
// Designed to be called from the DigestCard "Generate & send" button,
// or from the cron route (POST /api/cron/digest) which calls it per-user
// with a service-level token.

router.post("/digest/generate-and-send", requireAuth, async (req: Request, res: Response) => {
  const { userEmail, userId } = req;
  const parse = GenerateBodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body", details: parse.error.issues });
    return;
  }

  if (!userEmail) {
    res.status(400).json({
      error: "No email address on your account.",
    });
    return;
  }

  try {
    const digest = await generateDigest(userId, parse.data.date);
    const result = await sendDigestEmail(userId, userEmail, digest.id);
    res.json({
      ok:          true,
      digest_id:   digest.id,
      digest_date: digest.digest_date,
      message_id:  result.messageId,
      sent_to:     result.sentTo,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    logger.error({ err }, "Digest generate-and-send failed");
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /digest/latest ────────────────────────────────────────────────────

router.get("/digest/latest", requireAuth, async (req: Request, res: Response) => {
  const sb = getSupabaseClient();

  const { data, error } = await sb
    .from("digests")
    .select("*")
    .eq("user_id", req.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code === "PGRST116") {
    res.json({ digest: null });
    return;
  }

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ digest: data });
});

export default router;
