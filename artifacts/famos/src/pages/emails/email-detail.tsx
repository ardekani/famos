/**
 * Email detail page — /emails/:id
 *
 * Shows everything about a single email:
 *   - Raw metadata (subject, sender, received_at, status)
 *   - Extraction error (if failed)
 *   - Extracted events, deadlines, action_items, notes with confidence scores
 *   - Original email body
 *   - Re-run extraction button
 *
 * Designed to be helpful for debugging parser quality.
 */

import React, { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  CheckCircle2,
  StickyNote,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Circle,
  Loader2,
  Mail,
  Check,
} from "lucide-react";
import { getEmailWithExtractions, completeActionItem } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type {
  Event,
  Deadline,
  ActionItem,
  Note,
} from "@/types/database";

// ── Formatting helpers ────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatReceived(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month:   "short",
    day:     "numeric",
    year:    "numeric",
    hour:    "numeric",
    minute:  "2-digit",
  });
}

// ── Shared small components ───────────────────────────────────────────────

function Confidence({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  const color =
    pct >= 90 ? "text-green-700 bg-green-50" :
    pct >= 70 ? "text-amber-700 bg-amber-50" :
                "text-red-700 bg-red-50";
  return (
    <span
      title={`AI confidence: ${pct}%`}
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${color}`}
    >
      {pct}%
    </span>
  );
}

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const s = {
    high:   "bg-red-50 text-red-700",
    medium: "bg-amber-50 text-amber-700",
    low:    "bg-slate-100 text-slate-600",
  }[priority];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s}`}>
      {priority}
    </span>
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    processed: "bg-green-50 text-green-700 border-green-200",
    failed:    "bg-red-50 text-red-700 border-red-200",
    pending:   "bg-amber-50 text-amber-700 border-amber-200",
  };
  const labels: Record<string, string> = {
    processed: "Parsed",
    failed:    "Failed",
    pending:   "Pending",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function SectionCard({
  icon,
  title,
  count,
  accentColor,
  children,
  isEmpty,
  emptyLabel,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  accentColor: string;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={accentColor}>{icon}</span>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>
      {isEmpty ? (
        <p className="px-4 py-4 text-xs italic text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="p-4">{children}</div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="my-1 border-t border-border" />;
}

// ── Events section ────────────────────────────────────────────────────────

function EventsCard({ events }: { events: Event[] }) {
  return (
    <SectionCard
      icon={<CalendarDays className="h-4 w-4" />}
      title="Events"
      count={events.length}
      accentColor="text-primary"
      isEmpty={events.length === 0}
      emptyLabel="No events extracted from this email."
    >
      <ul className="divide-y divide-border -mx-4 px-4">
        {events.map((ev) => (
          <li key={ev.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{ev.title}</p>
              <Confidence value={ev.confidence} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {ev.date ? (
                <span className="text-xs text-muted-foreground">
                  {formatDate(ev.date)}
                  {ev.start_time && ` · ${formatTime(ev.start_time)}`}
                  {ev.end_time && ` – ${formatTime(ev.end_time)}`}
                </span>
              ) : (
                <span className="text-xs italic text-muted-foreground/60">No date extracted</span>
              )}
              {ev.location && (
                <span className="text-xs text-muted-foreground">📍 {ev.location}</span>
              )}
              <ChildTag name={ev.raw_child_name} />
            </div>
            {ev.description && (
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                {ev.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

// ── Deadlines section ─────────────────────────────────────────────────────

function DeadlinesCard({ deadlines }: { deadlines: Deadline[] }) {
  return (
    <SectionCard
      icon={<Clock className="h-4 w-4" />}
      title="Deadlines"
      count={deadlines.length}
      accentColor="text-amber-600"
      isEmpty={deadlines.length === 0}
      emptyLabel="No deadlines extracted from this email."
    >
      <ul className="divide-y divide-border -mx-4 px-4">
        {deadlines.map((d) => (
          <li key={d.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{d.title}</p>
              <Confidence value={d.confidence} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {d.date ? (
                <span className="text-xs font-medium text-amber-700">
                  Due {formatDate(d.date)}
                </span>
              ) : (
                <span className="text-xs italic text-muted-foreground/60">No date extracted</span>
              )}
              <ChildTag name={d.raw_child_name} />
            </div>
            {d.description && (
              <p className="mt-1.5 text-xs text-muted-foreground">{d.description}</p>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

// ── Action Items section ──────────────────────────────────────────────────

function ActionItemsCard({ items }: { items: ActionItem[] }) {
  const queryClient = useQueryClient();
  const [done, setDone] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: (id: string) => completeActionItem(id, user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  const handleComplete = (id: string) => {
    setDone((prev) => new Set([...prev, id]));
    mutation.mutate(id);
  };

  const visible = items.filter((i) => !done.has(i.id));

  return (
    <SectionCard
      icon={<CheckCircle2 className="h-4 w-4" />}
      title="Action Items"
      count={visible.length}
      accentColor="text-green-600"
      isEmpty={items.length === 0}
      emptyLabel="No action items extracted from this email."
    >
      <ul className="divide-y divide-border -mx-4 px-4">
        {visible.map((a) => (
          <li key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <button
              onClick={() => handleComplete(a.id)}
              className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-green-600"
              aria-label="Mark done"
            >
              <Circle className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{a.task}</p>
                <Confidence value={a.confidence} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <PriorityBadge priority={a.priority} />
                {a.due_date && (
                  <span className="text-xs text-muted-foreground">Due {formatDate(a.due_date)}</span>
                )}
                <ChildTag name={a.raw_child_name} />
              </div>
            </div>
          </li>
        ))}
        {visible.length === 0 && items.length > 0 && (
          <li className="flex items-center gap-2 py-3 text-sm text-green-700">
            <Check className="h-4 w-4" />
            All action items marked done.
          </li>
        )}
      </ul>
    </SectionCard>
  );
}

// ── Notes section ─────────────────────────────────────────────────────────

function NotesCard({ notes }: { notes: Note[] }) {
  return (
    <SectionCard
      icon={<StickyNote className="h-4 w-4" />}
      title="Notes"
      count={notes.length}
      accentColor="text-slate-500"
      isEmpty={notes.length === 0}
      emptyLabel="No notes extracted from this email."
    >
      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
            <div>
              <p className="text-sm text-foreground leading-relaxed">{n.content}</p>
              <ChildTag name={n.raw_child_name} />
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

// ── Email body (collapsible) ──────────────────────────────────────────────

function EmailBody({ body }: { body: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Original Email Body</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <>
          <Divider />
          <pre className="px-4 py-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
            {body}
          </pre>
        </>
      )}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

// ── Re-run extraction ─────────────────────────────────────────────────────

interface ReExtractResult {
  processing_status: "processed" | "failed";
  error?: string;
}

function useReExtract(emailId: string) {
  const queryClient = useQueryClient();
  return useMutation<ReExtractResult, Error>({
    mutationFn: async () => {
      const res = await apiFetch("/api/emails/extract", {
        method:  "POST",
        body:    JSON.stringify({ email_id: emailId }),
      });
      return res.json() as Promise<ReExtractResult>;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["email", emailId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function EmailDetailPage() {
  const params  = useParams<{ id: string }>();
  const emailId = params.id ?? "";
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey:    ["email", emailId],
    queryFn:     () => getEmailWithExtractions(emailId, user!.id),
    enabled:     Boolean(emailId),
    staleTime:   30_000,
  });

  const reExtract = useReExtract(emailId);

  // ── Not found ──
  if (!isLoading && !data && !error) {
    return (
      <Shell>
        <div className="py-20 text-center">
          <p className="text-muted-foreground">Email not found.</p>
          <Link href="/dashboard" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Back link */}
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      {isLoading && <PageSkeleton />}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-800">Failed to load email.</p>
          <p className="mt-1 text-xs text-red-600">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      )}

      {data && (() => {
        const email = data;
        const isFailed = email.processing_status === "failed";
        const totalExtracted =
          email.events.length +
          email.deadlines.length +
          email.action_items.length +
          email.notes.length;

        return (
          <>
            {/* ── Email header ── */}
            <div className="mb-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={email.processing_status} />
                {totalExtracted > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {totalExtracted} item{totalExtracted !== 1 ? "s" : ""} extracted
                  </span>
                )}
              </div>

              <h1 className="text-xl font-bold text-foreground leading-snug">
                {email.subject}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {email.sender && (
                  <span>
                    <span className="font-medium text-foreground">From:</span> {email.sender}
                  </span>
                )}
                <span>
                  <span className="font-medium text-foreground">Received:</span>{" "}
                  {formatReceived(email.received_at)}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/60">
                  {email.id}
                </span>
              </div>
            </div>

            {/* ── Extraction error panel ── */}
            {isFailed && email.extraction_error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Extraction failed</p>
                    <p className="mt-1.5 font-mono text-xs leading-relaxed text-red-700">
                      {email.extraction_error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Re-run extraction button ── */}
            <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
              <div>
                {reExtract.isSuccess && (
                  <p className={`text-sm font-medium ${
                    reExtract.data?.processing_status === "processed"
                      ? "text-green-700"
                      : "text-red-700"
                  }`}>
                    {reExtract.data?.processing_status === "processed"
                      ? "Re-extraction succeeded — page refreshed."
                      : `Re-extraction failed: ${reExtract.data?.error}`}
                  </p>
                )}
              </div>
              <button
                onClick={() => reExtract.mutate()}
                disabled={reExtract.isPending}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reExtract.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Re-running…</>
                ) : (
                  <><RefreshCw className="h-4 w-4" />Re-run extraction</>
                )}
              </button>
            </div>

            {/* ── Extracted data grid ── */}
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <EventsCard      events={email.events} />
              <DeadlinesCard   deadlines={email.deadlines} />
              <ActionItemsCard items={email.action_items} />
              <NotesCard       notes={email.notes} />
            </div>

            {/* ── Original email body ── */}
            <EmailBody body={email.body} />
          </>
        );
      })()}
    </Shell>
  );
}
