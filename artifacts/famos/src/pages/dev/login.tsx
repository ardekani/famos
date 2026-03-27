/**
 * Dev-only password login page — /dev/login
 *
 * Not linked from anywhere in the regular UI.
 * Uses Supabase email + password auth instead of magic link.
 * Bookmark this URL for instant test access without waiting for a magic link.
 */

import React, { useState } from "react";
import { Lock, Mail, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";

type State = "idle" | "loading" | "error";

export default function DevLoginPage() {
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [state,       setState]       = useState<State>("idle");
  const [errMsg,      setErrMsg]      = useState("");
  const [, navigate]                  = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !supabase) return;

    setState("loading");
    setErrMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
      password,
    });

    if (error) {
      setErrMsg(error.message);
      setState("error");
    } else {
      navigate("/dashboard");
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
              Dev login — password access
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Sign in with password
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Internal dev account only. Not for regular users.
              </p>
            </div>

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dev@example.com"
                required
                disabled={state === "loading"}
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                disabled={state === "loading"}
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {state === "error" && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {errMsg || "Invalid email or password."}
              </p>
            )}

            <button
              type="submit"
              disabled={state === "loading" || !email.trim() || !password}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {state === "loading" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
              ) : (
                <>Sign in <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/40">
          This page is not linked from the app.
        </p>
      </div>
    </div>
  );
}
