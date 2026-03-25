/**
 * TypeScript types for the email extraction pipeline.
 *
 * Flow:
 *   raw email → OpenAI → RawExtractionResult (unvalidated JSON)
 *             → validate → ValidatedExtractionResult (type-checked)
 *             → resolve children → ResolvedExtractionResult (child_id matched)
 *             → caller inserts into Supabase
 */

// ── Raw OpenAI output types ───────────────────────────────────────────────
// These mirror exactly what the model is asked to return.

export interface RawEvent {
  title: string;
  date: string | null;        // YYYY-MM-DD
  start_time: string | null;  // HH:MM (24h)
  end_time: string | null;
  location: string | null;
  description: string | null;
  child_name: string;         // "unknown" if not mentioned
  confidence: number | null;  // 0.0 – 1.0
}

export interface RawDeadline {
  title: string;
  date: string | null;        // YYYY-MM-DD
  description: string | null;
  child_name: string;
  confidence: number | null;
}

export interface RawActionItem {
  task: string;
  due_date: string | null;    // YYYY-MM-DD
  priority: "high" | "medium" | "low";
  child_name: string;
  confidence: number | null;
}

export interface RawNote {
  content: string;
  child_name: string;
}

/** The exact JSON shape expected from OpenAI */
export interface RawExtractionResult {
  events: RawEvent[];
  deadlines: RawDeadline[];
  action_items: RawActionItem[];
  notes: RawNote[];
}

// ── Resolved types (after child name → child_id matching) ─────────────────

export interface ResolvedEvent extends Omit<RawEvent, "child_name"> {
  child_id: string | null;
  raw_child_name: string | null;
}

export interface ResolvedDeadline extends Omit<RawDeadline, "child_name"> {
  child_id: string | null;
  raw_child_name: string | null;
}

export interface ResolvedActionItem extends Omit<RawActionItem, "child_name"> {
  child_id: string | null;
  raw_child_name: string | null;
}

export interface ResolvedNote extends Omit<RawNote, "child_name"> {
  child_id: string | null;
  raw_child_name: string | null;
}

export interface ResolvedExtractionResult {
  events: ResolvedEvent[];
  deadlines: ResolvedDeadline[];
  action_items: ResolvedActionItem[];
  notes: ResolvedNote[];
}

// ── Service result ────────────────────────────────────────────────────────

export type ExtractionServiceResult =
  | { success: true; data: ResolvedExtractionResult }
  | { success: false; error: string };

// ── Child reference (minimal shape needed for matching) ───────────────────

export interface ChildRef {
  id: string;
  name: string;
}
