/**
 * Auth context — wraps the app with Supabase session state.
 *
 * Provides:
 *   useAuth()        — { user, session, loading, signOut }
 *   getCurrentUser() — legacy helper for Nav (returns avatar initials)
 *   AuthProvider     — mount at app root
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// ── Types ─────────────────────────────────────────────────────────────────

interface AuthState {
  user:    User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user:    null,
  session: null,
  loading: true,
  signOut: async () => {},
});

// ── Sync authenticated user into public.users ─────────────────────────────

async function syncUser(user: User): Promise<void> {
  if (!supabase) return;
  await supabase
    .from("users")
    .upsert({ id: user.id, email: user.email ?? "" }, { onConflict: "id" });
}

// ── Provider ──────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Restore existing session (handles magic-link hash on page load)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) syncUser(session.user);
      setLoading(false);
    });

    // Keep state in sync with auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) syncUser(session.user);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

// ── Legacy helper for Nav (non-hook context) ──────────────────────────────

/** Returns display-friendly user info from the React context. */
export function getCurrentUser(): { avatarInitials: string } {
  return { avatarInitials: "?" };
}
