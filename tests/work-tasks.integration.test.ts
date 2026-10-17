import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, members } from "@wuff/db";
import { scopes } from "@wuff/contracts";
import {
  createList,
  createTask,
  getList,
  getTask,
  updateTask,
  updateList,
  deleteList,
  deleteTask,
  removeListMember,
  leaveList,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw new Error("Isolated development only");
const fixtures = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const a = { id: fixtures[0].id, scopes },
  b = { id: fixtures[1].id, scopes },
  outsider = { id: fixtures[2].id, scopes };
const write = (list: { id: string; version: number }) => ({
  listId: list.id,
  version: list.version,
  operationId: crypto.randomUUID(),
});
after(async () => database().pool.end());
test("work metadata is authorized, versioned, retry safe, immutable by key and cleared on departure", async () => {
  let list = await createList(a, {
    title: "Synthetic work lifecycle",
    mode: "work",
    operationId: crypto.randomUUID(),
  });
  let simple = await createList(a, {
    title: "Synthetic simple lifecycle",
    operationId: crypto.randomUUID(),
  });
  try {
    await assert.rejects(
      createTask(a, {
        ...write(simple),
        title: "No work state",
        status: "blocked",
      }),
      { code: "work_list_required" },
    );
    list = await createTask(a, {
      ...write(list),
      title: "Build the feature",
      status: "in_progress",
      priority: "high",
      references: [
        { url: "https://github.com/example/repo/issues/42", title: "Spec" },
      ],
    });
    const task = list.tasks[0],
      key = task.key;
    list = await updateTask(a, {
      ...write(list),
      taskId: task.id,
      completed: false,
    });
    assert.equal(
      list.tasks[0].status,
      "in_progress",
      "Ensuring an already-open task stays open preserves its workflow state",
    );
    assert.match(key, /^WUFF-[1-9][0-9]*$/);
    assert.equal(task.path, `/tasks/${task.id}`);
    assert.equal((await getTask(a, key)).task.id, task.id);
    assert.equal((await getTask(a, task.id)).task.key, key);
    await assert.rejects(getTask(b, key), {
      code: "not_found",
      message: "Task not found.",
    });
    await assert.rejects(getTask(b, crypto.randomUUID()), {
      code: "not_found",
      message: "Task not found.",
    });
    await assert.rejects(getTask(outsider, key), { code: "invite_required" });
    await assert.rejects(
      updateTask(a, { ...write(list), taskId: task.id, assigneeId: a.id }),
      { code: "invalid_assignee" },
    );
    await database()
      .db.insert(members)
      .values({ listId: list.id, userId: b.id });
    list = await getList(a, list.id);
    assert.equal(list.assignees.length, 2);
    const request = {
      ...write(list),
      taskId: task.id,
      status: "in_review",
      assigneeId: b.id,
    };
    list = await updateTask(b, request);
    assert.equal((await updateTask(b, request)).version, list.version);
    await assert.rejects(updateTask(b, { ...request, priority: "urgent" }), {
      code: "idempotency_conflict",
    });
    await assert.rejects(
      updateTask(
        { ...b, scopes: ["lists:read"] },
        { ...write(list), taskId: task.id, priority: "urgent" },
      ),
      { code: "forbidden" },
    );
    await assert.rejects(updateList(b, { ...write(list), mode: "simple" }), {
      code: "owner_required",
    });
    await assert.rejects(updateList(a, { ...write(list), mode: "simple" }), {
      code: "work_metadata_present",
    });
    list = await updateList(a, { ...write(list), title: "Renamed work list" });
    list = await updateTask(a, {
      ...write(list),
      taskId: task.id,
      title: "Renamed task",
      completed: true,
    });
    assert.equal(list.tasks[0].status, "done");
    assert.ok(list.tasks[0].completedAt);
    const completedAt = list.tasks[0].completedAt;
    list = await updateTask(a, {
      ...write(list),
      taskId: task.id,
      priority: "low",
    });
    assert.equal(list.tasks[0].completedAt, completedAt);
    list = await updateTask(a, {
      ...write(list),
      taskId: task.id,
      completed: false,
    });
    assert.equal(list.tasks[0].status, "todo");
    assert.equal(list.tasks[0].completedAt, null);
    assert.equal(list.tasks[0].key, key);
    const concurrent = await Promise.allSettled(
      ["blocked", "in_review"].map((status) =>
        updateTask(b, { ...write(list), taskId: task.id, status }),
      ),
    );
    assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (concurrent.find((r) => r.status === "rejected") as PromiseRejectedResult)
        .reason.code,
      "conflict",
    );
    list = await getList(a, list.id);
    list = await createTask(a, {
      ...write(list),
      title: "Child",
      parentTaskId: task.id,
    });
    const child = list.tasks.find((t) => t.parentTaskId === task.id)!;
    list = await updateTask(b, {
      ...write(list),
      taskId: child.id,
      status: "done",
      assigneeId: a.id,
    });
    assert.equal(list.tasks.find((t) => t.id === task.id)!.completed, false);
    list = await updateList(a, { ...write(list), archived: true });
    await assert.rejects(
      updateTask(b, { ...write(list), taskId: task.id, status: "done" }),
      { code: "list_archived" },
    );
    list = await updateList(a, { ...write(list), archived: false });
    await removeListMember(a, { ...write(list), userId: b.id });
    list = await getList(a, list.id);
    assert.ok(
      list.tasks.every((t) => t.assigneeId === null),
      "Private list clears owner and departed member assignments",
    );
    await assert.rejects(getTask(b, key), { code: "not_found" });
    await assert.rejects(updateTask(b, request), { code: "not_found" });
    await database()
      .db.insert(members)
      .values({ listId: list.id, userId: b.id });
    list = await updateTask(a, {
      ...write(list),
      taskId: task.id,
      assigneeId: b.id,
    });
    await leaveList(b, write(list));
    list = await getList(a, list.id);
    assert.ok(list.tasks.every((t) => t.assigneeId === null));
    // Legacy writers during rolling deployment update only the checkbox.
    await database().pool.query(
      "UPDATE wuff_tasks SET completed = true WHERE id = $1",
      [task.id],
    );
    assert.equal((await getTask(a, key)).task.status, "done");
    await database().pool.query(
      "UPDATE wuff_tasks SET completed = false WHERE id = $1",
      [task.id],
    );
    assert.equal((await getTask(a, key)).task.status, "todo");
    list = await getList(a, list.id);
    const oldNumber = Number(key.slice(5));
    list = await deleteTask(a, { ...write(list), taskId: task.id });
    await assert.rejects(getTask(a, key), { code: "not_found" });
    list = await createTask(a, { ...write(list), title: "Different task" });
    assert.ok(
      Number(list.tasks[0].key.slice(5)) > oldNumber,
      "Deleted keys are never reused",
    );
  } finally {
    for (const entry of [list, simple])
      await deleteList(a, write(await getList(a, entry.id)));
  }
});
