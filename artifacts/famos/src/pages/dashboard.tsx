/**
 * Dashboard — your school command center.
 *
 * Layout:
 *   1. Header           — greeting, date
 *   2. Week at a Glance — stat summary card
 *   3. OnboardingBanner — setup steps for new users
 *   4. Action Needed    — open action items, checkable, sorted by urgency
 *   5. This Week        — merged events + deadlines timeline (including today)
 *   6. By Child         — per-child summary cards
 *   7. School Emails    — recent emails, quiet/secondary
 *   8. Daily Digest     — generate/send utility
 */

import React, { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Circle,
  Mail,
  ChevronRight,
  Inbox,
  PartyPopper,
  CalendarX,
  FileText,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Send,
  Users,
  GraduationCap,
  ShoppingBag,
} from "lucide-react";
import {
  getDashboardData,
  completeActionItem,
  getLatestDigest,
  getChildren,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type {
  EventWithChild,
  Deadline,
  ActionItemWithChild,
  Email,
  Child,
} from "@/types/database";
import { Link } from "wouter";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";

// ── Date utilities ─────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function shiftDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function weekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function weekEnd(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function formatDate(iso: string | null): string {
  if (!iso) return "No date";
  const today = todayISO();
  const tomorrow = shiftDate(1);
  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 2)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Shared components ──────────────────────────────────────────────────────

function SectionHeading({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
        {label}
      </h2>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
          {count}
        </span>
      )}
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card shadow-xs ${className}`}>
      {children}
    </div>
  );
}

function ChildTag({ name }: { name: string | null | undefined }) {
  if (!name) return null;
  return (
    <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
      {name}
    </span>
  );
}

function EmptyState({
  icon,
  heading,
  sub,
}: {
  icon: React.ReactNode;
  heading: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
      <div className="mb-3 text-muted-foreground/30">{icon}</div>
      <p className="text-sm font-medium text-muted-foreground">{heading}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground/70">{sub}</p>}
    </div>
  );
}

// ── Action item categorization ─────────────────────────────────────────────
// Defined early so WeekGlanceCard can use it.

type ActionCategory = "must_do" | "bring_prepare" | "optional";

const MUST_DO_PATTERNS: RegExp[] = [
  /\bsign\b/i,
  /\breturn\b/i,
  /\bsubmit\b/i,
  /\bcomplete\b/i,
  /\bfill\s*(out|in)\b/i,
  /\bpermission\b/i,
  /\bform\b/i,
  /\bslip\b/i,
  /\brsvp\b/i,
  /\bregister\b/i,
  /\benrol(l)?\b/i,
  /\bsign\s*up\b/i,
  /\bpay\b/i,
  /\bpayment\b/i,
  /\bfee\b/i,
  /\bdeadline\b/i,
  /\$\d/,
  /\bmoney\b/i,
  /\bcash\b/i,
];

const BRING_PREPARE_PATTERNS: RegExp[] = [
  /\bbring\b/i,
  /\bpack(ed)?\b/i,
  /\bsend\b/i,
  /\bprepare\b/i,
  /\bprovide\b/i,
  /\blunch(es)?\b/i,
  /\bsnacks?\b/i,
  /\bwater\s*bottle\b/i,
  /\bswimsuit\b/i,
  /\btowel\b/i,
  /\bshoes?\b/i,
  /\buniform\b/i,
  /\bjacket\b/i,
  /\bcoat\b/i,
  /\bsuppl(y|ies)\b/i,
  /\bgear\b/i,
  /\bequipment\b/i,
  /\bcostume\b/i,
  /\binstrument\b/i,
  /\bbackpack\b/i,
  /\bkit\b/i,
  /\bbag\b/i,
  /\bfood\b/i,
  /\bdrink\b/i,
];

function categorizeAction(item: ActionItemWithChild): ActionCategory {
  if (item.priority === "low") return "optional";
  const task = item.task;
  if (MUST_DO_PATTERNS.some((re) => re.test(task))) return "must_do";
  if (BRING_PREPARE_PATTERNS.some((re) => re.test(task))) return "bring_prepare";
  return item.priority === "high" ? "must_do" : "bring_prepare";
}

// ── Section: Week at a Glance ──────────────────────────────────────────────

function WeekGlanceCard({
  events,
  deadlines,
  actionItems,
  weekLabel,
}: {
  events: EventWithChild[];
  deadlines: Deadline[];
  actionItems: ActionItemWithChild[];
  weekLabel: string;
}) {
  const today = todayISO();

  const mustDo  = actionItems.filter((a) => categorizeAction(a) === "must_do");
  const overdue = actionItems.filter((a) => a.due_date && a.due_date < today);
  const dueToday = actionItems.filter((a) => a.due_date === today);
  const totalMain = actionItems.filter((a) => a.priority !== "low").length;

  const isCalm =
    events.length === 0 && totalMain === 0 && deadlines.length === 0;

  // Nearest upcoming event
  const nearestEvent = [...events]
    .filter((e) => e.date && e.date >= today)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))[0] ?? null;

  // Line 1 — the lead sentence
  let line1: string;
  if (isCalm) {
    line1 = "You're all clear — enjoy the quiet week.";
  } else if (overdue.length > 0) {
    line1 = `${overdue.length} item${overdue.length > 1 ? "s are" : " is"} overdue — check below.`;
  } else if (mustDo.length > 0) {
    line1 = `You have ${mustDo.length} important thing${mustDo.length > 1 ? "s" : ""} to handle this week.`;
  } else if (totalMain > 0) {
    line1 = `${totalMain} thing${totalMain > 1 ? "s" : ""} to prepare — nothing urgent.`;
  } else {
    line1 = "No actions needed — just some events ahead.";
  }

  // Line 2 — nearest event with child name
  let line2: string | null = null;
  if (nearestEvent) {
    const cn = nearestEvent.child?.name ?? nearestEvent.raw_child_name;
    const dayLabel =
      nearestEvent.date === today
        ? "today"
        : nearestEvent.date === shiftDate(1)
        ? "tomorrow"
        : formatDate(nearestEvent.date);
    const title = nearestEvent.title;
    line2 = cn
      ? `${cn}'s ${title} is ${dayLabel}.`
      : `${title} is ${dayLabel}.`;
  }

  // Line 3 — action status coda
  let line3: string | null = null;
  if (!isCalm) {
    if (dueToday.length > 0) {
      line3 = `${dueToday.length} item${dueToday.length > 1 ? "s" : ""} due today.`;
    } else if (mustDo.length === 0 && totalMain === 0) {
      line3 = "No urgent actions today.";
    }
  }

  return (
    <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-primary/60">
        This week · {weekLabel}
      </p>
      <p className="mt-1.5 text-base font-semibold text-foreground">{line1}</p>
      {line2 && (
        <p className="mt-1 text-sm text-muted-foreground">{line2}</p>
      )}
      {line3 && (
        <p className="mt-0.5 text-sm text-muted-foreground">{line3}</p>
      )}
    </div>
  );
}

/** Sort items: overdue → due soon (≤3d) → coming up → no date, then by priority */
function sortByUrgency(
  items: ActionItemWithChild[],
  today: string,
  dueSoon: string
): ActionItemWithChild[] {
  const urgency = (i: ActionItemWithChild) => {
    if (i.due_date && i.due_date < today) return 0;
    if (i.due_date && i.due_date <= dueSoon) return 1;
    if (i.due_date) return 2;
    return 3;
  };
  const priorityRank = { high: 0, medium: 1, low: 2 } as const;
  return [...items].sort(
    (a, b) =>
      urgency(a) - urgency(b) ||
      priorityRank[a.priority] - priorityRank[b.priority]
  );
}

// ── Section: Action Needed ─────────────────────────────────────────────────

function ActionRow({
  item,
  today,
  onComplete,
}: {
  item: ActionItemWithChild;
  today: string;
  onComplete: (id: string) => void;
}) {
  const isHigh = item.priority === "high";
  const isOverdue = item.due_date ? item.due_date < today : false;
  const isDueToday = item.due_date === today;
  const isDueSoon = !isOverdue && !isDueToday && item.due_date
    ? item.due_date <= shiftDate(3)
    : false;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
        isOverdue
          ? "border-red-200 bg-red-50/40"
          : isHigh && isDueSoon
          ? "border-orange-200 bg-orange-50/30"
          : "border-border bg-card"
      }`}
    >
      <button
        onClick={() => onComplete(item.id)}
        className="mt-0.5 shrink-0 text-muted-foreground/40 transition-colors hover:text-green-600"
        aria-label="Mark as done"
      >
        <Circle className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <ChildTag name={item.child?.name ?? item.raw_child_name} />
          {isOverdue && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
              Overdue
            </span>
          )}
          {isDueToday && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Due today
            </span>
          )}
          {isDueSoon && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
              Due {formatDate(item.due_date)}
            </span>
          )}
        </div>
        <p
          className={`text-sm text-foreground leading-snug ${
            isHigh || isOverdue ? "font-semibold" : "font-medium"
          }`}
        >
          {item.task}
        </p>
        {item.due_date && !isOverdue && !isDueToday && !isDueSoon && (
          <p className="mt-1 text-xs text-muted-foreground">
            Due {formatDate(item.due_date)}
          </p>
        )}
      </div>

      <Link
        href={`/emails/${item.source_email_id}`}
        className="mt-0.5 shrink-0 text-muted-foreground/30 transition-colors hover:text-primary"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ActionBucket({
  icon,
  label,
  items,
  today,
  onComplete,
}: {
  icon: React.ReactNode;
  label: string;
  items: ActionItemWithChild[];
  today: string;
  onComplete: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground/50">{icon}</span>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      {items.map((item) => (
        <ActionRow key={item.id} item={item} today={today} onComplete={onComplete} />
      ))}
    </div>
  );
}

function ActionSection({ items }: { items: ActionItemWithChild[] }) {
  const queryClient = useQueryClient();
  const [optimisticDone, setOptimisticDone] = useState<Set<string>>(new Set());
  const [showOptional, setShowOptional] = useState(false);
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: (id: string) => completeActionItem(id, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const handleComplete = (id: string) => {
    setOptimisticDone((prev) => new Set([...prev, id]));
    mutation.mutate(id);
  };

  const today = todayISO();
  const dueSoon = shiftDate(3);

  const visible = items.filter((i) => !optimisticDone.has(i.id));

  // Categorize into semantic buckets
  const mustDo      = sortByUrgency(visible.filter((i) => categorizeAction(i) === "must_do"),       today, dueSoon);
  const bringPrepare = sortByUrgency(visible.filter((i) => categorizeAction(i) === "bring_prepare"), today, dueSoon);
  const optional    = sortByUrgency(visible.filter((i) => categorizeAction(i) === "optional"),      today, dueSoon);

  const totalMain = mustDo.length + bringPrepare.length;

  return (
    <section className="mb-8">
      <SectionHeading
        icon={<CheckCircle2 className="h-4 w-4" />}
        label="Action Needed"
        count={totalMain}
      />

      {totalMain === 0 && optional.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50/60 p-4">
          <PartyPopper className="h-5 w-5 shrink-0 text-green-500" />
          <div>
            <p className="text-sm font-semibold text-green-800">Nothing to do right now.</p>
            <p className="text-xs text-green-600 mt-0.5">
              When school emails arrive, we'll surface any forms, payments, or items to prepare.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <ActionBucket
            icon={<CheckCircle2 className="h-3 w-3" />}
            label="Must do"
            items={mustDo}
            today={today}
            onComplete={handleComplete}
          />
          <ActionBucket
            icon={<ShoppingBag className="h-3 w-3" />}
            label="Bring / prepare"
            items={bringPrepare}
            today={today}
            onComplete={handleComplete}
          />

          {/* Optional / FYI — collapsed by default */}
          {optional.length > 0 && (
            <div>
              <button
                onClick={() => setShowOptional((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {showOptional ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                Optional / FYI · {optional.length}
              </button>
              {showOptional && (
                <div className="mt-2 space-y-2">
                  {optional.map((item) => (
                    <ActionRow
                      key={item.id}
                      item={item}
                      today={today}
                      onComplete={handleComplete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Section: This Week (grouped by child) ──────────────────────────────────

function ThisWeekSection({
  events,
  deadlines,
  registeredChildren,
}: {
  events: EventWithChild[];
  deadlines: Deadline[];
  registeredChildren: Child[];
}) {
  const today = todayISO();

  // Build per-child groups, preserving known-child order
  type ChildGroup = {
    id: string;
    name: string;
    events: EventWithChild[];
    deadlines: Deadline[];
  };

  const groups = new Map<string, ChildGroup>();

  // Seed with registered children so their order is stable
  for (const child of registeredChildren) {
    groups.set(child.id, { id: child.id, name: child.name, events: [], deadlines: [] });
  }

  for (const ev of events) {
    const key = ev.child_id ?? "__other";
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: ev.child?.name ?? ev.raw_child_name ?? "School",
        events: [],
        deadlines: [],
      });
    }
    groups.get(key)!.events.push(ev);
  }

  for (const dl of deadlines) {
    const key = dl.child_id ?? "__other";
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: dl.raw_child_name ?? "School",
        events: [],
        deadlines: [],
      });
    }
    groups.get(key)!.deadlines.push(dl);
  }

  // Only show groups that have something this week
  const activeGroups = [...groups.values()].filter(
    (g) => g.events.length > 0 || g.deadlines.length > 0
  );

  // Sort each group's items chronologically
  for (const g of activeGroups) {
    g.events.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    g.deadlines.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  }

  const totalCount = activeGroups.reduce(
    (s, g) => s + g.events.length + g.deadlines.length,
    0
  );

  return (
    <section className="mb-8">
      <SectionHeading
        icon={<CalendarDays className="h-4 w-4" />}
        label="This Week"
        count={totalCount > 0 ? totalCount : undefined}
      />

      {activeGroups.length === 0 ? (
        <EmptyState
          icon={<CalendarX className="h-8 w-8" />}
          heading="Nothing on the calendar this week"
          sub="Events and deadlines will appear here once school emails arrive."
        />
      ) : (
        <div className="space-y-6">
          {activeGroups.map((group) => (
            <div key={group.id}>
              {/* Child name row */}
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">
                {group.name}
              </p>

              <div className="space-y-2">
                {group.events.map((ev) => {
                  const isToday = ev.date === today;
                  return (
                    <Card
                      key={ev.id}
                      className={`flex items-center justify-between gap-3 px-4 py-3 ${
                        isToday ? "border-primary/25 bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CalendarDays
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isToday ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {ev.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDate(ev.date)}
                            {ev.start_time ? ` · ${formatTime(ev.start_time)}` : ""}
                            {ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                            {ev.location ? ` · ${ev.location}` : ""}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/emails/${ev.source_email_id}`}
                        className="shrink-0 text-muted-foreground/40 hover:text-primary"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Card>
                  );
                })}

                {group.deadlines.map((dl) => {
                  const isToday = dl.date === today;
                  return (
                    <Card
                      key={dl.id}
                      className={`flex items-center justify-between gap-3 px-4 py-3 ${
                        isToday
                          ? "border-amber-300 bg-amber-50/50"
                          : "border-amber-200 bg-amber-50/20"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {dl.title}
                          </p>
                          <p className="text-xs text-amber-600">
                            {isToday ? "Due today" : `Due ${formatDate(dl.date)}`}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/emails/${dl.source_email_id}`}
                        className="shrink-0 text-muted-foreground/40 hover:text-primary"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Section: By Child ──────────────────────────────────────────────────────

function ByChildSection({
  children,
  events,
  deadlines,
  actionItems,
}: {
  children: Child[];
  events: EventWithChild[];
  deadlines: Deadline[];
  actionItems: ActionItemWithChild[];
}) {
  const today = todayISO();

  if (children.length === 0) return null;

  return (
    <section className="mb-8">
      <SectionHeading
        icon={<Users className="h-4 w-4" />}
        label="By Child"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {children.map((child) => {
          const childEvents = events
            .filter((e) => e.child_id === child.id && e.date && e.date >= today)
            .slice(0, 3);
          const childDeadlines = deadlines
            .filter((d) => d.child_id === child.id && d.date && d.date >= today)
            .slice(0, 2);
          const childActions = actionItems
            .filter((a) => a.child_id === child.id)
            .slice(0, 4);

          const hasItems =
            childEvents.length > 0 ||
            childDeadlines.length > 0 ||
            childActions.length > 0;

          const initial = child.name.charAt(0).toUpperCase();

          return (
            <Card key={child.id} className="overflow-hidden">
              {/* Child header */}
              <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {child.name}
                  </p>
                  {child.school_name && (
                    <p className="truncate text-xs text-muted-foreground">
                      {child.school_name}
                    </p>
                  )}
                </div>
              </div>

              {/* Child items */}
              {!hasItems ? (
                <div className="px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Nothing on the schedule — all clear!
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {childActions.map((action) => (
                    <li
                      key={action.id}
                      className="flex items-start gap-2.5 px-4 py-2.5"
                    >
                      <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/40" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {action.task}
                        </p>
                        {action.due_date && (
                          <p
                            className={`mt-0.5 text-xs ${
                              action.due_date <= today
                                ? "font-medium text-amber-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            Due {formatDate(action.due_date)}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                  {childEvents.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-start gap-2.5 px-4 py-2.5"
                    >
                      <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/40" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {ev.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(ev.date)}
                          {ev.start_time ? ` · ${formatTime(ev.start_time)}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                  {childDeadlines.map((dl) => (
                    <li
                      key={dl.id}
                      className="flex items-start gap-2.5 px-4 py-2.5"
                    >
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {dl.title}
                        </p>
                        <p className="mt-0.5 text-xs text-amber-600">
                          Due {formatDate(dl.date)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// ── Section: School Emails ─────────────────────────────────────────────────

function SchoolEmailsSection({ emails }: { emails: Email[] }) {
  return (
    <section className="mb-8">
      <SectionHeading icon={<Mail className="h-4 w-4" />} label="School Emails" />
      {emails.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          heading="No emails received yet"
          sub={
            <>
              Forward a school email to get started.{" "}
              <Link
                href="/setup/gmail-forwarding"
                className="text-primary underline-offset-2 hover:underline"
              >
                Set up forwarding
              </Link>
            </>
          }
        />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {emails.map((email) => (
              <li key={email.id}>
                <Link
                  href={`/emails/${email.id}`}
                  className="flex items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {email.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {email.sender ?? "Unknown sender"} ·{" "}
                      {relativeTime(email.received_at)}
                    </p>
                  </div>
                  {email.processing_status === "pending" && (
                    <span className="mt-0.5 shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Processing
                    </span>
                  )}
                  {email.processing_status === "failed" && (
                    <span className="mt-0.5 shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                      Failed
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3">
            <Link
              href="/emails"
              className="text-xs font-medium text-primary hover:underline underline-offset-4"
            >
              View all emails →
            </Link>
          </div>
        </Card>
      )}
    </section>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-20 w-full rounded-xl" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

// ── Daily Digest card ──────────────────────────────────────────────────────

interface DigestJson {
  date: string;
  summary: { urgent_count: number; total_actions: number; is_calm: boolean };
  action_needed: {
    task: string;
    priority: string;
    due_date: string | null;
    child_name: string | null;
  }[];
}

function DigestCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const { data: digest, isLoading } = useQuery({
    queryKey: ["digest", userId],
    queryFn: () => getLatestDigest(userId),
    staleTime: 60_000,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const res = await apiFetch("/api/digest/generate", {
        method: "POST",
        body: JSON.stringify({ date: today }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? "Generation failed"
        );
      }
      return res.json();
    },
    onSuccess: () => {
      setSendSuccess(false);
      queryClient.invalidateQueries({ queryKey: ["digest", userId] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/digest/send", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Send failed");
      }
      return res.json() as Promise<{ ok: boolean; sent_to: string }>;
    },
    onSuccess: () => {
      setSendSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["digest", userId] });
    },
  });

  const digestRelative = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const json = digest?.content_json as unknown as DigestJson | null;
  const today = new Date().toISOString().split("T")[0];
  const isToday = digest?.digest_date === today;
  const alreadySentToday = digest?.sent_at && isToday;

  return (
    <div className="mb-8 rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Daily email digest
          </span>
          {digest && json && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {json.summary.is_calm
                ? "All clear"
                : `${json.summary.urgent_count} urgent · ${json.summary.total_actions} actions`}
            </span>
          )}
          {digest && (
            <span className="text-[11px] text-muted-foreground/50">
              {digestRelative(digest.created_at)}
            </span>
          )}
          {alreadySentToday && (
            <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
              <Send className="h-2.5 w-2.5" />
              Sent today
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {digest && !alreadySentToday && (
            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || generateMutation.isPending}
              title={`Send to ${user?.email ?? "your email"}`}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-3 w-3" />
                  Email me
                </>
              )}
            </button>
          )}

          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                {digest ? "Regenerate" : "Generate"}
              </>
            )}
          </button>

          {digest && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
              aria-label={expanded ? "Collapse digest" : "Expand digest"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-border/60 bg-muted/20 px-4 py-2">
        <p className="text-[11px] text-muted-foreground">
          Automated daily delivery is not yet active — generate your digest
          manually and click <strong>Email me</strong> to send it to{" "}
          <span className="font-medium">{user?.email ?? "your email"}</span>.
        </p>
      </div>

      {generateMutation.isError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2">
          <p className="text-xs text-red-700">
            {generateMutation.error instanceof Error
              ? generateMutation.error.message
              : "Generation failed"}
          </p>
        </div>
      )}
      {sendMutation.isError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2">
          <p className="text-xs text-red-700">
            {sendMutation.error instanceof Error
              ? sendMutation.error.message
              : "Send failed"}
          </p>
        </div>
      )}
      {sendSuccess && (
        <div className="border-t border-green-100 bg-green-50 px-4 py-2">
          <p className="text-xs font-medium text-green-800">
            Digest sent to {user?.email} — check your inbox.
          </p>
        </div>
      )}

      {!isLoading && !digest && !generateMutation.isPending && (
        <p className="px-4 py-3 text-xs italic text-muted-foreground">
          No digest yet — click Generate to build one from your current data.
        </p>
      )}

      {digest && expanded && (
        <div className="border-t border-border px-4 py-4">
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted-foreground">
            {digest.content_text}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const userId  = user!.id;
  const start   = weekStart();
  const end     = weekEnd();
  const horizon = shiftDate(28);

  const { data, isLoading, error } = useQuery({
    queryKey:  ["dashboard", userId, start, end],
    queryFn:   () => getDashboardData(userId, start, end, horizon),
    staleTime: 60_000,
    retry:     1,
  });

  const { data: children = [], isLoading: childrenLoading } = useQuery({
    queryKey:  ["children", userId],
    queryFn:   () => getChildren(userId),
    staleTime: 60_000,
  });

  const weekLabel = (() => {
    const s = new Date(start + "T00:00:00");
    const e = new Date(end + "T00:00:00");
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(s)} – ${fmt(e)}`;
  })();

  const firstName = (() => {
    const prefix = user?.email?.split("@")[0] ?? "";
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  })();

  return (
    <Shell>
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-0.5">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">
            {greeting()}, {firstName}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground ml-7">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month:   "long",
            day:     "numeric",
          })}
        </p>
      </div>

      {/* ── Week at a Glance ── */}
      {data && (
        <WeekGlanceCard
          events={data.events}
          deadlines={data.deadlines}
          actionItems={data.action_items}
          weekLabel={weekLabel}
        />
      )}

      {/* ── Onboarding banner ── */}
      <OnboardingBanner
        hasChildren={children.length > 0}
        hasEmails={(data?.recentEmails.length ?? 0) > 0}
        loading={isLoading || childrenLoading}
      />

      {/* ── Error state ── */}
      {error && (
        <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            Could not load your school plan.
          </p>
          <p className="mt-1 text-xs text-red-600">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && <DashboardSkeleton />}

      {/* ── Content ── */}
      {data && (
        <>
          <ActionSection items={data.action_items} />

          <ThisWeekSection
            events={data.events}
            deadlines={data.deadlines}
            registeredChildren={children}
          />

          <ByChildSection
            children={children}
            events={data.events}
            deadlines={data.upcomingDeadlines}
            actionItems={data.action_items}
          />

          <SchoolEmailsSection emails={data.recentEmails} />
        </>
      )}

      {/* ── Daily Digest (utility) ── */}
      <DigestCard userId={userId} />
    </Shell>
  );
}
