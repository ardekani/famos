/**
 * Dev-only routes.
 *
 * These endpoints are intended for local development and testing only.
 * They should never be exposed in production.
 *
 * POST /api/dev/seed
 *   Inserts the 10 sample seed emails into the emails table.
 *   Optionally runs extraction on each email (slow — one OpenAI call per email).
 *
 * DELETE /api/dev/seed
 *   Removes all seeded emails (and their extracted entities via CASCADE).
 *   Identified by the "seeded: true" marker in raw_payload.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod/v4";
import { logger } from "../lib/logger.js";
import { getSupabaseClient } from "../lib/supabase.js";
import { runExtractionAndSave } from "../lib/process-email.js";
import { SEED_FIXTURES } from "../lib/dev-seeds.js";

const router = Router();

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

// We tag every seeded email row so we can cleanly wipe them later.
const SEED_MARKER = { seeded: true, source: "dev-seed-fixture" };

const SeedBodySchema = z.object({
  /** If true, run OpenAI extraction on each email after inserting. Slow. */
  process: z.boolean().default(false),
});

// ── POST /dev/seed ────────────────────────────────────────────────────────

router.post("/dev/seed", async (req: Request, res: Response) => {
  const parse = SeedBodySchema.safeParse(req.body ?? {});
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body", details: parse.error.issues });
    return;
  }

  const { process: shouldProcess } = parse.data;
  const sb = getSupabaseClient();
  const log = logger.child({ route: "POST /dev/seed" });

  log.info(
    { count: SEED_FIXTURES.length, process: shouldProcess },
    "Inserting seed fixtures"
  );

  const results: Array<{
    index: number;
    subject: string;
    email_id: string | null;
    inserted: boolean;
    processed: boolean;
    processing_status: "pending" | "processed" | "failed" | "skipped";
    error: string | null;
    expected: (typeof SEED_FIXTURES)[number]["expected"];
  }> = [];

  for (const [index, fixture] of SEED_FIXTURES.entries()) {
    // ── Insert raw email ────────────────────────────────────────────────
    const { data: email, error: insertError } = await sb
      .from("emails")
      .insert({
        user_id:           DEV_USER_ID,
        subject:           fixture.subject,
        body:              fixture.body,
        sender:            fixture.sender,
        processing_status: "pending",
        raw_payload:       SEED_MARKER,
      })
      .select("id")
      .single();

    if (insertError || !email) {
      log.error({ index, subject: fixture.subject, insertError }, "Failed to insert seed email");
      results.push({
        index,
        subject:            fixture.subject,
        email_id:           null,
        inserted:           false,
        processed:          false,
        processing_status:  "failed",
        error:              insertError?.message ?? "Unknown insert error",
        expected:           fixture.expected,
      });
      continue;
    }

    log.info({ index, emailId: email.id, subject: fixture.subject }, "Seed email inserted");

    // ── Optionally process ──────────────────────────────────────────────
    if (!shouldProcess) {
      results.push({
        index,
        subject:           fixture.subject,
        email_id:          email.id,
        inserted:          true,
        processed:         false,
        processing_status: "pending",
        error:             null,
        expected:          fixture.expected,
      });
      continue;
    }

    const processingResult = await runExtractionAndSave(
      email.id,
      fixture.subject,
      fixture.body,
      DEV_USER_ID
    );

    if (!processingResult.ok) {
      results.push({
        index,
        subject:           fixture.subject,
        email_id:          email.id,
        inserted:          true,
        processed:         false,
        processing_status: "failed",
        error:             processingResult.error,
        expected:          fixture.expected,
      });
    } else {
      const { saved } = processingResult.data;
      log.info(
        {
          index,
          emailId:     email.id,
          events:      saved.events.length,
          deadlines:   saved.deadlines.length,
          actionItems: saved.action_items.length,
          notes:       saved.notes.length,
        },
        "Seed email processed"
      );
      results.push({
        index,
        subject:           fixture.subject,
        email_id:          email.id,
        inserted:          true,
        processed:         true,
        processing_status: "processed",
        error:             null,
        expected:          fixture.expected,
      });
    }
  }

  const summary = {
    total:     results.length,
    inserted:  results.filter((r) => r.inserted).length,
    processed: results.filter((r) => r.processed).length,
    failed:    results.filter((r) => r.error !== null).length,
  };

  log.info({ summary }, "Seed complete");

  res.status(201).json({ summary, results });
});

// ── DELETE /dev/seed ──────────────────────────────────────────────────────

router.delete("/dev/seed", async (_req: Request, res: Response) => {
  const sb = getSupabaseClient();
  const log = logger.child({ route: "DELETE /dev/seed" });

  // Delete all emails tagged with the seed marker.
  // The ON DELETE CASCADE on events/deadlines/action_items/notes handles cleanup.
  const { data, error } = await sb
    .from("emails")
    .delete()
    .eq("user_id", DEV_USER_ID)
    .eq("raw_payload->>seeded", "true")
    .select("id");

  if (error) {
    log.error({ error }, "Failed to delete seed emails");
    res.status(500).json({ error: "Failed to delete seed emails", details: error.message });
    return;
  }

  const count = data?.length ?? 0;
  log.info({ count }, "Seed emails deleted");

  res.json({ deleted: count });
});

// ── GET /dev/seed ─────────────────────────────────────────────────────────
// List all seeded emails currently in the database.

router.get("/dev/seed", async (_req: Request, res: Response) => {
  const sb = getSupabaseClient();

  const { data, error } = await sb
    .from("emails")
    .select("id, subject, sender, processing_status, created_at")
    .eq("user_id", DEV_USER_ID)
    .eq("raw_payload->>seeded", "true")
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ count: data?.length ?? 0, emails: data ?? [] });
});

export default router;
