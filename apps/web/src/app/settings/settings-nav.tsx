"use client";
import { usePathname } from "next/navigation";
export function SettingsNav() {
  const path = usePathname();
  return (
    <nav aria-label="Settings" className="flex flex-wrap gap-2 sm:flex-col">
      {[
        ["/settings/reminders", "Reminders"],
        ["/settings/connections", "Connections"],
        ["/docs", "Design & prototype guide"],
      ].map(([href, label]) => (
        <a
          key={href}
          href={href}
          aria-current={path === href ? "page" : undefined}
          className={`rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-accent ${path === href ? "bg-accent text-primary" : ""}`}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
