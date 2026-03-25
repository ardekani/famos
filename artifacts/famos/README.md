# FamOS — Family School OS

Turn school email chaos into a clear weekly plan.

FamOS automatically extracts events, deadlines, and action items from forwarded school emails so parents always know what matters this week.

---

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Styling**: Tailwind CSS (calm, parent-friendly palette)
- **Routing**: Wouter (client-side)
- **API Server**: Express 5 (shared monorepo backend)
- **Database**: PostgreSQL + Drizzle ORM _(provisioned by Replit)_
- **Auth**: Mock/local auth for now — Supabase Auth or Replit Auth coming soon
- **AI**: OpenAI GPT (server-side only, via API server)
- **Email**: Resend (server-side only, via API server)

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page with value proposition and CTAs |
| `/dashboard` | This week's events, deadlines, and action items |
| `/emails/:id` | Single email with extracted events and actions |
| `/setup/gmail-forwarding` | Step-by-step Gmail forwarding setup guide |
| `/dev/test-email` | Dev tool: paste an email and see mock parsing output |

---

## Local Setup

### 1. Clone and install dependencies

```bash
git clone <repo>
cd <repo>
pnpm install
```

### 2. Set up environment variables

```bash
cp artifacts/famos/.env.example artifacts/famos/.env
# Fill in the values — see comments in .env.example
```

### 3. Start the dev server

```bash
# Start just the frontend
pnpm --filter @workspace/famos run dev

# Or start everything (frontend + API server)
pnpm --filter @workspace/famos run dev &
pnpm --filter @workspace/api-server run dev
```

---

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions.

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | When using Supabase | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | When using Supabase | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side | Supabase service role key |
| `OPENAI_API_KEY` | For email parsing | OpenAI API key (server-side only) |
| `RESEND_API_KEY` | For email digests | Resend API key (server-side only) |

---

## Project Structure

```
artifacts/famos/
├── src/
│   ├── App.tsx                       # Route definitions
│   ├── index.css                     # Theme + Tailwind config
│   ├── components/
│   │   └── layout/
│   │       ├── Nav.tsx               # Shared top navigation
│   │       └── Shell.tsx             # Page wrapper with nav
│   ├── lib/
│   │   ├── auth.ts                   # Mock auth (replace with real auth)
│   │   ├── supabase.ts               # Supabase client stub
│   │   ├── openai.ts                 # OpenAI usage notes (server-side)
│   │   └── resend.ts                 # Resend usage notes (server-side)
│   └── pages/
│       ├── home.tsx                  # Landing page
│       ├── dashboard.tsx             # Weekly dashboard
│       ├── emails/
│       │   └── email-detail.tsx      # Email detail view (/emails/:id)
│       ├── setup/
│       │   └── gmail-forwarding.tsx  # Gmail forwarding setup
│       └── dev/
│           └── test-email.tsx        # Dev email parser tool
└── .env.example                      # Environment variable template
```

---

## Roadmap

- [ ] Supabase Auth integration
- [ ] Real Gmail forwarding inbox (inbound email webhook)
- [ ] OpenAI email parsing (GPT-4o via API server)
- [ ] Resend daily digest emails
- [ ] Calendar export (iCal / Google Calendar)
- [ ] Multi-child support
