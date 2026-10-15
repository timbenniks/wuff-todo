import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, exists, gt, isNull, or, sql } from "drizzle-orm";
import {
  database,
  invitations,
  lists,
  members,
  receipts,
  tasks,
  users,
} from "@wuff/db";
import {
  Actor,
  inviteSchema,
  invitationResponseSchema,
  cancelInvitationSchema,
  removeMemberSchema,
  type ListSharing,
  type IncomingInvitation,
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

// Sharing and task writes lock the same list row. Revocation cannot race a
// permission check and allow a later task commit under the old membership.
async function ownerList(tx: Tx | Db, actor: Actor, listId: string) {
  const list = await accessible(tx, actor, listId);
  if (list.ownerId !== actor.id)
    fail("owner_required", "Only the owner can manage sharing.", 403);
  return list;
}
async function sharingSnapshot(
  tx: Tx,
  actor: Actor,
  listId: string,
): Promise<ListSharing> {
  const list = await accessible(tx, actor, listId);
  const [owner] = await tx
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, list.ownerId));
  const editors = await tx
    .select({ id: users.id, name: users.name, email: users.email })
    .from(members)
    .innerJoin(users, eq(members.userId, users.id))
    .where(eq(members.listId, listId))
    .orderBy(asc(members.createdAt));
  const pending =
    list.ownerId === actor.id
      ? await tx
          .select({
            id: invitations.id,
            email: invitations.email,
            expiresAt: invitations.expiresAt,
          })
          .from(invitations)
          .where(
            and(
              eq(invitations.listId, listId),
              isNull(invitations.closedAt),
              isNull(invitations.acceptedBy),
              gt(invitations.expiresAt, new Date()),
            ),
          )
          .orderBy(asc(invitations.createdAt))
      : [];
  return {
    listId,
    version: list.version,
    owner,
    members: editors,
    invitations: pending.map((i) => ({
      ...i,
      expiresAt: i.expiresAt.toISOString(),
    })),
  };
}
export async function getListSharing(actor: Actor, listId: string) {
  requireScope(actor, "lists:read");
  return database().db.transaction((tx) => sharingSnapshot(tx, actor, listId), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}
export async function listInvitations(
  actor: Actor,
): Promise<IncomingInvitation[]> {
  requireScope(actor, "lists:read");
  const db = database().db;
  await admission(db, actor);
  const rows = await db
    .select({
      id: invitations.id,
      listId: lists.id,
      listTitle: lists.title,
      ownerName: users.name,
      ownerEmail: users.email,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .innerJoin(lists, eq(invitations.listId, lists.id))
    .innerJoin(users, eq(lists.ownerId, users.id))
    .where(
      and(
        eq(invitations.recipientId, actor.id),
        isNull(invitations.closedAt),
        isNull(invitations.acceptedBy),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(invitations.createdAt));
  return rows.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() }));
}
export async function inviteToList(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = inviteSchema.parse(data);
  await ownerList(database().db, actor, input.listId);
  await mutate(
    actor,
    { ...input, kind: "invite_to_list" } as typeof input,
    async (tx) => {
      const list = await locked(tx, actor, input, true);
      const [recipient] = await tx
        .select()
        .from(users)
        .where(and(eq(users.email, input.email), eq(users.enabled, true)));
      if (!recipient)
        fail(
          "unavailable_recipient",
          "This person needs an existing Wuff account before you can invite them.",
          400,
        );
      if (recipient.id === list.ownerId)
        fail("already_member", "You already own this list.", 400);
      const [member] = await tx
        .select()
        .from(members)
        .where(
          and(eq(members.listId, list.id), eq(members.userId, recipient.id)),
        );
      if (member)
        fail("already_member", "This person already has access.", 409);
      const pending = await tx
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.listId, list.id),
            isNull(invitations.closedAt),
            isNull(invitations.acceptedBy),
          ),
        );
      const now = new Date();
      for (const invite of pending)
        if (invite.expiresAt <= now)
          await tx
            .update(invitations)
            .set({ closedAt: now })
            .where(eq(invitations.id, invite.id));
      if (
        pending.some((i) => i.recipientId === recipient.id && i.expiresAt > now)
      )
        return { id: list.id };
      if (pending.filter((i) => i.expiresAt > now).length >= 100)
        fail(
          "limit_reached",
          "A list can have up to 100 pending invitations.",
          400,
        );
      await tx
        .insert(invitations)
        .values({
          listId: list.id,
          email: recipient.email,
          recipientId: recipient.id,
          tokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
          expiresAt: new Date(now.getTime() + 7 * 86400000),
        });
      return { id: list.id };
    },
  );
  await ownerList(database().db, actor, input.listId);
  return getListSharing(actor, input.listId);
}
export async function respondToInvitation(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = invitationResponseSchema.parse(data);
  const result = await mutate(
    actor,
    { ...input, kind: "respond_to_invitation" } as typeof input,
    async (tx) => {
      // Read the target, then lock the list before re-reading the invitation.
      const [target] = await tx
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.id, input.invitationId),
            eq(invitations.recipientId, actor.id),
          ),
        );
      if (!target) return fail("not_found", "Invitation not found.", 404);
      const [list] = await tx
        .select()
        .from(lists)
        .where(eq(lists.id, target.listId))
        .for("update");
      if (!list) return fail("not_found", "Invitation not found.", 404);
      const [invite] = await tx
        .select()
        .from(invitations)
        .where(eq(invitations.id, target.id));
      if (
        !invite ||
        invite.closedAt ||
        invite.acceptedBy ||
        invite.expiresAt <= new Date()
      )
        fail(
          "invitation_closed",
          "This invitation has expired or is no longer available.",
          409,
        );
      if (input.accept)
        await tx
          .insert(members)
          .values({ listId: list.id, userId: actor.id })
          .onConflictDoNothing();
      await tx
        .update(invitations)
        .set({
          closedAt: new Date(),
          acceptedBy: input.accept ? actor.id : null,
        })
        .where(eq(invitations.id, invite.id));
      await tx
        .update(lists)
        .set({ version: list.version + 1 })
        .where(eq(lists.id, list.id));
      return { id: list.id };
    },
  );
  // A receipt is never authority to restore revoked access or disclose a snapshot.
  if (input.accept) await accessible(database().db, actor, result.id);
  return { listId: result.id, accepted: input.accept };
}
export async function cancelInvitation(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = cancelInvitationSchema.parse(data);
  await ownerList(database().db, actor, input.listId);
  await mutate(
    actor,
    { ...input, kind: "cancel_invitation" } as typeof input,
    async (tx) => {
      await locked(tx, actor, input, true);
      const [invite] = await tx
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.id, input.invitationId),
            eq(invitations.listId, input.listId),
          ),
        );
      if (!invite) fail("not_found", "Invitation not found.", 404);
      if (invite.closedAt || invite.acceptedBy)
        fail(
          "invitation_closed",
          "This invitation is no longer pending. Refresh sharing settings.",
          409,
        );
      await tx
        .update(invitations)
        .set({ closedAt: new Date() })
        .where(eq(invitations.id, invite.id));
      return { id: input.listId };
    },
  );
  await ownerList(database().db, actor, input.listId);
  return getListSharing(actor, input.listId);
}
export async function removeListMember(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = removeMemberSchema.parse(data);
  await ownerList(database().db, actor, input.listId);
  await mutate(
    actor,
    { ...input, kind: "remove_list_member" } as typeof input,
    async (tx) => {
      const list = await locked(tx, actor, input, true);
      if (input.userId === list.ownerId)
        fail("owner_required", "The owner cannot be removed.", 400);
      await tx
        .delete(members)
        .where(
          and(
            eq(members.listId, input.listId),
            eq(members.userId, input.userId),
          ),
        );
      return { id: input.listId };
    },
  );
  await ownerList(database().db, actor, input.listId);
  return getListSharing(actor, input.listId);
}
export async function leaveList(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = listMutationSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "leave_list" } as typeof input,
    async (tx) => {
      const list = await locked(tx, actor, input);
      if (list.ownerId === actor.id)
        fail("owner_required", "The owner cannot leave their own list.", 400);
      await tx
        .delete(members)
        .where(
          and(eq(members.listId, input.listId), eq(members.userId, actor.id)),
        );
      return { id: input.listId };
    },
  );
  return { listId: input.listId, left: true };
}
