/**
 * Home / landing page.
 * Presents the FamOS value proposition and CTAs.
 */

import { Link } from "wouter";
import { Shell } from "@/components/layout/Shell";
import { CalendarDays, ClipboardList, Inbox } from "lucide-react";

const valueBullets = [
  {
    icon: CalendarDays,
    text: "See all school events in one place",
  },
  {
    icon: Inbox,
    text: "Never miss forms, reminders, or supplies",
  },
  {
    icon: ClipboardList,
    text: "Get a daily digest of what needs action",
  },
];

export default function HomePage() {
  return (
    <Shell>
      {/* Hero section */}
      <section className="mx-auto max-w-2xl pt-8 pb-16 text-center">
        {/* Badge */}
        <span className="mb-6 inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          Family School OS
        </span>

        {/* Headline */}
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Turn school email chaos into a clear weekly plan
        </h1>

        {/* Subheadline */}
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Family School OS automatically turns school emails into events,
          deadlines, and action items — so you know what matters this week.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dev/test-email">
            <span className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
              Try it with a sample email
            </span>
          </Link>
          <Link href="/setup/gmail-forwarding">
            <span className="inline-flex items-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted">
              Set up Gmail forwarding
            </span>
          </Link>
        </div>
      </section>

      {/* Value bullets */}
      <section className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-3">
        {valueBullets.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-xs"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium leading-snug text-foreground">
              {text}
            </p>
          </div>
        ))}
      </section>

      {/* How it works (placeholder) */}
      <section className="mx-auto mt-16 max-w-2xl">
        <h2 className="mb-6 text-center text-xl font-semibold text-foreground">
          How it works
        </h2>
        <ol className="space-y-4">
          {[
            {
              step: "1",
              title: "Forward your school emails",
              desc: "Set up a simple Gmail filter to forward school emails to your FamOS inbox address.",
            },
            {
              step: "2",
              title: "We extract what matters",
              desc: "Our AI reads each email and pulls out events, deadlines, action items, and supply requests.",
            },
            {
              step: "3",
              title: "Review your weekly plan",
              desc: "Your dashboard shows a clear, prioritized view of what's coming up and what needs action today.",
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
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </ol>
      </section>
    </Shell>
  );
}
