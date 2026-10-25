"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { Button } from "@wuff/ui/button";
import { Corgi } from "./corgi";
import { empireApps, empireDestination } from "@/lib/empire";
import { authClient } from "@/lib/auth/client";
import { disableBrowserOnSignOut } from "@/lib/reminder-browser";
import {
  EmpirePreferencesProvider,
  useEmpirePreferences,
} from "./empire-preferences";
import { empireAppPreference } from "@wuff/contracts";

export function EmpireFrame({ children }: { children: React.ReactNode }) {
  const active = empireDestination(usePathname()) !== null;
  return (
    <EmpirePreferencesProvider active={active}>
      <EmpireChrome>{children}</EmpireChrome>
    </EmpirePreferencesProvider>
  );
}
function EmpireChrome({ children }: { children: React.ReactNode }) {
  const preferences = useEmpirePreferences();
  const pathname = usePathname();
  const destination = empireDestination(pathname);
  const header = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    header.current?.querySelectorAll("details").forEach((el) => {
      el.open = false;
    });
  }, [pathname]);
  if (!destination) return children;

  const links = (
    <>
      <a
        href="/"
        aria-current={destination === "dashboard" ? "page" : undefined}
      >
        Dashboard
      </a>
      {empireApps
        .filter(
          (app) =>
            preferences.settings &&
            empireAppPreference(preferences.settings.apps, app.id).visible,
        )
        .map((app) => (
          <a
            key={app.id}
            href={app.href}
            aria-current={destination === app.id ? "page" : undefined}
          >
            {app.name}
            {app.status === "coming-soon" && (
              <span className="empire-soon">Soon</span>
            )}
          </a>
        ))}
      <a href="/settings/apps">Manage apps</a>
    </>
  );
  return (
    <div className="empire-frame">
      {(destination === "dashboard" || destination === "totake") && (
        <a className="skip-link" href="#empire-content">
          Skip to content
        </a>
      )}
      <header
        className="empire-header"
        ref={header}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          const details = (event.target as HTMLElement).closest("details");
          if (details?.open) {
            details.open = false;
            details.querySelector("summary")?.focus();
            event.stopPropagation();
          }
        }}
        onBlur={(event) => {
          const details = (event.target as HTMLElement).closest("details");
          // Disabling a pending action can blur to the document. Keep its retry
          // menu open; close when focus actually moves to another control.
          if (
            details &&
            event.relatedTarget &&
            !details.contains(event.relatedTarget as Node)
          )
            details.open = false;
        }}
      >
        <a href="/" className="empire-brand" aria-label="Wuff Empire dashboard">
          <Corgi size={40} />
          <span className="wordmark">Wuff Empire</span>
        </a>
        <nav className="empire-desktop-nav" aria-label="Apps">
          {links}
        </nav>
        <details className="empire-mobile-nav">
          <summary>
            Apps <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <nav className="empire-popover" aria-label="Apps">
            {links}
          </nav>
        </details>
        <details className="empire-account">
          <summary aria-label="Account menu">
            <Settings size={20} aria-hidden="true" />
            <span>Account</span>
          </summary>
          <div className="empire-popover">
            <a
              href="/settings"
              aria-current={destination === "account" ? "page" : undefined}
            >
              <Settings size={18} aria-hidden="true" /> Settings
            </a>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await disableBrowserOnSignOut();
                  const result = await authClient.signOut();
                  if (result.error) throw new Error("Sign-out failed");
                  window.location.assign("/sign-in");
                } catch {
                  setError("Couldn’t sign out. Try again.");
                  setBusy(false);
                }
              }}
            >
              <LogOut size={18} aria-hidden="true" />
              {busy ? "Signing out…" : "Sign out"}
            </Button>
            {error && <p role="alert">{error}</p>}
          </div>
        </details>
      </header>
      {children}
    </div>
  );
}
