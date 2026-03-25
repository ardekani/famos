/**
 * FamOS — App entry point.
 * Defines all client-side routes using wouter.
 */

import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import HomePage from "@/pages/home";
import DashboardPage from "@/pages/dashboard";
import EmailsPage from "@/pages/emails/index";
import EmailDetailPage from "@/pages/emails/email-detail";
import GmailForwardingPage from "@/pages/setup/gmail-forwarding";
import TestEmailPage from "@/pages/dev/test-email";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Marketing / home */}
      <Route path="/" component={HomePage} />

      {/* App routes */}
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/emails" component={EmailsPage} />
      <Route path="/emails/:id" component={EmailDetailPage} />

      {/* Setup */}
      <Route path="/setup/gmail-forwarding" component={GmailForwardingPage} />

      {/* Dev tools */}
      <Route path="/dev/test-email" component={TestEmailPage} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/*
          BASE_URL is injected by Vite. In production it includes the
          artifact's previewPath prefix so routes resolve correctly.
        */}
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
