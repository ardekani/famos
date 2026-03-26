/**
 * Shared top navigation bar.
 * Shows the FamOS logo, main nav links, user avatar, and sign-out.
 */

import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useIsDevUser } from "@/lib/dev-access";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Mail, Users, Settings, FlaskConical, LogOut } from "lucide-react";

const navLinks = [
  { href: "/dashboard",              label: "Dashboard", icon: LayoutDashboard },
  { href: "/emails",                 label: "Emails",    icon: Mail            },
  { href: "/children",               label: "Children",  icon: Users           },
  { href: "/setup/gmail-forwarding", label: "Setup",     icon: Settings        },
];

const devLinks = [
  { href: "/dev/test-email", label: "Test Email", icon: FlaskConical },
];

export function Nav() {
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const isDevUser = useIsDevUser();

  const isActive = (href: string) =>
    location === href || location.startsWith(href + "/");

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "?";

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

        {/* Main nav — only show when signed in */}
        {user && (
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
        )}

        {/* Spacer when signed out */}
        {!user && <div className="flex-1" />}

        {/* Dev links — only visible to dev users */}
        {user && isDevUser && (
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
        )}

        {/* User avatar + sign out */}
        {user && (
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold select-none"
              title={user.email ?? ""}
            >
              {initials}
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
