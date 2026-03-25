/**
 * Core email extraction service.
 *
 * Takes a school email and a list of the user's children, calls OpenAI
 * with the structured extraction prompt, validates the response, resolves
 * child names to child IDs, and returns a typed result.
 *
 * This function is pure — it does not touch the database.
 * The caller is responsible for persisting the result and updating
 * the email's processing_status.
 *
 * Usage:
 *   const result = await extractFromEmail({ emailId, subject, body, userId, children });
 *   if (result.success) {
 *     // insert result.data.events, deadlines, etc. into Supabase
 *   } else {
 *     // store result.error on the email record
 *   }
 */

import OpenAI from "openai";
import { logger } from "../logger.js";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";
import { validateExtractionOutput } from "./validate.js";
import type {
  ChildRef,
  ExtractionServiceResult,
  RawExtractionResult,
  ResolvedEvent,
  ResolvedDeadline,
  ResolvedActionItem,
  ResolvedNote,
  ResolvedExtractionResult,
} from "./types.js";

// ── OpenAI client (lazy singleton) ────────────────────────────────────────

let _openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set.");
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// ── Child name resolution ─────────────────────────────────────────────────

/**
 * Match a raw child name string to a known child record.
 * Uses case-insensitive exact matching.
 * Returns null for both fields when the name is "unknown" or empty.
 */
function resolveChildName(
  rawName: string,
  children: ChildRef[]
): { childId: string | null; rawChildName: string | null } {
  const normalized = rawName.trim().toLowerCase();

  if (!normalized || normalized === "unknown") {
    return { childId: null, rawChildName: null };
  }

  const match = children.find((c) => c.name.trim().toLowerCase() === normalized);

  return {
    childId:      match?.id ?? null,
    rawChildName: rawName, // always preserve the original for debugging
  };
}

// ── Resolution helpers ────────────────────────────────────────────────────

function resolveEvents(
  raw: RawExtractionResult["events"],
  children: ChildRef[]
): ResolvedEvent[] {
  return raw.map(({ child_name, ...rest }) => {
    const { childId, rawChildName } = resolveChildName(child_name, children);
    return { ...rest, child_id: childId, raw_child_name: rawChildName };
  });
}

function resolveDeadlines(
  raw: RawExtractionResult["deadlines"],
  children: ChildRef[]
): ResolvedDeadline[] {
  return raw.map(({ child_name, ...rest }) => {
    const { childId, rawChildName } = resolveChildName(child_name, children);
    return { ...rest, child_id: childId, raw_child_name: rawChildName };
  });
}

function resolveActionItems(
  raw: RawExtractionResult["action_items"],
  children: ChildRef[]
): ResolvedActionItem[] {
  return raw.map(({ child_name, ...rest }) => {
    const { childId, rawChildName } = resolveChildName(child_name, children);
    return { ...rest, child_id: childId, raw_child_name: rawChildName };
  });
}

function resolveNotes(
  raw: RawExtractionResult["notes"],
  children: ChildRef[]
): ResolvedNote[] {
  return raw.map(({ child_name, ...rest }) => {
    const { childId, rawChildName } = resolveChildName(child_name, children);
    return { ...rest, child_id: childId, raw_child_name: rawChildName };
  });
}

// ── Main extraction function ──────────────────────────────────────────────

export interface ExtractFromEmailParams {
  /** The internal email ID (used for logging only) */
  emailId: string;
  subject: string;
  body: string;
  userId: string;
  /** Children already fetched for this user — used for name resolution */
  children: ChildRef[];
  /** OpenAI model to use. Defaults to gpt-4o-mini for cost efficiency. */
  model?: string;
}

/**
 * Extract structured school information from an email using OpenAI.
 * Always returns a typed result — never throws.
 */
export async function extractFromEmail(
  params: ExtractFromEmailParams
): Promise<ExtractionServiceResult> {
  const {
    emailId,
    subject,
    body,
    children,
    model = "gpt-4o-mini",
  } = params;

  const log = logger.child({ emailId, service: "extraction" });

  log.info({ model, childCount: children.length }, "Starting email extraction");

  // ── 1. Call OpenAI ──────────────────────────────────────────────────────

  let rawContent: string;

  try {
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model,
      temperature: 0,        // deterministic output
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system",  content: SYSTEM_PROMPT },
        { role: "user",    content: buildUserMessage(subject, body) },
      ],
    });

    rawContent = response.choices[0]?.message?.content ?? "";

    log.info(
      { tokens: response.usage?.total_tokens },
      "OpenAI call complete"
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err }, "OpenAI API call failed");
    return { success: false, error: `OpenAI API error: ${message}` };
  }

  // ── 2. Validate JSON response ───────────────────────────────────────────

  const validation = validateExtractionOutput(rawContent);

  if (!validation.ok) {
    log.warn({ raw: rawContent.slice(0, 500) }, "Validation failed");
    return { success: false, error: validation.error };
  }

  const raw = validation.data;

  log.info(
    {
      events:       raw.events.length,
      deadlines:    raw.deadlines.length,
      action_items: raw.action_items.length,
      notes:        raw.notes.length,
    },
    "Extraction validated"
  );

  // ── 3. Resolve child names to IDs ──────────────────────────────────────

  const resolved: ResolvedExtractionResult = {
    events:       resolveEvents(raw.events, children),
    deadlines:    resolveDeadlines(raw.deadlines, children),
    action_items: resolveActionItems(raw.action_items, children),
    notes:        resolveNotes(raw.notes, children),
  };

  return { success: true, data: resolved };
}
