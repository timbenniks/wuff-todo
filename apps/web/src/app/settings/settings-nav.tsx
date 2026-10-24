"use client";
import { usePathname } from "next/navigation";
export function SettingsNav() {
  const path = usePathname();
  return (
    <nav aria-label="Settings" className="workspace-settings-nav">
      {[
        ["/settings/reminders", "Reminders"],
        ["/settings/connections", "Connections"],
        ["/settings/docs", "Docs"],
      ].map(([href, label]) => (
        <a
          key={href}
          href={href}
          aria-current={
            path === href || path.startsWith(href + "/") ? "page" : undefined
          }
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
