import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, members } from "@wuff/db";
import { scopes } from "@wuff/contracts";
import {
  createList,
  createTask,
  getList,
  deleteList,
  updateTask,
  updateList,
  removeListMember,
  reorderTasks,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw new Error("Isolated development only");
const fixtures = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const a = { id: fixtures[0].id, scopes },
  b = { id: fixtures[1].id, scopes };
const write = (list: { id: string; version: number }) => ({
  listId: list.id,
  version: list.version,
  operationId: crypto.randomUUID(),
});
after(async () => database().pool.end());
test("calendar due dates stay independent, permission checked, retry safe, versioned and stable through task operations", async () => {
  let list = await createList(a, {
    title: "Synthetic calendar dates",
    operationId: crypto.randomUUID(),
  });
  let other = await createList(a, {
    title: "Synthetic other dates",
    operationId: crypto.randomUUID(),
  });
  try {
    list = await createTask(a, {
      ...write(list),
      title: "Parent",
      dueDate: "2028-02-29",
      content: "Keep these notes",
    });
    const parent = list.tasks[0].id;
    list = await createTask(a, {
      ...write(list),
      title: "Child",
      parentTaskId: parent,
    });
    const child = list.tasks.find((t) => t.parentTaskId === parent)!.id;
    assert.equal(
      list.tasks.find((t) => t.id === child)!.dueDate,
      null,
      "No inherited date",
    );
    await assert.rejects(
      updateTask(b, { ...write(list), taskId: child, dueDate: "2028-03-01" }),
      { code: "not_found" },
    );
    await database()
      .db.insert(members)
      .values({ listId: list.id, userId: b.id });
    const request = { ...write(list), taskId: child, dueDate: "2028-03-01" };
    list = await updateTask(b, request);
    assert.equal((await updateTask(b, request)).version, list.version);
    await assert.rejects(updateTask(b, { ...request, dueDate: "2028-03-02" }), {
      code: "idempotency_conflict",
    });
    await assert.rejects(
      updateTask(
        { ...b, scopes: ["lists:read"] },
        { ...write(list), taskId: child, dueDate: null },
      ),
      { code: "forbidden" },
    );
    await assert.rejects(
      updateTask(a, { ...write(other), taskId: child, dueDate: null }),
      { code: "not_found" },
    );
    for (const dueDate of [
      "2026-02-30",
      "0000-01-01",
      "2026-10-16T00:00:00Z",
    ]) {
      await assert.rejects(
        updateTask(b, { ...write(list), taskId: child, dueDate }),
      );
      assert.equal(
        (await getList(a, list.id)).version,
        list.version,
        "Invalid dates never advance the revision",
      );
    }
    await assert.rejects(
      database().pool.query(
        "UPDATE wuff_tasks SET due_date = 'infinity'::date WHERE id = $1",
        [child],
      ),
      { code: "23514" },
    );
    const oldPosition = list.tasks.find((t) => t.id === parent)!.position;
    list = await updateTask(a, {
      ...write(list),
      taskId: parent,
      dueDate: null,
    });
    assert.equal(list.tasks.find((t) => t.id === child)!.dueDate, "2028-03-01");
    assert.equal(
      list.tasks.find((t) => t.id === parent)!.position,
      oldPosition,
    );
    assert.equal(
      list.tasks.find((t) => t.id === parent)!.content,
      "Keep these notes",
    );
    list = await updateTask(b, {
      ...write(list),
      taskId: child,
      title: "Renamed child",
      completed: true,
    });
    assert.equal(
      list.tasks.find((t) => t.id === child)!.dueDate,
      "2028-03-01",
      "Omission preserves",
    );
    list = await updateTask(a, {
      ...write(list),
      taskId: parent,
      completed: true,
    });
    list = await updateTask(a, {
      ...write(list),
      taskId: parent,
      completed: false,
    });
    list = await reorderTasks(b, { ...write(list), taskIds: [parent] });
    assert.equal(list.tasks.find((t) => t.id === child)!.dueDate, "2028-03-01");
    const concurrent = await Promise.allSettled(
      ["2028-03-03", "2028-03-04"].map((dueDate) =>
        updateTask(b, { ...write(list), taskId: child, dueDate }),
      ),
    );
    assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (concurrent.find((r) => r.status === "rejected") as PromiseRejectedResult)
        .reason.code,
      "conflict",
    );
    list = await getList(a, list.id);
    list = await updateList(a, { ...write(list), archived: true });
    const archivedDate = list.tasks.find((t) => t.id === child)!.dueDate;
    await assert.rejects(
      updateTask(b, { ...write(list), taskId: child, dueDate: null }),
      { code: "list_archived" },
    );
    assert.equal(
      (await getList(b, list.id)).tasks.find((t) => t.id === child)!.dueDate,
      archivedDate,
    );
    list = await updateList(a, { ...write(list), archived: false });
    await removeListMember(a, { ...write(list), userId: b.id });
    list = await getList(a, list.id);
    await assert.rejects(updateTask(b, request), { code: "not_found" });
    await assert.rejects(getList(b, list.id), { code: "not_found" });
    await database()
      .db.insert(members)
      .values({ listId: list.id, userId: b.id });
    const replay = await updateTask(b, request);
    assert.equal(
      replay.tasks.find((t) => t.id === child)!.dueDate,
      archivedDate,
      "Receipt rereads current state and never restores the old date",
    );
    list = await updateTask(a, {
      ...write(list),
      taskId: child,
      dueDate: null,
    });
    assert.equal(list.tasks.find((t) => t.id === child)!.dueDate, null);
  } finally {
    for (const entry of [list, other])
      await deleteList(a, write(await getList(a, entry.id)));
  }
});
