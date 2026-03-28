# FamOS — Family School OS

> Turn school email chaos into a clear weekly plan.

FamOS is a parent-friendly web app that extracts events, deadlines, and action items from forwarded school emails using OpenAI — and displays them in a calm, scannable dashboard.

---

## What the App Does

1. **Parents forward school emails** to `inbox@famops.app` using a one-time Gmail filter.
2. **FamOS polls that inbox** every ~10 minutes via a Google Workspace service account.
3. **OpenAI (`gpt-5.4-nano`)** reads each email and returns structured JSON: events, deadlines, action items, and notes — with confidence scores and child name attribution.
4. **A post-extraction filter layer** (`filter.ts`) suppresses noise (arrival times, attire, dress codes) and saves logistics as notes rather than actions.
5. **The dashboard** organises everything into:
   - A narrative weekly briefing card ("You have 2 important things to handle this week. Emma's field trip is Friday.")
   - "This Week" grouped by child (Emma → events + deadlines / Noah → ...)
   - "Action Needed" split into Must do / Bring & prepare / Optional FYI
   - Per-child summary cards
6. **Daily digest** can be generated on demand and emailed via Resend.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS |
| Backend | Express 5 (TypeScript, compiled with esbuild) |
| Database | Supabase (PostgreSQL + Auth) |
| AI extraction | OpenAI `gpt-5.4-nano` — server-side only |
| Gmail ingest | Google Workspace service account (domain-wide delegation) |
| Email sending | Resend — server-side only, optional |
| Auth | Supabase Auth (magic link) + dev password login at `/dev/login` |
| Data fetching | TanStack Query (React Query v5) |
| Routing | Wouter |
| Monorepo | pnpm workspaces |
| Node.js | ≥ 20 |

---

## Environment Variables

All secrets are set via the Replit Secrets panel and are injected automatically into both workflows.

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key — server-side only, bypasses RLS |
| `OPENAI_API_KEY` | Yes | OpenAI key for email extraction |
| `GMAIL_CLIENT_EMAIL` | Yes | Google Workspace service account email |
| `GMAIL_PRIVATE_KEY` | Yes | Service account private key (PEM, newlines as `\n`) |
| `RESEND_API_KEY` | No | Resend key — required only for digest email sending |
| `RESEND_FROM_EMAIL` | No | Verified from address, e.g. `FamOS <digest@famops.app>` |
| `CRON_SECRET` | Yes | Shared secret for `/api/cron/*` endpoints |
| `DEV_PASSWORD` | No | Dev-only password for `/dev/login` (non-production) |
| `POSTMARK_INBOUND_TOKEN` | No | Legacy — Postmark webhook is currently bypassed |

---

## Local Setup

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- A [Supabase](https://supabase.com) project with Auth enabled
- An [OpenAI](https://platform.openai.com) API key
- A Google Workspace service account with domain-wide delegation (for Gmail ingest)

### Steps

```sh
# 1. Install dependencies
pnpm install

# 2. Set environment variables (see table above)

# 3. Run the database schema
#    Go to Supabase Dashboard → SQL Editor, paste supabase/schema.sql, run it.

# 4. Start the API server
pnpm --filter @workspace/api-server run dev

# 5. Start the frontend (separate terminal)
pnpm --filter @workspace/famos run dev
```

On **Replit**, both services start automatically via configured workflows.

---

## Database Setup

The full schema lives in `supabase/schema.sql`. Run it once against your Supabase project:

1. Go to **Supabase Dashboard → SQL Editor**
2. Paste the contents of `supabase/schema.sql`
3. Click **Run**

Tables:

| Table | Purpose |
|---|---|
| `children` | Child profiles linked to a parent user |
| `emails` | Raw ingested emails with processing status |
| `events` | Calendar events extracted from emails |
| `deadlines` | Due-date items extracted from emails |
| `action_items` | To-do items extracted from emails |
| `notes` | Notes + suppressed logistics from emails |
| `digests` | Generated daily digests |

---

## How Email Ingest Works

```
Parent forwards email → inbox@famops.app (Google Workspace)
        ↓
POST /api/cron/gmail-sync  (called every ~10 min by external scheduler)
        ↓
ingestNewGmailMessages()
  → Gmail API via service account
  → Fetches unread messages
  → Deduplicates via source_message_id
        ↓
Email row inserted in `emails` table  (status: "pending")
        ↓
extractFromEmail(subject, body)
  → OpenAI gpt-5.4-nano  (JSON mode, structured output)
  → System prompt in prompt.ts
  → Zod validation of response
        ↓
filter.ts post-extraction layer
  → ALWAYS_NOISE (arrival times, filler) → suppressed
  → SOFT_NOISE (attire, dress codes) → saved as notes
  → HIGH_VALUE (forms, payments, signatures) → saved as action_items
        ↓
Entities saved: events / deadlines / action_items / notes
        ↓
Email status → "processed"  (or "failed")
        ↓
Appears on dashboard
```

### Key files

| File | Role |
|---|---|
| `artifacts/api-server/src/lib/extraction/prompt.ts` | System prompt for OpenAI |
| `artifacts/api-server/src/lib/extraction/service.ts` | OpenAI call + Zod validation |
| `artifacts/api-server/src/lib/extraction/filter.ts` | Post-extraction noise filter |
| `artifacts/api-server/src/lib/gmail-ingest.ts` | Gmail API polling via service account |
| `artifacts/api-server/src/lib/process-email.ts` | Orchestrates save + status update |
| `artifacts/api-server/src/routes/cron.ts` | `POST /cron/gmail-sync`, `/cron/digest` |
| `artifacts/api-server/src/routes/emails.ts` | `POST /ingest`, `POST /extract`, `GET /:id` |

---

## Gmail Sync Setup

Emails land in `inbox@famops.app` (a Google Workspace Gmail account). The API server polls it using a service account with domain-wide delegation — no OAuth flow needed.

### Schedule the sync

`POST /api/cron/gmail-sync` must be called on a schedule (every 5–10 minutes). Use any HTTP scheduler:

**cron-job.org (recommended)**
1. Create a free account at [cron-job.org](https://cron-job.org)
2. Add a job: `POST https://your-api-domain/api/cron/gmail-sync`
3. Add header: `x-cron-secret: <CRON_SECRET value>`
4. Set interval: every 10 minutes

**Manual test**
```sh
curl -X POST https://your-api-domain/api/cron/gmail-sync \
     -H "x-cron-secret: YOUR_CRON_SECRET"
```

### Response
```json
{ "ingested": 2, "skipped": 1, "errors": 0 }
```

`ingested` = new emails processed this run. `skipped` = already seen (deduplicated). 

---

## Authentication

FamOS uses **Supabase Auth** with magic link (passwordless email) sign-in.

- `/` — sign-in page (enter email → receive magic link)
- `/dashboard` — protected; redirects to sign-in if unauthenticated
- `/dev/login` — dev-only password login (non-production only), uses `DEV_PASSWORD` env var

The API server uses the Supabase service role key to bypass RLS on all server-side reads/writes. Auth is enforced via session cookie checked by the `requireAuth` middleware.

---

## Dashboard Sections

| Section | What it shows |
|---|---|
| **Weekly briefing card** | 2–3 narrative sentences: action count, nearest event with child name, urgency status |
| **Action Needed — Must do** | Forms, payments, signatures, RSVPs (pattern-matched) |
| **Action Needed — Bring & prepare** | Lunch, supplies, uniform, gear (pattern-matched) |
| **Action Needed — Optional / FYI** | Low-confidence or low-priority items (collapsed by default) |
| **This Week** | Events + deadlines grouped by child, sorted chronologically |
| **By Child** | Per-child card showing upcoming events, deadlines, and open actions |
| **School Emails** | Recent emails with processing status; links to detail view |
| **Daily Digest** | Generate on demand; email to yourself via Resend |

### Action item categorization

Classification runs entirely in the frontend (`dashboard.tsx`) using regex pattern matching on the task text:

- `must_do` — sign, submit, pay, complete, RSVP, form, permission, deadline, $amount
- `bring_prepare` — bring, pack, lunch, snack, uniform, swimsuit, towel, supplies, gear
- `optional` — anything with priority `"low"` (already downgraded by `filter.ts`)

`must_do` wins when both patterns match (e.g. "bring and sign the permission slip").

### Where suppressed logistics appear

| Item | Where it ends up |
|---|---|
| Arrival / drop-off times | Saved as a note → visible on email detail page |
| Attire / dress code | Saved as a note → visible on email detail page |
| Event logistics (location, time detail) | Stored in `events.description` → shown in email detail |
| None of the above appear as action items | Suppression happens at extraction time via `filter.ts` |

---

## Re-running Extraction

Any email can be re-extracted without re-ingesting. On the email detail page (`/emails/:id`), click **Re-run extraction**. This calls `POST /api/emails/extract`, which:

1. Deletes all previously extracted entities for this email
2. Re-runs the OpenAI call with the current prompt
3. Re-runs the filter layer
4. Saves fresh results and invalidates the frontend cache

---

## Daily Digest

### Via dashboard

Click **Generate** in the Daily Digest card at the bottom of `/dashboard`. Expand to read the full plain-text digest, then click **Email me** to send it to your registered address.

### Via cURL

```sh
# Generate
curl -X POST https://your-api/api/digest/generate \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-03-27"}'

# Send
curl -X POST https://your-api/api/digest/send
```

### Automated daily delivery

Wire `POST /api/cron/digest` to a scheduler (same approach as gmail-sync above):

```sh
curl -X POST https://your-api/api/cron/digest \
     -H "x-cron-secret: YOUR_CRON_SECRET"
```

Sends digests to all users who have events or actions this week. Requires `RESEND_API_KEY`.

---

## Dev Tools (non-production only)

| Route | What it does |
|---|---|
| `GET /dev/login` | Password login for testing (uses `DEV_PASSWORD`) |
| `POST /api/dev/seed` | Insert 10 realistic sample school emails |
| `DELETE /api/dev/seed` | Clear all seeded data |
| `GET /emails/:id` | Full extraction debug view with confidence scores |

---

## Project Structure

```
/
├── artifacts/
│   ├── api-server/          # Express 5 API server
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── extraction/
│   │       │   │   ├── prompt.ts       # OpenAI system prompt
│   │       │   │   ├── service.ts      # OpenAI call + Zod validation
│   │       │   │   └── filter.ts       # Post-extraction noise filter
│   │       │   ├── gmail-ingest.ts     # Gmail API polling
│   │       │   ├── process-email.ts    # Orchestrates extraction + save
│   │       │   ├── digest.ts           # Digest generation + HTML rendering
│   │       │   └── supabase.ts         # Server-side Supabase client
│   │       └── routes/
│   │           ├── cron.ts             # POST /cron/gmail-sync, /cron/digest
│   │           ├── emails.ts           # POST /ingest, /extract, GET /:id, DELETE /:id
│   │           ├── digest.ts           # POST /digest/generate, /digest/send, GET /digest/latest
│   │           ├── inbound.ts          # Postmark webhook (bypassed — Gmail is active)
│   │           └── dev.ts              # Seed routes (non-production only)
│   └── famos/               # React + Vite frontend
│       └── src/
│           ├── lib/
│           │   ├── queries.ts          # Typed Supabase query helpers
│           │   ├── supabase.ts         # Supabase client (browser)
│           │   └── auth.ts             # Auth hook + session management
│           ├── pages/
│           │   ├── dashboard.tsx       # Main parent dashboard
│           │   ├── emails/
│           │   │   ├── index.tsx       # All emails list
│           │   │   └── email-detail.tsx   # Single email + extraction debug
│           │   ├── setup/
│           │   │   └── gmail-forwarding.tsx  # Forwarding setup guide
│           │   └── dev/
│           │       ├── login.tsx       # Dev password login
│           │       └── test-email.tsx  # Dev extraction tester
│           └── types/
│               └── database.ts         # TypeScript types mirroring DB schema
├── supabase/
│   └── schema.sql           # Full PostgreSQL schema
└── README.md
```

---

## What Could Be Built Next

1. **Instant inbound webhook** — re-enable the Postmark handler in `inbound.ts` (remove the early `return`) so emails are processed the moment they arrive rather than waiting for the next poll.
2. **Push notifications** — alert parents when a high-priority action item is extracted or approaching its deadline.
3. **Confidence review UI** — flag low-confidence extractions (< 70%) for parent confirmation before they appear on the dashboard.
4. **Email threading** — detect follow-up emails about the same event and merge/update rather than create duplicates.
5. **Multi-address support** — a household may forward from multiple email addresses; support comma-separated senders per user.
6. **Archiving / dismissing** — let parents mark items as "not relevant" so they stop appearing in future digests.
7. **Mobile app** — Expo React Native wrapper for push notifications and dashboard access on the go.
