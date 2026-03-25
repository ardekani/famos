/**
 * Zod schemas for validating the raw JSON returned by OpenAI.
 *
 * Uses .safeParse() throughout so malformed model output never crashes
 * the server — errors are surfaced as typed failure results instead.
 */

import { z } from "zod/v4";
import type { RawExtractionResult } from "./types.js";

// ── Field-level schemas ───────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const time24  = z.string().regex(/^\d{2}:\d{2}$/).nullable();
const confidence = z.number().min(0).max(1).nullable();
const childName  = z.string().min(1).default("unknown");

// ── Per-item schemas ──────────────────────────────────────────────────────

const RawEventSchema = z.object({
  title:       z.string().min(1),
  date:        isoDate.optional().default(null),
  start_time:  time24.optional().default(null),
  end_time:    time24.optional().default(null),
  location:    z.string().nullable().optional().default(null),
  description: z.string().nullable().optional().default(null),
  child_name:  childName,
  confidence:  confidence.optional().default(null),
});

const RawDeadlineSchema = z.object({
  title:       z.string().min(1),
  date:        isoDate.optional().default(null),
  description: z.string().nullable().optional().default(null),
  child_name:  childName,
  confidence:  confidence.optional().default(null),
});

const RawActionItemSchema = z.object({
  task:       z.string().min(1),
  due_date:   isoDate.optional().default(null),
  priority:   z.enum(["high", "medium", "low"]).default("medium"),
  child_name: childName,
  confidence: confidence.optional().default(null),
});

const RawNoteSchema = z.object({
  content:    z.string().min(1),
  child_name: childName,
});

// ── Top-level schema ──────────────────────────────────────────────────────

const RawExtractionResultSchema = z.object({
  events:       z.array(RawEventSchema).default([]),
  deadlines:    z.array(RawDeadlineSchema).default([]),
  action_items: z.array(RawActionItemSchema).default([]),
  notes:        z.array(RawNoteSchema).default([]),
});

// ── Validation function ───────────────────────────────────────────────────

export type ValidationResult =
  | { ok: true;  data: RawExtractionResult }
  | { ok: false; error: string };

/**
 * Safely parse the raw string output from OpenAI into a validated result.
 * Strips markdown code fences if the model wraps its output in them.
 * Never throws — always returns a typed success or failure.
 */
export function validateExtractionOutput(raw: string): ValidationResult {
  // Strip markdown code fences (```json ... ```) if present
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return {
      ok: false,
      error: `Model returned invalid JSON: ${stripped.slice(0, 200)}`,
    };
  }

  const result = RawExtractionResultSchema.safeParse(parsed);

  if (!result.success) {
    return {
      ok: false,
      error: `Extraction schema validation failed: ${result.error.message}`,
    };
  }

  return { ok: true, data: result.data as RawExtractionResult };
}
