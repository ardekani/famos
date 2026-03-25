/**
 * Authenticated fetch helper.
 *
 * Wraps window.fetch to automatically attach the current user's
 * Supabase JWT as an Authorization: Bearer header.
 *
 * Use this for ALL calls to /api/* routes so the server can
 * verify the caller's identity.
 */

import { supabase } from "./supabase";

export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  let token: string | undefined;

  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token;
  }

  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}
