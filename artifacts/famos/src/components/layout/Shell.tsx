/**
 * Page shell — wraps content with the nav and a max-width container.
 */

import { ReactNode } from "react";
import { Nav } from "./Nav";

interface ShellProps {
  children: ReactNode;
  /** Optional extra classes on the inner content wrapper */
  className?: string;
}

export function Shell({ children, className }: ShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className={`mx-auto max-w-5xl px-4 py-8 ${className ?? ""}`}>
        {children}
      </main>
    </div>
  );
}
