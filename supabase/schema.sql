-- ============================================================
-- FamOS — Supabase / PostgreSQL Schema
-- ============================================================
-- Run this in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- Or with the Supabase CLI:
--   supabase db reset   (runs this + seed.sql automatically)
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE processing_status AS ENUM ('pending', 'processed', 'failed');
CREATE TYPE action_priority   AS ENUM ('high', 'medium', 'low');

-- ── users ────────────────────────────────────────────────────
-- Mirrors Supabase Auth users. id matches auth.users.id when
-- using real auth; for local dev we insert a mock row manually.

CREATE TABLE IF NOT EXISTS users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── children ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS children (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  school_name TEXT,                          -- nullable
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── emails ───────────────────────────────────────────────────
-- Raw inbound emails forwarded to the FamOS inbox.

CREATE TABLE IF NOT EXISTS emails (
  id                UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_message_id TEXT,              -- original Message-ID header (nullable)
  subject           TEXT               NOT NULL,
  body              TEXT               NOT NULL,
  sender            TEXT,              -- From address (nullable)
  received_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  raw_payload       JSONB,             -- full inbound webhook payload (nullable)
  processing_status processing_status  NOT NULL DEFAULT 'pending',
  extraction_error  TEXT,              -- error message if status = 'failed' (nullable)
  created_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- ── events ───────────────────────────────────────────────────
-- Calendar events extracted from emails.

CREATE TABLE IF NOT EXISTS events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id        UUID        REFERENCES children(id) ON DELETE SET NULL, -- nullable
  source_email_id UUID        NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  date            DATE,                -- nullable (sometimes only a rough time is known)
  start_time      TIME,                -- nullable
  end_time        TIME,                -- nullable
  location        TEXT,                -- nullable
  description     TEXT,                -- nullable
  confidence      FLOAT,               -- 0.0–1.0 AI confidence score (nullable)
  raw_child_name  TEXT,                -- child name as extracted by AI, before matching (nullable)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── deadlines ────────────────────────────────────────────────
-- Due-dates extracted from emails (forms, payments, signups, etc).

CREATE TABLE IF NOT EXISTS deadlines (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id        UUID        REFERENCES children(id) ON DELETE SET NULL, -- nullable
  source_email_id UUID        NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  date            DATE,                -- nullable
  description     TEXT,                -- nullable
  confidence      FLOAT,               -- nullable
  raw_child_name  TEXT,                -- nullable
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── action_items ─────────────────────────────────────────────
-- Things the parent needs to do.

CREATE TABLE IF NOT EXISTS action_items (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id        UUID            REFERENCES children(id) ON DELETE SET NULL, -- nullable
  source_email_id UUID            NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  task            TEXT            NOT NULL,
  due_date        DATE,                      -- nullable
  priority        action_priority NOT NULL DEFAULT 'medium',
  completed       BOOLEAN         NOT NULL DEFAULT FALSE,
  confidence      FLOAT,                     -- nullable
  raw_child_name  TEXT,                      -- nullable
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ── notes ────────────────────────────────────────────────────
-- General info / FYI snippets extracted from emails.

CREATE TABLE IF NOT EXISTS notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id        UUID        REFERENCES children(id) ON DELETE SET NULL, -- nullable
  source_email_id UUID        NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL,
  raw_child_name  TEXT,                -- nullable
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── digests ──────────────────────────────────────────────────
-- Daily email digests sent to the parent.

CREATE TABLE IF NOT EXISTS digests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  digest_date  DATE        NOT NULL,
  content_text TEXT        NOT NULL,
  content_json JSONB,               -- structured digest data (nullable)
  sent_at      TIMESTAMPTZ,         -- NULL until actually sent (nullable)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_children_user_id         ON children(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_user_id           ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_processing_status ON emails(processing_status);
CREATE INDEX IF NOT EXISTS idx_events_user_id           ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date              ON events(date);
CREATE INDEX IF NOT EXISTS idx_deadlines_user_id        ON deadlines(user_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_date           ON deadlines(date);
CREATE INDEX IF NOT EXISTS idx_action_items_user_id     ON action_items(user_id);
CREATE INDEX IF NOT EXISTS idx_action_items_completed   ON action_items(completed);
CREATE INDEX IF NOT EXISTS idx_notes_user_id            ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_digests_user_id          ON digests(user_id);
CREATE INDEX IF NOT EXISTS idx_digests_digest_date      ON digests(digest_date);
