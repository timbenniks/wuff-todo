import { wuffError } from "./copy";
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
  inviteSchema,
  invitationResponseSchema,
  cancelInvitationSchema,
  removeMemberSchema,
  AppError,
  createListSchema,
  createTaskSchema,
  deleteTaskSchema,
  idSchema,
  listMutationSchema,
  renameListSchema,
  reorderTasksSchema,
  updateTaskSchema,
  updateListSchema,
  reorderListsSchema,
  createSectionSchema,
  renameSectionSchema,
  sectionMutationSchema,
  reorderSectionsSchema,
  taskImageBase64Schema,
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
      const data = { ...(await action()), viewerId: actor.id };
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
  server.registerTool(
    "get_list_order",
    {
      description:
        "Read your personal sidebar ordering and its current revision, including archived lists. Does not change the shared task order.",
      inputSchema: {},
      annotations: read,
    },
    async () =>
      result(async () => ({ order: await domain.getListOrder(actor) })),
  );
  server.registerTool(
    "reorder_lists",
    {
      description:
        "Set only your personal sidebar order. Read get_list_order first; include each accessible list ID exactly once, including archived lists, with its order revision and a fresh operationId UUID.",
      inputSchema: reorderListsSchema,
      annotations: write,
    },
    async (data) =>
      result(async () => ({ order: await domain.reorderLists(actor, data) })),
  );
  const operations = [
    [
      "update_list",
      "Owner only: change list title, plain-text description, shared color, or archived state. archived=true archives for everyone; false restores. Archived tasks are read-only. Read current list version first; use an operationId UUID for safe retries.",
      updateListSchema,
      domain.updateList,
      write,
    ],
    [
      "create_section",
      "Owner only: add a named section to an active list. Sections share list permissions. Read the list version first.",
      createSectionSchema,
      domain.createSection,
      write,
    ],
    [
      "rename_section",
      "Owner only: rename a section in an active list. Read the list version first.",
      renameSectionSchema,
      domain.renameSection,
      write,
    ],
    [
      "delete_section",
      "Owner only: remove a section from an active list. All its tasks are kept in the unsectioned group. Read the list version first.",
      sectionMutationSchema,
      domain.deleteSection,
      { ...write, destructiveHint: true },
    ],
    [
      "reorder_sections",
      "Owner only: set section order in an active list, supplying every section ID once. Read the list version first.",
      reorderSectionsSchema,
      domain.reorderSections,
      write,
    ],
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
      "Add a task to an active list. Optional content is Markdown task notes (up to 16,000 characters); HTML is displayed as text; only Wuff-uploaded private images are displayed. Optional sectionId must belong to this list; omit or set null for unsectioned. Read the list version first. Supply an operationId UUID for safe retries.",
      createTaskSchema,
      domain.createTask,
      write,
    ],
    [
      "update_task",
      "Rename, set completion state, edit Markdown content (up to 16,000 characters; empty string clears notes), or move a task in an active list. Preserve existing content unless asked to change it. sectionId must belong to the same list; null moves to unsectioned. Read the list version first.",
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
  server.registerTool(
    "get_list_sharing",
    {
      description:
        "Read a list's owner and editors. Only the owner sees pending invitations. Returns the current version for sharing changes.",
      inputSchema: { listId: idSchema },
      annotations: read,
    },
    async ({ listId }) =>
      result(async () => ({
        sharing: await domain.getListSharing(actor, listId),
      })),
  );
  server.registerTool(
    "list_invitations",
    {
      description:
        "Read pending invitations addressed to your Wuff account. These do not grant access until accepted.",
      inputSchema: {},
      annotations: read,
    },
    async () =>
      result(async () => ({
        invitations: await domain.listInvitations(actor),
      })),
  );
  const sharingOperations = [
    [
      "invite_to_list",
      "Owner only: invite an existing Wuff account by email. Creates an in-app invitation that expires in seven days; sends no email. Read the current list version first. Use an operationId UUID for safe retries.",
      inviteSchema,
      domain.inviteToList,
      write,
    ],
    [
      "respond_to_invitation",
      "Accept (accept=true) or decline (accept=false) an invitation addressed to you. Use an operationId UUID for safe retries.",
      invitationResponseSchema,
      domain.respondToInvitation,
      write,
    ],
    [
      "cancel_invitation",
      "Owner only: cancel a pending invitation for a list. Read the current list version first. Use an operationId UUID for safe retries.",
      cancelInvitationSchema,
      domain.cancelInvitation,
      { ...write, destructiveHint: true },
    ],
    [
      "remove_list_member",
      "Owner only: revoke an editor's list access across web and MCP. Read the current list version first. Use an operationId UUID for safe retries.",
      removeMemberSchema,
      domain.removeListMember,
      { ...write, destructiveHint: true },
    ],
    [
      "leave_list",
      "Leave a shared list you do not own. Read the current list version first. Use an operationId UUID for safe retries.",
      listMutationSchema,
      domain.leaveList,
      { ...write, destructiveHint: true },
    ],
  ] as const;
  for (const [
    name,
    description,
    schema,
    action,
    annotations,
  ] of sharingOperations)
    server.registerTool(
      name,
      { description, inputSchema: schema, annotations },
      async (data: unknown) =>
        result(async () => ({ sharing: await action(actor, data) })),
    );
  server.registerTool(
    "upload_task_image",
    {
      description:
        "Upload a private task-note image (still PNG/JPEG/WebP, at most 3 MiB, standard base64 without a data URL prefix). Read the list version first and use a fresh operationId for safe retries. Returns a Markdown image reference: insert it into this task's content with update_task to save it. Draft uploads expire after 24 hours. Never change existing notes unless asked.",
      inputSchema: taskImageBase64Schema,
      annotations: write,
    },
    async ({ imageBase64, ...input }) =>
      result(async () => ({
        image: await domain.uploadTaskImage(
          actor,
          input,
          domain.decodeTaskImage(imageBase64),
        ),
      })),
  );
  server.registerTool(
    "get_task_image",
    {
      description:
        "Read a private task-note image by attachmentId from a task's images or Markdown. Returns image content for clients to display/inspect. Current account and list access are required; draft images are visible only to their uploader.",
      inputSchema: { attachmentId: idSchema },
      annotations: read,
    },
    async ({ attachmentId }) => {
      let imageContent:
        { type: "image"; data: string; mimeType: string } | undefined;
      const response = await result(async () => {
        const { stream, image } = await domain.readTaskImage(
          actor,
          attachmentId,
        );
        const bytes = await new Response(stream).arrayBuffer();
        imageContent = {
          type: "image",
          data: Buffer.from(bytes).toString("base64"),
          mimeType: "image/webp",
        };
        return { image };
      });
      return {
        ...response,
        content: imageContent
          ? [...response.content, imageContent]
          : response.content,
      };
    },
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
