import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, members, attachments } from "@wuff/db";
import { eq } from "drizzle-orm";
import { scopes, taskImagePath } from "@wuff/contracts";
import {
  createList,
  getList,
  deleteList,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  createSection,
  deleteSection,
  updateList,
  removeListMember,
  readTaskImage,
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
test("subtasks enforce one level, list isolation, independent completion, sibling order and cascading deletion", async () => {
  let list = await createList(a, {
    title: "Synthetic subtask semantics",
    operationId: crypto.randomUUID(),
  });
  let other = await createList(b, {
    title: "Synthetic foreign parent",
    operationId: crypto.randomUUID(),
  });
  let imageId: string | undefined;
  try {
    list = await createTask(a, { ...write(list), title: "Parent" });
    const parent = list.tasks[0].id;
    list = await createTask(a, { ...write(list), title: "Other root" });
    const root = list.tasks.find((t) => t.id !== parent)!.id;
    other = await createTask(b, { ...write(other), title: "Private parent" });
    for (const parentTaskId of [other.tasks[0].id, crypto.randomUUID()])
      await assert.rejects(
        createTask(a, { ...write(list), title: "Denied link", parentTaskId }),
        { code: "invalid_parent" },
      );
    list = await createSection(a, { ...write(list), title: "Home" });
    const sectionId = list.sections[0].id;
    await assert.rejects(
      createTask(a, {
        ...write(list),
        parentTaskId: parent,
        sectionId,
        title: "Own section denied",
      }),
      { code: "invalid_section" },
    );
    await database()
      .db.insert(members)
      .values({ listId: list.id, userId: b.id });
    const request = {
      ...write(list),
      title: "Step one",
      parentTaskId: parent,
      content: "**Shared** step notes",
    };
    list = await createTask(b, request);
    const first = list.tasks.find((t) => t.parentTaskId === parent)!;
    assert.equal(
      (await createTask(b, request)).tasks.filter(
        (t) => t.parentTaskId === parent,
      ).length,
      1,
    );
    await assert.rejects(
      createTask(b, { ...request, title: "Different retry" }),
      { code: "idempotency_conflict" },
    );
    await assert.rejects(
      createTask(b, {
        ...write(list),
        title: "Grandchild denied",
        parentTaskId: first.id,
      }),
      { code: "invalid_parent" },
    );
    await assert.rejects(
      createTask(
        { ...b, scopes: ["lists:read"] },
        { ...write(list), title: "Read-only denied", parentTaskId: parent },
      ),
      { code: "forbidden" },
    );
    list = await createTask(a, {
      ...write(list),
      parentTaskId: parent,
      title: "Step two",
    });
    const second = list.tasks.find(
      (t) => t.parentTaskId === parent && t.id !== first.id,
    )!;
    list = await updateTask(b, {
      ...write(list),
      taskId: parent,
      completed: true,
      sectionId,
    });
    assert.ok(
      list.tasks
        .filter((t) => t.parentTaskId === parent)
        .every((t) => !t.completed && t.sectionId === null),
    );
    list = await updateTask(b, {
      ...write(list),
      taskId: first.id,
      completed: true,
    });
    const position = list.tasks.find((t) => t.id === first.id)!.position;
    list = await updateTask(b, {
      ...write(list),
      taskId: parent,
      completed: false,
    });
    assert.equal(list.tasks.find((t) => t.id === first.id)!.completed, true);
    list = await updateTask(a, {
      ...write(list),
      taskId: first.id,
      completed: false,
    });
    assert.equal(list.tasks.find((t) => t.id === first.id)!.position, position);
    for (const child of [first, second])
      list = await updateTask(b, {
        ...write(list),
        taskId: child.id,
        completed: true,
      });
    assert.equal(
      list.tasks.find((t) => t.id === parent)!.completed,
      false,
      "Finishing every child does not finish parent",
    );
    await assert.rejects(
      updateTask(b, { ...write(list), taskId: first.id, sectionId }),
      { code: "invalid_section" },
    );
    const childOrder = [second.id, first.id];
    list = await reorderTasks(b, {
      ...write(list),
      parentTaskId: parent,
      taskIds: childOrder,
    });
    assert.deepEqual(
      list.tasks.filter((t) => t.parentTaskId === parent).map((t) => t.id),
      childOrder,
    );
    for (const taskIds of [[first.id], [first.id, first.id], [first.id, root]])
      await assert.rejects(
        reorderTasks(b, { ...write(list), parentTaskId: parent, taskIds }),
        { code: "invalid_order" },
      );
    await assert.rejects(
      reorderTasks(b, { ...write(list), parentTaskId: first.id, taskIds: [] }),
      { code: "invalid_parent" },
    );
    list = await reorderTasks(b, { ...write(list), taskIds: [root, parent] });
    assert.deepEqual(
      list.tasks
        .filter((t) => !t.parentTaskId && !t.completed)
        .map((t) => t.id),
      [root, parent],
    );
    assert.deepEqual(
      list.tasks.filter((t) => t.parentTaskId === parent).map((t) => t.id),
      childOrder,
    );
    list = await deleteSection(a, { ...write(list), sectionId });
    assert.ok(list.tasks.every((t) => t.sectionId === null));
    list = await updateList(a, { ...write(list), archived: true });
    for (const operation of [
      () =>
        createTask(b, {
          ...write(list),
          title: "Archived step",
          parentTaskId: parent,
        }),
      () =>
        updateTask(b, { ...write(list), taskId: first.id, completed: false }),
      () =>
        reorderTasks(b, {
          ...write(list),
          parentTaskId: parent,
          taskIds: childOrder,
        }),
      () => deleteTask(b, { ...write(list), taskId: first.id }),
    ])
      await assert.rejects(operation, { code: "list_archived" });
    list = await updateList(a, { ...write(list), archived: false });
    const races = await Promise.allSettled([
      updateTask(a, {
        ...write(list),
        taskId: first.id,
        title: "Concurrent step",
      }),
      deleteTask(b, { ...write(list), taskId: second.id }),
    ]);
    assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (races.find((r) => r.status === "rejected") as PromiseRejectedResult)
        .reason.code,
      "conflict",
    );
    list = await getList(a, list.id);
    // A synthetic attachment row verifies that cascade leaves the private-byte
    // cleanup record orphaned, rather than an accessible image or lost record.
    imageId = crypto.randomUUID();
    await database()
      .db.insert(attachments)
      .values({
        id: imageId,
        listId: list.id,
        taskId: first.id,
        uploaderId: a.id,
        digest: "synthetic-subtask",
        pathname: `synthetic/${imageId}`,
        bytes: 10,
        width: 1,
        height: 1,
        ready: true,
        attached: true,
      });
    list = await updateTask(a, {
      ...write(list),
      taskId: first.id,
      content: `![Step photo](${taskImagePath(imageId)})`,
    });
    list = await deleteTask(a, { ...write(list), taskId: parent });
    assert.deepEqual(
      list.tasks.map((t) => t.id),
      [root],
    );
    const [image] = await database()
      .db.select()
      .from(attachments)
      .where(eq(attachments.id, imageId));
    assert.equal(image.taskId, null);
    await assert.rejects(readTaskImage(a, imageId), { code: "not_found" });
    await createTask(b, request); // Replaying a receipt never recreates deleted children.
    assert.equal((await getList(a, list.id)).tasks.length, 1);
  } finally {
    if (imageId)
      await database()
        .db.delete(attachments)
        .where(eq(attachments.id, imageId));
    for (const entry of [list, other]) {
      const latest = await getList(entry.id === list.id ? a : b, entry.id);
      await deleteList(entry.id === list.id ? a : b, write(latest));
    }
  }
});
test("revoked members cannot replay a subtask creation receipt or read child notes", async () => {
  let list = await createList(a, {
    title: "Synthetic subtask revocation",
    operationId: crypto.randomUUID(),
  });
  try {
    list = await createTask(a, { ...write(list), title: "Parent" });
    const parent = list.tasks[0].id;
    await database()
      .db.insert(members)
      .values({ listId: list.id, userId: b.id });
    const request = {
      ...write(list),
      title: "Private step",
      parentTaskId: parent,
      content: "Private notes",
    };
    list = await createTask(b, request);
    await removeListMember(a, { ...write(list), userId: b.id });
    list = await getList(a, list.id);
    await assert.rejects(createTask(b, request), { code: "not_found" });
    await assert.rejects(getList(b, list.id), { code: "not_found" });
    await assert.rejects(
      updateTask(b, {
        ...write(list),
        taskId: list.tasks.find((t) => t.parentTaskId === parent)!.id,
        title: "Denied",
      }),
      { code: "not_found" },
    );
  } finally {
    const latest = await getList(a, list.id);
    await deleteList(a, write(latest));
  }
});
