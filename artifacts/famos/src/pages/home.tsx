/**
 * Home / landing page.
 * Optimized for clarity, emotional resonance, and conversion.
 */

import { Link } from "wouter";
import { Shell } from "@/components/layout/Shell";
import {
  CalendarDays,
  ClipboardList,
  Inbox,
  AlertTriangle,
  Calendar,
  CheckCircle2,
} from "lucide-react";

// ── Value bullets ─────────────────────────────────────────────────────────

const valueBullets = [
  {
    icon: CalendarDays,
    heading: "Every event, in one place",
    text: "Concerts, field trips, picture day — pulled from emails automatically.",
  },
  {
    icon: Inbox,
    heading: "No more missed forms",
    text: "Permission slips, supply lists, and deadlines surfaced before it's too late.",
  },
  {
    icon: ClipboardList,
    heading: "A daily action list",
    text: "Each morning you know exactly what needs doing for your kids today.",
  },
];

// ── Concrete example block ────────────────────────────────────────────────

function ExampleOutput() {
  return (
    <section className="mx-auto mt-6 max-w-2xl">
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Here's what you'll see
      </p>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Today */}
        <div className="border-b border-border px-5 py-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary/70">
            Today
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-foreground">
              <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>
                <span className="font-semibold">Emma</span>: Field trip — bring
                a packed lunch
              </span>
            </li>
          </ul>
        </div>

        {/* This week */}
        <div className="border-b border-border bg-muted/30 px-5 py-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            This week
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-foreground">
              <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>
                <span className="font-semibold">Fri:</span> Permission slip due
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-foreground">
              <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>
                <span className="font-semibold">Mon:</span> Pajama Day
              </span>
            </li>
          </ul>
        </div>

        {/* Action needed */}
        <div className="px-5 py-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Action needed
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
              <span className="flex-1 text-foreground">
                Sign permission slip
              </span>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                HIGH
              </span>
            </li>
            <li className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
              <span className="flex-1 text-foreground">Pack lunch</span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                MEDIUM
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <Shell>
      {/* ── Hero ── */}
      <section className="mx-auto max-w-2xl pb-10 pt-10 text-center">
        {/* Badge */}
        <span className="mb-5 inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          Family School OS
        </span>

        {/* Headline */}
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Never miss another school deadline or event
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Family School OS turns school emails into a clear weekly plan — so you
          always know what's happening and what your kids need.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dev/test-email">
            <span className="inline-flex items-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-opacity hover:opacity-90">
              See your first weekly plan
            </span>
          </Link>
          <Link href="/setup/gmail-forwarding">
            <span className="inline-flex items-center rounded-lg border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground shadow-xs transition-colors hover:bg-muted">
              Set up Gmail forwarding
            </span>
          </Link>
        </div>

        {/* Trust line */}
        <p className="mt-4 text-xs text-muted-foreground/60">
          Works with any school emails &nbsp;·&nbsp; Set it once and it runs
          automatically
        </p>
      </section>

      {/* ── Concrete example ── */}
      <ExampleOutput />

      {/* ── Value bullets ── */}
      <section className="mx-auto mt-16 grid max-w-2xl gap-4 sm:grid-cols-3">
        {valueBullets.map(({ icon: Icon, heading, text }) => (
          <div
            key={heading}
            className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-xs"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{heading}</p>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">
                {text}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* ── How it works ── */}
      <section className="mx-auto mt-16 max-w-2xl pb-8">
        <h2 className="mb-6 text-center text-xl font-semibold text-foreground">
          How it works
        </h2>
        <ol className="space-y-4">
          {[
            {
              step: "1",
              title: "Connect or forward your school emails",
              desc: "Set up a one-time Gmail filter (takes two minutes) and school emails flow in automatically from that point on.",
            },
            {
              step: "2",
              title: "We extract what matters",
              desc: "Each email is read and sorted into events, deadlines, and action items — no reading required on your end.",
            },
            {
              step: "3",
              title: "Review your weekly plan",
              desc: "Open your dashboard and see exactly what's coming up and what needs action — sorted by urgency, by child.",
            },
          ].map(({ step, title, desc }) => (
            <div
              key={step}
              className="flex gap-4 rounded-xl border border-border bg-card p-5 shadow-xs"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {step}
              </div>
              <div>
                <p className="font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </ol>

        {/* Bottom CTA */}
        <div className="mt-10 text-center">
          <Link href="/dev/test-email">
            <span className="inline-flex items-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-opacity hover:opacity-90">
              See your first weekly plan
            </span>
          </Link>
          <p className="mt-3 text-xs text-muted-foreground/60">
            No account needed to try it
          </p>
        </div>
      </section>
    </Shell>
  );
}
