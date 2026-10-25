import { z } from "zod";
export const mcpToolGroups = [
  { id: "todo", title: "Wuff Todo" },
  { id: "totake", title: "Wuff Totake" },
  { id: "empire", title: "Empire settings" },
  { id: "notifications", title: "Shared notifications" },
  { id: "github", title: "GitHub" },
  { id: "agents", title: "Coding agents" },
  { id: "connections", title: "Connection controls" },
] as const;
export const mcpToolCatalog = [
  {
    id: "show_lists",
    group: "todo",
    title: "Open lists",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "show_list",
    group: "todo",
    title: "Open list",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "list_lists",
    group: "todo",
    title: "Browse lists",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "get_list",
    group: "todo",
    title: "Read list",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "get_task",
    group: "todo",
    title: "Read task",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "show_dashboard",
    group: "todo",
    title: "Open dashboard",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "get_dashboard",
    group: "todo",
    title: "Read dashboard",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "get_list_order",
    group: "todo",
    title: "Read list order",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "get_list_view",
    group: "todo",
    title: "Read list view",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "get_list_sharing",
    group: "todo",
    title: "Read list sharing",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "list_invitations",
    group: "todo",
    title: "Browse invitations",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "get_task_image",
    group: "todo",
    title: "Read task image",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "get_reminder_settings",
    group: "todo",
    title: "Read reminder settings",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "get_list_reminders",
    group: "todo",
    title: "Read list reminders",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "get_task_reminder",
    group: "todo",
    title: "Read task reminder",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "update_dashboard",
    group: "todo",
    title: "Change dashboard",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "reorder_lists",
    group: "todo",
    title: "Reorder lists",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "update_list_view",
    group: "todo",
    title: "Change list view",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "update_list",
    group: "todo",
    title: "Change list",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "create_section",
    group: "todo",
    title: "Create section",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "rename_section",
    group: "todo",
    title: "Rename section",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "delete_section",
    group: "todo",
    title: "Delete section",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "reorder_sections",
    group: "todo",
    title: "Reorder sections",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "create_list",
    group: "todo",
    title: "Create list",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "rename_list",
    group: "todo",
    title: "Rename list",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "delete_list",
    group: "todo",
    title: "Delete list",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "invite_to_list",
    group: "todo",
    title: "Invite to list",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "respond_to_invitation",
    group: "todo",
    title: "Respond to invitation",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "cancel_invitation",
    group: "todo",
    title: "Cancel invitation",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "remove_list_member",
    group: "todo",
    title: "Remove list member",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "leave_list",
    group: "todo",
    title: "Leave list",
    scopes: ["lists:read", "lists:manage"],
    control: false,
  },
  {
    id: "create_task",
    group: "todo",
    title: "Create task",
    scopes: ["lists:read", "tasks:write"],
    control: false,
  },
  {
    id: "update_task",
    group: "todo",
    title: "Change task",
    scopes: ["lists:read", "tasks:write"],
    control: false,
  },
  {
    id: "delete_task",
    group: "todo",
    title: "Delete task",
    scopes: ["lists:read", "tasks:write"],
    control: false,
  },
  {
    id: "reorder_tasks",
    group: "todo",
    title: "Reorder tasks",
    scopes: ["lists:read", "tasks:write"],
    control: false,
  },
  {
    id: "upload_task_image",
    group: "todo",
    title: "Upload task image",
    scopes: ["lists:read", "tasks:write"],
    control: false,
  },
  {
    id: "update_reminder_settings",
    group: "todo",
    title: "Change reminder settings",
    scopes: ["lists:read", "tasks:write"],
    control: false,
  },
  {
    id: "update_list_reminders",
    group: "todo",
    title: "Change list reminders",
    scopes: ["lists:read", "tasks:write"],
    control: false,
  },
  {
    id: "set_task_reminder",
    group: "todo",
    title: "Set task reminder",
    scopes: ["lists:read", "tasks:write"],
    control: false,
  },
  {
    id: "remove_reminder_device",
    group: "todo",
    title: "Remove reminder device",
    scopes: ["lists:read", "tasks:write"],
    control: false,
  },
  {
    id: "get_github_connections",
    group: "github",
    title: "Read GitHub connections",
    scopes: ["lists:read", "github:manage"],
    control: false,
  },
  {
    id: "list_github_repositories",
    group: "github",
    title: "Browse GitHub repositories",
    scopes: ["lists:read", "github:manage"],
    control: false,
  },
  {
    id: "get_github_list",
    group: "github",
    title: "Read GitHub list",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "get_github_task",
    group: "github",
    title: "Read GitHub task",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "get_github_pull_requests",
    group: "github",
    title: "Read GitHub pull requests",
    scopes: ["lists:read", "github:manage"],
    control: false,
  },
  {
    id: "bind_github_repository",
    group: "github",
    title: "Bind GitHub repository",
    scopes: ["lists:read", "lists:manage", "tasks:write", "github:manage"],
    control: false,
  },
  {
    id: "disconnect_github_repository",
    group: "github",
    title: "Disconnect GitHub repository",
    scopes: ["lists:read", "lists:manage", "tasks:write", "github:manage"],
    control: false,
  },
  {
    id: "link_github_issue",
    group: "github",
    title: "Link GitHub issue",
    scopes: ["lists:read", "lists:manage", "tasks:write", "github:manage"],
    control: false,
  },
  {
    id: "unlink_github_issue",
    group: "github",
    title: "Unlink GitHub issue",
    scopes: ["lists:read", "lists:manage", "tasks:write", "github:manage"],
    control: false,
  },
  {
    id: "retry_github_sync",
    group: "github",
    title: "Retry GitHub sync",
    scopes: ["lists:read", "tasks:write", "github:manage"],
    control: false,
  },
  {
    id: "resolve_github_conflict",
    group: "github",
    title: "Resolve GitHub conflict",
    scopes: ["lists:read", "tasks:write", "github:manage"],
    control: false,
  },
  {
    id: "get_agent_connection",
    group: "agents",
    title: "Read agent connection",
    scopes: ["lists:read", "agents:manage"],
    control: false,
  },
  {
    id: "list_agent_environments",
    group: "agents",
    title: "Browse agent environments",
    scopes: ["lists:read", "lists:manage", "agents:manage"],
    control: false,
  },
  {
    id: "get_agent_readiness",
    group: "agents",
    title: "Read agent readiness",
    scopes: ["lists:read", "lists:manage", "agents:manage"],
    control: false,
  },
  {
    id: "get_task_agent",
    group: "agents",
    title: "Read task agent",
    scopes: ["lists:read"],
    control: false,
  },
  {
    id: "get_agent_activity",
    group: "agents",
    title: "Read agent activity",
    scopes: ["lists:read", "lists:manage", "agents:manage"],
    control: false,
  },
  {
    id: "recover_agent_run",
    group: "agents",
    title: "Recover agent run",
    scopes: ["lists:read", "lists:manage", "agents:manage"],
    control: false,
  },
  {
    id: "create_agent_environment",
    group: "agents",
    title: "Create agent environment",
    scopes: ["lists:read", "lists:manage", "agents:manage"],
    control: false,
  },
  {
    id: "bind_agent_environment",
    group: "agents",
    title: "Bind agent environment",
    scopes: ["lists:read", "lists:manage", "agents:manage"],
    control: false,
  },
  {
    id: "launch_task_agent",
    group: "agents",
    title: "Launch task agent",
    scopes: ["lists:read", "lists:manage", "tasks:write", "agents:manage"],
    control: false,
  },
  {
    id: "message_task_agent",
    group: "agents",
    title: "Message task agent",
    scopes: ["lists:read", "lists:manage", "tasks:write", "agents:manage"],
    control: false,
  },
  {
    id: "cancel_task_agent",
    group: "agents",
    title: "Cancel task agent",
    scopes: ["lists:read", "lists:manage", "agents:manage"],
    control: false,
  },
  {
    id: "show_totake",
    group: "totake",
    title: "Open Totake",
    scopes: ["totake:read"],
    control: false,
  },
  {
    id: "get_totake_summary",
    group: "totake",
    title: "Read Totake summary",
    scopes: ["totake:read"],
    control: false,
  },
  {
    id: "get_totake",
    group: "totake",
    title: "Read Totake",
    scopes: ["totake:read"],
    control: false,
  },
  {
    id: "update_totake",
    group: "totake",
    title: "Change Totake",
    scopes: ["totake:read", "totake:write"],
    control: false,
  },
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
/** MCP may narrow a saved selection. Owner Settings/native can re-enable tools. */
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
