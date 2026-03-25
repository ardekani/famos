/**
 * 404 — Not Found
 */

import { Link } from "wouter";
import { Shell } from "@/components/layout/Shell";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <Shell>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <FileQuestion className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Go to dashboard
        </Link>
      </div>
    </Shell>
  );
}
