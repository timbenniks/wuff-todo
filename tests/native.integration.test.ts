import { test } from "node:test";
import {
  createRealtimeClient,
  waitForLive,
  disconnectLiveConnections,
} from "./helpers/live";
import type { LiveLists } from "../apps/web/src/lib/live-types";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loginFixture } from "./helpers/login";
import {
  nativeClientId,
  nativeRedirectUri,
} from "../apps/web/src/lib/native-policy";
import {
  tauriClientId,
  tauriRedirectUri,
  type TodoList,
} from "@wuff/contracts";
import { database } from "@wuff/db";
const origin = "http://localhost:3000",
  resource = origin + "/api/mobile";
const users = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const form = { "Content-Type": "application/x-www-form-urlencoded" };
async function mobile(token: string, action: string, input?: unknown) {
  return fetch(resource, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, input }),
  });
}
async function grant(
  cookie: string,
  scopes = "lists:read tasks:write lists:manage",
  identity = {
    clientId: nativeClientId,
    redirectUri: nativeRedirectUri,
    path: "/oauth/native",
  },
) {
  assert.equal((await fetch(origin + identity.path)).status, 200);
  const verifier = randomBytes(32).toString("base64url");
  const query = new URLSearchParams({
    client_id: identity.clientId,
    redirect_uri: identity.redirectUri,
    response_type: "code",
    code_challenge_method: "S256",
    state: randomBytes(16).toString("hex"),
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    resource,
    scope: scopes,
  });
  const response = await fetch(origin + "/oauth/authorize/decision", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: query.toString(), accept: true }),
  });
  assert.equal(
    response.status,
    200,
    "Native consent succeeds for an admitted identity",
  );
  const redirect = new URL((await response.json()).redirect);
  assert.equal(redirect.origin, "null");
  assert.equal(redirect.protocol, new URL(identity.redirectUri).protocol);
  assert.equal(redirect.searchParams.get("iss"), origin);
  const exchange = {
    grant_type: "authorization_code",
    client_id: identity.clientId,
    code: redirect.searchParams.get("code")!,
    redirect_uri: identity.redirectUri,
    code_verifier: verifier,
    resource,
  };
  const wrong = await fetch(origin + "/oauth/token", {
    method: "POST",
    headers: form,
    body: new URLSearchParams({ ...exchange, resource: origin + "/api/mcp" }),
  });
  assert.ok(
    wrong.status >= 400,
    "Native code cannot be exchanged for MCP tokens",
  );
  const wrongDecision = await fetch(origin + "/oauth/authorize/decision", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: query.toString(), accept: true }),
  });
  assert.equal(wrongDecision.status, 200);
  const wrongCode = new URL(
    (await wrongDecision.json()).redirect,
  ).searchParams.get("code")!;
  const wrongVerifier = await fetch(origin + "/oauth/token", {
    method: "POST",
    headers: form,
    body: new URLSearchParams({
      ...exchange,
      code: wrongCode,
      code_verifier: randomBytes(32).toString("base64url"),
    }),
  });
  assert.ok(wrongVerifier.status >= 400, "Wrong PKCE verifier is rejected");
  const result = await fetch(origin + "/oauth/token", {
    method: "POST",
    headers: form,
    body: new URLSearchParams(exchange),
  });
  assert.equal(result.status, 200);
  const token = await result.json();
  const replay = await fetch(origin + "/oauth/token", {
    method: "POST",
    headers: form,
    body: new URLSearchParams(exchange),
  });
  assert.ok(replay.status >= 400, "Authorization code is single-use");
  return token as {
    access_token: string;
    refresh_token: string;
    scope: string;
  };
}
async function revoke(refreshToken: string, clientId = nativeClientId) {
  return fetch(origin + "/oauth/revoke", {
    method: "POST",
    headers: form,
    body: new URLSearchParams({
      client_id: clientId,
      token: refreshToken,
    }),
  });
}

test("native PKCE, audience isolation, task retries/conflicts, membership revocation and refresh", async () => {
  const cookie = await loginFixture(users[0]);
  assert.equal(
    (
      await fetch(resource, {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "listLists" }),
      })
    ).status,
    401,
    "A website cookie cannot authorize the native endpoint",
  );
  const [owner, editor] = await Promise.all([
    grant(cookie),
    loginFixture(users[1]).then((c) => grant(c)),
  ]);
  let list: TodoList | undefined,
    latestRefresh = owner.refresh_token;
  try {
    assert.equal(
      (
        await fetch(origin + "/api/mcp", {
          headers: { Authorization: `Bearer ${owner.access_token}` },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(origin + "/api/v1/lists", {
          headers: { Authorization: `Bearer ${owner.access_token}` },
        })
      ).status,
      401,
    );
    const created = await mobile(owner.access_token, "createList", {
      title: "Native synthetic verification",
      operationId: crypto.randomUUID(),
    });
    assert.equal(created.status, 200);
    list = await created.json();
    const add = {
      listId: list!.id,
      version: list!.version,
      title: "Native task",
      operationId: crypto.randomUUID(),
    };
    assert.equal(
      (await mobile(owner.access_token, "createTask", add)).status,
      200,
    );
    assert.equal(
      (await mobile(owner.access_token, "createTask", add)).status,
      200,
    );
    list = await (await mobile(owner.access_token, "getList", list!.id)).json();
    assert.equal(list!.tasks.length, 1);
    assert.equal(
      (
        await mobile(owner.access_token, "updateTask", {
          ...add,
          taskId: list!.tasks[0].id,
          completed: true,
          operationId: crypto.randomUUID(),
        })
      ).status,
      409,
    );
    assert.equal(
      (await mobile(editor.access_token, "getList", list!.id)).status,
      404,
      "Private list is isolated",
    );
    assert.equal(
      (
        await mobile(owner.access_token, "inviteToList", {
          listId: list!.id,
          version: list!.version,
          email: users[1].email,
          operationId: crypto.randomUUID(),
        })
      ).status,
      200,
    );
    const inbox = await (
      await mobile(editor.access_token, "listInvitations")
    ).json();
    const invitation = inbox.find(
      (i: { listId: string }) => i.listId === list!.id,
    );
    assert.ok(invitation);
    assert.equal(
      (
        await mobile(editor.access_token, "respondToInvitation", {
          invitationId: invitation.id,
          accept: true,
          operationId: crypto.randomUUID(),
        })
      ).status,
      200,
    );
    list = await (
      await mobile(editor.access_token, "getList", list!.id)
    ).json();
    assert.equal(
      (
        await mobile(editor.access_token, "updateList", {
          listId: list!.id,
          version: list!.version,
          title: "Denied",
          operationId: crypto.randomUUID(),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await mobile(editor.access_token, "updateTask", {
          listId: list!.id,
          version: list!.version,
          taskId: list!.tasks[0].id,
          completed: true,
          operationId: crypto.randomUUID(),
        })
      ).status,
      200,
    );
    list = await (await mobile(owner.access_token, "getList", list!.id)).json();
    const session = await (await mobile(editor.access_token, "session")).json();
    assert.equal(
      (
        await mobile(owner.access_token, "removeListMember", {
          listId: list!.id,
          version: list!.version,
          userId: session.userId,
          operationId: crypto.randomUUID(),
        })
      ).status,
      200,
    );
    assert.equal(
      (await mobile(editor.access_token, "getList", list!.id)).status,
      404,
    );
    const renewed = await fetch(origin + "/oauth/token", {
      method: "POST",
      headers: form,
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: owner.refresh_token,
        client_id: nativeClientId,
        resource,
      }),
    });
    assert.equal(renewed.status, 200);
    const rotated = await renewed.json();
    latestRefresh = rotated.refresh_token;
    assert.equal(
      (await mobile(owner.access_token, "listLists")).status,
      401,
      "Rotation revokes the previous access token",
    );
    owner.access_token = rotated.access_token;
    const replayRefresh = await fetch(origin + "/oauth/token", {
      method: "POST",
      headers: form,
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: owner.refresh_token,
        client_id: nativeClientId,
        resource,
      }),
    });
    assert.ok(replayRefresh.status >= 400);
  } finally {
    if (list) {
      const response = await mobile(owner.access_token, "getList", list.id);
      if (response.ok) {
        const latest = await response.json();
        assert.equal(
          (
            await mobile(owner.access_token, "deleteList", {
              listId: list.id,
              version: latest.version,
              operationId: crypto.randomUUID(),
            })
          ).status,
          200,
        );
        assert.equal(
          (await mobile(owner.access_token, "getList", list.id)).status,
          404,
        );
      }
    }
    await revoke(latestRefresh);
    await revoke(editor.refresh_token);
    assert.equal((await mobile(owner.access_token, "listLists")).status, 401);
  }
});

test("native read-only grants cannot write; GitHub scope requires fresh explicit consent", async () => {
  const cookie = await loginFixture(users[0]);
  const reader = await grant(cookie, "lists:read");
  try {
    assert.equal((await mobile(reader.access_token, "listLists")).status, 200);
    assert.equal(
      (
        await mobile(reader.access_token, "createList", {
          title: "Denied",
          operationId: crypto.randomUUID(),
        })
      ).status,
      403,
    );
    const query = new URLSearchParams({
      client_id: nativeClientId,
      redirect_uri: nativeRedirectUri,
      response_type: "code",
      code_challenge_method: "S256",
      code_challenge: "a".repeat(43),
      state: "synthetic",
      resource,
      scope: "lists:read admin:all",
    });
    const denied = await fetch(origin + "/oauth/authorize/decision", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: query.toString(), accept: true }),
    });
    assert.equal(denied.status, 400);
    const escalation = await fetch(origin + "/oauth/token", {
      method: "POST",
      headers: form,
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: nativeClientId,
        refresh_token: reader.refresh_token,
        resource,
        scope: "lists:read github:manage",
      }),
    });
    assert.equal(
      escalation.status,
      400,
      "Refresh must not add an unconsented GitHub scope",
    );
    const basic = await grant(cookie);
    const enabled = await grant(
      cookie,
      "lists:read tasks:write lists:manage github:manage",
    );
    let list: TodoList | undefined;
    try {
      assert.ok(!basic.scope.split(" ").includes("github:manage"));
      assert.ok(enabled.scope.split(" ").includes("github:manage"));
      const session = await (
        await mobile(enabled.access_token, "session")
      ).json();
      assert.ok(session.scopes.includes("github:manage"));
      list = await (
        await mobile(basic.access_token, "createList", {
          title: "Synthetic native GitHub consent",
          mode: "work",
          operationId: crypto.randomUUID(),
        })
      ).json();
      // No synthetic identity has a provider account. Jobs cannot contact GitHub.
      await database().pool.query(
        "insert into wuff_github_bindings(list_id,owner_id,installation_id,repository_id,repository,auto_create_issues) values($1,$2,'synthetic','synthetic','synthetic-owner/consent-test',true)",
        [list!.id, users[0].id],
      );
      const input = {
        listId: list!.id,
        version: list!.version,
        title: "Automatic native issue",
        operationId: crypto.randomUUID(),
      };
      assert.equal(
        (await mobile(basic.access_token, "createTask", input)).status,
        403,
      );
      const created = await mobile(enabled.access_token, "createTask", input);
      assert.equal(created.status, 200);
      list = await created.json();
      assert.ok(
        list!.tasks[0].github,
        "Native snapshots include the authorized issue summary",
      );
      const edit = await mobile(enabled.access_token, "updateTask", {
        listId: list!.id,
        version: list!.version,
        taskId: list!.tasks[0].id,
        title: "Consented linked edit",
        operationId: crypto.randomUUID(),
      });
      assert.equal(edit.status, 200);
      list = await edit.json();
      assert.equal(
        (
          await mobile(basic.access_token, "updateTask", {
            listId: list!.id,
            version: list!.version,
            taskId: list!.tasks[0].id,
            completed: true,
            operationId: crypto.randomUUID(),
          })
        ).status,
        403,
      );
    } finally {
      if (list) {
        const current = await (
          await mobile(enabled.access_token, "getList", list.id)
        ).json();
        assert.equal(
          (
            await mobile(enabled.access_token, "deleteList", {
              listId: list.id,
              version: current.version,
              operationId: crypto.randomUUID(),
              confirmed: true,
            })
          ).status,
          200,
        );
      }
      await revoke(basic.refresh_token);
      await revoke(enabled.refresh_token);
      await database().pool.end();
    }
  } finally {
    await revoke(reader.refresh_token);
  }
});

test("Tauri fixed identity uses native permissions, refresh and revocation", async () => {
  const cookie = await loginFixture(users[0]);
  const tokens = await grant(cookie, "lists:read", {
    clientId: tauriClientId,
    redirectUri: tauriRedirectUri,
    path: "/oauth/tauri",
  });
  let refresh = tokens.refresh_token;
  try {
    assert.equal((await mobile(tokens.access_token, "listLists")).status, 200);
    assert.equal(
      (
        await mobile(tokens.access_token, "createList", {
          title: "Denied Tauri fixture",
          operationId: crypto.randomUUID(),
        })
      ).status,
      403,
    );
    const result = await fetch(origin + "/oauth/token", {
      method: "POST",
      headers: form,
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh,
        client_id: tauriClientId,
        resource,
      }),
    });
    assert.equal(result.status, 200);
    const rotated = await result.json();
    refresh = rotated.refresh_token;
    assert.equal((await mobile(rotated.access_token, "listLists")).status, 200);
    assert.equal((await revoke(refresh, tauriClientId)).status, 200);
    assert.equal((await mobile(rotated.access_token, "listLists")).status, 401);
  } finally {
    await revoke(refresh, tauriClientId);
  }
});

test("Tauri bearer live capabilities pin the actor and stream authorized changes", async () => {
  const cookie = await loginFixture(users[0]);
  const identity = {
    clientId: tauriClientId,
    redirectUri: tauriRedirectUri,
    path: "/oauth/tauri",
  };
  const reader = await grant(cookie, "lists:read", identity);
  const writer = await grant(cookie, "lists:read lists:manage", identity);
  let list: TodoList | undefined;
  let live: ReturnType<typeof createRealtimeClient> | undefined;
  try {
    const session = await (await mobile(reader.access_token, "session")).json();
    assert.equal(
      (await mobile(reader.access_token, "getLive", { userId: users[1].id }))
        .status,
      409,
    );
    const response = await mobile(reader.access_token, "getLive", {
      userId: session.userId,
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control")!, /no-store/);
    const config = (await response.json()) as LiveLists;
    live = createRealtimeClient({ url: config.url, logLevel: "silent" });
    const subscription = live.subscribe(config.query);
    await waitForLive(subscription, () => true);
    list = await (
      await mobile(writer.access_token, "createList", {
        title: "Tauri stream synthetic",
        operationId: crypto.randomUUID(),
      })
    ).json();
    await waitForLive(subscription, (rows) =>
      rows.some((row) => row.id === list!.id),
    );
    assert.equal(
      (
        await mobile(writer.access_token, "deleteList", {
          listId: list!.id,
          version: list!.version,
          operationId: crypto.randomUUID(),
        })
      ).status,
      200,
    );
    await waitForLive(
      subscription,
      (rows) => !rows.some((row) => row.id === list!.id),
    );
    list = undefined;
    await revoke(reader.refresh_token, tauriClientId);
    assert.equal(
      (await mobile(reader.access_token, "getLive", { userId: session.userId }))
        .status,
      401,
    );
    subscription.unsubscribe();
  } finally {
    live?.close();
    disconnectLiveConnections();
    if (list)
      await mobile(writer.access_token, "deleteList", {
        listId: list.id,
        version: list.version,
        operationId: crypto.randomUUID(),
      });
    await revoke(reader.refresh_token, tauriClientId);
    await revoke(writer.refresh_token, tauriClientId);
  }
});

test("native feature adapters preserve identity, Work context and private image permissions", async () => {
  const identity = {
    clientId: tauriClientId,
    redirectUri: tauriRedirectUri,
    path: "/oauth/tauri",
  };
  const cookie = await loginFixture(users[0]);
  const owner = await grant(cookie, undefined, identity),
    reader = await grant(cookie, "lists:read", identity);
  const outsider = await grant(
    await loginFixture(users[1]),
    "lists:read",
    identity,
  );
  let list: TodoList | undefined;
  const bytes = await readFile("apps/web/public/mascot/waffles-icon.webp");
  const imageRequest = (
    token: string,
    params: URLSearchParams,
    method = "GET",
    data?: Buffer,
  ) =>
    fetch(origin + "/api/mobile/images?" + params, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "image/webp",
        "X-Wuff-User": users[0].id,
      },
      body: data ? new Uint8Array(data) : undefined,
    });
  try {
    assert.equal(
      (
        await fetch(resource, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${owner.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "listLists", userId: users[1].id }),
        })
      ).status,
      409,
    );
    list = await (
      await mobile(owner.access_token, "createList", {
        title: "Native feature proof",
        mode: "work",
        operationId: crypto.randomUUID(),
      })
    ).json();
    list = await (
      await mobile(owner.access_token, "createTask", {
        listId: list!.id,
        version: list!.version,
        title: "Image and Work context",
        status: "in_progress",
        priority: "high",
        references: [
          { url: "https://github.com/timbenniks/wuff-todo/issues/10" },
        ],
        operationId: crypto.randomUUID(),
      })
    ).json();
    const task = list!.tasks[0];
    assert.equal(task.priority, "high");
    assert.equal(task.references.length, 1);
    assert.equal(
      (await mobile(owner.access_token, "githubTask", task.id)).status,
      200,
    );
    assert.equal(
      (await mobile(owner.access_token, "agentTask", task.id)).status,
      200,
    );
    assert.equal(
      (await mobile(outsider.access_token, "githubTask", task.id)).status,
      404,
    );
    assert.equal(
      (await mobile(outsider.access_token, "agentTask", task.id)).status,
      404,
    );
    const params = new URLSearchParams({
      listId: list!.id,
      taskId: task.id,
      version: String(list!.version),
      operationId: crypto.randomUUID(),
    });
    assert.equal(
      (await imageRequest(reader.access_token, params, "POST", bytes)).status,
      403,
    );
    const uploaded = await imageRequest(
      owner.access_token,
      params,
      "POST",
      bytes,
    );
    assert.equal(uploaded.status, 200);
    const { image } = await uploaded.json();
    assert.equal(
      (
        await (
          await imageRequest(owner.access_token, params, "POST", bytes)
        ).json()
      ).image.id,
      image.id,
    );
    const query = new URLSearchParams({ id: image.id });
    assert.equal(
      (await fetch(origin + "/api/mobile/images?" + query)).status,
      401,
    );
    const foreign = await fetch(origin + "/api/mobile/images?" + query, {
      headers: { Authorization: `Bearer ${outsider.access_token}` },
    });
    assert.equal(foreign.status, 404);
    const response = await imageRequest(owner.access_token, query);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control")!, /no-store/);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
    list = await (
      await mobile(owner.access_token, "updateTask", {
        listId: list!.id,
        taskId: task.id,
        version: list!.version,
        content: `**Native notes**\n\n![Waffles](/api/v1/attachments/${image.id})`,
        operationId: crypto.randomUUID(),
      })
    ).json();
    assert.equal(list!.tasks[0].images!.length, 1);
    assert.equal(list!.tasks[0].priority, "high");
    assert.equal(list!.tasks[0].references.length, 1);
    list = await (
      await mobile(owner.access_token, "updateTask", {
        listId: list!.id,
        taskId: task.id,
        version: list!.version,
        content: "**Native notes**",
        operationId: crypto.randomUUID(),
      })
    ).json();
    assert.equal(list!.tasks[0].images!.length, 0);
  } finally {
    if (list) {
      const latest = await (
        await mobile(owner.access_token, "getList", list.id)
      ).json();
      await mobile(owner.access_token, "deleteList", {
        listId: list.id,
        version: latest.version,
        operationId: crypto.randomUUID(),
      });
    }
    for (const token of [owner, reader, outsider])
      await revoke(token.refresh_token, tauriClientId);
  }
});
