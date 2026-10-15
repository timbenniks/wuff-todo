import { z } from "zod";

export const titleSchema = z.string().trim().min(1).max(300);
export const idSchema = z.uuid();
export const operationSchema = z.object({ operationId: z.uuid() });
export const versionSchema = z.number().int().nonnegative();
export const createListSchema = operationSchema.extend({ title: titleSchema });
export const listMutationSchema = operationSchema.extend({
  listId: idSchema,
  version: versionSchema,
});
export const renameListSchema = listMutationSchema.extend({
  title: titleSchema,
});
export const createTaskSchema = listMutationSchema.extend({
  title: titleSchema,
});
export const updateTaskSchema = listMutationSchema
  .extend({
    taskId: idSchema,
    title: titleSchema.optional(),
    completed: z.boolean().optional(),
  })
  .refine(
    (v) => v.title !== undefined || v.completed !== undefined,
    "Provide a task change",
  );
export const deleteTaskSchema = listMutationSchema.extend({ taskId: idSchema });
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
  title: string;
  completed: boolean;
  position: number;
};
export type TodoList = {
  id: string;
  title: string;
  ownerId: string;
  version: number;
  tasks: Task[];
};
export type ListSummary = Omit<TodoList, "tasks">;
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
