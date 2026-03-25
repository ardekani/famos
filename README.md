# FamOS — Family School OS

> Turn school email chaos into a clear weekly plan.

FamOS is a parent-friendly MVP web app that extracts events, deadlines, and action items from forwarded school emails using OpenAI — and displays them in a clean dashboard with a daily digest.

---

## What the App Does

1. **Parents forward school emails** to a dedicated FamOS inbox address using a one-time Gmail filter.
2. **FamOS ingests each email** via `POST /api/emails/ingest` and runs AI extraction.
3. **OpenAI (gpt-4.1-nano)** reads the email and returns structured JSON: events, deadlines, action items, and notes — with confidence scores and child name attribution.
4. **The dashboard** shows everything in one place: today's events, this week's calendar, open action items sorted by priority, and recently parsed emails.
5. **Daily digest** can be generated on demand and optionally emailed via Resend.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS |
| Backend | Express 5 (TypeScript, compiled with esbuild) |
| Database | Supabase (PostgreSQL) |
| AI extraction | OpenAI `gpt-4.1-nano` — server-side only |
| Email sending | Resend — server-side only, optional |
| Data fetching | TanStack Query (React Query v5) |
| Routing | Wouter |
| Monorepo | pnpm workspaces |
| Node.js | ≥ 20 |

---

## Environment Variables

### Frontend — `artifacts/famos/.env.local`

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |

### API Server — `artifacts/api-server/.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Server port — auto-set to `8080` by Replit |
| `VITE_SUPABASE_URL` | Yes | Supabase URL (server reads the same variable) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `OPENAI_API_KEY` | Yes | OpenAI key for email extraction |
| `RESEND_API_KEY` | No | Resend key — required only for digest email sending |
| `RESEND_FROM_EMAIL` | No | Verified from address, e.g. `FamOS <digest@yourdomain.com>` |

Copy `.env.example` to get the full template.

On **Replit**, all secrets are set via the Secrets panel (padlock icon). They are automatically injected into both workflows.

---

## Local Setup

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- A [Supabase](https://supabase.com) project
- An [OpenAI](https://platform.openai.com) API key

### Steps

```sh
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp .env.example artifacts/famos/.env.local
cp .env.example artifacts/api-server/.env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, OPENAI_API_KEY

# 3. Run the database schema (see Database Setup below)

# 4. Start the API server (port 8080)
pnpm --filter @workspace/api-server run dev

# 5. Start the frontend (in another terminal)
pnpm --filter @workspace/famos run dev
```

On **Replit**, both the API server and frontend start automatically via configured workflows. No manual steps needed beyond setting Secrets.

---

## Database Setup

The full schema lives in `supabase/schema.sql`. Run it once against your Supabase project:

1. Go to **Supabase Dashboard → SQL Editor**
2. Paste the contents of `supabase/schema.sql`
3. Click **Run**

This creates the following tables:

| Table | Purpose |
|---|---|
| `users` | Parent accounts (currently mocked) |
| `children` | Child profiles linked to a parent |
| `emails` | Raw ingested emails with processing status |
| `events` | Calendar events extracted from emails |
| `deadlines` | Due-date items extracted from emails |
| `action_items` | To-do items extracted from emails |
| `notes` | General notes extracted from emails |
| `digests` | Generated daily digests |

### Seed test data

Dev seed routes are mounted only when `NODE_ENV !== "production"`.

```sh
# Insert 10 realistic school emails (events, deadlines, actions, notes)
curl -X POST http://localhost:8080/api/dev/seed

# Clear all seeded data
curl -X DELETE http://localhost:8080/api/dev/seed
```

---

## How the Extraction Flow Works

```
Parent forwards email → FamOS inbox address
        ↓
POST /api/emails/ingest  { subject, body, sender }
        ↓
Email row inserted in `emails` table  (status: "pending")
        ↓
extractFromEmail(subject, body)
  → OpenAI gpt-4.1-nano  (structured output, JSON mode)
  → System prompt instructs extraction of events / deadlines / action_items / notes
  → max_completion_tokens: 2048
        ↓
Response validated with Zod  (strict schema with child names, dates, priorities, confidence)
        ↓
Entities saved to individual tables  (events, deadlines, action_items, notes)
        ↓
Email status updated → "processed"  (or "failed" if OpenAI / Zod throws)
        ↓
Appears on dashboard in real time
```

Key files:

| File | Role |
|---|---|
| `artifacts/api-server/src/lib/extraction/prompt.ts` | System prompt for OpenAI |
| `artifacts/api-server/src/lib/extraction/service.ts` | OpenAI call + Zod validation |
| `artifacts/api-server/src/lib/process-email.ts` | Orchestrates save + status update |
| `artifacts/api-server/src/routes/emails.ts` | `POST /ingest`, `POST /extract`, `GET /:id` |

### Re-running extraction

Any email can be re-extracted without re-ingesting. On the email detail page (`/emails/:id`), click **Re-run extraction**. This calls `POST /api/emails/extract` which:
1. Deletes all previously extracted entities for this email
2. Re-runs the OpenAI call
3. Saves fresh results
4. Invalidates the frontend cache

---

## What is Real vs Mocked

| Feature | Status |
|---|---|
| Email storage (Supabase) | ✅ Real |
| AI extraction (OpenAI gpt-4.1-nano) | ✅ Real |
| Dashboard data (Supabase) | ✅ Real |
| Action item completion | ✅ Real (persisted to Supabase) |
| Digest generation | ✅ Real (saves to `digests` table) |
| Digest email (Resend) | ✅ Real — requires `RESEND_API_KEY` |
| User auth | ⚠️ Mocked — hardcoded `DEV_USER_ID = "00000000-0000-0000-0000-000000000001"` |
| Gmail forwarding / inbound webhook | ⚠️ Simulated — emails are submitted manually via API or dev tool |
| Child-to-email linking | ⚠️ Partial — `raw_child_name` extracted by AI; `child_id` FK not yet auto-matched |

---

## How to Test with Sample Emails

### Option 1: Browser dev tool

Navigate to `/dev/test-email`. Select one of the four built-in sample emails (spring concert, field trip, medication form, supplies) or paste your own. Click **Submit** to run real extraction and see full results including confidence scores and raw JSON.

### Option 2: cURL

```sh
curl -X POST http://localhost:8080/api/emails/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Spring Concert — Jordan Grade 3",
    "body": "Dear Families,\n\nOur Spring Concert is Thursday March 27 at 6:30 PM in the gymnasium.\nPicture Day is Friday March 28. Return the order form by Wednesday.\n\n— Mrs. Thompson",
    "sender": "teacher@maplegrove.edu"
  }'
```

### Option 3: Bulk seed

```sh
curl -X POST http://localhost:8080/api/dev/seed
```

Inserts 10 pre-written emails covering a variety of school scenarios: concerts, field trips, medication forms, book fairs, picture day, and supply requests.

---

## How to Generate a Digest

### Via dashboard

Click **Generate** (or **Regenerate**) in the Daily Digest card at the top of `/dashboard`. The card expands to show the full plain-text digest.

### Via cURL

```sh
curl -X POST http://localhost:8080/api/digest/generate \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-03-25"}'
```

Response includes `content_text` (plain text) and `content_json` (structured data with today / this week / action needed sections).

### Send via email

```sh
curl -X POST http://localhost:8080/api/digest/send \
  -H "Content-Type: application/json" \
  -d '{"to_email":"parent@example.com"}'
```

Requires `RESEND_API_KEY`. Sends the most recently generated digest as an HTML email.

---

## What Should Be Built Next

1. **Real inbound email webhook** — integrate with Postmark or SendGrid Inbound Parse to receive forwarded emails as HTTP POST requests, eliminating the need for manual submission.
2. **Per-user auth** — replace the hardcoded `DEV_USER_ID` with real auth (Supabase Auth or Replit Auth). Auth tokens flow from frontend → API server via `Authorization: Bearer` headers.
3. **Child profiles** — let parents register children by name. Auto-match `raw_child_name` from extractions to the correct `child_id` using fuzzy name matching.
4. **Digest scheduling** — auto-generate and send the daily digest at a configurable time (e.g., 7 AM) using a cron job or Supabase scheduled function.
5. **Notification system** — push alerts or SMS (via Twilio) for high-priority action items approaching their deadlines.
6. **Confidence review UI** — flag low-confidence extractions (< 70%) for parent review before they appear on the dashboard.
7. **Archiving / dismissing** — let parents mark individual items as "not relevant" so they stop appearing in future digests.
8. **Multi-address support** — a household may have multiple school email senders; support comma-separated forwarding addresses per user.
9. **Email threading** — detect follow-up emails about the same event and merge/update rather than duplicate.
10. **Mobile app** — an Expo React Native wrapper for push notifications and dashboard access on the go.

---

## How to Replace Forwarding with Gmail OAuth

The forwarding approach works without OAuth but requires manual one-time setup by the parent. To upgrade to direct Gmail sync:

1. **Create a Google Cloud project** and enable the Gmail API at [console.cloud.google.com](https://console.cloud.google.com).
2. **Set up OAuth 2.0 credentials** (Web application type). Add your app's origin and redirect URI to the authorized list.
3. **Request the `gmail.readonly` scope** — or `gmail.modify` if you want to label/archive processed emails.
4. **Add an OAuth callback route** to the API server (`GET /api/auth/google/callback`) that exchanges the code for tokens and stores them in the `users` table.
5. **Replace the mock auth** in `artifacts/famos/src/lib/auth.ts` with a real flow that redirects to Google's OAuth consent screen.
6. **Poll Gmail periodically** using `users.messages.list` with the same filter query from the forwarding setup:
   ```
   (from:school OR from:teacher) OR ("field trip" OR "permission slip")
   ```
7. **For each new message**, decode the MIME body and call `POST /api/emails/ingest` — identical to the forwarding path.
8. **Store and refresh tokens** — access tokens expire after 1 hour; refresh automatically using the stored `refresh_token`.

The extraction pipeline (`extractFromEmail`, Zod validation, entity saving) is **completely unchanged** — only the ingestion trigger changes from "forwarding webhook" to "Gmail API poll."

---

## Project Structure

```
/
├── artifacts/
│   ├── api-server/          # Express 5 API server
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── digest.ts          # Digest generation + HTML rendering
│   │       │   ├── extraction/        # OpenAI prompt + Zod validation
│   │       │   ├── process-email.ts   # Orchestrates extraction + save
│   │       │   └── supabase.ts        # Server-side Supabase client
│   │       └── routes/
│   │           ├── digest.ts          # POST /digest/generate, /digest/send, GET /digest/latest
│   │           ├── emails.ts          # POST /emails/ingest, /emails/extract, GET /emails/:id
│   │           └── dev.ts             # POST/GET/DELETE /dev/seed (non-production only)
│   └── famos/               # React + Vite frontend
│       └── src/
│           ├── lib/
│           │   ├── queries.ts         # Typed Supabase query helpers
│           │   ├── supabase.ts        # Supabase client (browser)
│           │   └── auth.ts            # Mock auth — replace for production
│           ├── pages/
│           │   ├── dashboard.tsx      # Main parent dashboard
│           │   ├── emails/
│           │   │   ├── index.tsx      # All emails list
│           │   │   └── email-detail.tsx  # Single email + extraction debug
│           │   ├── setup/
│           │   │   └── gmail-forwarding.tsx  # Forwarding setup guide
│           │   └── dev/
│           │       └── test-email.tsx # Dev tool for testing extraction
│           └── types/
│               └── database.ts        # TypeScript types mirroring DB schema
├── supabase/
│   └── schema.sql           # Full PostgreSQL schema
├── .env.example             # Environment variable template
└── README.md
```
