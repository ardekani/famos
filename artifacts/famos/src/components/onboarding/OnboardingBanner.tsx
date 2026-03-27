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

import { useState } from "react";
import { Link } from "wouter";
import { Users, Mail, ArrowRight, Sparkles, Settings, Copy, Check, Forward } from "lucide-react";

const INBOUND_ADDRESS = "inbox@famops.app";

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
  const [showForward, setShowForward] = useState(false);
  const [copied,      setCopied]      = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(INBOUND_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        Try it instantly by pasting an email, forward one to see it appear automatically,
        or set up full auto-forwarding so every school email flows in on its own.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        {/* Option 1 — Paste */}
        <Link
          href="/try"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" />
          Paste a school email
        </Link>

        {/* Option 2 — Forward one email */}
        <button
          onClick={() => setShowForward((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <Forward className="h-4 w-4" />
          Forward one email
        </button>

        {/* Option 3 — Full auto-forwarding setup */}
        <Link
          href="/setup/gmail-forwarding"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <Settings className="h-4 w-4" />
          Set up auto-forwarding
        </Link>
      </div>

      {/* Inline forward panel */}
      {showForward && (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-foreground mb-1">
            Forward any school email to this address
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Open a school email in Gmail, click Forward, and send it here.
            It'll appear on your dashboard within a few minutes.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm font-semibold text-foreground bg-background border border-border rounded-lg px-3 py-2">
              {INBOUND_ADDRESS}
            </span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5 text-green-600" /><span className="text-green-700">Copied</span></>
              ) : (
                <><Copy className="h-3.5 w-3.5" />Copy address</>
              )}
            </button>
          </div>
        </div>
      )}
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
