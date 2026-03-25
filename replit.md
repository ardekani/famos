# FamOS — Workspace Reference

## Overview

pnpm workspace monorepo. Two active artifacts: a React + Vite frontend (`artifacts/famos`) and an Express API server (`artifacts/api-server`).

## What the App Does

FamOS (Family School OS) ingests school emails, runs AI extraction (OpenAI gpt-4.1-nano server-side) to pull out events, deadlines, action items, and notes, and displays everything in a parent-friendly dashboard. A daily digest can be generated on demand and optionally emailed via Resend.

## Artifacts

### Frontend — `@workspace/famos` at `artifacts/famos/`

React 19 + Vite + TypeScript + Tailwind CSS. Communicates with Supabase directly (anon key) for data reads and with the API server (via Vite proxy `/api → :8080`) for email ingestion and digest generation.

**Routes:**
- `/` — Landing / home page (public)
- `/login` — Magic-link sign-in (public; redirects to `/dashboard` if already signed in)
- `/dashboard` — Main parent command center (protected)
- `/children` — Manage children (protected)
- `/emails` — All parsed emails list (protected)
- `/emails/:id` — Email detail with debug/re-extract tools (protected)
- `/setup/gmail-forwarding` — Gmail forwarding guide (protected; forwarding NOT yet live)
- `/dev/test-email` — Dev tool: submit a sample email (protected)

**Key source files:**
- `src/lib/queries.ts` — All typed Supabase query helpers
- `src/lib/supabase.ts` — Supabase browser client
- `src/lib/auth.tsx` — Real auth: `AuthProvider`, `useAuth()`, magic-link session management
- `src/lib/api.ts` — `apiFetch()` helper that auto-attaches Supabase JWT
- `src/types/database.ts` — TypeScript types mirroring the DB schema
- `src/components/onboarding/OnboardingBanner.tsx` — Step-aware onboarding guide
- `src/pages/dashboard.tsx` — Dashboard: Today / Action Needed / This Week / Digest / Recent Emails
- `src/pages/children.tsx` — Add/delete children (name + school)
- `src/pages/emails/index.tsx` — Emails list with manual ingest form
- `src/pages/emails/email-detail.tsx` — Full extraction detail + re-run button

### API Server — `@workspace/api-server` at `artifacts/api-server/`

Express 5, TypeScript, compiled with esbuild to `dist/index.mjs`. All routes require a valid Supabase JWT (`Authorization: Bearer <token>`) via `requireAuth` middleware except `/api/health` and cron.

**Endpoints:**
- `GET  /api/health` — Health check (public)
- `POST /api/emails/ingest` — Ingest a new email and run AI extraction (auth required)
- `POST /api/emails/extract` — Re-run extraction for an existing email (auth required)
- `GET  /api/emails/:id` — Fetch email + all extracted entities (auth required)
- `POST /api/digest/generate` — Generate + save a digest from current DB data (auth required)
- `POST /api/digest/generate-and-send` — Generate + email digest in one step (auth required)
- `POST /api/digest/send` — Send the latest digest via Resend (auth required)
- `GET  /api/digest/latest` — Fetch the most recently generated digest (auth required)
- `POST /api/cron/digest` — Trigger daily digest for all users (CRON_SECRET protected)
- `POST /api/dev/seed` — Insert 10 realistic seed emails (dev only, excluded in prod)
- `GET  /api/dev/seed` — List seeded emails (dev only)
- `DELETE /api/dev/seed` — Remove all seeded emails (dev only)

**Key source files:**
- `src/lib/auth.ts` — `requireAuth` middleware: verifies Supabase JWT, sets `req.userId` + `req.userEmail`
- `src/lib/extraction/service.ts` — OpenAI call + Zod schema validation
- `src/lib/extraction/prompt.ts` — System prompt for extraction
- `src/lib/process-email.ts` — Orchestrates extraction + DB saves + status updates (all user-scoped)
- `src/lib/digest.ts` — Digest generation logic + HTML renderer for Resend
- `src/lib/queries.ts` — Shared Supabase query helpers
- `src/routes/cron.ts` — Cron endpoint + wiring instructions for external schedulers
- `src/routes/dev.ts` — Dev-only routes (hardcoded DEV_USER_ID is intentional here)

## Security Model

- All protected API routes enforce JWT auth via `requireAuth`
- All DB queries are scoped to the authenticated `userId` — including status UPDATEs in `process-email.ts`
- `routes/dev.ts` uses `DEV_USER_ID` intentionally (dev-only seed routes)
- Row-level security (RLS) should be enabled on all Supabase tables as an additional layer

## Environment Variables

Set in Replit Secrets. See `.env.example` for the full list.

| Variable | Used by | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend + api-server | Yes |
| `VITE_SUPABASE_ANON_KEY` | frontend + api-server | Yes |
| `OPENAI_API_KEY` | api-server | Yes |
| `RESEND_API_KEY` | api-server | No (digest email only) |
| `RESEND_FROM_EMAIL` | api-server | No (defaults to onboarding@resend.dev) |
| `CRON_SECRET` | api-server | No (blocks cron endpoint until set) |
| `PORT` | api-server | Auto-set by Replit |

## Extraction Model

OpenAI `gpt-4.1-nano` with `max_completion_tokens: 2048`. Uses JSON structured output. Zod validates the response — any failure marks the email as `failed` with `extraction_error` stored.

## What is Real vs MVP-Limited

| Feature | Status |
|---|---|
| User auth (Supabase magic-link) | ✅ Real |
| Email storage (Supabase) | ✅ Real |
| AI extraction (OpenAI) | ✅ Real |
| Dashboard data | ✅ Real |
| Action item completion | ✅ Real |
| Children management | ✅ Real |
| Digest generation | ✅ Real |
| Digest email (Resend) | ✅ Real — needs RESEND_API_KEY + domain verification |
| Resend sandbox | ⚠️ Only delivers to `re.ardekani@gmail.com` until domain verified |
| Inbound email webhook | ❌ Not live — users paste emails manually via Emails page |
| Gmail forwarding | ❌ Not live — setup page is a preview; auto-routing needs webhook |
| Child-ID FK linking | ⚠️ Partial — `raw_child_name` extracted; `child_id` matched only if names match exactly |
| CRON_SECRET | ⚠️ Not set — cron endpoint blocks until configured |

## Database Schema

Full schema at `supabase/schema.sql`. Tables: `users`, `children`, `emails`, `events`, `deadlines`, `action_items`, `notes`, `digests`.

## Workflows

| Workflow | Command |
|---|---|
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` |
| `artifacts/famos: web` | `pnpm --filter @workspace/famos run dev` |
