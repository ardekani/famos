/**
 * Simple local/mock auth helpers for development.
 * This simulates a logged-in user without a real auth backend.
 * Replace with Supabase Auth or Replit Auth when ready for production.
 */

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
}

/** The mock "logged-in" user for development */
export const MOCK_USER: MockUser = {
  id: "user_dev_001",
  name: "Alex Rivera",
  email: "alex@family.example",
  avatarInitials: "AR",
};

/** Returns the current user (mock for now) */
export function getCurrentUser(): MockUser {
  return MOCK_USER;
}

/** Simulates checking if someone is authenticated */
export function isAuthenticated(): boolean {
  return true; // always true in mock mode
}
