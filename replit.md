# FamOS — Workspace Reference

## Overview

pnpm workspace monorepo. Two active artifacts: a React + Vite frontend (`artifacts/famos`) and an Express API server (`artifacts/api-server`).

## What the App Does

FamOS (Family School OS) ingests forwarded school emails, runs AI extraction (OpenAI gpt-4.1-nano server-side) to pull out events, deadlines, action items, and notes, and displays everything in a parent-friendly dashboard. A daily digest can be generated on demand and optionally emailed via Resend.

## Artifacts

### Frontend — `@workspace/famos` at `artifacts/famos/`

React 19 + Vite + TypeScript + Tailwind CSS. Communicates with Supabase directly (anon key) for data reads and with the API server (via Vite proxy `/api → :8080`) for email ingestion and digest generation.

**Routes:**
- `/` — Landing / home page
- `/dashboard` — Main parent command center (events, deadlines, action items, digest)
- `/emails` — All parsed emails list (newest first, status badges)
- `/emails/:id` — Email detail: extracted entities, confidence scores, re-run extraction button
- `/setup/gmail-forwarding` — Step-by-step Gmail forwarding guide
- `/dev/test-email` — Dev tool: submit a sample email, see extraction results live

**Key source files:**
- `src/lib/queries.ts` — All typed Supabase query helpers
- `src/lib/supabase.ts` — Supabase browser client + `DEV_USER_ID` constant
- `src/lib/auth.ts` — Mock auth (replace with real auth for production)
- `src/types/database.ts` — TypeScript types mirroring the DB schema
- `src/pages/dashboard.tsx` — Dashboard with Today / Action Needed / This Week / Digest / Recent Emails sections
- `src/pages/emails/index.tsx` — Emails list page
- `src/pages/emails/email-detail.tsx` — Email detail with full debug info

### API Server — `@workspace/api-server` at `artifacts/api-server/`

Express 5, TypeScript, compiled with esbuild to `dist/index.mjs`. Mounts all routes under `/api`.

**Endpoints:**
- `GET  /api/health` — Health check
- `POST /api/emails/ingest` — Ingest a new email and run extraction
- `POST /api/emails/extract` — Re-run extraction for an existing email
- `GET  /api/emails/:id` — Fetch email + all extracted entities
- `POST /api/digest/generate` — Generate + save a digest from current DB data
- `POST /api/digest/send` — Send the latest digest via Resend (requires `RESEND_API_KEY`)
- `GET  /api/digest/latest` — Fetch the most recently generated digest
- `POST /api/dev/seed` — Insert 10 realistic seed emails (dev only)
- `GET  /api/dev/seed` — List seeded emails (dev only)
- `DELETE /api/dev/seed` — Remove all seeded emails (dev only)

**Key source files:**
- `src/lib/extraction/service.ts` — OpenAI call + Zod schema validation
- `src/lib/extraction/prompt.ts` — System prompt for extraction
- `src/lib/process-email.ts` — Orchestrates extraction + DB saves + status update
- `src/lib/digest.ts` — Digest generation logic + HTML renderer for Resend
- `src/lib/dev-seeds.ts` — 10 typed seed email fixtures
- `src/lib/supabase.ts` — Server-side Supabase client (reads `VITE_SUPABASE_*` vars)
- `src/routes/index.ts` — Route registration (dev routes excluded in production)

## Environment Variables

Set in Replit Secrets (padlock icon). See `.env.example` for the full list.

| Variable | Used by | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend + api-server | Yes |
| `VITE_SUPABASE_ANON_KEY` | frontend + api-server | Yes |
| `OPENAI_API_KEY` | api-server | Yes |
| `RESEND_API_KEY` | api-server | No (digest email only) |
| `RESEND_FROM_EMAIL` | api-server | No |
| `PORT` | api-server | Auto-set to 8080 |

## Dev User

Auth is mocked. All queries use:

```ts
DEV_USER_ID = "00000000-0000-0000-0000-000000000001"
```

This user must exist in the `users` table (the schema creates it, or the seed route upserts it).

## Extraction Model

OpenAI `gpt-4.1-nano` with `max_completion_tokens: 2048`. Uses JSON structured output. The Zod schema validates the response strictly — any validation failure marks the email as `failed` with the error stored in `extraction_error`.

## What is Real vs Mocked

| Feature | Status |
|---|---|
| Email storage (Supabase) | ✅ Real |
| AI extraction (OpenAI) | ✅ Real |
| Dashboard data | ✅ Real |
| Action item completion | ✅ Real |
| Digest generation | ✅ Real |
| Digest email (Resend) | ✅ Real — needs RESEND_API_KEY |
| User auth | ⚠️ Mocked — hardcoded DEV_USER_ID |
| Inbound email webhook | ⚠️ Simulated — manual API submission only |
| Child-ID linking | ⚠️ Partial — raw_child_name extracted; child_id FK not auto-matched |

## Database Schema

Full schema at `supabase/schema.sql`. Tables: `users`, `children`, `emails`, `events`, `deadlines`, `action_items`, `notes`, `digests`.

## Workflows

| Workflow | Command |
|---|---|
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` |
| `artifacts/famos: web` | `pnpm --filter @workspace/famos run dev` |

## Monorepo

pnpm workspaces. TypeScript project references. See README.md for full setup, extraction flow, and roadmap docs.
