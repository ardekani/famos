-- ============================================================
-- FamOS — Seed Data (local development only)
-- ============================================================
-- Creates a mock user, two children, a sample email, and
-- sample extracted data so every page has something to show.
--
-- Run after schema.sql:
--   supabase db reset   (runs schema + seed automatically)
-- Or manually in the Supabase SQL Editor.
-- ============================================================

-- ── Dev user ─────────────────────────────────────────────────
-- Fixed UUID so you can hard-code it in MOCK_USER (src/lib/auth.ts)

INSERT INTO users (id, email, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'alex@family.example',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ── Sample children ──────────────────────────────────────────

INSERT INTO children (id, user_id, name, school_name, created_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'Jordan',
    'Riverside Elementary',
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'Casey',
    'Riverside Elementary',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ── Sample email #1 ──────────────────────────────────────────

INSERT INTO emails (
  id, user_id, subject, body, sender, received_at,
  processing_status, created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000001',
  'Spring Concert & Picture Day Reminder',
  E'Dear Families,\n\nWe wanted to remind you of two upcoming events this week:\n\n🎵 Spring Concert — Thursday, March 27 at 6:30pm in the school gymnasium.\nAll students in grades 3–5 are expected to attend. Please arrive by 6:15pm.\n\n📸 Picture Day — Friday, March 28. Individual photos will be taken during class time.\nOrder forms should be returned by Wednesday.\n\nAlso, the Book Fair runs through Friday!\n\n— Ms. Patel, Principal',
  'principal@riverside.edu',
  NOW() - INTERVAL '1 day',
  'processed',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- ── Sample email #2 ──────────────────────────────────────────

INSERT INTO emails (
  id, user_id, subject, body, sender, received_at,
  processing_status, created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'Field Trip Permission Slip — Due Friday',
  E'Hi families,\n\nOur class field trip to the Science Museum is coming up on April 3rd.\nPlease return the signed permission slip by this Friday, March 29.\n\nStudents should bring:\n- A bag lunch (no nut products)\n- Comfortable walking shoes\n- $5 for the planetarium show\n\n— Ms. Chen',
  'teacher@riverside.edu',
  NOW() - INTERVAL '12 hours',
  'processed',
  NOW() - INTERVAL '12 hours'
)
ON CONFLICT (id) DO NOTHING;

-- ── Sample events ────────────────────────────────────────────

INSERT INTO events (user_id, child_id, source_email_id, title, date, start_time, confidence, created_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000100',
    'Spring Concert',
    '2026-03-27',
    '18:30',
    0.97,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000100',
    'Picture Day',
    '2026-03-28',
    NULL,
    0.99,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000101',
    'Science Museum Field Trip',
    '2026-04-03',
    NULL,
    0.95,
    NOW()
  );

-- ── Sample deadlines ─────────────────────────────────────────

INSERT INTO deadlines (user_id, child_id, source_email_id, title, date, confidence, created_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000100',
    'Return picture day order form',
    '2026-03-26',
    0.92,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000101',
    'Return signed permission slip',
    '2026-03-29',
    0.98,
    NOW()
  );

-- ── Sample action items ──────────────────────────────────────

INSERT INTO action_items (user_id, child_id, source_email_id, task, due_date, priority, completed, confidence, created_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000101',
    'Return signed permission slip for field trip',
    '2026-03-29',
    'high',
    false,
    0.98,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    NULL,
    '00000000-0000-0000-0000-000000000101',
    'Bring $5 for planetarium show',
    '2026-04-03',
    'medium',
    false,
    0.95,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000100',
    'Return picture day order form by Wednesday',
    '2026-03-26',
    'medium',
    false,
    0.92,
    NOW()
  );

-- ── Sample notes ─────────────────────────────────────────────

INSERT INTO notes (user_id, source_email_id, content, created_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000100',
    'Book Fair runs through Friday, March 28. Students can shop during library period or before/after school.',
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    'Field trip lunches must be nut-free. Comfortable walking shoes required.',
    NOW()
  );
