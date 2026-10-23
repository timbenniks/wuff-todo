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
  updateList,
  getListOrder,
  reorderLists,
  listLists,
  removeListMember,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Isolated development only");
const users = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const a = { id: users[0].id, scopes },
  b = { id: users[1].id, scopes };
const op = () => crypto.randomUUID();
const write = (list: { id: string; version: number }) => ({
  listId: list.id,
  version: list.version,
  operationId: op(),
});
after(async () => database().pool.end());
test("favorites are personal, authorized, concurrent and retry safe, without moving lists or tasks", async () => {
  const originals = [await getListOrder(a), await getListOrder(b)];
  const parent = await createList(a, {
    title: "Favorites parent",
    operationId: op(),
  });
  let child = await createList(a, {
    title: "Favorites shared child",
    operationId: op(),
  });
  const privateB = await createList(b, {
    title: "Favorites private",
    operationId: op(),
  });
  try {
    child = await createTask(a, { ...write(child), title: "Favorite task" });
    child = await createTask(a, {
      ...write(child),
      title: "Favorite subtask",
      parentTaskId: child.tasks[0].id,
    });
    await database()
      .db.insert(members)
      .values({ listId: child.id, userId: b.id });
    const before = await getList(a, child.id);
    let order = await getListOrder(a);
    const input = {
      ...order,
      nesting: [{ listId: child.id, parentListId: parent.id }],
      collapsedListIds: [parent.id],
      favoriteListIds: [child.id],
      operationId: op(),
    };
    order = await reorderLists(a, input);
    assert.deepEqual(order.favoriteListIds, [child.id]);
    assert.equal(
      (await listLists(a)).find((l) => l.id === child.id)?.favorite,
      true,
    );
    assert.equal(
      (await listLists(b)).find((l) => l.id === child.id)?.favorite,
      false,
    );
    assert.equal((await reorderLists(a, input)).version, order.version);
    await assert.rejects(
      reorderLists(a, {
        ...input,
        favoriteListIds: [],
        operationId: input.operationId,
      }),
      { code: "idempotency_conflict" },
    );
    await assert.rejects(reorderLists(a, { ...input, operationId: op() }), {
      code: "conflict",
    });
    for (const favoriteListIds of [[child.id, child.id], [privateB.id]])
      await assert.rejects(
        reorderLists(a, { ...order, favoriteListIds, operationId: op() }),
        { code: "invalid_favorites" },
      );
    await assert.rejects(
      reorderLists(
        { ...a, scopes: ["lists:read"] },
        { ...order, favoriteListIds: [], operationId: op() },
      ),
      { code: "forbidden" },
    );
    // Old clients omit favorites entirely; nesting/order edits preserve them.
    order = await reorderLists(a, {
      version: order.version,
      listIds: order.listIds,
      operationId: op(),
    });
    assert.deepEqual(order.favoriteListIds, [child.id]);
    assert.deepEqual(order.nesting, input.nesting);
    assert.deepEqual(order.collapsedListIds, [parent.id]);
    const results = await Promise.allSettled([
      reorderLists(a, { ...order, favoriteListIds: [], operationId: op() }),
      reorderLists(a, { ...order, collapsedListIds: [], operationId: op() }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.deepEqual(await getList(a, child.id), before);
    await reorderLists(b, {
      ...(await getListOrder(b)),
      favoriteListIds: [child.id],
      operationId: op(),
    });
    child = await updateList(a, { ...write(child), archived: true });
    assert.deepEqual((await getListOrder(b)).favoriteListIds, [child.id]);
    assert.equal(
      (await listLists(b)).filter((l) => l.favorite && !l.archived).length,
      0,
    );
    child = await updateList(a, { ...write(child), archived: false });
    assert.equal(
      (await listLists(b)).find((l) => l.id === child.id)?.favorite,
      true,
    );
    await removeListMember(a, { ...write(child), userId: b.id });
    assert.deepEqual((await getListOrder(b)).favoriteListIds, []);
    assert.ok(!(await listLists(b)).some((l) => l.id === child.id));
    await deleteList(a, write(await getList(a, child.id)));
    assert.ok(!(await getListOrder(a)).favoriteListIds.includes(child.id));
  } finally {
    for (const [actor, id] of [
      [a, child.id],
      [a, parent.id],
      [b, privateB.id],
    ] as const)
      try {
        await deleteList(actor, write(await getList(actor, id)));
      } catch (e) {
        if ((e as any).code !== "not_found") throw e;
      }
    for (const [i, actor] of [a, b].entries()) {
      const now = await getListOrder(actor);
      await reorderLists(actor, {
        ...originals[i],
        version: now.version,
        operationId: op(),
      });
    }
  }
});
