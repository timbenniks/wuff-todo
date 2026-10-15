import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { database, members, users } from "@wuff/db";
import { scopes } from "@wuff/contracts";
import {
  createList,
  createTask,
  deleteList,
  getList,
  listLists,
  renameList,
  reorderTasks,
  updateTask,
} from "@wuff/domain";

if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw new Error(
    "Integration tests require the isolated development database.",
  );
const fixtures = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const a = { id: fixtures[0].id, scopes },
  b = { id: fixtures[1].id, scopes },
  outsider = { id: fixtures[2].id, scopes };
const operationId = () => crypto.randomUUID();
after(async () => {
  await database().pool.end();
});
test("private lists, shared task writes, owner-only management, and revocation", async () => {
  let list = await createList(a, {
    title: "Permission proof",
    operationId: operationId(),
  });
  try {
    assert.ok((await listLists(a)).some((item) => item.id === list.id));
    assert.ok(!(await listLists(b)).some((item) => item.id === list.id));
    await assert.rejects(getList(b, list.id), { code: "not_found" });
    await assert.rejects(listLists(outsider), { code: "invite_required" });
    await database()
      .db.insert(members)
      .values({ listId: list.id, userId: b.id });
    list = await createTask(b, {
      listId: list.id,
      version: list.version,
      title: "Shared task",
      operationId: operationId(),
    });
    await assert.rejects(
      renameList(b, {
        listId: list.id,
        version: list.version,
        title: "Stolen",
        operationId: operationId(),
      }),
      { code: "owner_required" },
    );
    await assert.rejects(
      deleteList(b, {
        listId: list.id,
        version: list.version,
        operationId: operationId(),
      }),
      { code: "owner_required" },
    );
    await database().db.delete(members).where(eq(members.listId, list.id));
    await assert.rejects(getList(b, list.id), { code: "not_found" });
    await assert.rejects(
      createTask(b, {
        listId: list.id,
        version: list.version,
        title: "Denied",
        operationId: operationId(),
      }),
      { code: "not_found" },
    );
  } finally {
    const current = await getList(a, list.id);
    await deleteList(a, {
      listId: list.id,
      version: current.version,
      operationId: operationId(),
    });
  }
});
test("identical retries create once and different input with same key conflicts", async () => {
  const input = { title: "Retry proof", operationId: operationId() };
  const [first, second] = await Promise.all([
    createList(a, input),
    createList(a, input),
  ]);
  assert.equal(first.id, second.id);
  try {
    await assert.rejects(createList(a, { ...input, title: "Different" }), {
      code: "idempotency_conflict",
    });
    const taskInput = {
      listId: first.id,
      version: first.version,
      title: "One task",
      operationId: operationId(),
    };
    await Promise.all([createTask(a, taskInput), createTask(a, taskInput)]);
    assert.equal((await getList(a, first.id)).tasks.length, 1);
  } finally {
    const current = await getList(a, first.id);
    await deleteList(a, {
      listId: first.id,
      version: current.version,
      operationId: operationId(),
    });
  }
});
test("concurrent writes reject stale versions and ordering survives completion/reopening", async () => {
  let list = await createList(a, {
    title: "Ordering proof",
    operationId: operationId(),
  });
  try {
    const attempts = await Promise.allSettled(
      ["First", "Second"].map((title) =>
        createTask(a, {
          listId: list.id,
          version: 0,
          title,
          operationId: operationId(),
        }),
      ),
    );
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((r) => r.status === "rejected").length, 1);
    list = await getList(a, list.id);
    list = await createTask(a, {
      listId: list.id,
      version: list.version,
      title: "Another",
      operationId: operationId(),
    });
    const ids = list.tasks.map((t) => t.id).reverse();
    list = await reorderTasks(a, {
      listId: list.id,
      version: list.version,
      taskIds: ids,
      operationId: operationId(),
    });
    assert.deepEqual(
      list.tasks.map((t) => t.id),
      ids,
    );
    await assert.rejects(
      reorderTasks(a, {
        listId: list.id,
        version: list.version,
        taskIds: [ids[0], ids[0]],
        operationId: operationId(),
      }),
      { code: "invalid_order" },
    );
    list = await updateTask(a, {
      listId: list.id,
      version: list.version,
      taskId: ids[0],
      completed: true,
      operationId: operationId(),
    });
    list = await updateTask(a, {
      listId: list.id,
      version: list.version,
      taskId: ids[0],
      completed: false,
      operationId: operationId(),
    });
    assert.equal(list.tasks.at(-1)!.id, ids[0]);
    await assert.rejects(
      createTask(
        { id: a.id, scopes: ["lists:read"] },
        {
          listId: list.id,
          version: list.version,
          title: "Forbidden",
          operationId: operationId(),
        },
      ),
      { code: "forbidden" },
    );
  } finally {
    const current = await getList(a, list.id);
    await deleteList(a, {
      listId: list.id,
      version: current.version,
      operationId: operationId(),
    });
  }
});
test("disabled users lose access", async () => {
  await database()
    .db.update(users)
    .set({ enabled: false })
    .where(eq(users.id, b.id));
  try {
    await assert.rejects(listLists(b), { code: "invite_required" });
  } finally {
    await database()
      .db.update(users)
      .set({ enabled: true })
      .where(eq(users.id, b.id));
  }
});
