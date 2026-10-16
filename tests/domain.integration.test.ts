import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { database, invitations, members, users } from "@wuff/db";
import { scopes } from "@wuff/contracts";
import {
  createList,
  inviteToList,
  listInvitations,
  getListSharing,
  respondToInvitation,
  cancelInvitation,
  removeListMember,
  leaveList,
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
  const id = "domain-disabled-fixture";
  await database()
    .db.insert(users)
    .values({
      id,
      email: `${id}@example.invalid`,
      name: "Disabled domain fixture",
      enabled: false,
    })
    .onConflictDoNothing();
  await assert.rejects(listLists({ id, scopes }), { code: "invite_required" });
});

test("identity-bound invitations: expiry, decline, cancellation, acceptance, and retries", async () => {
  const list = await createList(a, {
    title: "Sharing lifecycle proof",
    operationId: operationId(),
  });
  const input = () => ({
    listId: list.id,
    version: 0,
    operationId: operationId(),
  });
  try {
    await assert.rejects(getListSharing(b, list.id), { code: "not_found" });
    await assert.rejects(
      inviteToList(a, { ...input(), email: "missing@example.invalid" }),
      { code: "unavailable_recipient" },
    );
    await assert.rejects(
      inviteToList(a, { ...input(), email: fixtures[2].email }),
      { code: "unavailable_recipient" },
    );
    await assert.rejects(
      inviteToList(a, { ...input(), email: fixtures[0].email }),
      { code: "already_member" },
    );
    const request = {
      ...input(),
      email: `  ${fixtures[1].email.toUpperCase()}  `,
    };
    let sharing = await inviteToList(a, request);
    assert.equal(sharing.invitations.length, 1);
    assert.equal(
      (await inviteToList(a, request)).version,
      sharing.version,
      "identical retry does not mutate",
    );
    const firstId = sharing.invitations[0].id;
    assert.ok((await listInvitations(b)).some((i) => i.id === firstId));
    assert.ok(!(await listInvitations(a)).some((i) => i.id === firstId));
    assert.ok(!(await listLists(b)).some((i) => i.id === list.id));
    await assert.rejects(getList(b, list.id), { code: "not_found" });
    await assert.rejects(
      respondToInvitation(a, {
        invitationId: firstId,
        accept: true,
        operationId: operationId(),
      }),
      { code: "not_found" },
    );
    await assert.rejects(
      respondToInvitation(outsider, {
        invitationId: firstId,
        accept: true,
        operationId: operationId(),
      }),
      { code: "invite_required" },
    );
    sharing = await inviteToList(a, {
      ...input(),
      version: sharing.version,
      email: fixtures[1].email,
    });
    assert.equal(
      sharing.invitations.length,
      1,
      "separate invite requests cannot create duplicate pending invitations",
    );
    await database()
      .db.update(invitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitations.id, firstId));
    assert.ok(!(await listInvitations(b)).some((i) => i.id === firstId));
    await assert.rejects(
      respondToInvitation(b, {
        invitationId: firstId,
        accept: true,
        operationId: operationId(),
      }),
      { code: "invitation_closed" },
    );
    sharing = await inviteToList(a, {
      ...input(),
      version: sharing.version,
      email: fixtures[1].email,
    });
    const declined = {
      invitationId: sharing.invitations[0].id,
      accept: false,
      operationId: operationId(),
    };
    await respondToInvitation(b, declined);
    await respondToInvitation(b, declined);
    await assert.rejects(
      respondToInvitation(b, {
        ...declined,
        accept: true,
        operationId: operationId(),
      }),
      { code: "invitation_closed" },
    );
    sharing = await getListSharing(a, list.id);
    sharing = await inviteToList(a, {
      ...input(),
      version: sharing.version,
      email: fixtures[1].email,
    });
    const canceledId = sharing.invitations[0].id;
    const cancel = {
      ...input(),
      version: sharing.version,
      invitationId: canceledId,
    };
    await cancelInvitation(a, cancel);
    sharing = await cancelInvitation(a, cancel);
    assert.equal(sharing.invitations.length, 0);
    await assert.rejects(
      respondToInvitation(b, {
        invitationId: canceledId,
        accept: true,
        operationId: operationId(),
      }),
      { code: "invitation_closed" },
    );
    sharing = await inviteToList(a, {
      ...input(),
      version: sharing.version,
      email: fixtures[1].email,
    });
    const accepted = {
      invitationId: sharing.invitations[0].id,
      accept: true,
      operationId: operationId(),
    };
    const results = await Promise.all([
      respondToInvitation(b, accepted),
      respondToInvitation(b, accepted),
    ]);
    assert.ok(results.every((r) => r.accepted));
    assert.equal(
      (
        await database()
          .db.select()
          .from(members)
          .where(and(eq(members.listId, list.id), eq(members.userId, b.id)))
      ).length,
      1,
    );
    assert.equal((await getListSharing(b, list.id)).owner.id, a.id);
    assert.ok((await listLists(b)).some((i) => i.id === list.id));
    sharing = await getListSharing(a, list.id);
    await assert.rejects(
      inviteToList(b, {
        ...input(),
        version: sharing.version,
        email: fixtures[0].email,
      }),
      { code: "owner_required" },
    );
    await assert.rejects(
      removeListMember(b, {
        ...input(),
        version: sharing.version,
        userId: a.id,
      }),
      { code: "owner_required" },
    );
    await assert.rejects(
      inviteToList(a, {
        ...input(),
        version: sharing.version,
        email: fixtures[1].email,
      }),
      { code: "already_member" },
    );
    await assert.rejects(
      leaveList(a, { ...input(), version: sharing.version }),
      { code: "owner_required" },
    );
    await assert.rejects(
      removeListMember(a, {
        ...input(),
        version: sharing.version,
        userId: a.id,
      }),
      { code: "owner_required" },
    );
    const revoke = { ...input(), version: sharing.version, userId: b.id };
    sharing = await removeListMember(a, revoke);
    await removeListMember(a, revoke);
    await assert.rejects(getList(b, list.id), { code: "not_found" });
    await assert.rejects(respondToInvitation(b, accepted), {
      code: "not_found",
    });
    await assert.rejects(
      respondToInvitation(b, { ...accepted, operationId: operationId() }),
      { code: "invitation_closed" },
    );
    assert.equal(
      (
        await database()
          .db.select()
          .from(members)
          .where(eq(members.listId, list.id))
      ).length,
      0,
      "acceptance retries never restore revoked access",
    );
    sharing = await inviteToList(a, {
      ...input(),
      version: sharing.version,
      email: fixtures[1].email,
    });
    await respondToInvitation(b, {
      invitationId: sharing.invitations[0].id,
      accept: true,
      operationId: operationId(),
    });
    const current = await getList(b, list.id);
    const leave = { ...input(), version: current.version };
    await leaveList(b, leave);
    await leaveList(b, leave);
    await assert.rejects(getList(b, list.id), { code: "not_found" });
  } finally {
    const current = await getList(a, list.id);
    await deleteList(a, {
      listId: list.id,
      version: current.version,
      operationId: operationId(),
    });
  }
});

test("concurrent invitation cancellation, acceptance, and task/revocation preserve access boundaries", async () => {
  const list = await createList(a, {
    title: "Sharing concurrency proof",
    operationId: operationId(),
  });
  try {
    let sharing = await inviteToList(a, {
      listId: list.id,
      version: list.version,
      email: fixtures[1].email,
      operationId: operationId(),
    });
    const accept = {
      invitationId: sharing.invitations[0].id,
      accept: true,
      operationId: operationId(),
    };
    const race = await Promise.allSettled([
      cancelInvitation(a, {
        listId: list.id,
        version: sharing.version,
        invitationId: accept.invitationId,
        operationId: operationId(),
      }),
      respondToInvitation(b, accept),
    ]);
    assert.equal(
      race.filter((r) => r.status === "fulfilled").length,
      1,
      "cancel and accept cannot both commit",
    );
    sharing = await getListSharing(a, list.id);
    if (!sharing.members.length) {
      sharing = await inviteToList(a, {
        listId: list.id,
        version: sharing.version,
        email: fixtures[1].email,
        operationId: operationId(),
      });
      await respondToInvitation(b, {
        ...accept,
        invitationId: sharing.invitations[0].id,
        operationId: operationId(),
      });
    }
    sharing = await getListSharing(a, list.id);
    const write = {
      listId: list.id,
      version: sharing.version,
      title: "Racing edit",
      operationId: operationId(),
    };
    const writes = await Promise.allSettled([
      createTask(b, write),
      removeListMember(a, {
        listId: list.id,
        version: sharing.version,
        userId: b.id,
        operationId: operationId(),
      }),
    ]);
    assert.equal(
      writes.filter((r) => r.status === "fulfilled").length,
      1,
      "version and row lock serialize edit versus revocation",
    );
    sharing = await getListSharing(a, list.id);
    if (sharing.members.length)
      await removeListMember(a, {
        listId: list.id,
        version: sharing.version,
        userId: b.id,
        operationId: operationId(),
      });
    await assert.rejects(
      createTask(b, write),
      { code: "not_found" },
      "even a successful write receipt cannot expose revoked data",
    );
    await assert.rejects(getList(b, list.id), { code: "not_found" });
    const readOnly = { id: a.id, scopes: ["lists:read"] };
    sharing = await getListSharing(a, list.id);
    await assert.rejects(
      inviteToList(readOnly, {
        listId: list.id,
        version: sharing.version,
        email: fixtures[1].email,
        operationId: operationId(),
      }),
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
