/**
 * Setup — Gmail Forwarding page.
 * Walks the user through setting up Gmail forwarding to their FamOS inbox.
 * No Gmail OAuth; manual forwarding only.
 */

import { Shell } from "@/components/layout/Shell";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";

// Placeholder forwarding address — will be user-specific once auth is real
const FORWARDING_ADDRESS = "inbox+demo@famos.app";

const steps = [
  {
    id: 1,
    title: "Open Gmail Settings",
    instructions: [
      'In Gmail, click the gear icon (⚙️) in the top-right corner.',
      'Select "See all settings".',
    ],
  },
  {
    id: 2,
    title: 'Go to "Filters and Blocked Addresses"',
    instructions: [
      'Click the "Filters and Blocked Addresses" tab.',
      'Click "Create a new filter".',
    ],
  },
  {
    id: 3,
    title: "Set up the filter",
    instructions: [
      'In the "From" field, enter your school\'s email domain (e.g. @district.edu).',
      'Click "Create filter".',
      'Check "Forward it to" and select your FamOS address below.',
    ],
  },
  {
    id: 4,
    title: "Confirm forwarding",
    instructions: [
      "Gmail will send a confirmation email to your FamOS address.",
      "Check back here — we'll confirm when the connection is active.",
    ],
  },
];

export default function GmailForwardingPage() {
  return (
    <Shell>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span>Setup</span>
          <ArrowRight className="h-3 w-3" />
          <span className="text-foreground">Gmail Forwarding</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Connect your school emails
        </h1>
        <p className="mt-2 text-muted-foreground">
          Forward your school emails to FamOS and we'll automatically extract
          events, deadlines, and action items.
        </p>
      </div>

      {/* Forwarding address card */}
      <div className="mb-8 rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Your FamOS inbox address
            </p>
            <p className="text-sm font-semibold text-foreground">
              {FORWARDING_ADDRESS}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Forward school emails to this address. Each email will be processed
          and added to your dashboard.
        </p>
      </div>

      {/* Step-by-step instructions */}
      <div className="space-y-4">
        {steps.map((step) => (
          <div
            key={step.id}
            className="rounded-xl border border-border bg-card p-5 shadow-xs"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {step.id}
              </div>
              <div>
                <p className="font-semibold text-foreground">{step.title}</p>
                <ul className="mt-2 space-y-1.5">
                  {step.instructions.map((line, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Note about OAuth */}
      <div className="mt-8 rounded-xl border border-dashed border-border bg-muted/40 p-5">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Why manual forwarding?</strong>{" "}
          We don't need access to your entire Gmail account — just the emails
          you choose to forward. This keeps things simple and private.
        </p>
      </div>
    </Shell>
  );
}
