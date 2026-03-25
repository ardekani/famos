/**
 * Emails list page — /emails
 *
 * Shows all ingested emails for the current user, newest first.
 * Each row links to /emails/:id for full detail and re-run.
 */

import React from "react";
import { Shell } from "@/components/layout/Shell";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Mail,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
} from "lucide-react";
import { getEmails } from "@/lib/queries";
import { DEV_USER_ID } from "@/lib/supabase";
import type { Email } from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins   = Math.floor(diffMs / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "processed") {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Parsed
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
        <AlertTriangle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
      <Clock className="h-3.5 w-3.5" />
      Pending
    </span>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────

function StatsBar({ emails }: { emails: Email[] }) {
  const parsed  = emails.filter(e => e.processing_status === "processed").length;
  const failed  = emails.filter(e => e.processing_status === "failed").length;
  const pending = emails.filter(e => e.processing_status === "pending").length;

  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        <span className="font-bold text-foreground">{emails.length}</span> total
      </span>
      {parsed > 0 && (
        <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
          <CheckCircle2 className="h-3 w-3" />
          {parsed} parsed
        </span>
      )}
      {failed > 0 && (
        <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
          <AlertTriangle className="h-3 w-3" />
          {failed} failed
        </span>
      )}
      {pending > 0 && (
        <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          <Clock className="h-3 w-3" />
          {pending} pending
        </span>
      )}
    </div>
  );
}

// ── Email row ─────────────────────────────────────────────────────────────

function EmailRow({ email }: { email: Email }) {
  return (
    <Link href={`/emails/${email.id}`}>
      <div className="group flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-card px-4 py-4 shadow-xs transition-colors hover:bg-muted/40">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Mail className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {email.subject}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {email.sender ?? "Unknown sender"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <StatusBadge status={email.processing_status} />
            <p className="mt-0.5 text-[11px] text-muted-foreground/60">
              {relativeTime(email.received_at)}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
        </div>
      </div>
    </Link>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
      <Inbox className="mb-4 h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm font-medium text-muted-foreground">No emails yet</p>
      <p className="mt-1 text-sm text-muted-foreground/70">
        Forward a school email to your FamOS inbox to get started.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link
          href="/setup/gmail-forwarding"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Set up Gmail forwarding
        </Link>
        <Link
          href="/dev/test-email"
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          Try a sample email
        </Link>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function EmailsPage() {
  const userId = DEV_USER_ID;

  const { data: emails, isLoading, error } = useQuery({
    queryKey:    ["emails", userId],
    queryFn:     () => getEmails(userId, 100),
    staleTime:   30_000,
    refetchInterval: 15_000,
  });

  return (
    <Shell>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Emails</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All forwarded school emails — click any row to see extracted events,
          deadlines, and action items.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Failed to load emails.</p>
          <p className="mt-1 text-xs text-red-600">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && <ListSkeleton />}

      {/* Stats + list */}
      {emails && (
        <>
          {emails.length > 0 && <StatsBar emails={emails} />}

          {emails.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {emails.map((email) => (
                <EmailRow key={email.id} email={email} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Forwarding nudge at bottom when there ARE emails */}
      {emails && emails.length > 0 && (
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Missing emails?{" "}
          <Link
            href="/setup/gmail-forwarding"
            className="text-primary underline-offset-4 hover:underline"
          >
            Check your forwarding setup →
          </Link>
        </p>
      )}
    </Shell>
  );
}
