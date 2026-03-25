/**
 * Dashboard — the parent command center.
 *
 * Sections:
 *   1. Header          — greeting, current date, urgent count
 *   2. Today           — events + deadlines happening today
 *   3. Action Needed   — open action items, checkable, sorted by priority
 *   4. This Week       — calendar-style event list for the week
 *   5. Recent Emails   — last 6 parsed emails with status badges
 */

import React, { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Mail,
  ChevronRight,
  Inbox,
  PartyPopper,
  CalendarX,
  Sparkles,
  FileText,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react";
import { getDashboardData, completeActionItem, getLatestDigest, getChildren } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { EventWithChild, Deadline, ActionItemWithChild, Email, Digest } from "@/types/database";
import { Link } from "wouter";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";

// ── Date utilities ────────────────────────────────────────────────────────

/** Returns today as an ISO date string: "2026-03-25" */
function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/** Returns "2026-03-25" for a date shifted by N days from today */
function shiftDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/** Monday of the current week */
function weekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

/** Sunday of the current week */
function weekEnd(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

/** Format an ISO date string as a human-readable label */
function formatDate(iso: string | null): string {
  if (!iso) return "No date";
  const today = todayISO();
  const tomorrow = shiftDate(1);
  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Format a 24-h time string "HH:MM:SS" → "6:30 PM" */
function formatTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Relative time for emails: "2 hours ago", "Yesterday", etc. */
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

/** Greeting based on hour of day */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Small shared components ───────────────────────────────────────────────

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
    <div className="mb-4 flex items-center gap-2">
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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card shadow-xs ${className}`}>
      {children}
    </div>
  );
}

function ChildTag({ name }: { name: string | null | undefined }) {
  if (!name) return null;
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
      <div className="mb-3 text-muted-foreground/40">{icon}</div>
      <p className="text-sm font-medium text-muted-foreground">{heading}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground/70">{sub}</p>}
    </div>
  );
}

// ── Section: Today ────────────────────────────────────────────────────────

function TodaySection({
  events,
  deadlines,
}: {
  events: EventWithChild[];
  deadlines: Deadline[];
}) {
  const today = todayISO();
  const todayEvents    = events.filter((e) => e.date === today);
  const todayDeadlines = deadlines.filter((d) => d.date === today);

  if (todayEvents.length === 0 && todayDeadlines.length === 0) {
    return (
      <section className="mb-8">
        <SectionHeading icon={<Sparkles className="h-4 w-4" />} label="Today" />
        <Card className="flex items-center gap-3 p-4">
          <PartyPopper className="h-5 w-5 shrink-0 text-green-500" />
          <p className="text-sm text-muted-foreground">
            Nothing scheduled for today. Enjoy the calm!
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <SectionHeading
        icon={<Sparkles className="h-4 w-4" />}
        label="Today"
        count={todayEvents.length + todayDeadlines.length}
      />
      <div className="space-y-3">
        {todayEvents.map((ev) => (
          <Card key={ev.id} className="flex items-start justify-between p-4">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">{ev.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {ev.start_time && (
                    <span className="text-xs text-muted-foreground">
                      {formatTime(ev.start_time)}
                      {ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                    </span>
                  )}
                  {ev.location && (
                    <span className="text-xs text-muted-foreground">· {ev.location}</span>
                  )}
                  <ChildTag name={ev.child?.name ?? ev.raw_child_name} />
                </div>
              </div>
            </div>
            <Link
              href={`/emails/${ev.source_email_id}`}
              className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Card>
        ))}
        {todayDeadlines.map((d) => (
          <Card key={d.id} className="flex items-start justify-between border-amber-200 p-4">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-foreground">{d.title}</p>
                <p className="mt-0.5 text-xs font-medium text-amber-600">Due today</p>
              </div>
            </div>
            <Link
              href={`/emails/${d.source_email_id}`}
              className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ── Section: Action Needed ────────────────────────────────────────────────

function ActionSection({ items }: { items: ActionItemWithChild[] }) {
  const queryClient = useQueryClient();
  const [optimisticDone, setOptimisticDone] = useState<Set<string>>(new Set());
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

  const visible = items.filter((i) => !optimisticDone.has(i.id));

  return (
    <section className="mb-8">
      <SectionHeading
        icon={<CheckCircle2 className="h-4 w-4" />}
        label="Action Needed"
        count={visible.length}
      />
      {visible.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8" />}
          heading="All caught up!"
          sub="No pending action items. Great job."
        />
      ) : (
        <div className="space-y-2.5">
          {visible.map((item) => {
            const isHigh = item.priority === "high";
            return (
              <Card
                key={item.id}
                className={`flex items-start gap-3 p-4 ${
                  isHigh ? "border-red-200 bg-red-50/30" : ""
                }`}
              >
                {/* Check button */}
                <button
                  onClick={() => handleComplete(item.id)}
                  className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-green-600"
                  aria-label="Mark as done"
                >
                  <Circle className="h-4 w-4" />
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium text-foreground ${isHigh ? "font-semibold" : ""}`}>
                      {item.task}
                    </p>
                    {isHigh && (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {item.due_date && (
                      <span
                        className={`text-xs ${
                          item.due_date <= todayISO()
                            ? "font-semibold text-red-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        Due {formatDate(item.due_date)}
                      </span>
                    )}
                    <ChildTag name={item.child?.name ?? item.raw_child_name} />
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        isHigh
                          ? "bg-red-100 text-red-700"
                          : item.priority === "medium"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.priority}
                    </span>
                  </div>
                </div>

                {/* Source email link */}
                <Link
                  href={`/emails/${item.source_email_id}`}
                  className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Section: This Week ────────────────────────────────────────────────────

function ThisWeekSection({
  events,
  deadlines,
}: {
  events: EventWithChild[];
  deadlines: Deadline[];
}) {
  const today = todayISO();

  // Merge events and deadlines into a single sorted list
  type WeekItem =
    | { kind: "event"; date: string | null; item: EventWithChild }
    | { kind: "deadline"; date: string | null; item: Deadline };

  const allItems: WeekItem[] = [
    ...events.filter((e) => e.date !== today).map((e) => ({ kind: "event" as const, date: e.date, item: e })),
    ...deadlines.filter((d) => d.date !== today).map((d) => ({ kind: "deadline" as const, date: d.date, item: d })),
  ].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  if (allItems.length === 0) {
    return (
      <section className="mb-8">
        <SectionHeading icon={<CalendarDays className="h-4 w-4" />} label="This Week" />
        <EmptyState
          icon={<CalendarX className="h-8 w-8" />}
          heading="Nothing else on the calendar this week"
          sub="Events from forwarded emails will appear here."
        />
      </section>
    );
  }

  // Group by date label
  const grouped = new Map<string, WeekItem[]>();
  for (const item of allItems) {
    const label = item.date ? formatDate(item.date) : "No date";
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label)!.push(item);
  }

  return (
    <section className="mb-8">
      <SectionHeading
        icon={<CalendarDays className="h-4 w-4" />}
        label="This Week"
        count={allItems.length}
      />
      <div className="space-y-1">
        {[...grouped.entries()].map(([dateLabel, items]) => (
          <div key={dateLabel}>
            {/* Day header */}
            <p className="mb-1.5 mt-4 first:mt-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {dateLabel}
            </p>
            <div className="space-y-2">
              {items.map((row) =>
                row.kind === "event" ? (
                  <Card
                    key={row.item.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {row.item.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {row.item.start_time && (
                            <span className="text-xs text-muted-foreground">
                              {formatTime(row.item.start_time)}
                            </span>
                          )}
                          {row.item.location && (
                            <span className="text-xs text-muted-foreground">
                              · {row.item.location}
                            </span>
                          )}
                          <ChildTag name={row.item.child?.name ?? row.item.raw_child_name} />
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/emails/${row.item.source_email_id}`}
                      className="shrink-0 text-muted-foreground hover:text-primary"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Card>
                ) : (
                  <Card
                    key={row.item.id}
                    className="flex items-center justify-between gap-3 border-amber-200 bg-amber-50/20 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {row.item.title}
                        </p>
                        <p className="text-xs text-amber-600">Deadline</p>
                      </div>
                    </div>
                    <Link
                      href={`/emails/${row.item.source_email_id}`}
                      className="shrink-0 text-muted-foreground hover:text-primary"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Card>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Section: Recent Emails ────────────────────────────────────────────────

const statusStyles: Record<string, string> = {
  processed: "bg-green-50 text-green-700",
  failed:    "bg-red-50 text-red-700",
  pending:   "bg-amber-50 text-amber-700",
};

const statusLabels: Record<string, string> = {
  processed: "Parsed",
  failed:    "Failed",
  pending:   "Pending",
};

function RecentEmailsSection({ emails }: { emails: Email[] }) {
  return (
    <section className="mb-8">
      <SectionHeading icon={<Mail className="h-4 w-4" />} label="Recently Parsed Emails" />
      {emails.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          heading="No emails yet"
          sub={
            <>
              Forward a school email to get started.{" "}
              <Link href="/setup/gmail-forwarding" className="text-primary underline-offset-2 hover:underline">
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
                  className="flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {email.subject}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {email.sender ?? "Unknown sender"} · {relativeTime(email.received_at)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      statusStyles[email.processing_status] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {statusLabels[email.processing_status] ?? email.processing_status}
                  </span>
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

// ── Loading skeleton ──────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>
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

// ── Digest card ───────────────────────────────────────────────────────────

interface DigestJson {
  date: string;
  summary: { urgent_count: number; total_actions: number; is_calm: boolean };
  action_needed: { task: string; priority: string; due_date: string | null; child_name: string | null }[];
}

function DigestCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: digest, isLoading } = useQuery({
    queryKey:  ["digest", userId],
    queryFn:   () => getLatestDigest(userId),
    staleTime: 60_000,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const res   = await apiFetch("/api/digest/generate", {
        method:  "POST",
        body:    JSON.stringify({ date: today }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Generation failed");
      }
      return res.json() as Promise<{ content_text: string; content_json: DigestJson; created_at: string }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["digest", userId] }),
  });

  const relativeTime = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins   = Math.floor(diffMs / 60_000);
    if (mins < 1)   return "just now";
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const json = digest?.content_json as unknown as DigestJson | null;

  return (
    <div className="mb-8 rounded-xl border border-border bg-card shadow-xs">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Daily Digest</span>
          {digest && json && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {json.summary.is_calm
                ? "All clear"
                : `${json.summary.urgent_count} urgent · ${json.summary.total_actions} actions`}
            </span>
          )}
          {digest && (
            <span className="text-[11px] text-muted-foreground/60">
              {relativeTime(digest.created_at)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Generate / Regenerate */}
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generateMutation.isPending
              ? <><Loader2 className="h-3 w-3 animate-spin" />Generating…</>
              : <><RefreshCw className="h-3 w-3" />{digest ? "Regenerate" : "Generate"}</>}
          </button>

          {/* Expand / collapse */}
          {digest && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
              aria-label={expanded ? "Collapse digest" : "Expand digest"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {generateMutation.isError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2">
          <p className="text-xs text-red-700">
            {generateMutation.error instanceof Error ? generateMutation.error.message : "Generation failed"}
          </p>
        </div>
      )}

      {/* No digest yet */}
      {!isLoading && !digest && !generateMutation.isPending && (
        <p className="border-t border-border px-4 py-3 text-xs italic text-muted-foreground">
          No digest generated yet — click Generate to create one from your current data.
        </p>
      )}

      {/* Digest body (collapsible) */}
      {digest && expanded && (
        <div className="border-t border-border px-4 py-4">
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted-foreground">
            {digest.content_text}
          </pre>
          {digest.sent_at && (
            <p className="mt-3 flex items-center gap-1 text-[11px] text-green-700">
              <Send className="h-3 w-3" />
              Sent {relativeTime(digest.sent_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const userId    = user!.id;
  const start     = weekStart();
  const end       = weekEnd();
  const horizon   = shiftDate(28); // 4 weeks out for deadlines

  const { data, isLoading, error } = useQuery({
    queryKey:    ["dashboard", userId, start, end],
    queryFn:     () => getDashboardData(userId, start, end, horizon),
    staleTime:   60_000,
    retry:       1,
  });

  const { data: children = [], isLoading: childrenLoading } = useQuery({
    queryKey: ["children", userId],
    queryFn:  () => getChildren(userId),
    staleTime: 60_000,
  });

  // Derive first-name-like label from email (e.g. "alex@..." → "Alex")
  const firstName = (() => {
    const prefix = user?.email?.split("@")[0] ?? "";
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  })();

  const today = todayISO();
  const weekLabel = (() => {
    const s = new Date(start + "T00:00:00");
    const e = new Date(end + "T00:00:00");
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(s)} – ${fmt(e)}`;
  })();

  const highPriorityCount =
    data?.action_items.filter((a) => a.priority === "high").length ?? 0;

  return (
    <Shell>
      {/* ── Header ── */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month:   "long",
              day:     "numeric",
              year:    "numeric",
            })}
            <span className="mx-2 text-border">·</span>
            Week of {weekLabel}
          </p>
        </div>

        {highPriorityCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            {highPriorityCount} urgent {highPriorityCount === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      {/* ── Daily Digest ── */}
      <DigestCard userId={userId} />

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
            Could not load dashboard data.
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
          <TodaySection
            events={data.events}
            deadlines={data.upcomingDeadlines}
          />

          <ActionSection items={data.action_items} />

          <ThisWeekSection
            events={data.events}
            deadlines={data.deadlines}
          />

          <RecentEmailsSection emails={data.recentEmails} />
        </>
      )}

    </Shell>
  );
}
