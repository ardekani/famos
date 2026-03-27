/**
 * Try it — paste a school email and see instant extraction.
 *
 * Available to all authenticated users. Submits to POST /api/emails/ingest
 * (user-scoped) and shows the extracted events, deadlines, action items, and notes.
 *
 * This is the production equivalent of the dev extraction tester — no debugging
 * details, just the value: "here's what FamOS pulled from your email."
 */

import { useState } from "react";
import { Link } from "wouter";
import { Shell } from "@/components/layout/Shell";
import { apiFetch } from "@/lib/api";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  CheckCircle2,
  StickyNote,
  Loader2,
  Sparkles,
  AlertTriangle,
  LayoutDashboard,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface SavedEvent {
  id: string;
  title: string;
  date: string | null;
  start_time: string | null;
  location: string | null;
  raw_child_name: string | null;
}

interface SavedDeadline {
  id: string;
  title: string;
  date: string | null;
  raw_child_name: string | null;
}

interface SavedActionItem {
  id: string;
  task: string;
  due_date: string | null;
  priority: "high" | "medium" | "low";
  raw_child_name: string | null;
}

interface SavedNote {
  id: string;
  content: string;
  raw_child_name: string | null;
}

interface IngestSuccess {
  email_id: string;
  processing_status: "processed";
  saved: {
    events: SavedEvent[];
    deadlines: SavedDeadline[];
    action_items: SavedActionItem[];
    notes: SavedNote[];
  };
}

interface IngestFailure {
  email_id?: string;
  processing_status: "failed";
  error: string;
}

type IngestResult = IngestSuccess | IngestFailure;

// ── Sample emails ──────────────────────────────────────────────────────────

const SAMPLES = [
  {
    label: "Field trip + permission slip",
    subject: "Field Trip Permission Slip — Due Friday",
    body: `Hi families,

Our class field trip to the Science Museum is coming up on April 3rd.
Please return the signed permission slip by this Friday, March 29.

Students should bring:
- A bag lunch (no nut products)
- Comfortable walking shoes
- $5 for the planetarium show

Jordan's group will leave at 8:30am and return by 3pm.

— Ms. Chen`,
  },
  {
    label: "Spring concert + picture day",
    subject: "Spring Concert & Picture Day Reminder",
    body: `Dear Families,

We wanted to remind you of two upcoming events this week:

🎵 Spring Concert — Thursday, April 10 at 6:30pm in the school gymnasium.
All students in grades 3–5 are expected to attend. Please arrive by 6:15pm.

📸 Picture Day — Friday, April 11. Individual photos will be taken during class time.
Order forms should be returned by Wednesday, April 9.

Also, the Book Fair runs through Friday!

— Ms. Patel, Principal`,
  },
];

// ── Small helpers ──────────────────────────────────────────────────────────

function ChildTag({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
      {name}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const styles = {
    high:   "bg-red-50 text-red-700",
    medium: "bg-amber-50 text-amber-700",
    low:    "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[priority]}`}>
      {priority}
    </span>
  );
}

// ── Results ────────────────────────────────────────────────────────────────

function ResultsView({ result }: { result: IngestSuccess }) {
  const { saved } = result;
  const total = saved.events.length + saved.deadlines.length + saved.action_items.length + saved.notes.length;

  return (
    <div className="mt-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50">
            <Sparkles className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Extraction complete</p>
            <p className="text-xs text-muted-foreground">
              {total} item{total !== 1 ? "s" : ""} found — now saved to your dashboard
            </p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <LayoutDashboard className="h-4 w-4" />
          View dashboard
        </Link>
      </div>

      {total === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            No structured events or deadlines found — the email may be informational only.
            It's still saved and will appear in your School Emails section.
          </p>
        </div>
      )}

      {/* Events */}
      {saved.events.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-muted/30">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Events</span>
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {saved.events.length}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {saved.events.map((ev) => (
              <li key={ev.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{ev.title}</p>
                  <ChildTag name={ev.raw_child_name} />
                </div>
                {(ev.date || ev.location) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ev.date && <span>{ev.date}{ev.start_time ? ` at ${ev.start_time}` : ""}</span>}
                    {ev.location && <span> · {ev.location}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Deadlines */}
      {saved.deadlines.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-muted/30">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-foreground">Deadlines</span>
            <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              {saved.deadlines.length}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {saved.deadlines.map((d) => (
              <li key={d.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{d.title}</p>
                  <ChildTag name={d.raw_child_name} />
                </div>
                {d.date && (
                  <p className="mt-0.5 text-xs text-muted-foreground">Due {d.date}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Items */}
      {saved.action_items.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-muted/30">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold text-foreground">Action Items</span>
            <span className="ml-auto rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              {saved.action_items.length}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {saved.action_items.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{a.task}</p>
                  <ChildTag name={a.raw_child_name} />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <PriorityBadge priority={a.priority} />
                  {a.due_date && (
                    <span className="text-xs text-muted-foreground">Due {a.due_date}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {saved.notes.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-muted/30">
            <StickyNote className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-foreground">Notes</span>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {saved.notes.length}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {saved.notes.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <p className="text-sm text-foreground">{n.content}</p>
                <ChildTag name={n.raw_child_name} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next step nudge */}
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-5 py-4">
        <p className="text-sm font-medium text-foreground">Want this to happen automatically?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up Gmail forwarding and every school email will be parsed as soon as it arrives — no pasting needed.
        </p>
        <Link
          href="/setup/gmail-forwarding"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-2"
        >
          Set up auto-forwarding <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function TryPage() {
  const [subject,      setSubject]      = useState("");
  const [body,         setBody]         = useState("");
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<IngestResult | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const loadSample = (s: typeof SAMPLES[number]) => {
    setSubject(s.subject);
    setBody(s.body);
    setResult(null);
    setNetworkError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;

    setLoading(true);
    setResult(null);
    setNetworkError(null);

    try {
      const res  = await apiFetch("/api/emails/ingest", {
        method: "POST",
        body:   JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });
      const json = await res.json() as IngestResult;
      setResult(json);
    } catch (e) {
      setNetworkError(e instanceof Error ? e.message : "Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = result && result.processing_status === "processed";
  const isError   = result && result.processing_status === "failed";

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
          Quick start
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Paste a school email
        </h1>
        <p className="mt-3 max-w-xl text-base text-muted-foreground leading-relaxed">
          Copy any email from your school — newsletter, reminder, permission slip — paste it below
          and FamOS will extract events, deadlines, and action items in seconds.
        </p>
      </div>

      {/* Sample loader */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Try a sample
        </p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => loadSample(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                subject === s.subject
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-2xl">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="subject" className="text-sm font-semibold text-foreground">
            Subject line
          </label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setResult(null); }}
            placeholder="e.g. Spring Concert Reminder"
            disabled={loading}
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="body" className="text-sm font-semibold text-foreground">
            Email body
          </label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => { setBody(e.target.value); setResult(null); }}
            placeholder="Paste the full email text here…"
            rows={10}
            disabled={loading}
            className="w-full resize-y rounded-xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 font-mono leading-relaxed"
          />
        </div>

        {networkError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700">{networkError}</p>
          </div>
        )}

        {isError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700">
              Extraction failed: {(result as IngestFailure).error}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !subject.trim() || !body.trim()}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Extracting…</>
          ) : (
            <><Sparkles className="h-4 w-4" />Extract events &amp; actions</>
          )}
        </button>
      </form>

      {/* Results */}
      {isSuccess && <ResultsView result={result as IngestSuccess} />}
    </Shell>
  );
}
