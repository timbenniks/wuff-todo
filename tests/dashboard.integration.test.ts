import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, members, dashboardPreferences } from "@wuff/db";
import { eq } from "drizzle-orm";
import { scopes, defaultDashboardSettings } from "@wuff/contracts";
import {
  getDashboard,
  getDashboardPreferences,
  updateDashboard,
  createList,
  createTask,
  updateTask,
  getList,
  updateList,
  deleteList,
  getListOrder,
  reorderLists,
  removeListMember,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Isolated development only");
const users = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const a = { id: users[0].id, scopes },
  b = { id: users[1].id, scopes },
  op = () => crypto.randomUUID();
const write = (list: { id: string; version: number }) => ({
  listId: list.id,
  version: list.version,
  operationId: op(),
});
after(() => database().pool.end());
test("Home projects authorized active dated tasks/subtasks with exact counts and personal favorites", async () => {
  const original = await getListOrder(a);
  let shared = await createList(a, { title: "Home shared", operationId: op() }),
    privateB = await createList(b, {
      title: "Home private",
      operationId: op(),
    });
  try {
    await database()
      .db.insert(members)
      .values({ listId: shared.id, userId: b.id });
    for (const [title, dueDate] of [
      ["Overdue", "2026-10-22"],
      ["Today", "2026-10-23"],
      ["Tomorrow", "2026-10-24"],
      ["Last upcoming day", "2026-10-30"],
      ["Too far", "2026-10-31"],
      ["No date", null],
    ] as const)
      shared = await createTask(a, { ...write(shared), title, dueDate });
    shared = await createTask(a, {
      ...write(shared),
      title: "Completed parent",
      dueDate: "2026-10-23",
    });
    const parent = shared.tasks.find((t) => t.title === "Completed parent")!;
    shared = await updateTask(a, {
      ...write(shared),
      taskId: parent.id,
      completed: true,
    });
    shared = await createTask(a, {
      ...write(shared),
      parentTaskId: parent.id,
      title: "Independent child",
      dueDate: "2026-10-23",
    });
    privateB = await createTask(b, {
      ...write(privateB),
      title: "Private today",
      dueDate: "2026-10-23",
    });
    await reorderLists(a, {
      ...(await getListOrder(a)),
      favoriteListIds: [shared.id],
      operationId: op(),
    });
    const before = await getList(a, shared.id),
      orderBefore = await getListOrder(a);
    const home = await getDashboard(a, { today: "2026-10-23", limit: 2 });
    assert.equal(home.todayTotal, 3);
    assert.equal(home.upcomingTotal, 2);
    assert.equal(home.todayTasks.length, 2);
    assert.equal(home.todayTasks[0].title, "Overdue");
    assert.deepEqual(
      home.upcomingTasks.map((t) => t.title),
      ["Tomorrow", "Last upcoming day"],
    );
    assert.deepEqual(
      home.favorites.map((l) => l.id),
      [shared.id],
    );
    assert.equal(home.favorites[0].shared, true);
    const all = await getDashboard(a, { today: "2026-10-23", limit: 100 });
    assert.equal(
      all.todayTasks.find((t) => t.title === "Independent child")?.parentTitle,
      "Completed parent",
    );
    assert.ok(!all.todayTasks.some((t) => t.title === "Private today"));
    assert.ok(!("content" in all.todayTasks[0]));
    assert.ok(
      (await getDashboard(b, { today: "2026-10-23" })).todayTasks.some(
        (t) => t.title === "Private today",
      ),
    );
    assert.deepEqual(
      (await getDashboard(b, { today: "2026-10-23" })).favorites,
      [],
    );
    assert.deepEqual(await getList(a, shared.id), before);
    assert.deepEqual(await getListOrder(a), orderBefore);
    await assert.rejects(
      getDashboard({ ...a, scopes: [] }, { today: "2026-10-23" }),
      { code: "forbidden" },
    );
    await assert.rejects(
      getDashboard({ id: "not-admitted", scopes }, { today: "2026-10-23" }),
      { code: "invite_required" },
    );
    shared = await updateList(a, { ...write(shared), archived: true });
    assert.equal(
      (await getDashboard(a, { today: "2026-10-23" })).todayTotal,
      0,
    );
    assert.deepEqual(
      (await getDashboard(a, { today: "2026-10-23" })).favorites,
      [],
    );
    shared = await updateList(a, { ...write(shared), archived: false });
    assert.equal(
      (await getDashboard(a, { today: "2026-10-23" })).todayTotal,
      3,
    );
    await removeListMember(a, { ...write(shared), userId: b.id });
    const revoked = await getDashboard(b, { today: "2026-10-23" });
    assert.ok(!revoked.todayTasks.some((t) => t.list.id === shared.id));
    assert.equal(revoked.todayTotal, 1);
  } finally {
    await deleteList(a, write(await getList(a, shared.id)));
    await deleteList(b, write(await getList(b, privateB.id)));
    await reorderLists(a, {
      ...original,
      version: (await getListOrder(a)).version,
      operationId: op(),
    });
  }
});
test("Home settings are independently revisioned, account isolated and safe for first-write concurrency and retries", async () => {
  const originals = await database().db.select().from(dashboardPreferences);
  const sidebar = await getListOrder(a);
  try {
    const old = await getDashboardPreferences(a),
      other = await getDashboardPreferences(b);
    const input = {
      ...old,
      settings: {
        sections: ["favorites", "upcoming", "today"],
        hidden: ["today"],
        startPage: "last_list",
      },
      operationId: op(),
    };
    const saved = await updateDashboard(a, input);
    assert.deepEqual(saved.settings, input.settings);
    assert.equal((await updateDashboard(a, input)).version, saved.version);
    await assert.rejects(
      updateDashboard(a, { ...input, settings: defaultDashboardSettings }),
      { code: "idempotency_conflict" },
    );
    await assert.rejects(updateDashboard(a, { ...input, operationId: op() }), {
      code: "conflict",
    });
    assert.deepEqual(await getDashboardPreferences(b), other);
    assert.deepEqual(await getListOrder(a), sidebar);
    await assert.rejects(
      updateDashboard(
        { ...a, scopes: ["lists:read"] },
        { ...saved, operationId: op() },
      ),
      { code: "forbidden" },
    );
    await assert.rejects(
      updateDashboard(a, {
        ...saved,
        settings: {
          ...saved.settings,
          sections: ["today", "today", "favorites"],
        },
        operationId: op(),
      }),
    );
    const result = await Promise.allSettled(
      [[], ["favorites"]].map((hidden) =>
        updateDashboard(a, {
          ...saved,
          settings: { ...saved.settings, hidden },
          operationId: op(),
        }),
      ),
    );
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
    assert.deepEqual(
      (await getDashboard(a, { today: "2026-10-23" })).preferences,
      await getDashboardPreferences(a),
    );
  } finally {
    for (const actor of [a, b]) {
      const old = originals.find((row) => row.userId === actor.id);
      if (old)
        await database()
          .db.insert(dashboardPreferences)
          .values(old)
          .onConflictDoUpdate({
            target: dashboardPreferences.userId,
            set: old,
          });
      else
        await database()
          .db.delete(dashboardPreferences)
          .where(eq(dashboardPreferences.userId, actor.id));
    }
  }
});
