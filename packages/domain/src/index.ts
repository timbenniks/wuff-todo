import { createHash } from "node:crypto";
import { and, asc, eq, exists, or, sql } from "drizzle-orm";
import { database, lists, members, receipts, tasks, users } from "@wuff/db";
import {
  Actor,
  AppError,
  createListSchema,
  createTaskSchema,
  deleteTaskSchema,
  listMutationSchema,
  renameListSchema,
  reorderTasksSchema,
  updateTaskSchema,
} from "@wuff/contracts";

type Db = ReturnType<typeof database>["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
const fail = (code: string, message: string, status: number): never => {
  throw new AppError(code, message, status);
};
export function requireScope(actor: Actor, scope: string) {
  if (!actor.scopes.includes(scope))
    fail(
      "forbidden",
      "This connection does not have permission for that action.",
      403,
    );
}
async function admission(tx: Tx | Db, actor: Actor) {
  const [user] = await tx
    .select()
    .from(users)
    .where(and(eq(users.id, actor.id), eq(users.enabled, true)));
  if (!user)
    fail("invite_required", "An invitation is required to use Wuff Todo.", 403);
  return user;
}
async function accessible(tx: Tx | Db, actor: Actor, id: string, lock = false) {
  await admission(tx, actor);
  const query = tx.select().from(lists).where(eq(lists.id, id));
  const [list] = await (lock ? query.for("update") : query);
  if (!list) return fail("not_found", "List not found.", 404);
  const [member] =
    list.ownerId === actor.id
      ? [true]
      : await tx
          .select()
          .from(members)
          .where(and(eq(members.listId, id), eq(members.userId, actor.id)));
  if (!member) return fail("not_found", "List not found.", 404);
  return list;
}
async function snapshot(tx: Tx | Db, actor: Actor, listId: string) {
  const list = await accessible(tx, actor, listId);
  return {
    ...list,
    tasks: await tx
      .select({
        id: tasks.id,
        title: tasks.title,
        completed: tasks.completed,
        position: tasks.position,
      })
      .from(tasks)
      .where(eq(tasks.listId, listId))
      .orderBy(asc(tasks.position), asc(tasks.id)),
  };
}
async function mutate(
  actor: Actor,
  input: { operationId: string },
  fn: (tx: Tx) => Promise<unknown>,
) {
  return database().db.transaction(async (tx) => {
    await admission(tx, actor);
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${actor.id + ":" + input.operationId}, 0))`,
    );
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const [receipt] = await tx
      .select()
      .from(receipts)
      .where(
        and(
          eq(receipts.actorId, actor.id),
          eq(receipts.operationId, input.operationId),
        ),
      );
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        fail(
          "idempotency_conflict",
          "This operation ID was already used for a different request.",
          409,
        );
      // Receipts contain identifiers only; callers must reread through current authorization.
      return receipt.result as { id: string };
    }
    const result = (await fn(tx)) as { id: string };
    await tx.insert(receipts).values({
      actorId: actor.id,
      operationId: input.operationId,
      fingerprint,
      result,
    });
    return result;
  });
}
async function locked(
  tx: Tx,
  actor: Actor,
  input: { listId: string; version: number },
  owner = false,
) {
  const list = await accessible(tx, actor, input.listId, true);
  if (owner && list.ownerId !== actor.id)
    fail("owner_required", "Only the owner can manage this list.", 403);
  if (list.version !== input.version)
    fail("conflict", "This list changed. Refresh it and try again.", 409);
  await tx
    .update(lists)
    .set({ version: list.version + 1 })
    .where(eq(lists.id, list.id));
  return list;
}

export async function listLists(actor: Actor) {
  requireScope(actor, "lists:read");
  const db = database().db;
  await admission(db, actor);
  return db
    .select({
      id: lists.id,
      title: lists.title,
      ownerId: lists.ownerId,
      version: lists.version,
    })
    .from(lists)
    .where(
      or(
        eq(lists.ownerId, actor.id),
        exists(
          db
            .select({ id: members.listId })
            .from(members)
            .where(
              and(eq(members.listId, lists.id), eq(members.userId, actor.id)),
            ),
        ),
      ),
    )
    .orderBy(asc(lists.createdAt), asc(lists.id));
}
export async function getList(actor: Actor, id: string) {
  requireScope(actor, "lists:read");
  return database().db.transaction((tx) => snapshot(tx, actor, id), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}
export async function createList(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = createListSchema.parse(data);
  const result = await mutate(
    actor,
    { ...input, kind: "create_list" } as typeof input,
    async (tx) => {
      const [list] = await tx
        .insert(lists)
        .values({ title: input.title, ownerId: actor.id })
        .returning({ id: lists.id });
      return list;
    },
  );
  return getList(actor, result.id);
}
export async function renameList(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = renameListSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "rename_list" } as typeof input,
    async (tx) => {
      await locked(tx, actor, input, true);
      await tx
        .update(lists)
        .set({ title: input.title })
        .where(eq(lists.id, input.listId));
      return { id: input.listId };
    },
  );
  return getList(actor, input.listId);
}
export async function deleteList(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = listMutationSchema.parse(data);
  // Recheck ownership on every retry, including after a receipt is found.
  const current = await accessible(database().db, actor, input.listId);
  if (current.ownerId !== actor.id)
    fail("owner_required", "Only the owner can delete this list.", 403);
  return mutate(
    actor,
    { ...input, kind: "delete_list" } as typeof input,
    async (tx) => {
      await locked(tx, actor, input, true);
      await tx.delete(lists).where(eq(lists.id, input.listId));
      return { id: input.listId };
    },
  );
}
export async function createTask(actor: Actor, data: unknown) {
  requireScope(actor, "tasks:write");
  const input = createTaskSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "create_task" } as typeof input,
    async (tx) => {
      await locked(tx, actor, input);
      const existing = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.listId, input.listId));
      if (existing.length >= 1000)
        fail("limit_reached", "A list can contain up to 1,000 tasks.", 400);
      await tx.insert(tasks).values({
        listId: input.listId,
        title: input.title,
        position: Math.max(-1, ...existing.map((t) => t.position)) + 1,
      });
      return { id: input.listId };
    },
  );
  return getList(actor, input.listId);
}
export async function updateTask(actor: Actor, data: unknown) {
  requireScope(actor, "tasks:write");
  const input = updateTaskSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "update_task" } as typeof input,
    async (tx) => {
      await locked(tx, actor, input);
      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, input.taskId), eq(tasks.listId, input.listId)));
      if (!task) fail("not_found", "Task not found.", 404);
      let position = task.position;
      if (input.completed === false && task.completed) {
        const rows = await tx
          .select()
          .from(tasks)
          .where(eq(tasks.listId, input.listId));
        position = Math.max(-1, ...rows.map((t) => t.position)) + 1;
      }
      await tx
        .update(tasks)
        .set({
          title: input.title ?? task.title,
          completed: input.completed ?? task.completed,
          position,
        })
        .where(eq(tasks.id, task.id));
      return { id: input.listId };
    },
  );
  return getList(actor, input.listId);
}
export async function deleteTask(actor: Actor, data: unknown) {
  requireScope(actor, "tasks:write");
  const input = deleteTaskSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "delete_task" } as typeof input,
    async (tx) => {
      await locked(tx, actor, input);
      await tx
        .delete(tasks)
        .where(and(eq(tasks.id, input.taskId), eq(tasks.listId, input.listId)));
      return { id: input.listId };
    },
  );
  return getList(actor, input.listId);
}
export async function reorderTasks(actor: Actor, data: unknown) {
  requireScope(actor, "tasks:write");
  const input = reorderTasksSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "reorder_tasks" } as typeof input,
    async (tx) => {
      await locked(tx, actor, input);
      const active = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.listId, input.listId), eq(tasks.completed, false)));
      if (
        active.length !== input.taskIds.length ||
        new Set(input.taskIds).size !== active.length ||
        active.some((t) => !input.taskIds.includes(t.id))
      )
        fail("invalid_order", "Provide each active task exactly once.", 400);
      for (const [position, id] of input.taskIds.entries())
        await tx.update(tasks).set({ position }).where(eq(tasks.id, id));
      return { id: input.listId };
    },
  );
  return getList(actor, input.listId);
}
