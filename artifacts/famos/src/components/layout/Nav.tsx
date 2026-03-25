/**
 * Shared top navigation bar.
 * Shows the FamOS logo, main nav links, and a simple user avatar.
 */

import { Link, useLocation } from "wouter";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Mail, Settings, FlaskConical } from "lucide-react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/emails", label: "Emails", icon: Mail },
  { href: "/setup/gmail-forwarding", label: "Setup", icon: Settings },
];

const devLinks = [
  { href: "/dev/test-email", label: "Test Email", icon: FlaskConical },
];

export function Nav() {
  const [location] = useLocation();
  const user = getCurrentUser();

  const isActive = (href: string) =>
    location === href || location.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        {/* Logo */}
        <Link href="/">
          <span className="flex items-center gap-2 font-semibold text-foreground text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
              F
            </span>
            FamOS
          </span>
        </Link>

        {/* Main nav */}
        <nav className="flex flex-1 items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </span>
            </Link>
          ))}
        </nav>

        {/* Dev links (subtle) */}
        <div className="hidden items-center gap-1 md:flex">
          {devLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  isActive(href)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground/60 hover:text-muted-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
            </Link>
          ))}
        </div>

        {/* User avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold select-none">
          {user.avatarInitials}
        </div>
      </div>
    </header>
  );
}
