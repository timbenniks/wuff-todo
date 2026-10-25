/** Client-safe declarations only. No React, database or transport imports. */
export type EmpireModule = {
  readonly permissions: readonly {
    readonly scope: string;
    readonly label: string;
  }[];
  readonly integrations?: readonly {
    readonly moduleId: string;
    readonly scopes: readonly string[];
  }[];
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly settingsHref: string;
  readonly status: "available" | "coming-soon";
  readonly hasDashboard: boolean;
  readonly description: string;
  readonly routes: readonly string[];
  readonly defaults: { readonly visible: boolean; readonly dashboard: boolean };
  readonly settings: readonly (readonly [href: string, label: string])[];
  readonly dashboard: readonly { readonly id: string }[];
  readonly theme:
    "blue" | "lavender" | "sage" | "rose" | "peach" | "sand" | "slate";
  readonly mcpTools: readonly {
    readonly id: string;
    readonly group: string;
    readonly title: string;
    readonly scopes: readonly string[];
    readonly control: boolean;
  }[];
  readonly mcpGroups: readonly {
    readonly id: string;
    readonly title: string;
    readonly order: number;
  }[];
};
export function createModuleRegistry<const T extends readonly EmpireModule[]>(
  modules: T,
): T {
  const ids = new Set<string>(),
    routes = new Set<string>(),
    widgets = new Set<string>(),
    groups = new Set<string>(),
    permissions = new Set<string>(),
    tools = new Set<string>();
  for (const module of modules) {
    if (!/^[a-z][a-z0-9-]*$/.test(module.id) || ids.has(module.id))
      throw new Error("Invalid or duplicate module: " + module.id);
    ids.add(module.id);
    if (
      !module.routes.length ||
      !module.routes.some(
        (route) => module.href === route || module.href.startsWith(route + "/"),
      )
    )
      throw new Error("Module entry must belong to a route: " + module.id);
    if (!module.settings.some(([href]) => href === module.settingsHref))
      throw new Error("Missing module settings entry: " + module.id);
    if (module.hasDashboard !== Boolean(module.dashboard.length))
      throw new Error("Dashboard declaration mismatch: " + module.id);
    for (const route of module.routes) {
      if (
        !/^\/(?!\/)[a-zA-Z0-9/-]+$/.test(route) ||
        route.endsWith("/") ||
        routes.has(route) ||
        ["/settings", "/api", "/sign-in", "/docs"].some(
          (reserved) => route === reserved || route.startsWith(reserved + "/"),
        )
      )
        throw new Error(
          "Invalid, reserved or duplicate module route: " + route,
        );
      routes.add(route);
    }
    for (const widget of module.dashboard) {
      if (!widget.id.startsWith(module.id + ".") || widgets.has(widget.id))
        throw new Error("Invalid or duplicate widget: " + widget.id);
      widgets.add(widget.id);
    }
    for (const [href] of module.settings) {
      if (
        !href.startsWith("/settings/") ||
        href.includes("?") ||
        href.includes("#") ||
        href.includes("..")
      )
        throw new Error("Invalid settings path: " + href);
    }
    for (const permission of module.permissions) {
      if (
        !/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/.test(permission.scope) ||
        permissions.has(permission.scope)
      )
        throw new Error("Invalid or duplicate permission: " + permission.scope);
      permissions.add(permission.scope);
    }
    for (const integration of module.integrations ?? []) {
      const target = modules.find(
        (candidate) => candidate.id === integration.moduleId,
      );
      if (
        !target ||
        target.id === module.id ||
        integration.scopes.some(
          (scope) =>
            !target.permissions.some(
              (permission) => permission.scope === scope,
            ),
        )
      )
        throw new Error("Invalid module integration: " + integration.moduleId);
    }
    for (const tool of module.mcpTools) {
      if (
        tools.has(tool.id) ||
        !module.mcpGroups.some((group) => group.id === tool.group) ||
        !tool.scopes.length ||
        tool.control ||
        tool.scopes.some(
          (scope) =>
            !module.permissions.some(
              (permission) => permission.scope === scope,
            ) &&
            !(module.integrations ?? []).some((integration) =>
              integration.scopes.includes(scope),
            ),
        )
      )
        throw new Error("Invalid or duplicate module tool: " + tool.id);
      tools.add(tool.id);
    }
    for (const group of module.mcpGroups) {
      if (groups.has(group.id))
        throw new Error("Duplicate module tool group: " + group.id);
      groups.add(group.id);
    }
  }
  return modules;
}
export function moduleForPath(
  modules: readonly EmpireModule[],
  pathname: string,
): EmpireModule | undefined {
  return modules
    .flatMap((module) => module.routes.map((route) => ({ module, route })))
    .filter(
      ({ route }) => pathname === route || pathname.startsWith(route + "/"),
    )
    .sort((a, b) => b.route.length - a.route.length)[0]?.module;
}
