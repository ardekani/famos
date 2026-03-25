/**
 * TypeScript types for the FamOS database schema.
 * These mirror the Supabase/PostgreSQL tables defined in supabase/schema.sql.
 * Keep in sync when the schema changes.
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export type ProcessingStatus = "pending" | "processed" | "failed";
export type ActionPriority = "high" | "medium" | "low";

// ── Table row types ────────────────────────────────────────────────────────
// These match what Supabase returns from SELECT queries.

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Child {
  id: string;
  user_id: string;
  name: string;
  school_name: string | null;
  created_at: string;
}

export interface Email {
  id: string;
  user_id: string;
  source_message_id: string | null;
  subject: string;
  body: string;
  sender: string | null;
  received_at: string;
  raw_payload: Record<string, unknown> | null;
  processing_status: ProcessingStatus;
  extraction_error: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  user_id: string;
  child_id: string | null;
  source_email_id: string;
  title: string;
  date: string | null;       // ISO date string: "2026-03-27"
  start_time: string | null; // "HH:MM:SS"
  end_time: string | null;
  location: string | null;
  description: string | null;
  confidence: number | null; // 0.0 – 1.0
  raw_child_name: string | null;
  created_at: string;
}

export interface Deadline {
  id: string;
  user_id: string;
  child_id: string | null;
  source_email_id: string;
  title: string;
  date: string | null;
  description: string | null;
  confidence: number | null;
  raw_child_name: string | null;
  created_at: string;
}

export interface ActionItem {
  id: string;
  user_id: string;
  child_id: string | null;
  source_email_id: string;
  task: string;
  due_date: string | null;
  priority: ActionPriority;
  completed: boolean;
  confidence: number | null;
  raw_child_name: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  child_id: string | null;
  source_email_id: string;
  content: string;
  raw_child_name: string | null;
  created_at: string;
}

export interface Digest {
  id: string;
  user_id: string;
  digest_date: string;
  content_text: string;
  content_json: Record<string, unknown> | null;
  sent_at: string | null;
  created_at: string;
}

// ── Insert types ───────────────────────────────────────────────────────────
// Omit auto-generated fields when inserting rows.

export type InsertUser       = Omit<User,       "id" | "created_at">;
export type InsertChild      = Omit<Child,      "id" | "created_at">;
export type InsertEmail      = Omit<Email,      "id" | "created_at">;
export type InsertEvent      = Omit<Event,      "id" | "created_at">;
export type InsertDeadline   = Omit<Deadline,   "id" | "created_at">;
export type InsertActionItem = Omit<ActionItem, "id" | "created_at">;
export type InsertNote       = Omit<Note,       "id" | "created_at">;
export type InsertDigest     = Omit<Digest,     "id" | "created_at">;

// ── Joined / view types ───────────────────────────────────────────────────
// Convenience types for common joined queries.

/** Event with its matched child name resolved */
export interface EventWithChild extends Event {
  child: Pick<Child, "id" | "name"> | null;
}

/** ActionItem with its matched child name resolved */
export interface ActionItemWithChild extends ActionItem {
  child: Pick<Child, "id" | "name"> | null;
}

/** Email with all extracted items attached */
export interface EmailWithExtractions extends Email {
  events: Event[];
  deadlines: Deadline[];
  action_items: ActionItem[];
  notes: Note[];
}

/** Dashboard summary for a given week */
export interface WeekSummary {
  events: EventWithChild[];
  deadlines: Deadline[];
  action_items: ActionItemWithChild[];
}
