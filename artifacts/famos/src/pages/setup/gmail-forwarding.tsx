/**
 * Setup — Gmail Forwarding
 *
 * Walks the parent through the one-time forwarding setup so their
 * school emails land in FamOS automatically.
 */

import React, { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Link } from "wouter";
import {
  ArrowLeft,
  Mail,
  Copy,
  Check,
  Settings,
  ToggleRight,
  PlusCircle,
  Filter,
  Zap,
  Info,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────

const FORWARDING_ADDRESS = "school@in.famops.app";

const FILTER_QUERY =
  '(from:school OR from:teacher OR from:notifications) OR ("field trip" OR "permission slip" OR "PTA" OR "school")';

// ── Steps ─────────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 1,
    icon: Settings,
    title: "Open Gmail Settings",
    body: (
      <>
        <p>
          In Gmail, click the <strong>gear icon (⚙)</strong> in the top-right
          corner, then choose <strong>"See all settings."</strong>
        </p>
      </>
    ),
  },
  {
    id: 2,
    icon: ToggleRight,
    title: "Go to Forwarding and POP/IMAP",
    body: (
      <>
        <p>
          Along the top of the Settings page, click the{" "}
          <strong>"Forwarding and POP/IMAP"</strong> tab.
        </p>
      </>
    ),
  },
  {
    id: 3,
    icon: PlusCircle,
    title: "Add your Family School OS forwarding address",
    body: (
      <>
        <p>
          Click <strong>"Add a forwarding address"</strong> and paste in your
          FamOS inbox address. Gmail will send you a confirmation email — click
          the link inside it to verify.
        </p>
      </>
    ),
  },
  {
    id: 4,
    icon: Filter,
    title: "Create a filter for school-related emails",
    body: (
      <>
        <p>
          Go to <strong>Settings → Filters and Blocked Addresses</strong>, then
          click <strong>"Create a new filter."</strong> Paste the example query
          below into the search box and click{" "}
          <strong>"Create filter with this search."</strong>
        </p>
      </>
    ),
    extra: "filter",
  },
  {
    id: 5,
    icon: Zap,
    title: "Apply the filter and enable forwarding",
    body: (
      <>
        <p>
          On the next screen, check{" "}
          <strong>"Forward it to"</strong> and select your FamOS address from
          the dropdown. Optionally check{" "}
          <strong>"Skip the Inbox (Archive it)"</strong> to keep your Gmail
          tidy. Click <strong>"Create filter."</strong>
        </p>
        <p className="mt-2">
          That's it — school emails will now flow into your FamOS dashboard
          automatically.
        </p>
      </>
    ),
  },
] as const;

// ── Copy button ───────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={label ?? "Copy to clipboard"}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600" />
          <span className="text-green-700">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </>
      )}
    </button>
  );
}

// ── Filter query block ────────────────────────────────────────────────────

function FilterQueryBlock() {
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Example filter query
        </span>
        <CopyButton text={FILTER_QUERY} label="Copy filter query" />
      </div>
      <pre className="overflow-x-auto px-3 py-3 text-[12px] leading-relaxed text-foreground whitespace-pre-wrap font-mono break-all">
        {FILTER_QUERY}
      </pre>
    </div>
  );
}

// ── Forwarding address card ───────────────────────────────────────────────

function ForwardingAddressCard() {
  return (
    <div className="mb-10 rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-primary/70">
        Your FamOS inbox address
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Mail className="h-4 w-4 text-primary" />
          </div>
          <span className="font-mono text-base font-semibold text-foreground">
            {FORWARDING_ADDRESS}
          </span>
        </div>
        <CopyButton text={FORWARDING_ADDRESS} label="Copy forwarding address" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        This is where Gmail will forward school emails. Every forwarded message
        gets parsed automatically — no extra steps needed.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function GmailForwardingPage() {
  return (
    <Shell>
      {/* Back link */}
      <Link
        href="/dashboard"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      {/* Header */}
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary/70">
          Setup · Gmail Forwarding
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Set it once and forget it
        </h1>
        <p className="mt-3 max-w-xl text-base text-muted-foreground leading-relaxed">
          Forward school emails automatically to your Family School OS inbox so
          your dashboard and daily digest stay up to date.
        </p>
      </div>

      {/* Forwarding address */}
      <ForwardingAddressCard />

      {/* Steps */}
      <div className="relative">
        {/* Connector line */}
        <div
          className="absolute left-[19px] top-8 bottom-8 w-px bg-border"
          aria-hidden
        />

        <ol className="space-y-5">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li key={step.id} className="relative flex gap-4">
                {/* Step number bubble */}
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
                  <Icon className="h-4 w-4 text-primary" />
                </div>

                {/* Step content */}
                <div className="flex-1 rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      Step {step.id}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-foreground">
                    {step.title}
                  </h2>
                  <div className="mt-2 text-sm text-muted-foreground leading-relaxed [&_strong]:font-semibold [&_strong]:text-foreground">
                    {step.body}
                  </div>
                  {"extra" in step && step.extra === "filter" && (
                    <FilterQueryBlock />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Success nudge */}
      <div className="mt-10 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
        <p className="text-sm font-semibold text-green-800">
          Once set up, you're done.
        </p>
        <p className="mt-1 text-sm text-green-700">
          Every school email you receive will land in your FamOS dashboard
          within seconds — parsed, organized, and ready to act on.
        </p>
      </div>

      {/* MVP note */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-dashed border-border bg-muted/30 px-5 py-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          This MVP supports forwarding first for a faster and simpler setup.
          Direct Gmail sync can be added later.
        </p>
      </div>
    </Shell>
  );
}
