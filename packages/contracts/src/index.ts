import { z } from "zod";

export const titleSchema = z.string().trim().min(1).max(300);
// Canonical task notes are Markdown, shared by web and MCP. No HTML is executed.
export const taskContentLimit = 16_000;
export const taskContentSchema = z.string().max(taskContentLimit);
export const idSchema = z.uuid();
export const operationSchema = z.object({ operationId: z.uuid() });
export const versionSchema = z.number().int().nonnegative();
export const listColors = [
  "blue",
  "lavender",
  "sage",
  "rose",
  "peach",
  "sand",
  "slate",
] as const;
export type ListColor = (typeof listColors)[number];
export const listColorSchema = z.enum(listColors);
export const createListSchema = operationSchema.extend({ title: titleSchema });
export const listMutationSchema = operationSchema.extend({
  listId: idSchema,
  version: versionSchema,
});
export const renameListSchema = listMutationSchema.extend({
  title: titleSchema,
});
export const updateListSchema = listMutationSchema
  .extend({
    title: titleSchema.optional(),
    description: z.string().trim().max(4000).optional(),
    color: listColorSchema.optional(),
    archived: z.boolean().optional(),
  })
  .refine(
    (v) =>
      [v.title, v.description, v.color, v.archived].some(
        (x) => x !== undefined,
      ),
    "Provide a list change",
  );
export const reorderListsSchema = operationSchema.extend({
  version: versionSchema,
  listIds: z.array(idSchema).max(10000),
});
export const createSectionSchema = listMutationSchema.extend({
  title: titleSchema,
});
export const sectionMutationSchema = listMutationSchema.extend({
  sectionId: idSchema,
});
export const renameSectionSchema = sectionMutationSchema.extend({
  title: titleSchema,
});
export const reorderSectionsSchema = listMutationSchema.extend({
  sectionIds: z.array(idSchema).max(50),
});
export const createTaskSchema = listMutationSchema.extend({
  title: titleSchema,
  sectionId: idSchema.nullable().optional(),
  content: taskContentSchema.optional(),
});
export const updateTaskSchema = listMutationSchema
  .extend({
    taskId: idSchema,
    title: titleSchema.optional(),
    completed: z.boolean().optional(),
    sectionId: idSchema.nullable().optional(),
    content: taskContentSchema.optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.completed !== undefined ||
      v.sectionId !== undefined ||
      v.content !== undefined,
    "Provide a task change",
  );
export const deleteTaskSchema = listMutationSchema.extend({ taskId: idSchema });
// Keep uploads below Vercel's function request limit, including MCP base64.
export const taskImageLimit = 3 * 1024 * 1024;
export const taskImageCountLimit = 20;
export const taskImageUploadSchema = listMutationSchema.extend({
  taskId: idSchema,
});
export const taskImageBase64Schema = taskImageUploadSchema.extend({
  imageBase64: z
    .string()
    .min(4)
    .max(4 * Math.ceil(taskImageLimit / 3)),
});
export type TaskImage = {
  id: string;
  width: number;
  height: number;
  bytes: number;
};
export function taskImagePath(id: string) {
  return `/api/v1/attachments/${id}`;
}
export function taskImageId(value: string): string | null {
  return (
    /^\/api\/v1\/attachments\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.exec(
      value,
    )?.[1] ?? null
  );
}
export const reorderTasksSchema = listMutationSchema.extend({
  taskIds: z.array(idSchema).max(1000),
});
export const inviteSchema = listMutationSchema.extend({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});
export const invitationResponseSchema = operationSchema.extend({
  invitationId: idSchema,
  accept: z.boolean(),
});
export const cancelInvitationSchema = listMutationSchema.extend({
  invitationId: idSchema,
});
export const removeMemberSchema = listMutationSchema.extend({
  userId: z.string().min(1).max(200),
});
export type SharedPerson = { id: string; name: string; email: string };
export type PendingInvitation = {
  id: string;
  email: string;
  expiresAt: string;
};
export type ListSharing = {
  listId: string;
  version: number;
  owner: SharedPerson;
  members: SharedPerson[];
  invitations: PendingInvitation[];
};
export type IncomingInvitation = {
  id: string;
  listId: string;
  listTitle: string;
  ownerName: string;
  ownerEmail: string;
  expiresAt: string;
};

export type Task = {
  id: string;
  content: string;
  title: string;
  completed: boolean;
  position: number;
  sectionId: string | null;
  images?: TaskImage[];
};
export type ListSection = { id: string; title: string; position: number };
export type ListOrder = { version: number; listIds: string[] };
export type TodoList = {
  id: string;
  title: string;
  ownerId: string;
  version: number;
  color: ListColor;
  description: string;
  archived: boolean;
  sections: ListSection[];
  tasks: Task[];
};
export type ListSummary = Pick<
  TodoList,
  "id" | "title" | "ownerId" | "version" | "color" | "archived"
>;
export const scopes = ["lists:read", "tasks:write", "lists:manage"] as const;
export type Scope = (typeof scopes)[number];
export type Actor = { id: string; scopes: readonly string[] };

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}
