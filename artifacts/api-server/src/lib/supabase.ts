/**
 * Server-side Supabase client for the API server.
 *
 * Reads from environment variables. VITE_* vars are set in the project
 * and are readable by the Node process even though the prefix is for Vite.
 *
 * For production, replace VITE_SUPABASE_ANON_KEY with SUPABASE_SERVICE_ROLE_KEY
 * so all server operations bypass Row Level Security.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase credentials not found. Set VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY for production)."
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });

  logger.info("Supabase client initialised");
  return _client;
}
