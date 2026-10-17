import { liveQueryDefinition } from "./live-query";
import { createHash, randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  exists,
  gt,
  isNull,
  isNotNull,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import {
  database,
  invitations,
  lists,
  members,
  receipts,
  tasks,
  users,
  sections,
  listPreferences,
  listViews,
  attachments,
} from "@wuff/db";
import {
  defaultListView,
  listViewSchema,
  updateListViewSchema,
  queryListViewSchema,
  projectListView,
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
  updateListSchema,
  reorderListsSchema,
  createSectionSchema,
  renameSectionSchema,
  sectionMutationSchema,
  reorderSectionsSchema,
  taskImageUploadSchema,
  taskImageCountLimit,
  taskImagePath,
  idSchema,
  taskLookupSchema,
  taskPath,
  type TodoList,
  type Task,
} from "@wuff/contracts";

import { taskImageReferences } from "./task-images";
import {
  normalizeTaskImage,
  storeTaskImage,
  loadTaskImage,
  eraseTaskImage,
  imageStorageConfigured,
} from "./image-storage";
export { decodeTaskImage } from "./image-storage";

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
  const participantIds =
    list.mode === "work"
      ? await tx
          .select({ id: members.userId })
          .from(members)
          .where(eq(members.listId, listId))
      : [];
  const assignees = participantIds.length
    ? await tx
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(
          and(
            inArray(users.id, [
              list.ownerId,
              ...participantIds.map((p) => p.id),
            ]),
            eq(users.enabled, true),
          ),
        )
        .orderBy(asc(users.name), asc(users.id))
    : [];
  const images = await tx
    .select({
      id: attachments.id,
      taskId: attachments.taskId,
      width: attachments.width,
      height: attachments.height,
      bytes: attachments.bytes,
    })
    .from(attachments)
    .where(
      and(
        eq(attachments.listId, listId),
        eq(attachments.attached, true),
        eq(attachments.ready, true),
        isNull(attachments.retiredAt),
      ),
    );
  const [personalView] = await tx
    .select()
    .from(listViews)
    .where(and(eq(listViews.userId, actor.id), eq(listViews.listId, listId)));
  const snapshot = {
    personalView: {
      version: personalView?.version ?? 0,
      view: personalView
        ? listViewSchema.parse(personalView.view)
        : defaultListView(),
    },
    ...list,
    assignees,
    sections: await tx
      .select({
        id: sections.id,
        title: sections.title,
        position: sections.position,
      })
      .from(sections)
      .where(eq(sections.listId, listId))
      .orderBy(asc(sections.position), asc(sections.id)),
    tasks: await tx
      .select({
        id: tasks.id,
        number: tasks.number,
        status: tasks.status,
        priority: tasks.priority,
        assigneeId: tasks.assigneeId,
        references: tasks.references,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        completedAt: tasks.completedAt,
        parentTaskId: tasks.parentTaskId,
        dueDate: tasks.dueDate,
        title: tasks.title,
        content: tasks.content,
        completed: tasks.completed,
        position: tasks.position,
        sectionId: tasks.sectionId,
      })
      .from(tasks)
      .where(eq(tasks.listId, listId))
      .orderBy(asc(tasks.position), asc(tasks.id)),
  };
  return {
    ...snapshot,
    tasks: snapshot.tasks.map(
      ({ number, createdAt, updatedAt, completedAt, ...task }) => ({
        ...task,
        key: `WUFF-${number}`,
        path: taskPath(task.id),
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        completedAt: completedAt?.toISOString() ?? null,
        assigneeId: assignees.some((p) => p.id === task.assigneeId)
          ? task.assigneeId
          : null,
        images: images
          .filter((image) => image.taskId === task.id)
          .map(({ taskId, ...image }) => image),
      }),
    ),
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
  activeOnly = false,
) {
  const list = await accessible(tx, actor, input.listId, true);
  if (owner && list.ownerId !== actor.id)
    fail("owner_required", "Only the owner can manage this list.", 403);
  if (activeOnly && list.archived)
    fail(
      "list_archived",
      "Restore this list before changing its tasks or sections.",
      409,
    );
  if (list.version !== input.version)
    fail("conflict", "This list changed. Refresh it and try again.", 409);
  await tx
    .update(lists)
    .set({ version: list.version + 1 })
    .where(eq(lists.id, list.id));
  return list;
}

async function catalog(tx: Tx | Db, actor: Actor) {
  return tx
    .select({
      id: lists.id,
      title: lists.title,
      ownerId: lists.ownerId,
      version: lists.version,
      color: lists.color,
      archived: lists.archived,
    })
    .from(lists)
    .where(
      or(
        eq(lists.ownerId, actor.id),
        exists(
          tx
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
async function orderedCatalog(tx: Tx | Db, actor: Actor) {
  const rows = await catalog(tx, actor);
  const [preference] = await tx
    .select()
    .from(listPreferences)
    .where(eq(listPreferences.userId, actor.id));
  const rank = new Map((preference?.listIds ?? []).map((id, i) => [id, i]));
  return {
    lists: rows.sort(
      (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
    ),
    version: preference?.version ?? 0,
  };
}
export async function listLists(actor: Actor) {
  requireScope(actor, "lists:read");
  const db = database().db;
  await admission(db, actor);
  return (await orderedCatalog(db, actor)).lists;
}
export async function getListOrder(actor: Actor) {
  requireScope(actor, "lists:read");
  return database().db.transaction(
    async (tx) => {
      await admission(tx, actor);
      const value = await orderedCatalog(tx, actor);
      return { version: value.version, listIds: value.lists.map((l) => l.id) };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function reorderLists(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = reorderListsSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "reorder_lists" } as typeof input,
    async (tx) => {
      // Account row serializes first writes even before a preference row exists.
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, actor.id))
        .for("update");
      const current = await orderedCatalog(tx, actor);
      if (current.version !== input.version)
        fail(
          "conflict",
          "Your list order changed. Refresh it and try again.",
          409,
        );
      if (
        current.lists.length !== input.listIds.length ||
        new Set(input.listIds).size !== input.listIds.length ||
        current.lists.some((l) => !input.listIds.includes(l.id))
      )
        fail(
          "invalid_order",
          "Provide each accessible list exactly once, including archived lists.",
          400,
        );
      await tx
        .insert(listPreferences)
        .values({
          userId: actor.id,
          listIds: input.listIds,
          version: current.version + 1,
        })
        .onConflictDoUpdate({
          target: listPreferences.userId,
          set: { listIds: input.listIds, version: current.version + 1 },
        });
      return { id: actor.id };
    },
  );
  return getListOrder(actor);
}
export async function getList(actor: Actor, id: string) {
  requireScope(actor, "lists:read");
  return database().db.transaction((tx) => snapshot(tx, actor, id), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}
export async function queryListView(actor: Actor, data: unknown) {
  const input = queryListViewSchema.parse(data);
  const list = await getList(actor, input.listId);
  return {
    list,
    groups: projectListView(list, list.personalView.view, input.today),
  };
}
export async function updateListView(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = updateListViewSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "update_list_view" } as typeof input,
    async (tx) => {
      // Lock the list to serialize access revocation and first preference writes.
      // This never increments the shared task revision or rewrites task positions.
      await accessible(tx, actor, input.listId, true);
      const [current] = await tx
        .select()
        .from(listViews)
        .where(
          and(
            eq(listViews.userId, actor.id),
            eq(listViews.listId, input.listId),
          ),
        );
      if ((current?.version ?? 0) !== input.viewVersion)
        fail("conflict", "Your view changed. Refresh it and try again.", 409);
      await tx
        .insert(listViews)
        .values({
          userId: actor.id,
          listId: input.listId,
          version: input.viewVersion + 1,
          view: input.view,
        })
        .onConflictDoUpdate({
          target: [listViews.userId, listViews.listId],
          set: { version: input.viewVersion + 1, view: input.view },
        });
      return { id: input.listId };
    },
  );
  return getList(actor, input.listId);
}
export async function getTask(actor: Actor, lookup: string) {
  requireScope(actor, "lists:read");
  const identifier = taskLookupSchema.parse(lookup);
  return database().db.transaction(
    async (tx) => {
      await admission(tx, actor);
      const [row] = await tx
        .select({ id: tasks.id, listId: tasks.listId })
        .from(tasks)
        .where(
          /^WUFF-/i.test(identifier)
            ? eq(tasks.number, Number(identifier.slice(5)))
            : eq(tasks.id, identifier),
        );
      if (!row) return fail("not_found", "Task not found.", 404);
      const list = await snapshot(tx, actor, row.listId).catch(
        (error: unknown) => {
          // Keys are discoverable numbers; do not reveal existence through errors.
          if (error instanceof AppError && error.status === 404)
            return fail("not_found", "Task not found.", 404);
          throw error;
        },
      );
      return { list, task: list.tasks.find((t) => t.id === row.id)! };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
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
        .values({
          title: input.title,
          ownerId: actor.id,
          mode: input.mode ?? "simple",
        })
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
export async function updateList(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = updateListSchema.parse(data);
  // Receipts do not retain an owner's former authority.
  const current = await accessible(database().db, actor, input.listId);
  if (current.ownerId !== actor.id)
    fail("owner_required", "Only the owner can manage this list.", 403);
  await mutate(
    actor,
    { ...input, kind: "update_list" } as typeof input,
    async (tx) => {
      await locked(tx, actor, input, true);
      const { title, description, color, archived, mode } = input;
      if (mode === "simple") {
        const rows = await tx
          .select()
          .from(tasks)
          .where(eq(tasks.listId, input.listId));
        if (
          rows.some(
            (t) =>
              !["todo", "done"].includes(t.status) ||
              t.priority !== "none" ||
              t.assigneeId ||
              t.references.length,
          )
        )
          fail(
            "work_metadata_present",
            "Clear work metadata before switching to Simple. Your task data has been kept.",
            409,
          );
      }
      await tx
        .update(lists)
        .set({ title, description, color, archived, mode })
        .where(eq(lists.id, input.listId));
      return { id: input.listId };
    },
  );
  return getList(actor, input.listId);
}
async function validSection(tx: Tx, listId: string, sectionId?: string | null) {
  if (!sectionId) return;
  const [section] = await tx
    .select({ id: sections.id })
    .from(sections)
    .where(and(eq(sections.id, sectionId), eq(sections.listId, listId)));
  if (!section) fail("not_found", "Section not found in this list.", 404);
}
export async function createSection(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = createSectionSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "create_section" } as typeof input,
    async (tx) => {
      await locked(tx, actor, input, true, true);
      const existing = await tx
        .select()
        .from(sections)
        .where(eq(sections.listId, input.listId));
      if (existing.length >= 50)
        fail("limit_reached", "A list can contain up to 50 sections.", 400);
      await tx.insert(sections).values({
        listId: input.listId,
        title: input.title,
        position: Math.max(-1, ...existing.map((s) => s.position)) + 1,
      });
      return { id: input.listId };
    },
  );
  return getList(actor, input.listId);
}
export async function renameSection(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = renameSectionSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "rename_section" } as typeof input,
    async (tx) => {
      await locked(tx, actor, input, true, true);
      await validSection(tx, input.listId, input.sectionId);
      await tx
        .update(sections)
        .set({ title: input.title })
        .where(eq(sections.id, input.sectionId));
      return { id: input.listId };
    },
  );
  return getList(actor, input.listId);
}
export async function deleteSection(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = sectionMutationSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "delete_section" } as typeof input,
    async (tx) => {
      await locked(tx, actor, input, true, true);
      await validSection(tx, input.listId, input.sectionId);
      // ON DELETE SET NULL preserves every task in the unsectioned group.
      await tx.delete(sections).where(eq(sections.id, input.sectionId));
      return { id: input.listId };
    },
  );
  return getList(actor, input.listId);
}
export async function reorderSections(actor: Actor, data: unknown) {
  requireScope(actor, "lists:manage");
  const input = reorderSectionsSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "reorder_sections" } as typeof input,
    async (tx) => {
      await locked(tx, actor, input, true, true);
      const existing = await tx
        .select({ id: sections.id })
        .from(sections)
        .where(eq(sections.listId, input.listId));
      if (
        existing.length !== input.sectionIds.length ||
        new Set(input.sectionIds).size !== existing.length ||
        existing.some((s) => !input.sectionIds.includes(s.id))
      )
        fail(
          "invalid_order",
          "Provide every section in this list exactly once.",
          400,
        );
      for (const [position, id] of input.sectionIds.entries())
        await tx.update(sections).set({ position }).where(eq(sections.id, id));
      return { id: input.listId };
    },
  );
  return getList(actor, input.listId);
}
// The list row is already locked by every caller. A parent must be a root in
// the same list; no cycles, grandchildren or cross-list links can be created.
async function validParent(
  tx: Tx,
  listId: string,
  parentTaskId?: string | null,
) {
  if (!parentTaskId) return;
  const [parent] = await tx
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, parentTaskId), eq(tasks.listId, listId)));
  if (!parent || parent.parentTaskId)
    fail(
      "invalid_parent",
      "Choose a top-level task in this list for your little steps.",
      400,
    );
}
async function validWorkFields(
  tx: Tx,
  list: { id: string; ownerId: string; mode: TodoList["mode"] },
  input: {
    status?: Task["status"];
    priority?: Task["priority"];
    assigneeId?: string | null;
    references?: Task["references"];
  },
) {
  if (
    list.mode !== "work" &&
    ((input.status !== undefined && !["todo", "done"].includes(input.status)) ||
      (input.priority !== undefined && input.priority !== "none") ||
      input.assigneeId ||
      input.references?.length)
  )
    fail(
      "work_list_required",
      "Choose Work in list settings before adding work metadata.",
      400,
    );
  if (input.assigneeId) {
    const people = await tx
      .select({ id: members.userId })
      .from(members)
      .where(eq(members.listId, list.id));
    const [person] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.assigneeId), eq(users.enabled, true)));
    if (
      !people.length ||
      !person ||
      (input.assigneeId !== list.ownerId &&
        !people.some((p) => p.id === input.assigneeId))
    )
      fail(
        "invalid_assignee",
        "Choose a current member of this shared list.",
        400,
      );
  }
}
async function clearDepartedAssignee(tx: Tx, listId: string, userId: string) {
  const remaining = await tx
    .select({ id: members.userId })
    .from(members)
    .where(eq(members.listId, listId));
  await tx
    .update(tasks)
    .set({ assigneeId: null, updatedAt: new Date() })
    .where(
      and(
        eq(tasks.listId, listId),
        remaining.length
          ? eq(tasks.assigneeId, userId)
          : isNotNull(tasks.assigneeId),
      ),
    );
}
export async function createTask(actor: Actor, data: unknown) {
  requireScope(actor, "tasks:write");
  const input = createTaskSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "create_task" } as typeof input,
    async (tx) => {
      const list = await locked(tx, actor, input, false, true);
      await validWorkFields(tx, list, input);
      await validParent(tx, input.listId, input.parentTaskId);
      if (input.parentTaskId && input.sectionId)
        fail(
          "invalid_section",
          "Subtasks follow their parent’s section. Move the parent to corg-anize them together.",
          400,
        );
      await validSection(tx, input.listId, input.sectionId);
      const existing = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.listId, input.listId));
      if (existing.length >= 1000)
        fail("limit_reached", "A list can contain up to 1,000 tasks.", 400);
      if (taskImageReferences(input.content ?? "").length)
        fail(
          "invalid_attachment",
          "Create the task before adding images.",
          400,
        );
      await tx.insert(tasks).values({
        listId: input.listId,
        parentTaskId: input.parentTaskId ?? null,
        title: input.title,
        status: input.status ?? "todo",
        completed: input.status === "done",
        completedAt: input.status === "done" ? new Date() : null,
        priority: input.priority ?? "none",
        assigneeId: input.assigneeId ?? null,
        references: input.references ?? [],
        dueDate: input.dueDate ?? null,
        sectionId: input.sectionId ?? null,
        content: input.content ?? "",
        position:
          Math.max(
            -1,
            ...existing
              .filter((t) => t.parentTaskId === (input.parentTaskId ?? null))
              .map((t) => t.position),
          ) + 1,
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
      const list = await locked(tx, actor, input, false, true);
      await validWorkFields(tx, list, input);
      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, input.taskId), eq(tasks.listId, input.listId)));
      if (!task) fail("not_found", "Task not found.", 404);
      if (task.parentTaskId && input.sectionId)
        fail(
          "invalid_section",
          "Subtasks follow their parent’s section. Move the parent to corg-anize them together.",
          400,
        );
      await validSection(tx, input.listId, input.sectionId);
      if (input.content !== undefined)
        await reconcileTaskImages(tx, actor, task.id, input.content);
      const status =
        input.status ??
        (input.completed === true
          ? "done"
          : input.completed === false && task.completed
            ? "todo"
            : task.status);
      const completed = status === "done";
      let position = task.position;
      if (!completed && task.completed && !task.parentTaskId) {
        const rows = await tx
          .select()
          .from(tasks)
          .where(
            and(eq(tasks.listId, input.listId), isNull(tasks.parentTaskId)),
          );
        position = Math.max(-1, ...rows.map((t) => t.position)) + 1;
      }
      await tx
        .update(tasks)
        .set({
          title: input.title ?? task.title,
          dueDate: input.dueDate === undefined ? task.dueDate : input.dueDate,
          content: input.content ?? task.content,
          status,
          completed,
          completedAt: completed
            ? task.completed
              ? task.completedAt
              : new Date()
            : null,
          updatedAt: new Date(),
          priority: input.priority ?? task.priority,
          assigneeId:
            input.assigneeId === undefined ? task.assigneeId : input.assigneeId,
          references: input.references ?? task.references,
          sectionId:
            input.sectionId === undefined ? task.sectionId : input.sectionId,
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
      await locked(tx, actor, input, false, true);
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
      await locked(tx, actor, input, false, true);
      await validParent(tx, input.listId, input.parentTaskId);
      const active = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.listId, input.listId),
            input.parentTaskId
              ? eq(tasks.parentTaskId, input.parentTaskId)
              : and(isNull(tasks.parentTaskId), eq(tasks.completed, false)),
          ),
        );
      if (
        active.length !== input.taskIds.length ||
        new Set(input.taskIds).size !== active.length ||
        active.some((t) => !input.taskIds.includes(t.id))
      )
        fail(
          "invalid_order",
          input.parentTaskId
            ? "Provide every subtask of this parent exactly once, including completed steps."
            : "Provide each active top-level task exactly once.",
          400,
        );
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
      await tx.insert(invitations).values({
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
      await clearDepartedAssignee(tx, input.listId, input.userId);
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
      await clearDepartedAssignee(tx, input.listId, actor.id);
      return { id: input.listId };
    },
  );
  return { listId: input.listId, left: true };
}

// Capabilities are issued only after current admission/access checks. The SQL
// also includes those dependencies so authorization stays live after issuance.
export async function getLiveQuery(actor: Actor) {
  requireScope(actor, "lists:read");
  await admission(database().db, actor);
  return liveQueryDefinition(actor.id);
}

async function reconcileTaskImages(
  tx: Tx,
  actor: Actor,
  taskId: string,
  content: string,
) {
  const ids = taskImageReferences(content);
  if (ids.length > taskImageCountLimit)
    fail("limit_reached", "A task can have up to 20 images.", 400);
  // The caller holds the list lock; row locks serialize this with cleanup.
  const rows = await tx
    .select()
    .from(attachments)
    .where(eq(attachments.taskId, taskId))
    .for("update");
  for (const id of ids) {
    const row = rows.find((row) => row.id === id);
    if (
      !row ||
      !row.ready ||
      row.retiredAt ||
      (!row.attached &&
        (row.uploaderId !== actor.id ||
          row.createdAt.getTime() <= Date.now() - 86_400_000))
    )
      fail(
        "invalid_attachment",
        "An image is unavailable. Remove it from your draft or upload it again.",
        409,
      );
  }
  for (const row of rows) {
    if (ids.includes(row.id))
      await tx
        .update(attachments)
        .set({ attached: true })
        .where(eq(attachments.id, row.id));
    else if (row.attached && !row.retiredAt)
      await tx
        .update(attachments)
        .set({ retiredAt: new Date() })
        .where(eq(attachments.id, row.id));
  }
}
async function currentImage(
  tx: Tx | Db,
  actor: Actor,
  id: string,
  write = false,
) {
  const [row] = await tx
    .select()
    .from(attachments)
    .where(eq(attachments.id, id));
  if (!row?.listId || !row.taskId || row.retiredAt)
    return fail("not_found", "Image not found.", 404);
  const list = await accessible(tx, actor, row.listId, write);
  if (write && list.archived)
    fail("list_archived", "Restore this list before adding images.", 409);
  const [task] = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, row.taskId), eq(tasks.listId, list.id)));
  if (
    !task ||
    (!row.attached &&
      (row.uploaderId !== actor.id ||
        row.createdAt.getTime() <= Date.now() - 86_400_000))
  )
    return fail("not_found", "Image not found.", 404);
  return row;
}
export async function uploadTaskImage(
  actor: Actor,
  data: unknown,
  bytes: Uint8Array,
) {
  requireScope(actor, "tasks:write");
  const input = taskImageUploadSchema.parse(data);
  // Reject unauthorized callers before decoding/re-encoding or storing bytes.
  await accessible(database().db, actor, input.listId);
  if (!imageStorageConfigured())
    fail(
      "images_unavailable",
      "Image uploads aren’t available yet. Your notes are safe.",
      503,
    );
  const image = await normalizeTaskImage(bytes);
  const result = await mutate(
    actor,
    {
      ...input,
      kind: "upload_task_image",
      digest: image.digest,
    } as typeof input,
    async (tx) => {
      const list = await accessible(tx, actor, input.listId, true);
      if (list.archived)
        fail("list_archived", "Restore this list before adding images.", 409);
      if (list.version !== input.version)
        fail("conflict", "This list changed. Refresh it and try again.", 409);
      const [task] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, input.taskId), eq(tasks.listId, list.id)));
      if (!task) return fail("not_found", "Task not found.", 404);
      const existing = await tx
        .select({ id: attachments.id })
        .from(attachments)
        .where(
          and(
            eq(attachments.taskId, task.id),
            isNull(attachments.retiredAt),
            or(
              eq(attachments.attached, true),
              sql`${attachments.createdAt} > now() - interval '24 hours'`,
            ),
          ),
        );
      if (existing.length >= taskImageCountLimit)
        fail(
          "limit_reached",
          "A task can have up to 20 saved or draft images. Remove saved images or try again after abandoned drafts expire.",
          400,
        );
      const id = randomUUID();
      await tx.insert(attachments).values({
        id,
        listId: list.id,
        taskId: task.id,
        uploaderId: actor.id,
        digest: image.digest,
        pathname: `task-images/${id}/${image.digest}.webp`,
        bytes: image.bytes,
        width: image.width,
        height: image.height,
      });
      return { id };
    },
  );
  // A receipt never restores former membership or a deleted/expired attachment.
  const row = await database().db.transaction((tx) =>
    currentImage(tx, actor, result.id, true),
  );
  if (!row.ready) {
    await storeTaskImage(row.pathname, image.data);
    await database().db.transaction(async (tx) => {
      await currentImage(tx, actor, row.id, true);
      const [updated] = await tx
        .update(attachments)
        .set({ ready: true })
        .where(and(eq(attachments.id, row.id), isNull(attachments.retiredAt)))
        .returning({ id: attachments.id });
      if (!updated) fail("not_found", "Image not found.", 404);
    });
  }
  return {
    id: row.id,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    markdown: `![Image](${taskImagePath(row.id)})`,
  };
}
export async function readTaskImage(actor: Actor, imageId: string) {
  requireScope(actor, "lists:read");
  const row = await currentImage(database().db, actor, idSchema.parse(imageId));
  if (!row.ready) return fail("not_found", "Image not found.", 404);
  const stream = await loadTaskImage(row.pathname);
  // Recheck after storage I/O; never redirect to a Blob URL or issue a read token.
  await currentImage(database().db, actor, row.id);
  return {
    stream,
    image: {
      id: row.id,
      width: row.width,
      height: row.height,
      bytes: row.bytes,
    },
  };
}
export async function cleanupTaskImages() {
  if (!imageStorageConfigured())
    fail("images_unavailable", "Image storage is unavailable.", 503);
  const db = database().db;
  const rows = await db.transaction(async (tx) => {
    const candidates = await tx
      .select()
      .from(attachments)
      .where(
        or(
          and(
            eq(attachments.attached, false),
            sql`${attachments.createdAt} <= now() - interval '24 hours'`,
          ),
          and(
            or(
              isNull(attachments.taskId),
              isNull(attachments.listId),
              isNotNull(attachments.retiredAt),
            ),
            sql`${attachments.createdAt} <= now() - interval '1 hour'`,
          ),
        ),
      )
      .limit(100)
      .for("update", { skipLocked: true });
    if (candidates.length)
      await tx
        .update(attachments)
        .set({ retiredAt: new Date() })
        .where(
          and(
            inArray(
              attachments.id,
              candidates.map((row) => row.id),
            ),
            isNull(attachments.retiredAt),
          ),
        );
    return candidates;
  });
  let removed = 0,
    failed = 0;
  for (const row of rows) {
    try {
      await eraseTaskImage(row.pathname);
      // Keep a tombstone for an hour, then delete the object again before
      // dropping metadata. A delayed upload cannot leave an untracked orphan.
      if (row.retiredAt && row.retiredAt.getTime() <= Date.now() - 3_600_000) {
        await db
          .delete(attachments)
          .where(
            and(eq(attachments.id, row.id), isNotNull(attachments.retiredAt)),
          );
      }
      removed++;
    } catch {
      failed++;
    }
  }
  return { removed, failed };
}
