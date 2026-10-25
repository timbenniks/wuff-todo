import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Actor } from "@wuff/contracts";
import { empireModules } from "@wuff/contracts";
import { createMcpContext, scopeModuleMcpContext } from "./mcp-context";
import { registerPlatformMcp } from "./mcp-platform";
import { moduleServers } from "@/modules/server";
export function createMcpServer(
  actor: Actor,
  enabledTools: readonly string[] | null = null,
) {
  const server = new McpServer({ name: "Wuff Empire", version: "0.2.0" });
  const context = createMcpContext(server, actor, enabledTools);
  registerPlatformMcp(context);
  for (const module of empireModules)
    moduleServers[module.id].registerMcp(
      scopeModuleMcpContext(
        context,
        module.mcpTools.map((tool) => tool.id),
      ),
    );
  return server;
}
