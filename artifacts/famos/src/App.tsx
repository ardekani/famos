/**
 * FamOS — App entry point.
 * Defines all client-side routes using wouter.
 * Protected routes require a valid Supabase session.
 */

import { type ComponentType } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, useAuth } from "@/lib/auth";
import { useIsDevUser } from "@/lib/dev-access";

import LoginPage        from "@/pages/login";
import HomePage         from "@/pages/home";
import DashboardPage    from "@/pages/dashboard";
import ChildrenPage     from "@/pages/children";
import EmailsPage       from "@/pages/emails/index";
import EmailDetailPage  from "@/pages/emails/email-detail";
import GmailForwardingPage from "@/pages/setup/gmail-forwarding";
import TryPage            from "@/pages/try";
import TestEmailPage    from "@/pages/dev/test-email";
import DevLoginPage     from "@/pages/dev/login";
import NotFound         from "@/pages/not-found";

const queryClient = new QueryClient();

// ── Loading spinner ───────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}

// ── Protected route wrapper ───────────────────────────────────────────────

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user)   return <Redirect to="/login" />;

  return <Component />;
}

// ── Dev-only route wrapper ────────────────────────────────────────────────
// Requires auth AND dev-user access. Non-dev users are redirected to /dashboard.

function DevRoute({ component: Component }: { component: ComponentType }) {
  const { user, loading } = useAuth();
  const isDevUser = useIsDevUser();

  if (loading)            return <LoadingScreen />;
  if (!user)              return <Redirect to="/login" />;
  if (!isDevUser)         return <Redirect to="/dashboard" />;

  return <Component />;
}

// ── Router ────────────────────────────────────────────────────────────────

function Router() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  // Redirect authenticated users away from public-only pages
  if (!loading && user && (location === "/login" || location === "/" || location === "/dev/login")) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <Switch>
      {/* Auth */}
      <Route path="/login" component={LoginPage} />

      {/* Marketing */}
      <Route path="/" component={HomePage} />

      {/* Protected app routes */}
      <Route path="/dashboard">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/children">
        <ProtectedRoute component={ChildrenPage} />
      </Route>
      <Route path="/emails">
        <ProtectedRoute component={EmailsPage} />
      </Route>
      <Route path="/emails/:id">
        <ProtectedRoute component={EmailDetailPage} />
      </Route>
      <Route path="/setup/gmail-forwarding">
        <ProtectedRoute component={GmailForwardingPage} />
      </Route>
      <Route path="/try">
        <ProtectedRoute component={TryPage} />
      </Route>

      {/* Dev tools */}
      <Route path="/dev/login" component={DevLoginPage} />
      <Route path="/dev/test-email">
        <DevRoute component={TestEmailPage} />
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

// ── App ───────────────────────────────────────────────────────────────────

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
