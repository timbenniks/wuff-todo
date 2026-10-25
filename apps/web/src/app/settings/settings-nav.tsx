"use client";
import { empireModules } from "@wuff/contracts";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { NativeSelect } from "@wuff/ui/native-select";
const sections: {
  title: string;
  links: readonly (readonly [string, string])[];
}[] = [
  {
    title: "Your Empire",
    links: [
      ["/settings/apps", "Your apps"],
      ["/settings/dashboard", "Dashboard"],
      ["/settings/notifications", "Notifications"],
      ["/settings/connections", "AI & MCP connections"],
      ["/settings/account", "Account"],
    ],
  },
  ...empireModules.map((module) => ({
    title: module.name,
    links: module.settings,
  })),
  { title: "Help", links: [["/settings/docs", "Docs"]] },
];
export function SettingsNav() {
  const router = useRouter();
  const path = usePathname();
  const active =
    sections
      .flatMap((s) => s.links)
      .filter(([href]) => path === href || path.startsWith(href + "/"))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[0] ?? "/settings/apps";
  return (
    <aside className="empire-settings-navigation">
      <Link prefetch={false} className="empire-text-link" href="/">
        ← Dashboard
      </Link>
      <label className="empire-settings-mobile">
        Settings page
        <NativeSelect
          aria-label="Settings page"
          value={active}
          onChange={(event) => router.push(event.target.value)}
        >
          {sections.map((section) => (
            <optgroup key={section.title} label={section.title}>
              {section.links.map(([href, label]) => (
                <option key={href} value={href}>
                  {label}
                </option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
      </label>
      <nav aria-label="Settings" className="empire-settings-nav">
        {sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.links.map(([href, label]) => (
              <Link
                prefetch={false}
                key={href}
                href={href}
                aria-current={active === href ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </section>
        ))}
      </nav>
    </aside>
  );
}
