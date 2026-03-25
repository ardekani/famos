/**
 * Supabase client.
 *
 * Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file
 * (copy from .env.example) to connect to your Supabase project.
 *
 * In local dev the client still initialises — queries will just fail
 * gracefully until you add real keys. The mock data in seed.sql keeps
 * the UI populated during development.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both env vars are present */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/**
 * Supabase browser client.
 * Will be `null` when env vars are not set (local dev without Supabase).
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;

// ── Dev user constant ─────────────────────────────────────────────────────
// Matches the fixed UUID inserted by supabase/seed.sql.

export const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
