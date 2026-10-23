import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, members } from "@wuff/db";
import { scopes, sidebarGroups } from "@wuff/contracts";
import {
  createList,
  getList,
  deleteList,
  updateList,
  createTask,
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
test("one-level personal nesting preserves tasks, permissions, revisions and retry safety", async () => {
  const originalA = await getListOrder(a),
    originalB = await getListOrder(b);
  const parent = await createList(a, {
    title: "Nesting parent",
    operationId: op(),
  });
  let child = await createList(a, {
    title: "Nesting child",
    operationId: op(),
  });
  const other = await createList(a, {
    title: "Nesting other",
    operationId: op(),
  });
  const privateB = await createList(b, {
    title: "Nesting private",
    operationId: op(),
  });
  try {
    await database()
      .db.insert(members)
      .values([
        { listId: child.id, userId: b.id },
        { listId: parent.id, userId: b.id },
      ]);
    child = await createTask(a, { ...write(child), title: "Repot monstera" });
    child = await createTask(a, {
      ...write(child),
      title: "Prepare soil",
      parentTaskId: child.tasks[0].id,
    });
    const beforeTasks = child.tasks,
      childVersion = child.version;
    let order = await getListOrder(a);
    const input = {
      ...order,
      nesting: [{ listId: child.id, parentListId: parent.id }],
      collapsedListIds: [parent.id],
      operationId: op(),
    };
    const saved = await reorderLists(a, input);
    assert.deepEqual(saved.nesting, input.nesting);
    assert.deepEqual((await getListOrder(b)).nesting, originalB.nesting);
    assert.equal(
      (await listLists(a)).find((l) => l.id === child.id)?.parentListId,
      parent.id,
    );
    assert.equal(
      (await listLists(b)).find((l) => l.id === child.id)?.parentListId,
      null,
    );
    assert.equal((await reorderLists(a, input)).version, saved.version);
    await assert.rejects(
      reorderLists(a, {
        ...input,
        collapsedListIds: [],
        operationId: input.operationId,
      }),
      { code: "idempotency_conflict" },
    );
    await assert.rejects(reorderLists(a, { ...input, operationId: op() }), {
      code: "conflict",
    });
    for (const nesting of [
      [{ listId: child.id, parentListId: child.id }],
      [
        { listId: child.id, parentListId: parent.id },
        { listId: parent.id, parentListId: child.id },
      ],
      [
        { listId: child.id, parentListId: parent.id },
        { listId: other.id, parentListId: child.id },
      ],
      [
        { listId: child.id, parentListId: parent.id },
        { listId: child.id, parentListId: other.id },
      ],
      [{ listId: child.id, parentListId: privateB.id }],
    ])
      await assert.rejects(
        reorderLists(a, { ...saved, nesting, operationId: op() }),
        { code: "invalid_nesting" },
      );
    await assert.rejects(
      reorderLists(
        { ...a, scopes: ["lists:read"] },
        { ...saved, operationId: op() },
      ),
      { code: "forbidden" },
    );
    const preserved = await reorderLists(a, {
      listIds: saved.listIds,
      version: saved.version,
      operationId: op(),
    });
    assert.deepEqual(
      preserved.nesting,
      input.nesting,
      "legacy reorder preserves hierarchy",
    );
    const concurrent = await Promise.allSettled(
      [[], [parent.id]].map((collapsedListIds) =>
        reorderLists(a, { ...preserved, collapsedListIds, operationId: op() }),
      ),
    );
    assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
    const reread = await getList(a, child.id);
    assert.deepEqual(reread.tasks, beforeTasks);
    assert.equal(reread.version, childVersion);
    assert.deepEqual((await getList(a, parent.id)).tasks, []);
    // A shared-list editor can organize their own navigation without changing the owner.
    order = await getListOrder(b);
    await reorderLists(b, {
      ...order,
      nesting: [{ listId: child.id, parentListId: parent.id }],
      operationId: op(),
    });
    await updateList(a, { ...write(parent), archived: true });
    assert.ok(
      sidebarGroups(await listLists(a), false).some(
        (g) => g.list.id === child.id,
      ),
    );
    let currentParent = await getList(a, parent.id);
    await updateList(a, { ...write(currentParent), archived: false });
    await removeListMember(a, {
      ...write(await getList(a, parent.id)),
      userId: b.id,
    });
    assert.deepEqual((await getListOrder(b)).nesting, []);
    assert.ok(!(await getListOrder(b)).listIds.includes(parent.id));
    assert.ok(
      sidebarGroups(await listLists(b), false).some(
        (g) => g.list.id === child.id,
      ),
    );
    await deleteList(a, write(await getList(a, parent.id)));
    assert.deepEqual(
      (await getList(a, child.id)).tasks,
      beforeTasks,
      "parent deletion cannot cascade to child list",
    );
    assert.deepEqual((await getListOrder(a)).nesting, []);
  } finally {
    for (const [actor, id] of [
      [a, parent.id],
      [a, child.id],
      [a, other.id],
      [b, privateB.id],
    ] as const) {
      try {
        await deleteList(actor, write(await getList(actor, id)));
      } catch (e) {
        if ((e as { code?: string }).code !== "not_found") throw e;
      }
    }
    for (const [actor, old] of [
      [a, originalA],
      [b, originalB],
    ] as const) {
      const now = await getListOrder(actor);
      await reorderLists(actor, {
        ...old,
        version: now.version,
        listIds: [
          ...old.listIds.filter((id) => now.listIds.includes(id)),
          ...now.listIds.filter((id) => !old.listIds.includes(id)),
        ],
        operationId: op(),
      });
    }
  }
});

test("authenticated web, MCP and native adapters share personal hierarchy and enforce scope/origin boundaries", async () => {
  const { loginFixture } = await import("./helpers/login");
  const { createHash, randomBytes } = await import("node:crypto");
  const { tauriClientId, tauriRedirectUri } = await import("@wuff/contracts");
  const origin = "http://localhost:3000";
  const cookie = await loginFixture(users[0]);
  const headers = {
    Origin: origin,
    Cookie: cookie,
    "Content-Type": "application/json",
  };
  const tokens: { access_token: string; clientId: string }[] = [];
  const old = await getListOrder(a);
  const parent = await createList(a, {
    title: "Adapter parent",
    operationId: op(),
  });
  const child = await createList(a, {
    title: "Adapter child",
    operationId: op(),
  });
  async function grant(native: boolean, scope = "lists:read lists:manage") {
    const resource = origin + (native ? "/api/mobile" : "/api/mcp");
    let clientId = tauriClientId,
      redirectUri = tauriRedirectUri;
    if (native)
      assert.equal((await fetch(origin + "/oauth/tauri")).status, 200);
    else {
      const registered = await fetch(origin + "/oauth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Nesting integration",
          redirect_uris: ["http://127.0.0.1:4173/callback"],
        }),
      });
      assert.equal(registered.status, 201);
      const value = await registered.json();
      clientId = value.client_id;
      redirectUri = value.redirect_uris[0];
    }
    const verifier = randomBytes(32).toString("base64url");
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      state: randomBytes(16).toString("hex"),
      scope,
      resource,
    });
    const decision = await fetch(origin + "/oauth/authorize/decision", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: query.toString(), accept: true }),
    });
    assert.equal(decision.status, 200);
    const redirect = new URL((await decision.json()).redirect);
    const exchange = await fetch(origin + "/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirectUri,
        code: redirect.searchParams.get("code")!,
        code_verifier: verifier,
        resource,
      }),
    });
    assert.equal(exchange.status, 200);
    const token = await exchange.json();
    tokens.push({ ...token, clientId });
    return token.access_token as string;
  }
  let rpc = 0;
  async function mcp(token: string, name: string, args: unknown) {
    const response = await fetch(origin + "/api/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++rpc,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).result;
  }
  async function native(token: string, action: string, input?: unknown) {
    return fetch(origin + "/api/mobile", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, input, userId: a.id }),
    });
  }
  try {
    let order = await getListOrder(a);
    const input = {
      ...order,
      nesting: [{ listId: child.id, parentListId: parent.id }],
      operationId: op(),
    };
    let response = await fetch(origin + "/api/v1/list-order", {
      method: "PUT",
      headers,
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 200);
    order = await response.json();
    assert.deepEqual(order.nesting, input.nesting);
    assert.equal(
      (
        await fetch(origin + "/api/v1/list-order", {
          method: "PUT",
          headers,
          body: JSON.stringify({ ...input, operationId: op() }),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await fetch(origin + "/api/v1/list-order", {
          method: "PUT",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ ...order, operationId: op() }),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(origin + "/api/v1/list-order", {
          headers: { Cookie: cookie, "X-Wuff-User": b.id },
        })
      ).status,
      409,
    );
    const token = await grant(false);
    let result = await mcp(token, "get_list_order", {});
    assert.deepEqual(result.structuredContent.order.nesting, input.nesting);
    result = await mcp(token, "reorder_lists", {
      ...order,
      collapsedListIds: [parent.id],
      operationId: op(),
    });
    assert.ok(!result.isError);
    order = result.structuredContent.order;
    const nativeToken = await grant(true);
    response = await native(nativeToken, "getListOrder");
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).collapsedListIds, [parent.id]);
    response = await native(nativeToken, "reorderLists", {
      ...order,
      nesting: [],
      operationId: op(),
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).nesting, []);
    const readToken = await grant(false, "lists:read");
    const denied = await mcp(readToken, "reorder_lists", {
      ...(await getListOrder(a)),
      nesting: input.nesting,
      operationId: op(),
    });
    assert.equal(denied.isError, true);
    assert.equal(
      (await native(token, "getListOrder")).status,
      401,
      "MCP token cannot authorize native calls",
    );
    response = await fetch(origin + "/api/v1/lists", {
      headers: { Cookie: cookie },
    });
    assert.equal(response.status, 200);
    assert.equal(
      (await response.json()).find(
        (list: { id: string }) => list.id === child.id,
      ).parentListId,
      null,
    );
  } finally {
    for (const token of tokens)
      await fetch(origin + "/oauth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: token.access_token,
          client_id: token.clientId,
        }),
      });
    for (const id of [child.id, parent.id])
      await deleteList(a, write(await getList(a, id)));
    const now = await getListOrder(a);
    await reorderLists(a, { ...old, version: now.version, operationId: op() });
  }
});
