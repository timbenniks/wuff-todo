import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, members } from "@wuff/db";
import { scopes } from "@wuff/contracts";
import {
  createList,
  getList,
  deleteList,
  createTask,
  updateTask,
  updateList,
  removeListMember,
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
test("task Markdown stays private, shared, retry safe and protected against stale/archived edits", async () => {
  let list = await createList(a, {
    title: "Synthetic Markdown notes",
    operationId: crypto.randomUUID(),
  });
  const other = await createList(a, {
    title: "Synthetic other notes",
    operationId: crypto.randomUUID(),
  });
  try {
    list = await createTask(a, {
      ...write(list),
      title: "Notes default empty",
    });
    assert.equal(list.tasks[0].content, "");
    const first = list.tasks[0].id;
    await database()
      .db.insert(members)
      .values({ listId: list.id, userId: b.id });
    const content =
      "## Plan\n\n**Bold** and *italic*.\n\n- [ ] Fetch treats\n\n```js\nconst x = '<img>';\n```";
    const request = { ...write(list), taskId: first, content };
    list = await updateTask(b, request);
    assert.equal((await updateTask(b, request)).version, list.version);
    assert.equal((await getList(a, list.id)).tasks[0].content, content);
    await assert.rejects(
      updateTask(b, { ...request, operationId: crypto.randomUUID() }),
      { code: "conflict" },
    );
    await assert.rejects(updateTask(b, { ...request, content: "Different" }), {
      code: "idempotency_conflict",
    });
    await assert.rejects(
      updateTask(
        { ...b, scopes: ["lists:read"] },
        { ...write(list), taskId: first, content: "Denied" },
      ),
      { code: "forbidden" },
    );
    await assert.rejects(
      updateTask(outsider, {
        ...write(list),
        taskId: first,
        content: "Denied",
      }),
      { code: "invite_required" },
    );
    await assert.rejects(
      updateTask(a, {
        ...write(other),
        taskId: first,
        content: "Cross-list denied",
      }),
      { code: "not_found" },
    );
    const results = await Promise.allSettled(
      ["Left draft", "Right draft"].map((content) =>
        updateTask(b, { ...write(list), taskId: first, content }),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    list = await getList(a, list.id);
    list = await updateTask(a, {
      ...write(list),
      taskId: first,
      content: "",
      completed: true,
    });
    assert.equal(list.tasks[0].content, "");
    list = await updateTask(b, {
      ...write(list),
      taskId: first,
      content: "Completed notes still editable",
    });
    list = await updateList(a, { ...write(list), archived: true });
    await assert.rejects(
      updateTask(b, {
        ...write(list),
        taskId: first,
        content: "Archived denied",
      }),
      { code: "list_archived" },
    );
    assert.equal(
      (await getList(b, list.id)).tasks[0].content,
      "Completed notes still editable",
    );
    list = await updateList(a, { ...write(list), archived: false });
    await removeListMember(a, { ...write(list), userId: b.id });
    list = await getList(a, list.id);
    await assert.rejects(getList(b, list.id), { code: "not_found" });
    await assert.rejects(updateTask(b, request), { code: "not_found" });
  } finally {
    await deleteList(a, write(await getList(a, list.id)));
    await deleteList(a, write(await getList(a, other.id)));
  }
});
