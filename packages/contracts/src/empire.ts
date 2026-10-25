import { z } from "zod";
export const connectionPermissionLabels: Record<string, string> = {
  "totake:read":
    "Totake: read private medication, equipment, history and stock",
  "totake:write": "Totake: change schedules, records, reminders and stock",
  "notifications:read": "Read shared notification settings",
  "notifications:manage": "Change shared notification settings",
  "empire:read": "Read Empire choices and AI connections",
  "empire:manage":
    "Change Empire choices, manage MCP tool choices and disconnect AI clients",
  "lists:read": "Todo: read accessible lists and tasks",
  "tasks:write": "Todo: change tasks and personal reminders",
  "lists:manage": "Todo: manage owned lists and personal views",
  "github:manage": "Todo: manage GitHub connections and linked issues",
  "agents:manage": "Todo: manage coding environments and paid agents",
};
export const disconnectAiClientSchema = z
  .object({
    clientId: z.string().min(1).max(200),
    operationId: z.uuid().optional(),
  })
  .strict();
export type AiConnection = {
  id: string;
  name: string;
  scopes: string[];
  state: "authorized" | "expired";
  mcp?: boolean;
};
export function summarizeAiConnections(
  rows: { id: string; name: string; scopes: string[]; expiresAt: number }[],
  now: number,
): AiConnection[] {
  const grouped = new Map<string, AiConnection>();
  for (const row of rows) {
    const old = grouped.get(row.id) ?? {
      id: row.id,
      name: row.name,
      scopes: [],
      state: "expired" as const,
    };
    const active = row.expiresAt > now;
    grouped.set(row.id, {
      ...old,
      scopes: [
        ...new Set([...old.scopes, ...(active ? row.scopes : [])]),
      ].sort(),
      state: active || old.state === "authorized" ? "authorized" : "expired",
    });
  }
  return [...grouped.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

export const empireAppCatalog = [
  {
    id: "todo",
    name: "Wuff Todo",
    href: "/lists",
    settingsHref: "/settings/todo",
    status: "available" as "available" | "coming-soon",
    hasDashboard: true,
    description: "Private lists, shared plans, and a little less to remember.",
  },
  {
    id: "totake",
    name: "Wuff Totake",
    href: "/totake",
    settingsHref: "/settings/totake",
    status: "available" as "available" | "coming-soon",
    hasDashboard: true,
    description: "A personal home for medicine reminders.",
  },
] as const;
export type EmpireAppId = (typeof empireAppCatalog)[number]["id"];
export type EmpireAppPreference = { visible: boolean; dashboard: boolean };
export type EmpireSettings = {
  userId: string;
  version: number;
  apps: Record<string, EmpireAppPreference>;
  catalog: typeof empireAppCatalog;
};
export const empireChangeSchema = z
  .object({
    appId: z.enum(["todo", "totake"]),
    visible: z.boolean().optional(),
    dashboard: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) => v.visible !== undefined || v.dashboard !== undefined,
    "Choose a setting to change",
  );
export const updateEmpireSettingsSchema = z
  .object({
    version: z.number().int().nonnegative(),
    operationId: z.uuid(),
    changes: z
      .array(empireChangeSchema)
      .min(1)
      .max(2)
      .refine(
        (v) => new Set(v.map((c) => c.appId)).size === v.length,
        "Change each app once",
      ),
  })
  .strict();
export type EmpireSettingsUpdate = z.infer<typeof updateEmpireSettingsSchema>;
export function empireAppPreference(
  apps: EmpireSettings["apps"],
  id: EmpireAppId,
): EmpireAppPreference {
  return apps[id] ?? { visible: true, dashboard: id === "todo" };
}
export function applyEmpireChanges(
  apps: EmpireSettings["apps"],
  changes: EmpireSettingsUpdate["changes"],
) {
  const next = { ...apps };
  for (const change of changes) {
    const { appId } = change;
    next[appId] = {
      ...empireAppPreference(apps, appId),
      ...(change.visible !== undefined ? { visible: change.visible } : {}),
      ...(change.dashboard !== undefined
        ? { dashboard: change.dashboard }
        : {}),
    };
  }
  return next;
}
