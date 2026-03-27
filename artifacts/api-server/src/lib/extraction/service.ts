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
import { filterActionItems } from "./filter.js";
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
 * Levenshtein distance between two strings (case-insensitive).
 * Returns a count of single-character edits.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Match a raw child name string to a known child record using a tiered
 * strategy (fastest / most precise first):
 *
 *  Tier 1 — Exact match (case-insensitive)
 *           "Emma Johnson" → "emma johnson"
 *
 *  Tier 2 — First-name match
 *           "Emma" → child whose first name token is "Emma"
 *           OR child "Emma Johnson" whose first token matches extracted name
 *
 *  Tier 3 — Substring containment
 *           "Emma" contained in "Emma Johnson", or vice-versa
 *
 *  Tier 4 — Fuzzy (Levenshtein ≤ 2) on any name token
 *           "Emm" or "Emmma" → "Emma"
 *
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

  // Tier 1: exact
  const exact = children.find((c) => c.name.trim().toLowerCase() === normalized);
  if (exact) return { childId: exact.id, rawChildName: rawName };

  // Tier 2: first-name match
  const firstNameMatch = children.find((c) => {
    const childFirst = c.name.trim().toLowerCase().split(/\s+/)[0];
    const rawFirst   = normalized.split(/\s+/)[0];
    return childFirst === normalized || rawFirst === childFirst;
  });
  if (firstNameMatch) return { childId: firstNameMatch.id, rawChildName: rawName };

  // Tier 3: substring containment (e.g. "Emma" in "Emma Johnson")
  const substringMatch = children.find((c) => {
    const cn = c.name.trim().toLowerCase();
    return cn.includes(normalized) || normalized.includes(cn);
  });
  if (substringMatch) return { childId: substringMatch.id, rawChildName: rawName };

  // Tier 4: fuzzy on any name token (Levenshtein ≤ 2, tokens must be ≥ 4 chars)
  const rawTokens   = normalized.split(/\s+/);
  const fuzzyMatch  = children.find((c) => {
    const childTokens = c.name.trim().toLowerCase().split(/\s+/);
    return childTokens.some((ct) =>
      rawTokens.some((rt) => ct.length >= 4 && rt.length >= 4 && levenshtein(ct, rt) <= 2)
    );
  });
  if (fuzzyMatch) return { childId: fuzzyMatch.id, rawChildName: rawName };

  // No match — preserve raw for debugging
  return { childId: null, rawChildName: rawName };
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
    model = "gpt-5.4-nano",
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
      max_completion_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system",  content: SYSTEM_PROMPT },
        { role: "user",    content: buildUserMessage(subject, body, children.map((c) => c.name)) },
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

  // ── 3. Post-process: filter noisy action items ─────────────────────────

  const filtered = filterActionItems(raw);

  log.info(
    {
      action_items_before: raw.action_items.length,
      action_items_after:  filtered.action_items.length,
      notes_added:         filtered.notes.length - raw.notes.length,
    },
    "Action item filtering complete"
  );

  // ── 4. Resolve child names to IDs ──────────────────────────────────────

  const resolved: ResolvedExtractionResult = {
    events:       resolveEvents(filtered.events, children),
    deadlines:    resolveDeadlines(filtered.deadlines, children),
    action_items: resolveActionItems(filtered.action_items, children),
    notes:        resolveNotes(filtered.notes, children),
  };

  return { success: true, data: resolved };
}
