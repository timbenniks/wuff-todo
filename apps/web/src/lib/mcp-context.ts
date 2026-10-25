import { wuffError } from "./copy";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  mcpToolCatalog,
  mcpToolAllowed,
  Actor,
  AppError,
} from "@wuff/contracts";
import { appOrigin } from "./config";
export function createMcpContext(
  server: McpServer,
  actor: Actor,
  enabledTools: readonly string[] | null,
) {
  const registerTool: typeof server.registerTool = (name, config, callback) => {
    const policy = mcpToolCatalog.find((tool) => tool.id === name);
    if (!policy) throw new Error(`Missing MCP tool policy: ${name}`);
    const tool = server.registerTool(
      name,
      { ...config, title: config.title ?? policy.title },
      callback,
    );
    if (!mcpToolAllowed(name, actor.scopes, enabledTools)) tool.disable();
    return tool;
  };
  const uri = "ui://wuff/lists.html";
  const read = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  const write = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  async function result(action: () => Promise<Record<string, unknown>>) {
    try {
      const data = {
        ...(await action()),
        viewerId: actor.id,
        webOrigin: appOrigin(),
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data) }],
        structuredContent: data,
      };
    } catch (error) {
      return {
        isError: true,
        structuredContent: {
          error: {
            code:
              error instanceof AppError
                ? error.code
                : error instanceof z.ZodError
                  ? "invalid_input"
                  : "internal_error",
          },
        },
        content: [
          {
            type: "text" as const,
            text:
              error instanceof AppError || error instanceof z.ZodError
                ? wuffError(
                    error instanceof z.ZodError
                      ? error.issues.map((i) => i.message).join("; ")
                      : error.message,
                  )
                : "Ruff patch! Wuff couldn’t complete the request. Try again.",
          },
        ],
      };
    }
  }
  return { server, actor, registerTool, uri, read, write, result };
}
export type McpContext = ReturnType<typeof createMcpContext>;
export type ModuleMcpContext = Omit<McpContext, "server">;

export function scopeModuleMcpContext(
  context: McpContext,
  toolIds: readonly string[],
): ModuleMcpContext {
  const owned = new Set(toolIds);
  const registerTool: typeof context.registerTool = (
    name,
    config,
    callback,
  ) => {
    if (!owned.has(name))
      throw new Error(
        "Module attempted to register an undeclared tool: " + name,
      );
    return context.registerTool(name, config, callback);
  };
  const { server: _server, ...moduleContext } = context;
  return { ...moduleContext, registerTool };
}
