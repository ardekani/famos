/**
 * Digest generation library.
 *
 * Fetches structured data from Supabase for a given user + date,
 * builds both a plain-text and JSON digest, and saves it to the digests table.
 */

import { getSupabaseClient } from "./supabase.js";
import { logger } from "./logger.js";

// ── Types (mirrors database schema) ──────────────────────────────────────

interface DbEvent {
  id: string;
  title: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  raw_child_name: string | null;
}

interface DbDeadline {
  id: string;
  title: string;
  date: string | null;
  raw_child_name: string | null;
}

interface DbActionItem {
  id: string;
  task: string;
  due_date: string | null;
  priority: "high" | "medium" | "low";
  completed: boolean;
  raw_child_name: string | null;
}

export interface DigestJson {
  date: string;
  generated_at: string;
  today: {
    events: DigestEvent[];
    deadlines: DigestDeadline[];
  };
  this_week: {
    events: DigestEvent[];
    deadlines: DigestDeadline[];
  };
  action_needed: DigestAction[];
  summary: {
    urgent_count: number;
    total_actions: number;
    is_calm: boolean;
  };
}

interface DigestEvent {
  title: string;
  date: string;
  time?: string;
  location?: string;
  child_name?: string;
}

interface DigestDeadline {
  title: string;
  date: string;
  child_name?: string;
}

interface DigestAction {
  task: string;
  priority: "high" | "medium" | "low";
  due_date: string | null;
  child_name: string | null;
}

export interface SavedDigest {
  id: string;
  user_id: string;
  digest_date: string;
  content_text: string;
  content_json: DigestJson;
  sent_at: string | null;
  created_at: string;
}

// ── Formatting helpers ────────────────────────────────────────────────────

const WEEKDAY_MONTH_DAY: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month:   "short",
  day:     "numeric",
  timeZone: "UTC",
};

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", WEEKDAY_MONTH_DAY);
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtLongDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
    year:    "numeric",
    timeZone: "UTC",
  });
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

/** Sunday of the week containing the given ISO date */
function weekEndOf(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0 = Sun
  const toSun = dow === 0 ? 0 : 7 - dow;
  d.setUTCDate(d.getUTCDate() + toSun);
  return d.toISOString().split("T")[0];
}

// ── Filtering rules ───────────────────────────────────────────────────────

const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 } as const;
const THREE_WEEKS_MS  = 21 * 24 * 60 * 60 * 1000;

/**
 * Returns true for action items that are "low-value":
 * - low priority with no due date
 * - low priority due more than 3 weeks out
 */
function isLowValue(item: DbActionItem, today: string): boolean {
  if (item.priority !== "low") return false;
  if (!item.due_date) return true;
  const diff = new Date(item.due_date).getTime() - new Date(today).getTime();
  return diff > THREE_WEEKS_MS;
}

function sortActions(items: DbActionItem[]): DbActionItem[] {
  return [...items].sort((a, b) => {
    const pw = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (pw !== 0) return pw;
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
}

// ── Text rendering ────────────────────────────────────────────────────────

function renderText(json: DigestJson): string {
  const lines: string[] = [
    `FamOS Daily Digest — ${fmtLongDate(json.date)}`,
    "",
  ];

  const rule = "─".repeat(44);

  // TODAY
  lines.push("TODAY", rule);
  const todayItems = [...json.today.events, ...json.today.deadlines];
  if (todayItems.length === 0) {
    lines.push("Nothing on the calendar today.");
  } else {
    for (const ev of json.today.events) {
      const time = ev.time ? ` at ${ev.time}` : "";
      const loc  = ev.location ? ` · ${ev.location}` : "";
      const who  = ev.child_name ? ` (${ev.child_name})` : "";
      lines.push(`📅 ${ev.title}${who}${time}${loc}`);
    }
    for (const dl of json.today.deadlines) {
      const who = dl.child_name ? ` (${dl.child_name})` : "";
      lines.push(`⏰ ${dl.title}${who} — due TODAY`);
    }
  }
  lines.push("");

  // THIS WEEK
  lines.push("THIS WEEK", rule);
  const weekItems = [...json.this_week.events, ...json.this_week.deadlines];
  if (weekItems.length === 0) {
    lines.push("No more events this week.");
  } else {
    for (const ev of json.this_week.events) {
      const time = ev.time ? ` at ${ev.time}` : "";
      const loc  = ev.location ? ` · ${ev.location}` : "";
      const who  = ev.child_name ? ` (${ev.child_name})` : "";
      lines.push(`📅 ${ev.title}${who} — ${fmtDate(ev.date)}${time}${loc}`);
    }
    for (const dl of json.this_week.deadlines) {
      const who = dl.child_name ? ` (${dl.child_name})` : "";
      lines.push(`⏰ ${dl.title}${who} — due ${fmtDate(dl.date)}`);
    }
  }
  lines.push("");

  // ACTION NEEDED
  lines.push("ACTION NEEDED", rule);
  if (json.action_needed.length === 0) {
    lines.push("No urgent school actions today.");
  } else {
    for (const a of json.action_needed) {
      const icon  = a.priority === "high" ? "⚠" : "•";
      const due   = a.due_date ? ` — due ${fmtDate(a.due_date)}` : "";
      const who   = a.child_name ? ` (${a.child_name})` : "";
      const badge = a.priority === "high" ? " [HIGH]" : "";
      lines.push(`${icon} ${a.task}${who}${due}${badge}`);
    }
  }
  lines.push("");
  lines.push(
    `Generated by FamOS · ${new Date(json.generated_at).toLocaleString("en-US", {
      month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    })}`
  );

  return lines.join("\n");
}

// ── HTML rendering (for email) ────────────────────────────────────────────

export function renderHtml(json: DigestJson): string {
  const sectionStyle = `font-size:14px;color:#374151;margin-bottom:24px;`;
  const headingStyle = `font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1;margin:0 0 12px;`;
  const itemStyle    = `padding:8px 0;border-bottom:1px solid #f3f4f6;display:flex;align-items:baseline;gap:8px;`;
  const pillHigh     = `display:inline-block;background:#fef2f2;color:#b91c1c;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700;`;
  const pillChild    = `display:inline-block;background:#eef2ff;color:#4338ca;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600;`;

  function evRows(evs: DigestEvent[], includeDate: boolean): string {
    return evs.map(ev => {
      const time  = ev.time ? `<span style="color:#6b7280;font-size:12px;">at ${ev.time}</span>` : "";
      const date  = includeDate ? `<span style="color:#6b7280;font-size:12px;">${fmtDate(ev.date)}</span>` : "";
      const who   = ev.child_name ? `<span style="${pillChild}">${ev.child_name}</span>` : "";
      const loc   = ev.location ? `<span style="color:#9ca3af;font-size:12px;">📍 ${ev.location}</span>` : "";
      return `<div style="${itemStyle}"><span>📅</span><span>${ev.title} ${date} ${time} ${loc} ${who}</span></div>`;
    }).join("");
  }

  function dlRows(dls: DigestDeadline[], includeDate: boolean): string {
    return dls.map(dl => {
      const date = includeDate ? `<span style="color:#d97706;font-size:12px;">due ${fmtDate(dl.date)}</span>` : `<span style="color:#d97706;font-size:12px;">due TODAY</span>`;
      const who  = dl.child_name ? `<span style="${pillChild}">${dl.child_name}</span>` : "";
      return `<div style="${itemStyle}"><span>⏰</span><span>${dl.title} ${date} ${who}</span></div>`;
    }).join("");
  }

  const todayItems = [...json.today.events, ...json.today.deadlines];
  const weekItems  = [...json.this_week.events, ...json.this_week.deadlines];

  const todaySection = todayItems.length === 0
    ? `<p style="color:#9ca3af;font-style:italic;">Nothing on the calendar today.</p>`
    : evRows(json.today.events, false) + dlRows(json.today.deadlines, false);

  const weekSection = weekItems.length === 0
    ? `<p style="color:#9ca3af;font-style:italic;">No more events this week.</p>`
    : evRows(json.this_week.events, true) + dlRows(json.this_week.deadlines, true);

  const actionSection = json.action_needed.length === 0
    ? `<p style="color:#9ca3af;font-style:italic;">No urgent school actions today. 🎉</p>`
    : json.action_needed.map(a => {
        const due   = a.due_date ? `<span style="color:#6b7280;font-size:12px;">due ${fmtDate(a.due_date)}</span>` : "";
        const who   = a.child_name ? `<span style="${pillChild}">${a.child_name}</span>` : "";
        const badge = a.priority === "high" ? `<span style="${pillHigh}">HIGH</span>` : "";
        const icon  = a.priority === "high" ? "⚠️" : "•";
        return `<div style="${itemStyle}"><span>${icon}</span><span>${a.task} ${due} ${who} ${badge}</span></div>`;
      }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
  <tr>
    <td style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:28px 32px;">
      <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">📋 FamOS Daily Digest</p>
      <p style="margin:4px 0 0;font-size:13px;color:#c7d2fe;">${fmtLongDate(json.date)}</p>
    </td>
  </tr>
  <tr><td style="padding:28px 32px;">

    <div style="${sectionStyle}">
      <p style="${headingStyle}">Today</p>
      ${todaySection}
    </div>

    <div style="${sectionStyle}">
      <p style="${headingStyle}">This Week</p>
      ${weekSection}
    </div>

    <div style="${sectionStyle}">
      <p style="${headingStyle}">Action Needed</p>
      ${actionSection}
    </div>

  </td></tr>
  <tr>
    <td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:16px 32px;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">
        Generated by <strong style="color:#6366f1;">FamOS</strong> ·
        ${new Date(json.generated_at).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Main generator ────────────────────────────────────────────────────────

/**
 * Generate a digest for a given user and date (defaults to today UTC).
 * Saves to the digests table and returns the saved record.
 */
export async function generateDigest(
  userId: string,
  targetDate?: string
): Promise<SavedDigest> {
  const sb      = getSupabaseClient();
  const today   = targetDate ?? new Date().toISOString().split("T")[0];
  const tomorrow = addDays(today, 1);
  const weekEnd  = weekEndOf(today);

  logger.info({ userId, today, weekEnd }, "Generating digest");

  // ── Fetch data in parallel ──
  const [eventsResult, deadlinesResult, actionsResult] = await Promise.all([
    sb
      .from("events")
      .select("id,title,date,start_time,end_time,location,raw_child_name")
      .eq("user_id", userId)
      .gte("date", today)
      .lte("date", weekEnd)
      .order("date")
      .order("start_time"),
    sb
      .from("deadlines")
      .select("id,title,date,raw_child_name")
      .eq("user_id", userId)
      .gte("date", today)
      .lte("date", weekEnd)
      .order("date"),
    sb
      .from("action_items")
      .select("id,task,due_date,priority,completed,raw_child_name")
      .eq("user_id", userId)
      .eq("completed", false),
  ]);

  if (eventsResult.error)    throw eventsResult.error;
  if (deadlinesResult.error) throw deadlinesResult.error;
  if (actionsResult.error)   throw actionsResult.error;

  const allEvents    = (eventsResult.data    ?? []) as DbEvent[];
  const allDeadlines = (deadlinesResult.data ?? []) as DbDeadline[];
  const allActions   = (actionsResult.data   ?? []) as DbActionItem[];

  // ── Partition today vs rest of week ──
  const todayEvents    = allEvents.filter(e => e.date === today);
  const weekEvents     = allEvents.filter(e => e.date && e.date >= tomorrow && e.date <= weekEnd);
  const todayDeadlines = allDeadlines.filter(d => d.date === today);
  const weekDeadlines  = allDeadlines.filter(d => d.date && d.date >= tomorrow && d.date <= weekEnd);

  // ── Filter & sort action items ──
  const filteredActions = sortActions(
    allActions.filter(a => !isLowValue(a, today))
  );

  // ── Map to clean shapes ──
  function mapEvent(e: DbEvent): DigestEvent {
    return {
      title:      e.title,
      date:       e.date ?? today,
      ...(e.start_time && { time: fmtTime(e.start_time) }),
      ...(e.location    && { location: e.location }),
      ...(e.raw_child_name && { child_name: e.raw_child_name }),
    };
  }

  function mapDeadline(d: DbDeadline): DigestDeadline {
    return {
      title:     d.title,
      date:      d.date ?? today,
      ...(d.raw_child_name && { child_name: d.raw_child_name }),
    };
  }

  function mapAction(a: DbActionItem): DigestAction {
    return {
      task:       a.task,
      priority:   a.priority,
      due_date:   a.due_date,
      child_name: a.raw_child_name,
    };
  }

  const urgentCount = filteredActions.filter(a => a.priority === "high").length;

  const digestJson: DigestJson = {
    date:         today,
    generated_at: new Date().toISOString(),
    today: {
      events:    todayEvents.map(mapEvent),
      deadlines: todayDeadlines.map(mapDeadline),
    },
    this_week: {
      events:    weekEvents.map(mapEvent),
      deadlines: weekDeadlines.map(mapDeadline),
    },
    action_needed: filteredActions.map(mapAction),
    summary: {
      urgent_count:  urgentCount,
      total_actions: filteredActions.length,
      is_calm:       filteredActions.length === 0,
    },
  };

  const contentText = renderText(digestJson);

  // ── Save to digests table (upsert so re-generating the same day replaces the old one) ──
  const { data, error } = await sb
    .from("digests")
    .upsert(
      {
        user_id:      userId,
        digest_date:  today,
        content_text: contentText,
        content_json: digestJson as unknown as Record<string, unknown>,
        sent_at:      null,
      },
      { onConflict: "user_id,digest_date" }
    )
    .select()
    .single();

  if (error || !data) {
    logger.error({ error }, "Failed to save digest");
    throw error ?? new Error("No data returned from insert");
  }

  logger.info({ digestId: data.id }, "Digest saved");
  return data as SavedDigest;
}
