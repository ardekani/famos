/**
 * Dashboard page.
 * Shows this week's events, upcoming deadlines, and action items.
 * Placeholder data for now — wire to API/Supabase when ready.
 */

import { Shell } from "@/components/layout/Shell";
import { CalendarDays, Clock, CheckCircle2, AlertCircle } from "lucide-react";

// --- Placeholder data ---

const upcomingEvents = [
  {
    id: "e1",
    title: "Spring Concert",
    date: "Thu, Mar 27",
    school: "Riverside Elementary",
    tag: "Event",
  },
  {
    id: "e2",
    title: "Picture Day",
    date: "Fri, Mar 28",
    school: "Riverside Elementary",
    tag: "Reminder",
  },
  {
    id: "e3",
    title: "Book Fair ends",
    date: "Fri, Mar 28",
    school: "Riverside Elementary",
    tag: "Deadline",
  },
];

const actionItems = [
  {
    id: "a1",
    text: "Return signed permission slip for field trip",
    due: "Tomorrow",
    priority: "high",
  },
  {
    id: "a2",
    text: "Bring $5 for book fair",
    due: "This week",
    priority: "medium",
  },
  {
    id: "a3",
    text: "Pack gym shoes on Wednesday",
    due: "Wed, Mar 26",
    priority: "medium",
  },
];

const tagColors: Record<string, string> = {
  Event: "bg-blue-50 text-blue-700",
  Reminder: "bg-amber-50 text-amber-700",
  Deadline: "bg-red-50 text-red-700",
};

export default function DashboardPage() {
  return (
    <Shell>
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">This Week</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            March 24 – March 30, 2026
          </p>
        </div>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          3 items need action
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming events */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Upcoming Events
            </h2>
          </div>
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between rounded-xl border border-border bg-card p-4 shadow-xs"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {event.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.school}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {event.date}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagColors[event.tag] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {event.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Action items */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Action Items
            </h2>
          </div>
          <div className="space-y-3">
            {actionItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-xs"
              >
                {item.priority === "high" ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm text-foreground">{item.text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Due: {item.due}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Placeholder empty state hint */}
      <div className="mt-10 rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          More emails = more items here.{" "}
          <a
            href="/setup/gmail-forwarding"
            className="text-primary underline-offset-4 hover:underline"
          >
            Set up Gmail forwarding
          </a>{" "}
          to get started.
        </p>
      </div>
    </Shell>
  );
}
