import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { database, dashboardPreferences } from "@wuff/db";
import { scopes, defaultDashboardSettings } from "@wuff/contracts";
import { createList, createTask, deleteList, getList } from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Development only");
const users = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const a = { id: users[0].id, scopes },
  b = { id: users[1].id, scopes },
  op = () => crypto.randomUUID();
after(() => database().pool.end());
test("authenticated web/MCP/native Home adapters enforce scopes, account/origin/audience boundaries and share preferences", async () => {
  const { loginFixture } = await import("./helpers/login");
  const { createHash, randomBytes } = await import("node:crypto");
  const { tauriClientId, tauriRedirectUri } = await import("@wuff/contracts");
  const origin = "http://localhost:3000",
    cookie = await loginFixture(users[0]),
    headers = {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    };
  const tokens: { access_token: string; clientId: string }[] = [];
  const [old] = await database()
    .db.select()
    .from(dashboardPreferences)
    .where(eq(dashboardPreferences.userId, a.id));
  let fixture = await createList(a, {
    title: "Dashboard adapter list",
    operationId: op(),
  });
  fixture = await createTask(a, {
    listId: fixture.id,
    version: fixture.version,
    title: "Dashboard adapter task",
    dueDate: "2026-10-23",
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
    let response = await fetch(origin + "/api/v1/dashboard?today=2026-10-23", {
      headers,
    });
    assert.equal(response.status, 200);
    const home = await response.json();
    assert.ok(
      home.todayTasks.some((task: any) => task.id === fixture.tasks[0].id),
    );
    const input = {
      version: home.preferences.version,
      settings: {
        sections: ["favorites", "today", "upcoming"],
        hidden: ["upcoming"],
        startPage: "last_list",
      },
      operationId: op(),
    };
    response = await fetch(origin + "/api/v1/dashboard", {
      method: "PUT",
      headers,
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 200);
    let saved = await response.json();
    assert.deepEqual(saved.settings, input.settings);
    response = await fetch(origin + "/api/v1/dashboard", {
      method: "PUT",
      headers,
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).version, saved.version);
    assert.equal(
      (
        await fetch(origin + "/api/v1/dashboard", {
          method: "PUT",
          headers,
          body: JSON.stringify({ ...input, operationId: op() }),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await fetch(origin + "/api/v1/dashboard", {
          method: "PUT",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            version: saved.version,
            operationId: op(),
          }),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(origin + "/api/v1/dashboard?today=2026-10-23", {
          headers: { Cookie: cookie, "X-Wuff-User": b.id },
        })
      ).status,
      409,
    );
    assert.equal(
      (await fetch(origin + "/api/v1/dashboard?today=2026-02-29", { headers }))
        .status,
      400,
    );
    const token = await grant(false);
    let result = await mcp(token, "get_dashboard", { today: "2026-10-23" });
    assert.deepEqual(result.structuredContent.dashboard.preferences, saved);
    result = await mcp(token, "show_dashboard", {
      today: "2026-10-23",
      limit: 100,
    });
    assert.ok(!result.isError);
    assert.equal(
      result.structuredContent.dashboard.name,
      users[0].name ?? result.structuredContent.dashboard.name,
    );
    result = await mcp(token, "update_dashboard", {
      version: saved.version,
      settings: { ...input.settings, hidden: [] },
      operationId: op(),
    });
    assert.ok(!result.isError);
    saved = result.structuredContent.dashboardPreferences;
    const nativeToken = await grant(true);
    response = await native(nativeToken, "getDashboard", {
      today: "2026-10-23",
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).preferences, saved);
    response = await native(nativeToken, "updateDashboard", {
      version: saved.version,
      settings: defaultDashboardSettings,
      operationId: op(),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(
      (await response.json()).settings,
      defaultDashboardSettings,
    );
    const readToken = await grant(false, "lists:read");
    result = await mcp(readToken, "get_dashboard", { today: "2026-10-23" });
    assert.ok(!result.isError);
    result = await mcp(readToken, "update_dashboard", {
      version: 0,
      settings: defaultDashboardSettings,
      operationId: op(),
    });
    assert.equal(result.isError, true);
    assert.equal(
      (await native(token, "getDashboard", { today: "2026-10-23" })).status,
      401,
    );
    response = await fetch(origin + "/api/v1/dashboard?today=2026-10-23");
    assert.equal(response.status, 401);
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
    const list = await getList(a, fixture.id);
    await deleteList(a, {
      listId: list.id,
      version: list.version,
      operationId: op(),
    });
    if (old)
      await database()
        .db.insert(dashboardPreferences)
        .values(old)
        .onConflictDoUpdate({ target: dashboardPreferences.userId, set: old });
    else
      await database()
        .db.delete(dashboardPreferences)
        .where(eq(dashboardPreferences.userId, a.id));
  }
});
