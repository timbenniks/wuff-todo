import { z } from "zod";
import { empireModules } from "./modules";
export const mcpToolGroups = [
  ...empireModules.flatMap<(typeof empireModules)[number]["mcpGroups"][number]>(
    (module) => module.mcpGroups,
  ),
  { id: "empire", title: "Empire settings", order: 30 },
  { id: "notifications", title: "Shared notifications", order: 40 },
  { id: "connections", title: "Connection controls", order: 70 },
]
  .sort((a, b) => a.order - b.order)
  .map(({ id, title }) => ({ id, title }));
export const mcpToolCatalog = [
  ...empireModules.flatMap<(typeof empireModules)[number]["mcpTools"][number]>(
    (module) => module.mcpTools,
  ),
  {
    id: "get_notification_settings",
    group: "notifications",
    title: "Read notification settings",
    scopes: ["notifications:read"],
    control: false,
  },
  {
    id: "update_notification_settings",
    group: "notifications",
    title: "Change notification settings",
    scopes: ["notifications:read", "notifications:manage"],
    control: false,
  },
  {
    id: "show_empire_settings",
    group: "empire",
    title: "Open Empire settings",
    scopes: ["empire:read"],
    control: false,
  },
  {
    id: "get_empire_settings",
    group: "empire",
    title: "Read Empire settings",
    scopes: ["empire:read"],
    control: false,
  },
  {
    id: "update_empire_settings",
    group: "empire",
    title: "Change Empire settings",
    scopes: ["empire:read", "empire:manage"],
    control: false,
  },
  {
    id: "get_ai_connections",
    group: "connections",
    title: "Read AI connections",
    scopes: ["empire:read"],
    control: true,
  },
  {
    id: "get_mcp_tool_preferences",
    group: "connections",
    title: "Read MCP tool preferences",
    scopes: ["empire:read"],
    control: true,
  },
  {
    id: "disconnect_ai_client",
    group: "connections",
    title: "Disconnect AI client",
    scopes: ["empire:manage"],
    control: true,
  },
  {
    id: "update_mcp_tool_preferences",
    group: "connections",
    title: "Change MCP tool preferences",
    scopes: ["empire:read", "empire:manage"],
    control: true,
  },
] as const;

export type McpToolId = (typeof mcpToolCatalog)[number]["id"];
export const optionalMcpToolIds = mcpToolCatalog
  .filter((t) => !t.control)
  .map((t) => t.id);
export function mcpToolAllowed(
  id: string,
  scopes: readonly string[],
  enabled: readonly string[] | null,
) {
  const tool = mcpToolCatalog.find((t) => t.id === id);
  return (
    !!tool &&
    tool.scopes.every((s) => scopes.includes(s)) &&
    (tool.control || enabled === null || enabled.includes(id))
  );
}
/** Saved selection and effective permission are independent connection states. */
export function mcpToolAvailability(
  id: string,
  grantedScopes: readonly string[],
  selectedTools: readonly string[],
) {
  const tool = mcpToolCatalog.find((tool) => tool.id === id);
  const selected = !!tool && selectedTools.includes(id);
  const missingScopes = tool
    ? tool.scopes.filter((scope) => !grantedScopes.includes(scope))
    : [];
  return {
    selected,
    available: selected && mcpToolAllowed(id, grantedScopes, selectedTools),
    missingScopes,
  };
}
/** MCP may narrow a saved selection. Owner Settings can re-enable tools. */
export function mcpToolSelectionAllowed(
  current: readonly string[] | null,
  requested: readonly string[],
  fromMcp: boolean,
) {
  return (
    !fromMcp ||
    current === null ||
    requested.every((id) => current.includes(id))
  );
}
export function selectMcpToolGroup(
  current: readonly string[],
  group: string,
  selected: boolean,
): McpToolId[] {
  const allowed = optionalMcpToolIds.filter((id) => current.includes(id));
  const groupIds: readonly McpToolId[] = mcpToolCatalog
    .filter((t) => t.group === group && !t.control)
    .map((t) => t.id);
  return [
    ...new Set(
      selected
        ? [...allowed, ...groupIds]
        : allowed.filter((id) => !groupIds.includes(id)),
    ),
  ].sort();
}
export const mcpToolQuerySchema = z
  .object({ clientId: z.string().min(1).max(200) })
  .strict();
export const updateMcpToolsSchema = mcpToolQuerySchema
  .extend({
    version: z.number().int().nonnegative(),
    operationId: z.uuid(),
    enabledTools: z
      .array(z.enum(optionalMcpToolIds as [McpToolId, ...McpToolId[]]))
      .max(optionalMcpToolIds.length),
  })
  .strict()
  .refine(
    (v) => new Set(v.enabledTools).size === v.enabledTools.length,
    "Choose each tool only once",
  );
export type McpToolsUpdate = z.infer<typeof updateMcpToolsSchema>;
export type McpToolPreferences = {
  userId: string;
  clientId: string;
  clientName: string;
  version: number;
  configured: boolean;
  enabledTools: McpToolId[];
  grantedScopes: string[];
  catalog: typeof mcpToolCatalog;
  groups: typeof mcpToolGroups;
  canEnable: boolean;
  setupPath: string;
};
