/**
 * Dev seed fixtures — 10 sample school emails.
 *
 * Each fixture includes:
 *   - Raw email content (subject + body + sender)
 *   - `expected` block documenting the intended extraction behavior
 *
 * The `expected` block is human-readable documentation for now.
 * It is structured so that golden-test assertions can be added later
 * by iterating over `expected.events`, `expected.deadlines`, etc.
 * and comparing against the actual DB rows.
 *
 * Special-case flags:
 *   multiChild        — email mentions more than one child by name
 *   vagueDates        — date is relative ("tomorrow", "later this week")
 *                       and cannot be resolved to YYYY-MM-DD without context
 *   informationalOnly — no actionable items; expect only notes or empty arrays
 *   testsFocus        — describes the specific edge case this fixture covers
 */

export interface ExpectedBehavior {
  description: string;
  events?: string[];
  deadlines?: string[];
  action_items?: string[];
  notes?: string[];
  multiChild?: boolean;
  vagueDates?: boolean;
  informationalOnly?: boolean;
  testsFocus?: string;
}

export interface SeedFixture {
  subject: string;
  body: string;
  sender: string;
  expected: ExpectedBehavior;
}

export const SEED_FIXTURES: SeedFixture[] = [
  // ── 1. Field Trip Reminder ───────────────────────────────────────────────
  // Tests: event with start/end time, deadline, action item with due date
  {
    subject: "Field Trip Reminder — Science Museum",
    sender:  "teacher@school.edu",
    body: `Dear parents,
Our class will be going to the Science Museum on March 28 from 9am to 2pm.
Please sign and return the permission slip by March 26.
Students should bring a packed lunch.
Best,
School`,
    expected: {
      description: "Field trip with explicit start/end times, a deadline, and an action item",
      events: [
        "Science Museum field trip on March 28, 09:00–14:00",
      ],
      deadlines: [
        "Return signed permission slip by March 26",
      ],
      action_items: [
        "Sign and return permission slip by March 26 (high priority)",
        "Pack a lunch for the field trip (medium priority)",
      ],
      testsFocus: "Event with start+end time, deadline with explicit date, multiple action items",
    },
  },

  // ── 2. Pajama Day This Friday ────────────────────────────────────────────
  // Tests: vague date ("this Friday"), single informational event, no deadline
  {
    subject: "Pajama Day This Friday",
    sender:  "teacher@school.edu",
    body: `Friday is Pajama Day! Students are welcome to wear pajamas to school.`,
    expected: {
      description: "Fun day announcement with a vague relative date",
      events: [
        "Pajama Day this Friday (date unresolvable without context)",
      ],
      deadlines: [],
      action_items: [],
      notes: [
        "Pajama Day is optional — students are 'welcome' to participate",
      ],
      vagueDates: true,
      testsFocus: "Relative date ('this Friday') — model should not hallucinate an ISO date",
    },
  },

  // ── 3. PTA Meeting Tonight ───────────────────────────────────────────────
  // Tests: vague date ("tonight"), event with time + location, no action item
  {
    subject: "PTA Meeting Tonight",
    sender:  "pta@school.edu",
    body: `Please join us tonight at 7pm in the library for the monthly PTA meeting.`,
    expected: {
      description: "Event with time and location but vague date",
      events: [
        "PTA meeting tonight at 19:00 in the library (date unresolvable without context)",
      ],
      deadlines: [],
      action_items: [],
      vagueDates: true,
      testsFocus: "Vague date ('tonight') — start_time should be 19:00, date should be null",
    },
  },

  // ── 4. Emma and Noah Spring Concert ─────────────────────────────────────
  // Tests: multi-child email, two different arrival times, single main event
  {
    subject: "Spring Concert — Emma and Noah",
    sender:  "music@school.edu",
    body: `Emma should arrive by 5:30pm for warm-up. Noah should arrive by 6:00pm. The Spring Concert begins at 6:30pm on April 12 in the school auditorium.`,
    expected: {
      description: "Two children with different arrival times at the same event",
      events: [
        "Spring Concert on April 12 at 18:30 in the school auditorium",
      ],
      deadlines: [],
      action_items: [
        "Bring Emma to school by 17:30 for warm-up (high priority)",
        "Bring Noah to school by 18:00 (high priority)",
      ],
      multiChild: true,
      testsFocus: "Multi-child extraction — Emma and Noah should map to separate child records if seeded",
    },
  },

  // ── 5. Weekly Snack Reminder ─────────────────────────────────────────────
  // Tests: recurring task, no specific date, low-priority action item
  {
    subject: "Weekly Snack Reminder",
    sender:  "teacher@school.edu",
    body: `Please remember to send snacks every Monday.`,
    expected: {
      description: "Recurring weekly reminder with no specific date",
      events: [],
      deadlines: [],
      action_items: [
        "Send snacks every Monday (low priority, recurring)",
      ],
      notes: [
        "Snacks are required every Monday",
      ],
      testsFocus: "Recurring / no-date task — due_date should be null, priority should be low",
    },
  },

  // ── 6. Next Week Schedule Attached ──────────────────────────────────────
  // Tests: attachment reference with no extractable content — notes only or empty
  {
    subject: "Next Week Schedule Attached",
    sender:  "admin@school.edu",
    body: `See attached schedule for next week.`,
    expected: {
      description: "Email with content only in an attachment — body has no extractable data",
      events: [],
      deadlines: [],
      action_items: [],
      notes: [
        "Schedule for next week is in the attachment — no inline details provided",
      ],
      informationalOnly: true,
      testsFocus: "Graceful handling of near-empty body — should prefer notes over hallucinating events",
    },
  },

  // ── 7. Reminder: Field Trip Tomorrow ────────────────────────────────────
  // Tests: follow-up reminder with vague date, minimal new info
  {
    subject: "Reminder: Field Trip Tomorrow",
    sender:  "teacher@school.edu",
    body: `Just a reminder that the Science Museum field trip is tomorrow. Don't forget packed lunch.`,
    expected: {
      description: "Follow-up reminder — event tomorrow, action item to pack lunch",
      events: [
        "Science Museum field trip tomorrow (date unresolvable without context)",
      ],
      deadlines: [],
      action_items: [
        "Pack a lunch for tomorrow's field trip (high priority, time-sensitive)",
      ],
      vagueDates: true,
      testsFocus: "Relative date ('tomorrow') — date should be null, action item should be high priority",
    },
  },

  // ── 8. Bring Swimsuit Tomorrow ───────────────────────────────────────────
  // Tests: urgent single action item, vague date, no event
  {
    subject: "Bring Swimsuit Tomorrow",
    sender:  "teacher@school.edu",
    body: `Reminder: students need to bring a swimsuit tomorrow for water play.`,
    expected: {
      description: "Urgent supply reminder with a vague date",
      events: [],
      deadlines: [],
      action_items: [
        "Bring a swimsuit tomorrow for water play (high priority)",
      ],
      vagueDates: true,
      testsFocus: "Supply action item — no event, only action_item; due_date should be null",
    },
  },

  // ── 9. School Performance Later This Week ───────────────────────────────
  // Tests: vague upcoming event with no time or date, notes-heavy output
  {
    subject: "School Performance Later This Week",
    sender:  "teacher@school.edu",
    body: `Later this week we'll have a special student performance. More details coming soon.`,
    expected: {
      description: "Teaser announcement — no actionable info yet, should produce a note",
      events: [
        "Student performance later this week (no time or location yet)",
      ],
      deadlines: [],
      action_items: [],
      notes: [
        "More details about the performance are coming soon",
      ],
      vagueDates: true,
      informationalOnly: true,
      testsFocus: "Vague event announcement — date should be null, confidence should be low",
    },
  },

  // ── 10. Thank You for Supporting Our Fundraiser ──────────────────────────
  // Tests: purely informational thank-you — no events, deadlines, or action items
  {
    subject: "Thank You for Supporting Our Fundraiser",
    sender:  "pta@school.edu",
    body: `Thank you for supporting our fundraiser!`,
    expected: {
      description: "One-sentence thank-you — entirely informational",
      events: [],
      deadlines: [],
      action_items: [],
      notes: [
        "Acknowledgement of fundraiser support — no follow-up required",
      ],
      informationalOnly: true,
      testsFocus: "Fully informational email — all arrays empty or notes only; zero hallucination risk",
    },
  },
];
