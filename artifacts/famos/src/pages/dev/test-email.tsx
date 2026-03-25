/**
 * Dev — Email Extraction Tester
 *
 * Lets developers paste a school email, submit it to POST /api/emails/ingest,
 * and immediately see the full structured extraction result.
 *
 * Useful for iterating on prompt quality without any external tooling.
 */

import { Shell } from "@/components/layout/Shell";
import { useState } from "react";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  StickyNote,
  AlertTriangle,
  Loader2,
  Database,
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
  Zap,
} from "lucide-react";
import { supabase, isSupabaseConfigured, DEV_USER_ID } from "@/lib/supabase";
import type { Child } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────

interface SavedEvent {
  id: string;
  title: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  raw_child_name: string | null;
  confidence: number | null;
}

interface SavedDeadline {
  id: string;
  title: string;
  date: string | null;
  description: string | null;
  raw_child_name: string | null;
  confidence: number | null;
}

interface SavedActionItem {
  id: string;
  task: string;
  due_date: string | null;
  priority: "high" | "medium" | "low";
  raw_child_name: string | null;
  confidence: number | null;
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
  email_id: string;
  processing_status: "failed";
  error: string;
}

type IngestResult = IngestSuccess | IngestFailure;

// ── Sample emails ──────────────────────────────────────────────────────────

interface SampleEmail {
  label: string;
  subject: string;
  body: string;
}

const SAMPLES: SampleEmail[] = [
  {
    label: "Spring Concert & Picture Day",
    subject: "Spring Concert & Picture Day Reminder",
    body: `Dear Families,

We wanted to remind you of two upcoming events this week:

🎵 Spring Concert — Thursday, March 27 at 6:30pm in the school gymnasium.
All students in grades 3–5 are expected to attend. Please arrive by 6:15pm.

📸 Picture Day — Friday, March 28. Individual photos will be taken during class time.
Order forms should be returned by Wednesday, March 26.

Also, the Book Fair runs through Friday!

— Ms. Patel, Principal`,
  },
  {
    label: "Field Trip Permission Slip",
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
    label: "Informational Only",
    subject: "Weekly Newsletter — Week of March 24",
    body: `Hello Riverside Elementary Families,

Thank you to everyone who donated to the canned food drive last week.
We collected over 400 items!

The school library will be closed Monday for inventory.
The new reading corner opens Tuesday.

Wishing everyone a great week,
— The Riverside Team`,
  },
  {
    label: "Multi-child & Urgent",
    subject: "URGENT: Medication Form Required for Both Students",
    body: `Dear Parent/Guardian,

Our records show that Jordan Rivera and Casey Rivera both require updated
medication authorization forms on file before April 1st.

This is required by district policy. Students without completed forms
may not be allowed to attend the upcoming overnight field trip.

Please complete and return the attached form by Friday, March 28.
Forms can also be submitted online at the district portal.

Contact the school nurse at nurse@riverside.edu with any questions.

— Riverside Elementary Office`,
  },
];

// ── Supabase connection check ──────────────────────────────────────────────

type CheckStatus = "idle" | "loading" | "ok" | "error";

function SupabaseCheck() {
  const [status, setStatus] = useState<CheckStatus>("idle");
  const [children, setChildren] = useState<Child[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const runCheck = async () => {
    setStatus("loading");
    setErrorMsg("");
    setChildren([]);

    if (!supabase) {
      setStatus("error");
      setErrorMsg("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("user_id", DEV_USER_ID);

      if (error) throw error;
      setChildren(data ?? []);
      setStatus("ok");
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mb-8 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Supabase Connection</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            isSupabaseConfigured
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}>
            {isSupabaseConfigured ? "Keys set ✓" : "Keys missing"}
          </span>
        </div>
        <button
          onClick={runCheck}
          disabled={status === "loading"}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === "loading" ? (
            <><Loader2 className="h-3 w-3 animate-spin" />Checking…</>
          ) : (
            "Run check"
          )}
        </button>
      </div>

      {status === "ok" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Connected successfully!</span>
          </div>
          {children.length > 0 ? (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">
                Children for dev user ({children.length}):
              </p>
              <ul className="space-y-1">
                {children.map((c) => (
                  <li key={c.id} className="text-xs text-foreground flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    {c.name}{c.school_name ? ` — ${c.school_name}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              No children found. Did you run seed.sql?
            </p>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="flex items-start gap-2 text-sm text-red-600">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Connection failed</p>
            <p className="text-xs mt-0.5 text-red-500">{errorMsg}</p>
          </div>
        </div>
      )}

      {status === "idle" && (
        <p className="text-xs text-muted-foreground">
          Click "Run check" to test the Supabase connection and verify seed data.
        </p>
      )}
    </div>
  );
}

// ── Result display helpers ─────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  const color =
    pct >= 90 ? "text-green-600 bg-green-50" :
    pct >= 70 ? "text-amber-600 bg-amber-50" :
    "text-red-600 bg-red-50";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${color}`}>
      {pct}%
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

function ChildTag({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
      {name}
    </span>
  );
}

function SectionCard({
  icon,
  title,
  count,
  accentClass,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  accentClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <div className={`flex items-center justify-between px-4 pt-4 pb-3 border-b border-border`}>
        <div className="flex items-center gap-2">
          <span className={accentClass}>{icon}</span>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-xs text-muted-foreground italic">No {label} extracted.</p>
  );
}

function RawJsonPanel({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          Raw JSON
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed text-foreground font-mono whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Results panel ──────────────────────────────────────────────────────────

function ResultsPanel({ result, subject }: { result: IngestResult; subject: string }) {
  const isFailed = result.processing_status === "failed";

  return (
    <div className="flex flex-col gap-4">
      {/* Status + link header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {isFailed ? (
            <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              <XCircle className="h-3.5 w-3.5" />
              Extraction failed
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Processed
            </span>
          )}
          <span className="text-xs text-muted-foreground font-mono truncate max-w-[180px]" title={result.email_id}>
            {result.email_id.slice(0, 8)}…
          </span>
        </div>
        <a
          href={`/emails/${result.email_id}`}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View saved email
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Extraction error */}
      {isFailed && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">Extraction error</p>
              <p className="mt-1 text-xs text-red-700 font-mono leading-relaxed">{result.error}</p>
            </div>
          </div>
        </div>
      )}

      {!isFailed && (() => {
        const { saved } = result;
        const totalItems =
          saved.events.length +
          saved.deadlines.length +
          saved.action_items.length +
          saved.notes.length;

        return (
          <>
            {totalItems === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2">
                  <StickyNote className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">
                    No structured data extracted. The email may be informational only — try the Notes section or check the raw JSON.
                  </p>
                </div>
              </div>
            )}

            {/* Events */}
            <SectionCard
              icon={<CalendarDays className="h-4 w-4" />}
              title="Events"
              count={saved.events.length}
              accentClass="text-primary"
            >
              {saved.events.length === 0 ? (
                <EmptyState label="events" />
              ) : (
                <ul className="divide-y divide-border -mx-4 px-4">
                  {saved.events.map((ev) => (
                    <li key={ev.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{ev.title}</p>
                        <ConfidenceBadge value={ev.confidence} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {ev.date && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3" />
                            {ev.date}
                            {ev.start_time && ` at ${ev.start_time}`}
                            {ev.end_time && ` – ${ev.end_time}`}
                          </span>
                        )}
                        {ev.location && (
                          <span className="text-xs text-muted-foreground">📍 {ev.location}</span>
                        )}
                        <ChildTag name={ev.raw_child_name} />
                      </div>
                      {ev.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{ev.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Deadlines */}
            <SectionCard
              icon={<Clock className="h-4 w-4" />}
              title="Deadlines"
              count={saved.deadlines.length}
              accentClass="text-amber-600"
            >
              {saved.deadlines.length === 0 ? (
                <EmptyState label="deadlines" />
              ) : (
                <ul className="divide-y divide-border -mx-4 px-4">
                  {saved.deadlines.map((d) => (
                    <li key={d.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{d.title}</p>
                        <ConfidenceBadge value={d.confidence} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {d.date && (
                          <span className="text-xs text-muted-foreground">Due {d.date}</span>
                        )}
                        <ChildTag name={d.raw_child_name} />
                      </div>
                      {d.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{d.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Action Items */}
            <SectionCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Action Items"
              count={saved.action_items.length}
              accentClass="text-green-600"
            >
              {saved.action_items.length === 0 ? (
                <EmptyState label="action items" />
              ) : (
                <ul className="divide-y divide-border -mx-4 px-4">
                  {saved.action_items.map((a) => (
                    <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{a.task}</p>
                        <ConfidenceBadge value={a.confidence} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <PriorityBadge priority={a.priority} />
                        {a.due_date && (
                          <span className="text-xs text-muted-foreground">Due {a.due_date}</span>
                        )}
                        <ChildTag name={a.raw_child_name} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Notes */}
            <SectionCard
              icon={<StickyNote className="h-4 w-4" />}
              title="Notes"
              count={saved.notes.length}
              accentClass="text-slate-500"
            >
              {saved.notes.length === 0 ? (
                <EmptyState label="notes" />
              ) : (
                <ul className="space-y-2">
                  {saved.notes.map((n) => (
                    <li key={n.id} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                      <div>
                        <p className="text-sm text-foreground">{n.content}</p>
                        <ChildTag name={n.raw_child_name} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Raw JSON */}
            <RawJsonPanel data={result} />
          </>
        );
      })()}

      {/* Always show raw JSON on failure */}
      {isFailed && <RawJsonPanel data={result} />}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function TestEmailPage() {
  const [subject, setSubject] = useState(SAMPLES[0].subject);
  const [body, setBody] = useState(SAMPLES[0].body);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const loadSample = (sample: SampleEmail) => {
    setSubject(sample.subject);
    setBody(sample.body);
    setResult(null);
    setNetworkError(null);
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !body.trim()) return;
    setLoading(true);
    setResult(null);
    setNetworkError(null);

    try {
      const res = await fetch("/api/emails/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });

      const json = await res.json() as IngestResult;
      setResult(json);
    } catch (e: unknown) {
      setNetworkError(
        e instanceof Error
          ? e.message
          : "Network error — is the API server running?"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      {/* Page header */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Dev Tool
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Dev Tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Test Supabase connectivity and iterate on extraction prompt quality.
        </p>
      </div>

      {/* Supabase check */}
      <SupabaseCheck />

      {/* Divider */}
      <div className="mb-8 border-t border-border" />

      {/* Email tester */}
      <div className="mb-5 flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">Email Extraction Tester</h2>
      </div>

      {/* Sample email loader buttons */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Load sample email
        </p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => loadSample(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                subject === s.subject && body === s.body
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Left: input form ── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="subject" className="text-sm font-semibold text-foreground">
              Subject
            </label>
            <input
              id="subject"
              type="text"
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="body" className="text-sm font-semibold text-foreground">
              Body
            </label>
            <textarea
              id="body"
              className="min-h-[360px] w-full rounded-xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Paste the email body here…"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !subject.trim() || !body.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Extracting…</>
            ) : (
              <><Zap className="h-4 w-4" />Run extraction</>
            )}
          </button>

          {/* Tiny hint */}
          <p className="text-xs text-muted-foreground text-center">
            Submits to <code className="font-mono bg-muted px-1 py-0.5 rounded text-[11px]">POST /api/emails/ingest</code> and saves to Supabase.
          </p>
        </div>

        {/* ── Right: results ── */}
        <div>
          {/* Idle state */}
          {!result && !loading && !networkError && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 text-center">
              <Zap className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                Results will appear here
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Load a sample email or paste your own, then click "Run extraction".
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-xl border border-border bg-card px-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium text-foreground">Calling OpenAI…</p>
              <p className="mt-1 text-xs text-muted-foreground">
                gpt-4o-mini is reading the email. This takes 2–6 seconds.
              </p>
            </div>
          )}

          {/* Network error */}
          {networkError && !loading && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Network error</p>
                  <p className="mt-1 text-xs text-red-700 font-mono">{networkError}</p>
                  <p className="mt-2 text-xs text-red-600">
                    Make sure the API server workflow is running.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <ResultsPanel result={result} subject={subject} />
          )}
        </div>
      </div>
    </Shell>
  );
}
