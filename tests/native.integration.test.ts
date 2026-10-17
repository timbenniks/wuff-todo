import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loginFixture } from "./helpers/login";
import {
  nativeClientId,
  nativeRedirectUri,
} from "../apps/web/src/lib/native-policy";
import type { TodoList } from "@wuff/contracts";
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
) {
  assert.equal((await fetch(origin + "/oauth/native")).status, 200);
  const verifier = randomBytes(32).toString("base64url");
  const query = new URLSearchParams({
    client_id: nativeClientId,
    redirect_uri: nativeRedirectUri,
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
  assert.equal(redirect.protocol, "com.timbenniks.wufftodo:");
  assert.equal(redirect.searchParams.get("iss"), origin);
  const exchange = {
    grant_type: "authorization_code",
    client_id: nativeClientId,
    code: redirect.searchParams.get("code")!,
    redirect_uri: nativeRedirectUri,
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
  return token as { access_token: string; refresh_token: string };
}
async function revoke(refreshToken: string) {
  return fetch(origin + "/oauth/revoke", {
    method: "POST",
    headers: form,
    body: new URLSearchParams({
      client_id: nativeClientId,
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

test("native read-only grants cannot write or gain GitHub scope through authorization", async () => {
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
      scope: "lists:read github:manage",
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
  } finally {
    await revoke(reader.refresh_token);
  }
});
