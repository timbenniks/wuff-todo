import { readFile } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import {
  Actor,
  AppError,
  createListSchema,
  createTaskSchema,
  deleteTaskSchema,
  idSchema,
  listMutationSchema,
  renameListSchema,
  reorderTasksSchema,
  updateTaskSchema,
} from "@wuff/contracts";
import * as domain from "@wuff/domain";

export function createMcpServer(actor: Actor) {
  const server = new McpServer({ name: "Wuff Todo", version: "0.1.0" });
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
      const data = await action();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data) }],
        structuredContent: data,
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text:
              error instanceof AppError || error instanceof z.ZodError
                ? error.message
                : "Wuff couldn’t complete the request. Try again.",
          },
        ],
      };
    }
  }
  registerAppTool(
    server,
    "show_lists",
    {
      title: "Show your Wuff lists",
      description: "Open an interactive view of accessible lists.",
      inputSchema: {},
      annotations: read,
      _meta: { ui: { resourceUri: uri } },
    },
    async () => result(async () => ({ lists: await domain.listLists(actor) })),
  );
  registerAppTool(
    server,
    "show_list",
    {
      title: "Show a Wuff list",
      description:
        "Open a list with interactive task controls. Returns its current version for writes.",
      inputSchema: { listId: idSchema },
      annotations: read,
      _meta: { ui: { resourceUri: uri } },
    },
    async ({ listId }) =>
      result(async () => ({ list: await domain.getList(actor, listId) })),
  );
  server.registerTool(
    "list_lists",
    {
      description: "Find lists you own or can edit.",
      inputSchema: {},
      annotations: read,
    },
    async () => result(async () => ({ lists: await domain.listLists(actor) })),
  );
  server.registerTool(
    "get_list",
    {
      description:
        "Read a list and its tasks. Use the returned version for mutations.",
      inputSchema: { listId: idSchema },
      annotations: read,
    },
    async ({ listId }) =>
      result(async () => ({ list: await domain.getList(actor, listId) })),
  );
  const operations = [
    [
      "create_list",
      "Create a private list. Supply a fresh operationId UUID; reuse it only for an identical retry.",
      createListSchema,
      domain.createList,
      write,
    ],
    [
      "rename_list",
      "Rename a list you own. Read its current version first.",
      renameListSchema,
      domain.renameList,
      write,
    ],
    [
      "delete_list",
      "Permanently delete an owned list and all its tasks. Ask the user before setting confirmed=true.",
      listMutationSchema.extend({ confirmed: z.literal(true) }),
      domain.deleteList,
      { ...write, destructiveHint: true },
    ],
    [
      "create_task",
      "Add a task. Read the list version first. Supply an operationId UUID for safe retries.",
      createTaskSchema,
      domain.createTask,
      write,
    ],
    [
      "update_task",
      "Rename or set completion state explicitly. Read the list version first.",
      updateTaskSchema,
      domain.updateTask,
      write,
    ],
    [
      "delete_task",
      "Delete a task from an accessible list. Read the list version first.",
      deleteTaskSchema,
      domain.deleteTask,
      { ...write, destructiveHint: true },
    ],
    [
      "reorder_tasks",
      "Set the shared active-task order. Include every active task once and the current list version.",
      reorderTasksSchema,
      domain.reorderTasks,
      write,
    ],
  ] as const;
  for (const [name, description, schema, action, annotations] of operations)
    registerAppTool(
      server,
      name,
      {
        description,
        inputSchema: schema,
        annotations,
        _meta: { ui: { resourceUri: uri } },
      },
      async (data: unknown) =>
        result(async () => {
          const value = await action(actor, data);
          return name === "delete_list" ? { deleted: value } : { list: value };
        }),
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
  return server;
}
