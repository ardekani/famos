/**
 * Dev-access utility.
 *
 * Controls which users can see developer tools and pages.
 *
 * Access is granted when EITHER:
 *   1. The app is running in Vite dev mode (import.meta.env.DEV === true), OR
 *   2. The authenticated user's email is in the VITE_DEV_EMAILS allowlist
 *
 * To enable dev access for your email in production, set:
 *   VITE_DEV_EMAILS=your@email.com
 * Multiple emails can be comma-separated:
 *   VITE_DEV_EMAILS=alice@example.com,bob@example.com
 */

import { useAuth } from "./auth";

/** Parsed allowlist from the VITE_DEV_EMAILS env var. */
const DEV_EMAIL_ALLOWLIST: Set<string> = new Set(
  (import.meta.env.VITE_DEV_EMAILS ?? "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean)
);

/**
 * Returns true when the current user has dev-tool access.
 * Safe to call from any component inside AuthProvider.
 */
export function useIsDevUser(): boolean {
  const { user } = useAuth();

  // In Vite dev mode, all authenticated users can see dev tools.
  if (import.meta.env.DEV) return true;

  // In production, check the allowlist.
  if (!user?.email) return false;
  return DEV_EMAIL_ALLOWLIST.has(user.email.toLowerCase());
}
