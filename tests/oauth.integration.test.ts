import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
const origin = "http://localhost:3000",
  resource = `${origin}/api/mcp`;
const fixtures = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const jsonHeaders = { Origin: origin, "Content-Type": "application/json" };
async function login(index = 0) {
  const response = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      email: fixtures[index].email,
      password: fixtures[index].password,
    }),
  });
  assert.equal(
    response.status,
    200,
    "Synthetic user can sign in through Neon proxy",
  );
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
async function post(path: string, body: unknown, cookie: string) {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { ...jsonHeaders, Cookie: cookie },
    body: JSON.stringify(body),
  });
}
let rpcId = 0;
async function rpc(token: string, method: string, params: unknown) {
  const response = await fetch(resource, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  return { status: response.status, body: await response.json() };
}

test("Neon login, closed signup, unauthorized access, and session restoration", async () => {
  const unauthed = await fetch(`${origin}/api/v1/lists`);
  assert.equal(unauthed.status, 401);
  assert.equal(
    (
      await post(
        "/api/auth/sign-up/email",
        {
          email: "uninvited@example.invalid",
          password: randomBytes(30).toString("hex"),
          name: "No invite",
        },
        "",
      )
    ).status,
    403,
  );
  const directSignup = await fetch(
    `${process.env.NEON_AUTH_BASE_URL}/sign-up/email`,
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        name: "No invite",
        email: `uninvited-${randomBytes(5).toString("hex")}@example.invalid`,
        password: randomBytes(30).toString("hex"),
      }),
    },
  );
  assert.ok(
    directSignup.status >= 400,
    "Managed auth rejects direct public signup too",
  );
  const cookie = await login();
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await fetch(`${origin}/api/v1/lists`, { headers: { Cookie: cookie } }))
        .status,
      200,
    );
  const outsiderCookie = await login(2);
  assert.equal(
    (
      await fetch(`${origin}/api/v1/lists`, {
        headers: { Cookie: outsiderCookie },
      })
    ).status,
    403,
  );
  assert.equal((await post("/api/auth/sign-out", {}, cookie)).status, 200);
  assert.equal(
    (await fetch(`${origin}/api/v1/lists`, { headers: { Cookie: cookie } }))
      .status,
    401,
  );
});

test("OAuth discovery, consent, PKCE, MCP operations, scope checks, refresh, and revocation", async () => {
  assert.equal((await fetch(resource)).status, 401);
  const protectedMeta = await (
    await fetch(`${origin}/.well-known/oauth-protected-resource/api/mcp`)
  ).json();
  assert.equal(protectedMeta.resource, resource);
  const metadata = await (
    await fetch(`${origin}/.well-known/oauth-authorization-server`)
  ).json();
  assert.ok(metadata.code_challenge_methods_supported.includes("S256"));
  const registration = await post(
    "/oauth/register",
    {
      client_name: "Wuff integration test",
      redirect_uris: ["http://127.0.0.1:38675/callback"],
      token_endpoint_auth_method: "none",
    },
    "",
  );
  assert.equal(registration.status, 201);
  const client = await registration.json();
  assert.equal(
    (
      await post(
        "/oauth/register",
        { redirect_uris: ["http://evil.example/callback"] },
        "",
      )
    ).status,
    400,
  );
  const cookie = await login();
  async function grant(scope: string) {
    const verifier = randomBytes(32).toString("base64url");
    const query = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      response_type: "code",
      scope,
      state: randomBytes(24).toString("hex"),
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      resource,
    });
    const consent = await fetch(`${origin}/oauth/authorize?${query}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(consent.status, 200);
    assert.ok((await consent.text()).includes("Allow connection"));
    const decision = await post(
      "/oauth/authorize/decision",
      { query: query.toString(), accept: true },
      cookie,
    );
    const data = await decision.json();
    assert.equal(decision.status, 200, JSON.stringify(data));
    const redirect = new URL(data.redirect);
    assert.equal(redirect.searchParams.get("state"), query.get("state"));
    return { verifier, code: redirect.searchParams.get("code")! };
  }
  async function exchange(body: Record<string, string>) {
    return fetch(`${origin}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: client.client_id,
        resource,
        ...body,
      }),
    });
  }
  const bad = await grant("lists:read");
  assert.equal(
    (
      await exchange({
        grant_type: "authorization_code",
        code: bad.code,
        code_verifier: randomBytes(32).toString("base64url"),
        redirect_uri: client.redirect_uris[0],
      })
    ).status,
    400,
  );
  const full = await grant("lists:read tasks:write lists:manage");
  assert.equal(
    (
      await exchange({
        grant_type: "authorization_code",
        code: full.code,
        code_verifier: full.verifier,
        redirect_uri: client.redirect_uris[0],
        resource: "https://other.example/mcp",
      })
    ).status,
    400,
  );
  const tokenResponse = await exchange({
    grant_type: "authorization_code",
    code: full.code,
    code_verifier: full.verifier,
    redirect_uri: client.redirect_uris[0],
  });
  const token = await tokenResponse.json();
  assert.equal(
    tokenResponse.status,
    200,
    JSON.stringify({ error: token.error }),
  );
  assert.equal(
    (
      await exchange({
        grant_type: "authorization_code",
        code: full.code,
        code_verifier: full.verifier,
        redirect_uri: client.redirect_uris[0],
      })
    ).status,
    400,
    "Code cannot be reused",
  );
  const initialized = await rpc(token.access_token, "initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "Wuff test", version: "1" },
  });
  assert.equal(initialized.status, 200);
  assert.equal(initialized.body.result.serverInfo.name, "Wuff Todo");
  const tools = await rpc(token.access_token, "tools/list", {});
  assert.ok(
    tools.body.result.tools.some(
      (t: { name: string }) => t.name === "show_list",
    ),
  );
  const created = await rpc(token.access_token, "tools/call", {
    name: "create_list",
    arguments: { title: "OAuth smoke list", operationId: crypto.randomUUID() },
  });
  assert.ok(!created.body.result.isError, "MCP list creation succeeds");
  let list = created.body.result.structuredContent.list;
  try {
    const onWeb = await fetch(`${origin}/api/v1/lists/${list.id}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(onWeb.status, 200);
    const added = await post(
      "/api/v1/tasks",
      {
        listId: list.id,
        version: list.version,
        title: "Web to MCP",
        operationId: crypto.randomUUID(),
      },
      cookie,
    );
    assert.equal(added.status, 200);
    const read = await rpc(token.access_token, "tools/call", {
      name: "show_list",
      arguments: { listId: list.id },
    });
    list = read.body.result.structuredContent.list;
    assert.equal(list.tasks[0].title, "Web to MCP");
    const ui = await rpc(token.access_token, "resources/read", {
      uri: "ui://wuff/lists.html",
    });
    assert.ok(ui.body.result.contents[0].mimeType.includes("mcp-app"));
    assert.ok(ui.body.result.contents[0].text.includes("Wuff Todo"));
    const completed = await rpc(token.access_token, "tools/call", {
      name: "update_task",
      arguments: {
        listId: list.id,
        taskId: list.tasks[0].id,
        version: list.version,
        completed: true,
        operationId: crypto.randomUUID(),
      },
    });
    assert.ok(!completed.body.result.isError);
    const webState = await (
      await fetch(`${origin}/api/v1/lists/${list.id}`, {
        headers: { Cookie: cookie },
      })
    ).json();
    assert.equal(webState.tasks[0].completed, true);
    const readGrant = await grant("lists:read"),
      readToken = await (
        await exchange({
          grant_type: "authorization_code",
          code: readGrant.code,
          code_verifier: readGrant.verifier,
          redirect_uri: client.redirect_uris[0],
        })
      ).json();
    const denied = await rpc(readToken.access_token, "tools/call", {
      name: "create_list",
      arguments: { title: "Denied", operationId: crypto.randomUUID() },
    });
    assert.equal(denied.body.result.isError, true);
    const refresh = await exchange({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    });
    assert.equal(refresh.status, 200);
    const renewed = await refresh.json();
    assert.equal(
      (
        await exchange({
          grant_type: "refresh_token",
          refresh_token: token.refresh_token,
        })
      ).status,
      400,
      "Refresh token rotates",
    );
    assert.equal((await rpc(token.access_token, "tools/list", {})).status, 401);
    assert.equal(
      (await rpc(renewed.access_token, "tools/list", {})).status,
      200,
    );
    const disconnected = await fetch(`${origin}/api/v1/connections`, {
      method: "DELETE",
      headers: { ...jsonHeaders, Cookie: cookie },
      body: JSON.stringify({ clientId: client.client_id }),
    });
    assert.equal(disconnected.status, 200);
    assert.equal(
      (await rpc(renewed.access_token, "tools/list", {})).status,
      401,
    );
  } finally {
    const latest = await (
      await fetch(`${origin}/api/v1/lists/${list.id}`, {
        headers: { Cookie: cookie },
      })
    ).json();
    await fetch(`${origin}/api/v1/lists/${list.id}`, {
      method: "DELETE",
      headers: { ...jsonHeaders, Cookie: cookie },
      body: JSON.stringify({
        version: latest.version,
        operationId: crypto.randomUUID(),
      }),
    });
  }
});
