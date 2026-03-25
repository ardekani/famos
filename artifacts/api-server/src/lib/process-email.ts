/**
 * Shared email processing utility.
 *
 * Extracted from routes/emails.ts so both the ingest route and the
 * dev/seed route can reuse the same extraction + persistence logic.
 *
 * Callers are responsible for:
 *   1. Inserting the raw email row (with status = 'pending')
 *   2. Calling this function with the resulting email ID
 *   3. Handling the returned result (e.g. responding to the client)
 */

import { getSupabaseClient } from "./supabase.js";
import { extractFromEmail } from "./extraction/index.js";
import type { ResolvedExtractionResult } from "./extraction/index.js";

// ── Child fetching ─────────────────────────────────────────────────────────

export async function fetchChildren(userId: string) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("children")
    .select("id, name")
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to fetch children: ${error.message}`);
  return data ?? [];
}

// ── Entity persistence ─────────────────────────────────────────────────────

export async function saveExtractedEntities(
  userId: string,
  emailId: string,
  data: ResolvedExtractionResult
) {
  const sb = getSupabaseClient();

  const [events, deadlines, actionItems, notes] = await Promise.all([
    data.events.length > 0
      ? sb
          .from("events")
          .insert(
            data.events.map((e) => ({
              user_id:         userId,
              source_email_id: emailId,
              child_id:        e.child_id,
              raw_child_name:  e.raw_child_name,
              title:           e.title,
              date:            e.date,
              start_time:      e.start_time,
              end_time:        e.end_time,
              location:        e.location,
              description:     e.description,
              confidence:      e.confidence,
            }))
          )
          .select()
      : Promise.resolve({ data: [], error: null }),

    data.deadlines.length > 0
      ? sb
          .from("deadlines")
          .insert(
            data.deadlines.map((d) => ({
              user_id:         userId,
              source_email_id: emailId,
              child_id:        d.child_id,
              raw_child_name:  d.raw_child_name,
              title:           d.title,
              date:            d.date,
              description:     d.description,
              confidence:      d.confidence,
            }))
          )
          .select()
      : Promise.resolve({ data: [], error: null }),

    data.action_items.length > 0
      ? sb
          .from("action_items")
          .insert(
            data.action_items.map((a) => ({
              user_id:         userId,
              source_email_id: emailId,
              child_id:        a.child_id,
              raw_child_name:  a.raw_child_name,
              task:            a.task,
              due_date:        a.due_date,
              priority:        a.priority,
              confidence:      a.confidence,
            }))
          )
          .select()
      : Promise.resolve({ data: [], error: null }),

    data.notes.length > 0
      ? sb
          .from("notes")
          .insert(
            data.notes.map((n) => ({
              user_id:         userId,
              source_email_id: emailId,
              child_id:        n.child_id,
              raw_child_name:  n.raw_child_name,
              content:         n.content,
            }))
          )
          .select()
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [events, deadlines, actionItems, notes]) {
    if (result.error) {
      throw new Error(`Failed to save extracted entities: ${result.error.message}`);
    }
  }

  return {
    events:       events.data       ?? [],
    deadlines:    deadlines.data    ?? [],
    action_items: actionItems.data  ?? [],
    notes:        notes.data        ?? [],
  };
}

// ── Delete entities ────────────────────────────────────────────────────────

/**
 * Delete all extracted entities for a given email.
 * userId is required to ensure we never touch another user's rows —
 * even if the caller passes an email_id that belongs to someone else.
 */
export async function deleteExtractedEntities(emailId: string, userId: string) {
  const sb = getSupabaseClient();
  await Promise.all([
    sb.from("events").delete().eq("source_email_id", emailId).eq("user_id", userId),
    sb.from("deadlines").delete().eq("source_email_id", emailId).eq("user_id", userId),
    sb.from("action_items").delete().eq("source_email_id", emailId).eq("user_id", userId),
    sb.from("notes").delete().eq("source_email_id", emailId).eq("user_id", userId),
  ]);
}

// ── Main: run extraction and persist ──────────────────────────────────────

export type ProcessEmailResult =
  | { ok: true;  data: { extracted: ResolvedExtractionResult; saved: ReturnType<typeof saveExtractedEntities> extends Promise<infer T> ? T : never } }
  | { ok: false; error: string };

export async function runExtractionAndSave(
  emailId: string,
  subject: string,
  body: string,
  userId: string
): Promise<ProcessEmailResult> {
  const sb = getSupabaseClient();
  const children = await fetchChildren(userId);

  const result = await extractFromEmail({
    emailId,
    subject,
    body,
    userId,
    children,
  });

  if (!result.success) {
    await sb
      .from("emails")
      .update({ processing_status: "failed", extraction_error: result.error })
      .eq("id", emailId)
      .eq("user_id", userId);

    return { ok: false, error: result.error };
  }

  const saved = await saveExtractedEntities(userId, emailId, result.data);

  await sb
    .from("emails")
    .update({ processing_status: "processed", extraction_error: null })
    .eq("id", emailId)
    .eq("user_id", userId);

  return { ok: true, data: { extracted: result.data, saved } };
}
