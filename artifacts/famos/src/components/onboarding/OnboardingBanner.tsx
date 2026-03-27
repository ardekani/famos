/**
 * OnboardingBanner — guides a new user through the 3-step setup.
 *
 * Steps detected automatically from real data:
 *   1. No children       → Add your children
 *   2. Children, no emails → Send your first school email
 *   3. Complete          → null (banner hidden)
 *
 * Props come from the parent (dashboard already has the data),
 * so no extra queries happen here.
 */

import { Link } from "wouter";
import { Users, Mail, ArrowRight, Sparkles, Settings } from "lucide-react";

type Step = 1 | 2;

interface Props {
  hasChildren: boolean;
  hasEmails:   boolean;
  loading?:    boolean;
}

// ── Step dots ─────────────────────────────────────────────────────────────

function StepDots({ current }: { current: Step }) {
  const steps = [1, 2, 3] as const;
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s) => (
        <span
          key={s}
          className={[
            "h-2 rounded-full transition-all",
            s < current
              ? "w-2 bg-primary"
              : s === current
              ? "w-4 bg-primary"
              : "w-2 bg-border",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

// ── Step 1 — Add children ──────────────────────────────────────────────────

function Step1Card() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Step 1 of 3
          </span>
        </div>
        <StepDots current={1} />
      </div>

      <h2 className="text-lg font-bold text-foreground">Add your children</h2>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-lg">
        FamOS needs to know who your kids are so it can link school emails to
        the right person — events, deadlines, and action items will show each
        child's name.
      </p>

      <div className="mt-5">
        <Link
          href="/children"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          Add your first child <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ── Step 2 — First email ───────────────────────────────────────────────────

function Step2Card() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Step 2 of 3
          </span>
        </div>
        <StepDots current={2} />
      </div>

      <h2 className="text-lg font-bold text-foreground">
        Bring in your first school email
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-lg">
        Paste a real school email to see FamOS extract events and action items
        instantly — or set up automatic forwarding so emails flow in on their own.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/try"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" />
          Paste a school email
        </Link>
        <Link
          href="/setup/gmail-forwarding"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <Settings className="h-4 w-4" />
          Set up auto-forwarding
        </Link>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function OnboardingBanner({ hasChildren, hasEmails, loading }: Props) {
  if (loading) return null;
  if (hasChildren && hasEmails) return null; // onboarding complete

  const step: Step = !hasChildren ? 1 : 2;

  return (
    <div className="mb-8">
      {step === 1 && <Step1Card />}
      {step === 2 && <Step2Card />}
    </div>
  );
}
