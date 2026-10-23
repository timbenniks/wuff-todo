import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, members } from "@wuff/db";
import { scopes, defaultListView, viewSettings } from "@wuff/contracts";
import {
  createList,
  createTask,
  getList,
  updateListView,
  queryListView,
  deleteList,
  removeListMember,
  updateList,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Isolated development only");
const users = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const a = { id: users[0].id, scopes },
  b = { id: users[1].id, scopes },
  outsider = { id: users[2].id, scopes };
const write = (l: { id: string; version: number }) => ({
  listId: l.id,
  version: l.version,
  operationId: crypto.randomUUID(),
});
after(() => database().pool.end());
test("views isolate members, preserve task revisions/order and serialize writes/retries/revocation", async () => {
  let l = await createList(a, {
    title: "Synthetic personal views",
    mode: "work",
    operationId: crypto.randomUUID(),
  });
  try {
    l = await createTask(a, {
      ...write(l),
      title: "Matching task",
      priority: "urgent",
    });
    await database().db.insert(members).values({ listId: l.id, userId: b.id });
    const originalVersion = l.version,
      originalTasks = l.tasks;
    const request = {
      listId: l.id,
      viewVersion: 0,
      view: { ...defaultListView(), sortBy: "priority", completed: "hide" },
      operationId: crypto.randomUUID(),
    };
    let result = await updateListView(b, request);
    assert.equal(result.version, originalVersion);
    assert.equal(result.personalView.version, 1);
    assert.deepEqual(result.tasks, originalTasks);
    assert.equal((await updateListView(b, request)).personalView.version, 1);
    await assert.rejects(updateListView(b, { ...request, view: {} }), {
      code: "idempotency_conflict",
    });
    assert.equal((await getList(a, l.id)).personalView.version, 0);
    await assert.rejects(
      updateListView(
        { ...b, scopes: ["lists:read"] },
        { ...request, operationId: crypto.randomUUID() },
      ),
      { code: "forbidden" },
    );
    await assert.rejects(
      queryListView(outsider, { listId: l.id, today: "2026-10-17" }),
      { code: "invite_required" },
    );
    const race = await Promise.allSettled(
      ["status", "date"].map((groupBy) =>
        updateListView(b, {
          ...request,
          viewVersion: 1,
          operationId: crypto.randomUUID(),
          view: { groupBy },
        }),
      ),
    );
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (race.find((r) => r.status === "rejected") as PromiseRejectedResult)
        .reason.code,
      "conflict",
    );
    assert.equal(
      (
        await queryListView(b, { listId: l.id, today: "2026-10-17" })
      ).groups.flatMap((g) => g.tasks).length,
      1,
    );
    l = await updateList(a, { ...write(l), archived: true });
    result = await updateListView(b, {
      ...request,
      viewVersion: 2,
      operationId: crypto.randomUUID(),
    });
    assert.equal(result.personalView.version, 3);
    assert.equal(result.archived, true);
    await removeListMember(a, { ...write(l), userId: b.id });
    await assert.rejects(updateListView(b, request), { code: "not_found" });
    await assert.rejects(
      queryListView(b, { listId: l.id, today: "2026-10-17" }),
      { code: "not_found" },
    );
  } finally {
    await deleteList(a, { ...write(await getList(a, l.id)) });
  }
});

test("named presets remain personal, preserve legacy writes, and share conflict/retry protection", async () => {
  let l = await createList(a, {
    title: "Synthetic saved presets",
    operationId: crypto.randomUUID(),
  });
  try {
    await database().db.insert(members).values({ listId: l.id, userId: b.id });
    const id = crypto.randomUUID(),
      settings = {
        ...viewSettings(defaultListView()),
        completed: "hide" as const,
        columns: ["status", "due"] as ("status" | "due")[],
      };
    const request = {
      listId: l.id,
      viewVersion: 0,
      operationId: crypto.randomUUID(),
      view: {
        ...defaultListView(),
        ...settings,
        presets: [{ id, name: "My focus", settings }],
        activePresetId: id,
      },
    };
    let saved = await updateListView(a, request);
    assert.equal(saved.version, l.version);
    assert.deepEqual((await getList(b, l.id)).personalView.view.presets, []);
    assert.equal((await updateListView(a, request)).personalView.version, 1);
    await assert.rejects(
      updateListView(a, { ...request, operationId: crypto.randomUUID() }),
      { code: "conflict" },
    );
    saved = await updateListView(a, {
      listId: l.id,
      viewVersion: 1,
      operationId: crypto.randomUUID(),
      view: { search: "legacy" },
    });
    assert.equal(saved.personalView.view.presets[0].name, "My focus");
    assert.equal(saved.personalView.view.activePresetId, id);
    assert.deepEqual(saved.personalView.view.columns, ["status", "due"]);
    await assert.rejects(
      updateListView(
        { ...b, scopes: ["lists:read"] },
        { ...request, operationId: crypto.randomUUID() },
      ),
      { code: "forbidden" },
    );
    const races = await Promise.allSettled(
      ["Left", "Right"].map((name) =>
        updateListView(a, {
          ...request,
          viewVersion: 2,
          operationId: crypto.randomUUID(),
          view: {
            ...saved.personalView.view,
            presets: [{ id, name, settings }],
          },
        }),
      ),
    );
    assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
    saved = await getList(a, l.id);
    assert.equal(saved.personalView.view.presets.length, 1);
    const removed = await updateListView(a, {
      listId: l.id,
      viewVersion: saved.personalView.version,
      operationId: crypto.randomUUID(),
      view: { ...saved.personalView.view, presets: [], activePresetId: null },
    });
    assert.deepEqual(removed.personalView.view.presets, []);
    assert.deepEqual(removed.tasks, l.tasks);
    assert.equal(removed.version, l.version);
  } finally {
    const current = await getList(a, l.id);
    await deleteList(a, write(current));
  }
});
