/**
 * Email ingestion routes.
 *
 * POST /api/emails/ingest  — store a new email and run extraction
 * POST /api/emails/extract — re-run extraction for an existing email
 * GET  /api/emails/:id     — fetch email + all extracted entities
 *
 * All routes require a valid Supabase Bearer token (set by requireAuth).
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod/v4";
import { logger } from "../lib/logger.js";
import { getSupabaseClient } from "../lib/supabase.js";
import { requireAuth } from "../lib/auth.js";
import {
  runExtractionAndSave,
  deleteExtractedEntities,
} from "../lib/process-email.js";

const router = Router();

// ── Request schemas ───────────────────────────────────────────────────────

const IngestBodySchema = z.object({
  subject:           z.string().min(1),
  body:              z.string().min(1),
  sender:            z.string().optional(),
  source_message_id: z.string().optional(),
});

const ExtractBodySchema = z.object({
  email_id: z.string().uuid(),
});

// ── POST /emails/ingest ───────────────────────────────────────────────────

router.post("/emails/ingest", requireAuth, async (req: Request, res: Response) => {
  const parse = IngestBodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body", details: parse.error.issues });
    return;
  }

  const { subject, body, sender, source_message_id } = parse.data;
  const userId = req.userId;
  const sb = getSupabaseClient();

  // 1. Insert the raw email with status = pending
  const { data: email, error: insertError } = await sb
    .from("emails")
    .insert({
      user_id:           userId,
      subject,
      body,
      sender:            sender ?? null,
      source_message_id: source_message_id ?? null,
      processing_status: "pending",
    })
    .select()
    .single();

  if (insertError || !email) {
    logger.error({ insertError }, "Failed to insert email");
    res.status(500).json({ error: "Failed to store email", details: insertError?.message });
    return;
  }

  logger.info({ emailId: email.id }, "Email stored, running extraction");

  // 2. Run extraction and persist
  const extraction = await runExtractionAndSave(email.id, subject, body, userId);

  if (!extraction.ok) {
    res.status(422).json({
      email_id:          email.id,
      processing_status: "failed",
      error:             extraction.error,
    });
    return;
  }

  res.status(201).json({
    email_id:          email.id,
    processing_status: "processed",
    extracted:         extraction.data.extracted,
    saved:             extraction.data.saved,
  });
});

// ── POST /emails/extract ──────────────────────────────────────────────────

router.post("/emails/extract", requireAuth, async (req: Request, res: Response) => {
  const parse = ExtractBodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body", details: parse.error.issues });
    return;
  }

  const { email_id } = parse.data;
  const userId = req.userId;
  const sb = getSupabaseClient();

  // 1. Fetch existing email (scoped to this user)
  const { data: email, error: fetchError } = await sb
    .from("emails")
    .select("id, subject, body, user_id")
    .eq("id", email_id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  // 2. Delete previously extracted entities (scoped to this user)
  await deleteExtractedEntities(email_id, userId);

  // 3. Mark as pending before re-running (always scope to userId for defense-in-depth)
  await sb
    .from("emails")
    .update({ processing_status: "pending", extraction_error: null })
    .eq("id", email_id)
    .eq("user_id", userId);

  logger.info({ emailId: email_id }, "Re-running extraction");

  // 4. Run extraction and persist
  const extraction = await runExtractionAndSave(
    email.id,
    email.subject,
    email.body,
    userId
  );

  if (!extraction.ok) {
    res.status(422).json({
      email_id,
      processing_status: "failed",
      error:             extraction.error,
    });
    return;
  }

  res.json({
    email_id,
    processing_status: "processed",
    extracted:         extraction.data.extracted,
    saved:             extraction.data.saved,
  });
});

// ── GET /emails/:id ───────────────────────────────────────────────────────

router.get("/emails/:id", requireAuth, async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!id || !UUID_RE.test(id)) {
    res.status(400).json({ error: "Invalid email ID format" });
    return;
  }

  const userId = req.userId;
  const sb = getSupabaseClient();

  const [emailResult, eventsResult, deadlinesResult, actionItemsResult, notesResult] =
    await Promise.all([
      sb
        .from("emails")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single(),
      sb.from("events").select("*").eq("source_email_id", id).eq("user_id", userId).order("date"),
      sb.from("deadlines").select("*").eq("source_email_id", id).eq("user_id", userId).order("date"),
      sb.from("action_items").select("*").eq("source_email_id", id).eq("user_id", userId).order("due_date"),
      sb.from("notes").select("*").eq("source_email_id", id).eq("user_id", userId),
    ]);

  if (emailResult.error || !emailResult.data) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  res.json({
    email:        emailResult.data,
    events:       eventsResult.data       ?? [],
    deadlines:    deadlinesResult.data    ?? [],
    action_items: actionItemsResult.data  ?? [],
    notes:        notesResult.data        ?? [],
  });
});

export default router;
