import { empireModules, moduleForPath } from "@wuff/contracts";
export { empireAppCatalog as empireApps } from "@wuff/contracts";
export { portalSections } from "@/modules/todo/portal-sections";
export type EmpireDestination =
  "dashboard" | (typeof empireModules)[number]["id"] | "account";
export function empireDestination(pathname: string): EmpireDestination | null {
  if (pathname === "/") return "dashboard";
  if (pathname === "/settings" || pathname.startsWith("/settings/"))
    return "account";
  return (
    (moduleForPath(empireModules, pathname)?.id as
      EmpireDestination | undefined) ?? null
  );
}
