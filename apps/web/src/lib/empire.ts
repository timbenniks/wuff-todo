import type { Dashboard } from "@wuff/contracts";
export { empireAppCatalog as empireApps } from "@wuff/contracts";

export type EmpireDestination = "dashboard" | "todo" | "totake" | "account";
export function empireDestination(pathname: string): EmpireDestination | null {
  if (pathname === "/") return "dashboard";
  const segment = pathname.split("/")[1];
  if (["lists", "tasks", "github", "agents", "connections"].includes(segment))
    return "todo";
  if (segment === "totake") return "totake";
  if (segment === "settings") return "account";
  return null;
}

// The portal follows existing Todo visibility/order without writing preferences.
export function portalSections(dashboard: Dashboard) {
  const { sections, hidden } = dashboard.preferences.settings;
  return sections.filter((section) => !hidden.includes(section));
}
