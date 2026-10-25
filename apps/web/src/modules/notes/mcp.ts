import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import {
  idSchema,
  noteQuerySchema,
  createNoteSchema,
  noteEditSchema,
  noteManageSchema,
  noteImageSchema,
  noteTaskSchema,
  updateNotesSettingsSchema,
} from "@wuff/contracts";
import { z } from "zod";
import * as notes from "@wuff/domain/modules/notes";
import type { ModuleMcpContext } from "@/lib/mcp-context";
import { appOrigin } from "@/lib/config";
export function registerNotesMcp({
  actor,
  registerTool,
  read,
  write,
  result,
  uri,
}: ModuleMcpContext) {
  registerAppTool(
    { registerTool },
    "show_notes",
    {
      title: "Wuff Notes",
      description:
        "Open your private/shared Notes workspace. Includes notes, moodboards, search, links, sharing and personal choices. Requires notes:read. No linked note or Todo access is granted by sharing a note.",
      inputSchema: noteQuerySchema.shape,
      annotations: read,
      _meta: { ui: { resourceUri: uri } },
    },
    async (input) =>
      result(async () => ({ notes: await notes.searchNotes(actor, input) })),
  );
  registerTool(
    "search_notes",
    {
      description:
        "Search accessible notes by text, tag and all/pinned/archived/shared/trash filter. Bounded pagination; titles, previews and tags are permission-filtered. Requires notes:read.",
      inputSchema: noteQuerySchema.shape,
      annotations: read,
    },
    async (input) =>
      result(async () => ({ notes: await notes.searchNotes(actor, input) })),
  );
  registerTool(
    "get_note",
    {
      description:
        "Read an accessible note, board, current version and personal preferenceVersion. Links/backlinks/cards/tasks reveal only targets you can access. Owner sees sharing; viewers cannot edit. Requires notes:read.",
      inputSchema: { noteId: idSchema },
      annotations: read,
    },
    async ({ noteId }) =>
      result(async () => ({ note: await notes.getNote(actor, noteId) })),
  );
  registerTool(
    "create_note",
    {
      description:
        "Create a PRIVATE note or moodboard. Title and Markdown content, normalized tags and one approved theme. Requires notes:read/write; fresh operationId, retry uncertain outcomes with IDENTICAL arguments. Never infer sharing intent.",
      inputSchema: createNoteSchema.shape,
      annotations: write,
    },
    async (input) =>
      result(async () => ({ note: await notes.createNote(actor, input) })),
  );
  for (const name of ["update_note", "manage_note"] as const)
    registerTool(
      name,
      {
        description:
          name === "manage_note"
            ? "Owner only: explicitly share/unshare an existing active Empire account as viewer/editor, or move to trash/restore. Requires notes:manage and notes:read. Read get_note first; current version and operationId. Sharing does NOT share linked notes, tasks, images in other modules or provider credentials. Changes must follow explicit user intent."
            : "Edit an accessible note/board as owner/editor, link/unlink another accessible note, add/update/remove/reorder cards, or change your own pin/archive choices. Viewers may change only their personal choices or leave. Requires notes:read/write. Read get_note first; current version (and preferenceVersion for personal choices), fresh operationId. Retry uncertain outcomes IDENTICALLY. Mode changes retain both content and cards. Never replace an unavailable linked-note card with inferred content.",
        inputSchema:
          name === "manage_note"
            ? noteManageSchema.shape
            : noteEditSchema.shape,
        annotations: write,
      },
      async (input) =>
        result(async () => {
          const value = await notes.updateNote(actor, input);
          return "left" in value
            ? { notes: await notes.searchNotes(actor) }
            : { note: value };
        }),
    );
  registerTool(
    "upload_note_image",
    {
      description:
        "Upload a still PNG/JPEG/WebP up to 3 MiB as standard base64 to a note you may edit. Private storage strips metadata. Requires notes:read/write, current note version, operationId and identical retries. Returns asset ID; then add_card with kind=image. Max 24 reusable images per note. No external images are fetched.",
      inputSchema: noteImageSchema.shape,
      annotations: write,
    },
    async (input) =>
      result(async () => await notes.uploadNoteImage(actor, input)),
  );
  registerTool(
    "get_note_image",
    {
      description:
        "Read a private board image only while you can access its active note. Requires notes:read. Sharing another note never grants this image.",
      inputSchema: { assetId: idSchema },
      annotations: read,
    },
    async ({ assetId }) => {
      const response = await result(async () => {
        const { stream, image } = await notes.readNoteImage(actor, assetId);
        const bytes = await new Response(stream).arrayBuffer();
        return { image, data: Buffer.from(bytes).toString("base64") };
      });
      if (response.isError) return response;
      const data = response.structuredContent as unknown as {
        image: unknown;
        data: string;
      };
      return {
        content: [
          { type: "image" as const, data: data.data, mimeType: "image/webp" },
        ],
        structuredContent: { image: data.image },
      };
    },
  );
  registerTool(
    "get_notes_settings",
    {
      description:
        "Read your default note mode/theme and pinned/recent dashboard preferences. These are personal and never change another user's notes.",
      inputSchema: {},
      annotations: read,
    },
    async () =>
      result(async () => ({
        notesSettings: await notes.getNotesSettings(actor),
      })),
  );
  registerTool(
    "update_notes_settings",
    {
      description:
        "Save personal Notes defaults and dashboard preferences. Requires notes:read/write; current settings version and operationId; identical retries.",
      inputSchema: updateNotesSettingsSchema.shape,
      annotations: write,
    },
    async (input) =>
      result(async () => ({
        notesSettings: await notes.updateNotesSettings(actor, input),
      })),
  );
  registerTool(
    "get_notes_dashboard",
    {
      description:
        "Read a bounded personal pinned/recent Notes dashboard, excluding archived, trashed and inaccessible notes. Requires notes:read.",
      inputSchema: {},
      annotations: read,
    },
    async () =>
      result(async () => ({
        notesDashboard: await notes.getNotesDashboard(actor),
      })),
  );
  registerTool(
    "create_note_task",
    {
      description:
        "ONLY on explicit user intent: atomically create one Todo task in a chosen accessible list from an accessible note. Requires notes:read, lists:read and tasks:write. Read note and destination list versions. confirmed=true acknowledges destination members/integrations may see copied text. includeContent defaults false; private images/linked-note content are never copied. Always retain Source note backlink; it grants no access. Fresh operationId; retry uncertain delivery IDENTICALLY.",
      inputSchema: noteTaskSchema.shape,
      annotations: write,
    },
    async (input) =>
      result(async () => await notes.createNoteTask(actor, input, appOrigin())),
  );
}
