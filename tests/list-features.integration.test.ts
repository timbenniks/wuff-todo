import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, members } from "@wuff/db";
import { scopes } from "@wuff/contracts";
import {
  createList,
  getList,
  listLists,
  deleteList,
  updateList,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  createSection,
  renameSection,
  reorderSections,
  deleteSection,
  getListOrder,
  reorderLists,
  removeListMember,
} from "@wuff/domain";
import { createRealtime, rawSql } from "@neon/realtime/server";
import { getLiveQuery } from "@wuff/domain";
import { createRealtimeClient, waitForLive } from "./helpers/live";
import type { ListSummary } from "@wuff/contracts";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw new Error("Isolated development only");
const fixtures = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const a = { id: fixtures[0].id, scopes },
  b = { id: fixtures[1].id, scopes },
  outsider = { id: fixtures[2].id, scopes };
const op = () => crypto.randomUUID();
const write = (l: { id: string; version: number }) => ({
  listId: l.id,
  version: l.version,
  operationId: op(),
});
async function cleanup(id: string) {
  const l = await getList(a, id);
  await deleteList(a, write(l));
}
after(async () => database().pool.end());
test("shared metadata permissions, archive write boundary, retries and concurrent settings", async () => {
  let list = await createList(a, {
    title: "Mature list permissions",
    operationId: op(),
  });
  try {
    assert.equal(list.color, "blue");
    assert.equal(list.archived, false);
    assert.deepEqual(list.sections, []);
    await database()
      .db.insert(members)
      .values({ listId: list.id, userId: b.id });
    const request = {
      ...write(list),
      color: "lavender",
      description: "Shared context\nSecond line",
    };
    const saved = await updateList(a, request);
    list = saved;
    assert.equal((await updateList(a, request)).version, saved.version);
    assert.equal((await getList(b, list.id)).description, request.description);
    for (const change of [
      { color: "rose" },
      { archived: true },
      { description: "Changed" },
    ])
      await assert.rejects(updateList(b, { ...write(list), ...change }), {
        code: "owner_required",
      });
    await assert.rejects(
      updateList(outsider, { ...write(list), color: "rose" }),
      { code: "invite_required" },
    );
    await assert.rejects(
      updateList(
        { ...a, scopes: ["lists:read"] },
        { ...write(list), color: "rose" },
      ),
      { code: "forbidden" },
    );
    await assert.rejects(
      updateList(a, { ...write(list), color: "url(javascript:alert(1))" }),
    );
    const results = await Promise.allSettled(
      ["sage", "rose"].map((color) => updateList(a, { ...write(list), color })),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    list = await getList(a, list.id);
    list = await createTask(b, { ...write(list), title: "Kept task" });
    const task = list.tasks[0];
    list = await updateList(a, { ...write(list), archived: true });
    assert.equal(
      (await listLists(b)).find((l) => l.id === list.id)?.archived,
      true,
    );
    for (const action of [
      () => createTask(b, { ...write(list), title: "Denied" }),
      () => updateTask(a, { ...write(list), taskId: task.id, completed: true }),
      () => deleteTask(b, { ...write(list), taskId: task.id }),
      () => reorderTasks(a, { ...write(list), taskIds: [task.id] }),
      () => createSection(a, { ...write(list), title: "Denied" }),
    ])
      await assert.rejects(action(), { code: "list_archived" });
    list = await updateList(a, { ...write(list), archived: false });
    assert.equal(list.tasks[0].title, "Kept task");
    list = await updateTask(b, {
      ...write(list),
      taskId: task.id,
      completed: true,
    });
    assert.equal(list.tasks[0].completed, true);
  } finally {
    await cleanup(list.id);
  }
});
test("sections stay inside their list and removal preserves active and completed tasks", async () => {
  let list = await createList(a, {
    title: "Sections proof",
    operationId: op(),
  });
  let other = await createList(a, {
    title: "Other sections proof",
    operationId: op(),
  });
  try {
    await database()
      .db.insert(members)
      .values({ listId: list.id, userId: b.id });
    await assert.rejects(
      createSection(b, { ...write(list), title: "Denied" }),
      { code: "owner_required" },
    );
    const creation = { ...write(list), title: "Groceries" };
    list = await createSection(a, creation);
    assert.equal((await createSection(a, creation)).sections.length, 1);
    list = await createSection(a, { ...write(list), title: "Household" });
    const first = list.sections[0].id,
      second = list.sections[1].id;
    list = await renameSection(a, {
      ...write(list),
      sectionId: first,
      title: "Vegetables",
    });
    list = await reorderSections(a, {
      ...write(list),
      sectionIds: [second, first],
    });
    assert.deepEqual(
      list.sections.map((s) => s.id),
      [second, first],
    );
    await assert.rejects(
      reorderSections(a, { ...write(list), sectionIds: [first, first] }),
      { code: "invalid_order" },
    );
    await assert.rejects(
      renameSection(a, {
        ...write(other),
        sectionId: first,
        title: "Cross list",
      }),
      { code: "not_found" },
    );
    await assert.rejects(
      createTask(a, { ...write(other), sectionId: first, title: "Cross list" }),
      { code: "not_found" },
    );
    other = await createTask(a, { ...write(other), title: "Other task" });
    await assert.rejects(
      updateTask(a, {
        ...write(other),
        taskId: other.tasks[0].id,
        sectionId: first,
      }),
      { code: "not_found" },
    );
    list = await createTask(b, {
      ...write(list),
      title: "Carrots",
      sectionId: first,
    });
    const carrot = list.tasks[0].id;
    list = await createTask(b, {
      ...write(list),
      title: "Potatoes",
      sectionId: first,
    });
    list = await updateTask(b, {
      ...write(list),
      taskId: carrot,
      completed: true,
      sectionId: second,
    });
    list = await updateTask(b, {
      ...write(list),
      taskId: carrot,
      sectionId: first,
    });
    const remove = { ...write(list), sectionId: first };
    list = await deleteSection(a, remove);
    assert.equal((await deleteSection(a, remove)).version, list.version);
    assert.equal(list.tasks.length, 2);
    assert.ok(list.tasks.every((t) => t.sectionId === null));
    assert.equal(list.tasks.find((t) => t.id === carrot)?.completed, true);
    list = await updateList(a, { ...write(list), archived: true });
    for (const action of [
      () =>
        renameSection(a, {
          ...write(list),
          sectionId: second,
          title: "Denied",
        }),
      () => reorderSections(a, { ...write(list), sectionIds: [second] }),
      () => deleteSection(a, { ...write(list), sectionId: second }),
    ])
      await assert.rejects(action(), { code: "list_archived" });
  } finally {
    await cleanup(list.id);
    await cleanup(other.id);
  }
});
test("personal list order is isolated, revisioned, permission filtered, and signals live metadata", async () => {
  let first = await createList(a, { title: "Order one", operationId: op() }),
    second = await createList(a, { title: "Order two", operationId: op() });
  const originalA = await getListOrder(a),
    originalB = await getListOrder(b);
  const rt = createRealtime({
    secret: process.env.NEON_REALTIME_SECRET!,
    db: new URL(process.env.DATABASE_URL!).pathname.slice(1),
  });
  const definition = await getLiveQuery(a);
  const query = await rt.seal({
    query: rawSql<ListSummary & { orderVersion: number }>(
      definition.query,
      definition.params,
    ),
  });
  const client = createRealtimeClient({
    url: process.env.NEON_REALTIME_URL!,
    logLevel: "silent",
  });
  const sub = client.subscribe(query);
  try {
    await waitForLive(
      sub,
      (rows) => rows.some((r) => r.id === first.id),
      20000,
    );
    const reverse = [...originalA.listIds].reverse(),
      input = {
        listIds: reverse,
        version: originalA.version,
        operationId: op(),
      };
    const saved = await reorderLists(a, input);
    await waitForLive(sub, (rows) =>
      rows.some(
        (r) =>
          (r as ListSummary & { orderVersion: number }).orderVersion ===
          saved.version,
      ),
    );
    assert.deepEqual(
      (await listLists(a)).map((l) => l.id),
      reverse,
    );
    assert.deepEqual((await getListOrder(b)).listIds, originalB.listIds);
    assert.equal((await reorderLists(a, input)).version, saved.version);
    await assert.rejects(reorderLists(a, { ...input, operationId: op() }), {
      code: "conflict",
    });
    await assert.rejects(
      reorderLists(a, {
        ...input,
        version: saved.version,
        listIds: [first.id, first.id],
        operationId: op(),
      }),
      { code: "invalid_order" },
    );
    const attempts = await Promise.allSettled(
      [reverse, [...reverse].reverse()].map((listIds) =>
        reorderLists(a, { version: saved.version, listIds, operationId: op() }),
      ),
    );
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (await getList(a, first.id)).version,
      0,
      "Personal order does not change list versions",
    );
    first = await updateList(a, {
      ...write(first),
      color: "sage",
      archived: true,
    });
    await waitForLive(sub, (rows) =>
      rows.some((r) => r.id === first.id && r.color === "sage" && r.archived),
    );
    await database()
      .db.insert(members)
      .values({ listId: second.id, userId: b.id });
    const memberOrder = await getListOrder(b);
    await reorderLists(b, {
      ...memberOrder,
      listIds: [
        second.id,
        ...memberOrder.listIds.filter((id) => id !== second.id),
      ],
      operationId: op(),
    });
    await removeListMember(a, { ...write(second), userId: b.id });
    assert.ok(!(await getListOrder(b)).listIds.includes(second.id));
    await assert.rejects(
      reorderLists(b, {
        ...memberOrder,
        version: (await getListOrder(b)).version,
        operationId: op(),
      }),
      { code: "invalid_order" },
    );
  } finally {
    sub.unsubscribe();
    client.close();
    // Restore only these synthetic accounts' ordering; preserve any earlier fixture data.
    for (const [actor, original] of [
      [a, originalA],
      [b, originalB],
    ] as const) {
      const now = await getListOrder(actor);
      const known = new Set(now.listIds);
      const ids = [
        ...original.listIds.filter((id) => known.has(id)),
        ...now.listIds.filter((id) => !original.listIds.includes(id)),
      ];
      await reorderLists(actor, { ...now, listIds: ids, operationId: op() });
    }
    await cleanup(first.id);
    await cleanup(second.id);
  }
});
