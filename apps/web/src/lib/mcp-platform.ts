import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import {
  mcpToolQuerySchema,
  updateMcpToolsSchema,
  notificationSettingsSchema,
  updateEmpireSettingsSchema,
  disconnectAiClientSchema,
} from "@wuff/contracts";
import * as domain from "@wuff/domain";
import type { McpContext } from "@/lib/mcp-context";
export function registerPlatformMcp({
  server,
  actor,
  registerTool,
  uri,
  read,
  write,
  result,
}: McpContext) {
  registerTool(
    "get_ai_connections",
    {
      description:
        "Read your personal AI-client connections, actual granted scopes and authorized/expired status. Requires empire:read. No tokens or provider credentials are exposed.",
      inputSchema: {},
      annotations: read,
    },
    async () =>
      result(async () => ({
        connections: await domain.getAiConnections(actor),
      })),
  );
  registerTool(
    "disconnect_ai_client",
    {
      description:
        "Revoke your grants for a specific AI client. Requires empire:manage. Supply clientId from get_ai_connections and fresh operationId; retry uncertain requests with the same arguments. This does not disconnect GitHub or other provider accounts.",
      inputSchema: disconnectAiClientSchema.shape,
      annotations: { ...write, destructiveHint: true },
    },
    async (input) =>
      result(async () => ({
        ...(await domain.disconnectAiClient(actor, input)),
      })),
  );
  registerTool(
    "get_empire_settings",
    {
      description:
        "Read the app catalogue and your independently versioned app/dashboard visibility. Requires empire:read. These choices never grant data access.",
      inputSchema: {},
      annotations: read,
    },
    async () =>
      result(async () => ({
        empireSettings: await domain.getEmpireSettings(actor),
        empireCanManage: actor.scopes.includes("empire:manage"),
      })),
  );
  registerTool(
    "update_empire_settings",
    {
      description:
        "Patch personal app visibility/dashboard choices. Read get_empire_settings first; supply version and fresh operationId. Requires empire:read and empire:manage. Omitted apps/fields are preserved. Retry uncertain saves with exactly the same arguments. Hiding does not pause notifications, revoke connections or remove data. Totake summary is opt-in.",
      inputSchema: updateEmpireSettingsSchema.shape,
      annotations: write,
    },
    async (input) =>
      result(async () => ({
        empireSettings: await domain.updateEmpireSettings(actor, input),
      })),
  );
  registerAppResource(
    server,
    "Wuff lists",
    uri,
    { description: "Private list and task controls" },
    async () => ({
      contents: [
        {
          uri,
          mimeType: RESOURCE_MIME_TYPE,
          text: await readFile(
            path.join(process.cwd(), ".mcp/ui.html"),
            "utf8",
          ),
          _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } },
        },
      ],
    }),
  );
  registerTool(
    "get_notification_settings",
    {
      description:
        "Read your global/per-app notification pauses and lock-screen content setting. Requires notifications:read. Device registration uses secure Settings.",
      inputSchema: {},
      annotations: read,
    },
    async () =>
      result(async () => ({
        notifications: await domain.getNotificationSettings(actor),
      })),
  );
  registerTool(
    "update_notification_settings",
    {
      description:
        "Save global/per-app notification pause and privacy settings. Requires notifications:read and notifications:manage. apps.todo/totake true means PAUSED. Read current version; supply fresh operationId and retry uncertain requests identically. Pause does not record or skip doses.",
      inputSchema: notificationSettingsSchema.shape,
      annotations: write,
    },
    async (input) =>
      result(async () => ({
        notifications: await domain.updateNotificationSettings(actor, input),
      })),
  );
  registerTool(
    "get_mcp_tool_preferences",
    {
      description:
        "Read a named MCP connection's tool choices/catalog and secure settings URL. Requires empire:read. Tool choices never grant OAuth permissions.",
      inputSchema: mcpToolQuerySchema.shape,
      annotations: read,
    },
    async (input) =>
      result(async () => ({
        toolPreferences: await domain.getMcpToolPreferences(actor, input),
      })),
  );
  registerTool(
    "update_mcp_tool_preferences",
    {
      description:
        "Save tool choices for an owned MCP connection. Read get_mcp_tool_preferences first; use current version and fresh operationId, retry uncertain requests identically. Requires empire:read/manage. AI connections may only turn tools off; re-enable through Wuff Settings. Never change choices without explicit user intent. Refresh the client tool catalog after saving.",
      inputSchema: updateMcpToolsSchema,
      annotations: write,
    },
    async (input) =>
      result(async () => ({
        toolPreferences: await domain.updateMcpToolPreferences(actor, input),
      })),
  );
  registerAppTool(
    { registerTool },
    "show_empire_settings",
    {
      title: "Choose your Wuff apps",
      description:
        "Open personal app and dashboard visibility settings. Requires empire:read; saving also requires empire:manage. Hiding an app does not stop reminders, revoke connections or delete data.",
      inputSchema: {},
      annotations: read,
      _meta: { ui: { resourceUri: uri } },
    },
    async () =>
      result(async () => ({
        empireSettings: await domain.getEmpireSettings(actor),
        empireCanManage: actor.scopes.includes("empire:manage"),
      })),
  );
}
