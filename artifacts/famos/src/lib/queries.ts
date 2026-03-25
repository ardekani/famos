/**
 * Typed query helpers for the FamOS database.
 *
 * Every function accepts a userId so queries are always scoped to the
 * current user. Returns typed results from database.ts.
 */

import { supabase } from "./supabase";
import type {
  Child,
  Email,
  Event,
  Deadline,
  ActionItem,
  Note,
  EventWithChild,
  ActionItemWithChild,
  WeekSummary,
  EmailWithExtractions,
  InsertEmail,
  InsertEvent,
  InsertDeadline,
  InsertActionItem,
  InsertNote,
} from "@/types/database";

// ── Helper ────────────────────────────────────────────────────────────────

function requireClient() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file."
    );
  }
  return supabase;
}

// ── Children ──────────────────────────────────────────────────────────────

/** Fetch all children for a user */
export async function getChildren(userId: string): Promise<Child[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("children")
    .select("*")
    .eq("user_id", userId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

// ── Emails ────────────────────────────────────────────────────────────────

/** Fetch emails for a user, newest first */
export async function getEmails(userId: string, limit = 20): Promise<Email[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("emails")
    .select("*")
    .eq("user_id", userId)
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Fetch a single email with all its extracted items */
export async function getEmailWithExtractions(
  emailId: string
): Promise<EmailWithExtractions | null> {
  const db = requireClient();
  const { data, error } = await db
    .from("emails")
    .select(
      `
      *,
      events(*),
      deadlines(*),
      action_items(*),
      notes(*)
    `
    )
    .eq("id", emailId)
    .single();
  if (error) throw error;
  return data as EmailWithExtractions | null;
}

/** Insert a new inbound email */
export async function insertEmail(email: InsertEmail): Promise<Email> {
  const db = requireClient();
  const { data, error } = await db.from("emails").insert(email).select().single();
  if (error) throw error;
  return data as Email;
}

/** Update email processing status */
export async function updateEmailStatus(
  emailId: string,
  status: "pending" | "processed" | "failed",
  extractionError?: string
): Promise<void> {
  const db = requireClient();
  const { error } = await db
    .from("emails")
    .update({
      processing_status: status,
      extraction_error: extractionError ?? null,
    })
    .eq("id", emailId);
  if (error) throw error;
}

// ── Events ────────────────────────────────────────────────────────────────

/**
 * Fetch events in a date range, with child info joined.
 * Dates should be ISO strings: "2026-03-24"
 */
export async function getEvents(
  userId: string,
  from: string,
  to: string
): Promise<EventWithChild[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("events")
    .select("*, child:children(id, name)")
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .order("start_time");
  if (error) throw error;
  return (data ?? []) as EventWithChild[];
}

/** Insert extracted events for an email */
export async function insertEvents(events: InsertEvent[]): Promise<Event[]> {
  const db = requireClient();
  const { data, error } = await db.from("events").insert(events).select();
  if (error) throw error;
  return data ?? [];
}

// ── Deadlines ─────────────────────────────────────────────────────────────

/** Fetch upcoming deadlines for a user in a date range */
export async function getDeadlines(
  userId: string,
  from: string,
  to: string
): Promise<Deadline[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("deadlines")
    .select("*")
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to)
    .order("date");
  if (error) throw error;
  return data ?? [];
}

/** Insert extracted deadlines for an email */
export async function insertDeadlines(
  deadlines: InsertDeadline[]
): Promise<Deadline[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("deadlines")
    .insert(deadlines)
    .select();
  if (error) throw error;
  return data ?? [];
}

// ── Action items ──────────────────────────────────────────────────────────

/**
 * Fetch open (not completed) action items for a user.
 * Sorted client-side by priority weight (high → medium → low) then due date.
 */
export async function getOpenActionItems(
  userId: string
): Promise<ActionItemWithChild[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("action_items")
    .select("*, child:children(id, name)")
    .eq("user_id", userId)
    .eq("completed", false)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;

  const priorityWeight = { high: 0, medium: 1, low: 2 };
  return ((data ?? []) as ActionItemWithChild[]).sort(
    (a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]
  );
}

/** Mark an action item as completed */
export async function completeActionItem(itemId: string): Promise<void> {
  const db = requireClient();
  const { error } = await db
    .from("action_items")
    .update({ completed: true })
    .eq("id", itemId);
  if (error) throw error;
}

/** Insert extracted action items for an email */
export async function insertActionItems(
  items: InsertActionItem[]
): Promise<ActionItem[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("action_items")
    .insert(items)
    .select();
  if (error) throw error;
  return data ?? [];
}

// ── Notes ─────────────────────────────────────────────────────────────────

/** Fetch notes extracted from a specific email */
export async function getNotesByEmail(emailId: string): Promise<Note[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("notes")
    .select("*")
    .eq("source_email_id", emailId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

/** Insert extracted notes for an email */
export async function insertNotes(notes: InsertNote[]): Promise<Note[]> {
  const db = requireClient();
  const { data, error } = await db.from("notes").insert(notes).select();
  if (error) throw error;
  return data ?? [];
}

// ── Dashboard / Week summary ──────────────────────────────────────────────

/**
 * Fetch everything needed for the dashboard in one shot.
 * events + deadlines cover weekStart → deadlineHorizon (4 weeks out).
 * action_items are always all open items regardless of date.
 */
export async function getDashboardData(
  userId: string,
  weekStart: string,
  weekEnd: string,
  deadlineHorizon: string
): Promise<WeekSummary & { upcomingDeadlines: Deadline[]; recentEmails: Email[] }> {
  const [events, weekDeadlines, upcomingDeadlines, action_items, recentEmails] =
    await Promise.all([
      getEvents(userId, weekStart, weekEnd),
      getDeadlines(userId, weekStart, weekEnd),
      getDeadlines(userId, weekStart, deadlineHorizon),
      getOpenActionItems(userId),
      getEmails(userId, 6),
    ]);

  return {
    events,
    deadlines: weekDeadlines,
    upcomingDeadlines,
    action_items,
    recentEmails,
  };
}

/** @deprecated Use getDashboardData instead */
export async function getWeekSummary(
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeekSummary> {
  const [events, deadlines, action_items] = await Promise.all([
    getEvents(userId, weekStart, weekEnd),
    getDeadlines(userId, weekStart, weekEnd),
    getOpenActionItems(userId),
  ]);
  return { events, deadlines, action_items };
}
