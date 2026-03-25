/**
 * Dev — Test Email page.
 * Lets developers paste a raw email and see how FamOS would parse it.
 * Also includes a Supabase connection check.
 */

import { Shell } from "@/components/layout/Shell";
import { useState } from "react";
import { CalendarDays, CheckCircle2, ShoppingCart, Loader2, Database, XCircle } from "lucide-react";
import { supabase, isSupabaseConfigured, DEV_USER_ID } from "@/lib/supabase";
import type { Child } from "@/types/database";

// ── Supabase connection check ─────────────────────────────────────────────

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
          {/* Env var status badge */}
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
            <><Loader2 className="h-3 w-3 animate-spin" /> Checking…</>
          ) : (
            "Run check"
          )}
        </button>
      </div>

      {/* Result */}
      {status === "ok" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Connected successfully!</span>
          </div>
          {children.length > 0 ? (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">
                Children found for dev user ({children.length}):
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
              No children found for dev user. Did you run seed.sql?
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
          Click "Run check" to test the Supabase connection and verify your seed data loaded correctly.
        </p>
      )}
    </div>
  );
}

// ── Email parser ──────────────────────────────────────────────────────────

const SAMPLE_EMAIL = `Subject: Spring Concert & Field Trip Reminder

Dear Families,

Just a quick reminder about two upcoming events:

🎵 Spring Concert is this Thursday, March 27 at 6:30pm in the gymnasium.
Grades 3–5 must arrive by 6:15pm. 

🚌 Permission slips for the April 3rd Science Museum trip are due Friday.
Students should bring a bag lunch (nut-free) and $5 for the planetarium.

Also: Don't forget gym shoes are required every Wednesday.

Thanks,
Ms. Patel`;

interface ParsedResult {
  events: { title: string; date: string }[];
  actionItems: string[];
  supplies: string[];
}

function mockParseEmail(_body: string): ParsedResult {
  return {
    events: [
      { title: "Spring Concert", date: "Thu, March 27 at 6:30pm" },
      { title: "Science Museum Field Trip", date: "Thu, April 3" },
    ],
    actionItems: [
      "Arrive at Spring Concert by 6:15pm (grades 3–5)",
      "Return signed permission slip by Friday",
      "Pack nut-free bag lunch on April 3",
      "Pack gym shoes every Wednesday",
    ],
    supplies: ["$5 for planetarium show"],
  };
}

export default function TestEmailPage() {
  const [emailBody, setEmailBody] = useState(SAMPLE_EMAIL);
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleParse = async () => {
    setLoading(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 900));
    setResult(mockParseEmail(emailBody));
    setLoading(false);
  };

  return (
    <Shell>
      {/* Header */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Dev Tool
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Dev Tools</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Check your Supabase connection and test the email parser.
        </p>
      </div>

      {/* Supabase connection check */}
      <SupabaseCheck />

      {/* Email parser */}
      <h2 className="mb-4 text-base font-semibold text-foreground">Email Parser Test</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label htmlFor="email-body" className="text-sm font-semibold text-foreground">
            Email content
          </label>
          <textarea
            id="email-body"
            className="min-h-[320px] w-full rounded-xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono"
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="Paste a school email here…"
          />
          <button
            onClick={handleParse}
            disabled={loading || !emailBody.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Parsing…</>
            ) : (
              "Parse email"
            )}
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {!result && !loading && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 py-16 text-center">
              <p className="text-sm text-muted-foreground">Results will appear here after parsing.</p>
            </div>
          )}
          {loading && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {result && (
            <div className="space-y-4">
              {result.events.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      Events ({result.events.length})
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {result.events.map((ev, i) => (
                      <li key={i}>
                        <p className="text-sm font-medium text-foreground">{ev.title}</p>
                        <p className="text-xs text-muted-foreground">{ev.date}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.actionItems.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                  <div className="mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      Action Items ({result.actionItems.length})
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {result.actionItems.map((item, i) => (
                      <li key={i} className="text-sm text-foreground flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.supplies.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                  <div className="mb-3 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-foreground">
                      Things to Bring ({result.supplies.length})
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {result.supplies.map((item, i) => (
                      <li key={i} className="text-sm text-foreground flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
