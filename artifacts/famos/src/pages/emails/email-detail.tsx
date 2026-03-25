/**
 * Email detail page — /emails/:id
 * Shows a single processed email with extracted events, action items, and raw body.
 * Placeholder data for now.
 */

import { Shell } from "@/components/layout/Shell";
import { useParams, Link } from "wouter";
import { ArrowLeft, CalendarDays, CheckCircle2, ShoppingCart } from "lucide-react";

// Placeholder email data — keyed by id
const MOCK_EMAILS: Record<
  string,
  {
    id: string;
    subject: string;
    from: string;
    date: string;
    body: string;
    events: { title: string; date: string }[];
    actionItems: string[];
    supplies: string[];
  }
> = {
  "sample-1": {
    id: "sample-1",
    subject: "Spring Concert & Picture Day Reminder",
    from: "principal@riverside.edu",
    date: "Mon, March 24, 2026",
    body: `Dear Families,

We wanted to remind you of two upcoming events this week:

🎵 Spring Concert — Thursday, March 27 at 6:30pm in the school gymnasium.
All students in grades 3–5 are expected to attend. Please arrive by 6:15pm.

📸 Picture Day — Friday, March 28. Individual photos will be taken during class time.
Order forms should be returned by Wednesday.

Also, the Book Fair runs through Friday! Students can visit during their library period,
or families are welcome to shop before and after school.

Thank you for your continued support.

— Ms. Patel, Principal`,
    events: [
      { title: "Spring Concert", date: "Thu, March 27 at 6:30pm" },
      { title: "Picture Day", date: "Fri, March 28" },
      { title: "Book Fair ends", date: "Fri, March 28" },
    ],
    actionItems: [
      "Return picture day order form by Wednesday",
      "Arrive at Spring Concert by 6:15pm (grades 3–5)",
    ],
    supplies: [],
  },
  "sample-2": {
    id: "sample-2",
    subject: "Field Trip Permission Slip — Due Friday",
    from: "teacher@riverside.edu",
    date: "Tue, March 25, 2026",
    body: `Hi families,

Our class field trip to the Science Museum is coming up on April 3rd.
Please return the signed permission slip by this Friday, March 29.

Students should bring:
- A bag lunch (no nut products)
- Comfortable walking shoes
- $5 for the planetarium show

Let me know if you have any questions!

— Ms. Chen`,
    events: [
      { title: "Science Museum Field Trip", date: "Thu, April 3" },
    ],
    actionItems: [
      "Return signed permission slip by Fri, March 29",
      "Pack bag lunch (nut-free) on April 3",
    ],
    supplies: ["$5 for planetarium show", "Comfortable walking shoes"],
  },
};

export default function EmailDetailPage() {
  const params = useParams<{ id: string }>();
  const emailId = params.id ?? "sample-1";
  const email = MOCK_EMAILS[emailId];

  if (!email) {
    return (
      <Shell>
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Email not found.</p>
          <Link href="/dashboard">
            <span className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </span>
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Back link */}
      <Link href="/dashboard">
        <span className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </span>
      </Link>

      {/* Email header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{email.subject}</h1>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>From: {email.from}</span>
          <span>•</span>
          <span>{email.date}</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Extracted: Events */}
        {email.events.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Events Found
              </h2>
            </div>
            <ul className="space-y-2">
              {email.events.map((ev, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-2" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {ev.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{ev.date}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Extracted: Action items */}
        {email.actionItems.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Action Items
              </h2>
            </div>
            <ul className="space-y-2">
              {email.actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-2" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Extracted: Supplies */}
        {email.supplies.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="mb-3 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Things to Bring / Buy
              </h2>
            </div>
            <ul className="space-y-2">
              {email.supplies.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-2" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Raw email body */}
      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-xs">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Original Email
        </h2>
        <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans leading-relaxed">
          {email.body}
        </pre>
      </section>
    </Shell>
  );
}
