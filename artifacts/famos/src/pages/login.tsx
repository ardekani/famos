/**
 * Login page — magic link auth.
 *
 * User enters their email, we send a magic link via Supabase Auth.
 * After clicking the link, they're redirected back and the session
 * is picked up automatically by AuthProvider.
 */

import React, { useState } from "react";
import { Mail, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

type State = "idle" | "loading" | "sent" | "error";

export default function LoginPage() {
  const [email,   setEmail]   = useState("");
  const [state,   setState]   = useState<State>("idle");
  const [errMsg,  setErrMsg]  = useState("");

  const redirectTo = window.location.origin + import.meta.env.BASE_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !supabase) return;

    setState("loading");
    setErrMsg("");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setErrMsg(error.message);
      setState("error");
    } else {
      setState("sent");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-bold shadow-md">
            F
          </span>
          <div>
            <h1 className="text-xl font-bold text-foreground">FamOS</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Family School OS — sign in to continue
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {state === "sent" ? (
            // ── Confirmation state ──
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Check your inbox</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  We sent a sign-in link to{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                  <br />
                  Click the link to sign in — no password needed.
                </p>
              </div>
              <button
                onClick={() => { setState("idle"); setEmail(""); }}
                className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            // ── Login form ──
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Enter your email to get started
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  We'll send you a one-click sign-in link. No password required.
                </p>
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={state === "loading"}
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                />
              </div>

              {state === "error" && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errMsg || "Something went wrong. Please try again."}
                </p>
              )}

              {!isSupabaseConfigured && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Supabase is not configured — set VITE_SUPABASE_URL and
                  VITE_SUPABASE_ANON_KEY to enable login.
                </p>
              )}

              <button
                type="submit"
                disabled={state === "loading" || !email.trim() || !isSupabaseConfigured}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {state === "loading" ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                ) : (
                  <>Send sign-in link <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          By signing in you agree to keep school emails safe and private.
        </p>
      </div>
    </div>
  );
}
