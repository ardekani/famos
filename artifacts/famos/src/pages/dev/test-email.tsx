/**
 * Dev — Test Email page.
 * Lets developers paste a raw email and see how FamOS would parse it.
 * Simulates the AI extraction with a fake/mock response.
 */

import { Shell } from "@/components/layout/Shell";
import { useState } from "react";
import { CalendarDays, CheckCircle2, ShoppingCart, Loader2 } from "lucide-react";

// Sample email to pre-fill the textarea
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

// Mock parser — simulates what the AI would return
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
    // Simulate async processing delay
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
        <h1 className="text-2xl font-bold text-foreground">Test Email Parser</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Paste a raw school email below and see how FamOS would extract events,
          action items, and supplies. Uses a mock parser — no AI calls made.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Input */}
        <div className="flex flex-col gap-3">
          <label
            htmlFor="email-body"
            className="text-sm font-semibold text-foreground"
          >
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
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing…
              </>
            ) : (
              "Parse email"
            )}
          </button>
        </div>

        {/* Output */}
        <div className="flex flex-col gap-4">
          {!result && !loading && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                Results will appear here after parsing.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Events */}
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
                        <p className="text-sm font-medium text-foreground">
                          {ev.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ev.date}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action items */}
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
                      <li
                        key={i}
                        className="text-sm text-foreground flex items-start gap-2"
                      >
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Supplies */}
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
                      <li
                        key={i}
                        className="text-sm text-foreground flex items-start gap-2"
                      >
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
