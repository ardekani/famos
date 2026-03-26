-- ============================================================
-- Migration 001: Enable Row Level Security
-- ============================================================
-- Run this in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- What this does:
--   1. Enables RLS on every user-scoped table.
--   2. Adds policies so each authenticated user can only
--      read/write their own rows.
--
-- The API server uses SUPABASE_SERVICE_ROLE_KEY which bypasses
-- RLS entirely, so no server-side queries are affected.
-- ============================================================

-- ── Enable RLS on all tables ─────────────────────────────────

ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE children     ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails       ENABLE ROW LEVEL SECURITY;
ALTER TABLE events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadlines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE digests      ENABLE ROW LEVEL SECURITY;

-- ── users ────────────────────────────────────────────────────
-- id = auth.uid() for real Supabase Auth users.

CREATE POLICY "users: select own row"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users: update own row"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT/DELETE on users is handled server-side only (service role).

-- ── children ─────────────────────────────────────────────────

CREATE POLICY "children: all own rows"
  ON children FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── emails ───────────────────────────────────────────────────

CREATE POLICY "emails: all own rows"
  ON emails FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── events ───────────────────────────────────────────────────

CREATE POLICY "events: all own rows"
  ON events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── deadlines ────────────────────────────────────────────────

CREATE POLICY "deadlines: all own rows"
  ON deadlines FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── action_items ─────────────────────────────────────────────

CREATE POLICY "action_items: all own rows"
  ON action_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── notes ────────────────────────────────────────────────────

CREATE POLICY "notes: all own rows"
  ON notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── digests ──────────────────────────────────────────────────

CREATE POLICY "digests: all own rows"
  ON digests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
