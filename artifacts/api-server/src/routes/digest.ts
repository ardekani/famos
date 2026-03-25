/**
 * Digest routes.
 *
 * POST /api/digest/generate — build & save a digest from stored data
 * POST /api/digest/send     — send the latest (or specified) digest via Resend
 * GET  /api/digest/latest   — fetch the most recently generated digest
 *
 * All routes require a valid Supabase Bearer token (set by requireAuth).
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

const SendBodySchema = z.object({
  to_email:  z.string().email(),
  digest_id: z.string().uuid().optional(),
});

// ── POST /digest/generate ─────────────────────────────────────────────────

router.post("/digest/generate", requireAuth, async (req: Request, res: Response) => {
  const parse = GenerateBodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body", details: parse.error.issues });
    return;
  }

  const userId = req.userId;
  const date   = parse.data.date;

  try {
    const digest = await generateDigest(userId, date);
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

router.post("/digest/send", requireAuth, async (req: Request, res: Response) => {
  const RESEND_API_KEY = process.env["RESEND_API_KEY"];
  if (!RESEND_API_KEY) {
    res.status(503).json({
      error: "Email sending not configured",
      hint:  "Add RESEND_API_KEY to your environment secrets to enable digest emails.",
    });
    return;
  }

  const parse = SendBodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body", details: parse.error.issues });
    return;
  }

  const { to_email, digest_id } = parse.data;
  const userId = req.userId;
  const sb     = getSupabaseClient();

  // Fetch the digest to send (scoped to this user)
  let digestQuery = sb.from("digests").select("*").eq("user_id", userId);
  if (digest_id) {
    digestQuery = digestQuery.eq("id", digest_id);
  } else {
    digestQuery = digestQuery.order("created_at", { ascending: false }).limit(1);
  }
  const { data: digestData, error: fetchErr } = await digestQuery.single();

  if (fetchErr || !digestData) {
    res.status(404).json({ error: "Digest not found. Generate one first." });
    return;
  }

  const digest      = digestData;
  const digestJson  = digest.content_json as Record<string, unknown> | null;
  const fromEmail   = process.env["RESEND_FROM_EMAIL"] ?? "FamOS <onboarding@resend.dev>";
  const subjectDate = new Date((digestJson?.["date"] as string ?? digest.digest_date) + "T00:00:00Z")
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  // Dynamically import Resend so the file doesn't fail at startup without the key
  const { Resend } = await import("resend");
  const resend     = new Resend(RESEND_API_KEY);

  const html = digestJson
    ? renderHtml(digestJson as Parameters<typeof renderHtml>[0])
    : `<pre>${digest.content_text}</pre>`;

  const { data: sendData, error: sendErr } = await resend.emails.send({
    from:    fromEmail,
    to:      [to_email],
    subject: `FamOS Digest — ${subjectDate}`,
    html,
    text:    digest.content_text,
  });

  if (sendErr) {
    logger.error({ sendErr }, "Resend failed");
    res.status(502).json({ error: "Failed to send email", details: sendErr.message });
    return;
  }

  // Mark sent_at (scoped to this user)
  await sb
    .from("digests")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", digest.id)
    .eq("user_id", userId);

  logger.info({ digestId: digest.id, to_email }, "Digest sent via Resend");
  res.json({ ok: true, message_id: sendData?.id, sent_to: to_email });
});

// ── GET /digest/latest ────────────────────────────────────────────────────

router.get("/digest/latest", requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId;
  const sb     = getSupabaseClient();

  const { data, error } = await sb
    .from("digests")
    .select("*")
    .eq("user_id", userId)
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
