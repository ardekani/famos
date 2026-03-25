/**
 * Supabase browser client.
 *
 * Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file
 * (copy from .env.example) to connect to your Supabase project.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both env vars are present */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/**
 * Supabase browser client.
 * Will be `null` when env vars are not set.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;
