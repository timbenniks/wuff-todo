import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { and, eq, inArray } from "drizzle-orm";
import {
  database,
  mcpToolPreferences,
  oauthTokens,
  receipts,
  users,
} from "@wuff/db";
import { optionalMcpToolIds, scopes } from "@wuff/contracts";
import { getMcpToolPreferences, updateMcpToolPreferences } from "@wuff/domain";
import { loginFixture } from "./helpers/login";
import {
  empireGrant,
  empireMcp,
  fixtureOrigin as origin,
} from "./helpers/empire-grant";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Development only");
after(() => database().pool.end());
test("MCP connection tool choices: actual HTTP/MCP/native parity, privacy, scope ceiling, narrowing, retries, races and revocation", async () => {
  const [user, other] = JSON.parse(
    await readFile(".vercel/dev-users.json", "utf8"),
  );
  const cookie = await loginFixture(user);
  const headers = {
    Origin: origin,
    Cookie: cookie,
    "Content-Type": "application/json",
    "X-Wuff-User": user.id,
  };
  const tokens: Awaited<ReturnType<typeof empireGrant>>[] = [];
  const operationIds: string[] = [];
  const op = () => {
    const id = crypto.randomUUID();
    operationIds.push(id);
    return id;
  };
  const grant = async (scope: string, native = false) => {
    const token = await empireGrant(cookie, scope, native);
    tokens.push(token);
    return token;
  };
  const api = async (clientId: string) => {
    const r = await fetch(
      origin + "/api/v1/connections/tools?" + new URLSearchParams({ clientId }),
      { headers },
    );
    assert.equal(r.status, 200);
    return r.json();
  };
  const write = (input: unknown, extra = {}) =>
    fetch(origin + "/api/v1/connections/tools", {
      method: "PUT",
      headers: { ...headers, ...extra },
      body: JSON.stringify(input),
    });
  const nativeCall = async (token: string, action: string, input: unknown) => {
    const r = await fetch(origin + "/api/mobile", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, input, userId: user.id }),
    });
    return { status: r.status, data: await r.json() };
  };
  const discovery = async (token: string) => {
    const r = await fetch(origin + "/api/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
    assert.equal(r.status, 200);
    return (await r.json()).result.tools.map(
      (t: { name: string }) => t.name,
    ) as string[];
  };
  try {
    const full = await grant(
        "lists:read lists:manage tasks:write empire:read empire:manage totake:read totake:write",
      ),
      second = await grant("empire:read empire:manage totake:read"),
      native = await grant("lists:read empire:read empire:manage", true),
      readonly = await grant("empire:read");
    const actor = { id: user.id, scopes },
      target = { clientId: full.clientId };
    assert.equal(
      (
        await fetch(
          origin + "/api/v1/connections/tools?clientId=" + full.clientId,
        )
      ).status,
      401,
    );
    assert.equal(
      (await write({}, { Origin: "https://foreign.invalid" })).status,
      403,
    );
    const initial = await api(full.clientId);
    assert.equal(initial.configured, false);
    assert.equal(initial.version, 0);
    assert.deepEqual(initial.enabledTools, optionalMcpToolIds);
    const fromMcp = await empireMcp(
      full.access_token,
      "get_mcp_tool_preferences",
      target,
    );
    assert.deepEqual(
      { ...fromMcp.result.structuredContent.toolPreferences, canEnable: true },
      initial,
    );
    assert.equal(
      fromMcp.result.structuredContent.toolPreferences.canEnable,
      false,
    );
    await assert.rejects(
      getMcpToolPreferences({ id: other.id, scopes }, target),
      { code: "not_found" },
    );
    await assert.rejects(
      getMcpToolPreferences({ id: user.id, scopes: ["lists:read"] }, target),
      { code: "forbidden" },
    );
    const selected = optionalMcpToolIds.filter((id) => !id.includes("totake"));
    const input = {
      ...target,
      version: 0,
      operationId: op(),
      enabledTools: selected,
    };
    assert.equal((await write(input)).status, 200);
    assert.equal((await write(input)).status, 200);
    assert.equal((await write({ ...input, enabledTools: [] })).status, 409);
    assert.equal((await write({ ...input, operationId: op() })).status, 409);
    const list = await discovery(full.access_token);
    assert(list.includes("get_task"));
    assert(!list.includes("get_totake"));
    assert(!list.includes("update_totake"));
    assert(
      (await empireMcp(full.access_token, "get_totake", {})).result.isError,
    );
    assert((await discovery(second.access_token)).includes("get_totake"));
    assert(
      !(await discovery(readonly.access_token)).includes(
        "update_mcp_tool_preferences",
      ),
    );
    const forbidden = await empireMcp(
      full.access_token,
      "update_mcp_tool_preferences",
      {
        ...target,
        version: 1,
        operationId: op(),
        enabledTools: optionalMcpToolIds,
      },
    );
    assert.equal(forbidden.result.structuredContent.error.code, "forbidden");
    const narrow = await empireMcp(
      full.access_token,
      "update_mcp_tool_preferences",
      { ...target, version: 1, operationId: op(), enabledTools: ["get_task"] },
    );
    assert.equal(narrow.result.isError, undefined);
    assert.deepEqual((await api(full.clientId)).enabledTools, ["get_task"]);
    const nativeRead = await nativeCall(
      native.access_token,
      "getMcpToolPreferences",
      target,
    );
    assert.equal(nativeRead.status, 200);
    assert.deepEqual(nativeRead.data, await api(full.clientId));
    const nativeSave = await nativeCall(
      native.access_token,
      "updateMcpToolPreferences",
      {
        ...target,
        version: 2,
        operationId: op(),
        enabledTools: ["get_totake"],
      },
    );
    assert.equal(nativeSave.status, 200);
    assert.deepEqual(nativeSave.data.enabledTools, ["get_totake"]);
    assert((await discovery(full.access_token)).includes("get_totake"));
    const race = await Promise.all(
      [[], ["get_task"]].map((enabledTools) =>
        write({ ...target, version: 3, operationId: op(), enabledTools }),
      ),
    );
    assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
    // Refresh preserves both the OAuth ceiling and the independently saved allowlist.
    const before = await api(full.clientId);
    const refresh = await fetch(origin + "/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: full.clientId,
        refresh_token: full.refresh_token,
        resource: full.resource,
      }),
    });
    assert.equal(refresh.status, 200);
    const rotated = await refresh.json();
    assert.equal(rotated.scope, full.scope);
    assert.deepEqual(await api(full.clientId), before);
    assert(!(await discovery(rotated.access_token)).includes("get_totake"));
    // A newly consented token for the same client does not reset the owner's policy.
    const again = await empireGrant(cookie, full.scope, false, {
      clientId: full.clientId,
      redirectUri: "http://127.0.0.1:4173/callback",
    });
    assert.deepEqual(await api(full.clientId), before);
    assert(!(await discovery(again.access_token)).includes("get_totake"));
    const replay = {
      ...target,
      version: before.version,
      operationId: op(),
      enabledTools: [],
    };
    await updateMcpToolPreferences(actor, replay);
    await database()
      .db.update(users)
      .set({ enabled: false })
      .where(eq(users.id, user.id));
    try {
      await assert.rejects(updateMcpToolPreferences(actor, replay), {
        code: "invite_required",
      });
    } finally {
      await database()
        .db.update(users)
        .set({ enabled: true })
        .where(eq(users.id, user.id));
    }
    await database()
      .db.update(oauthTokens)
      .set({
        refreshExpiresAt: new Date(Date.now() - 1000),
        accessExpiresAt: new Date(Date.now() - 1000),
      })
      .where(
        and(
          eq(oauthTokens.userId, user.id),
          eq(oauthTokens.clientId, second.clientId),
        ),
      );
    assert.deepEqual((await api(second.clientId)).grantedScopes, []);
    assert.equal(
      (
        await empireMcp(second.access_token, "get_mcp_tool_preferences", {
          clientId: second.clientId,
        })
      ).status,
      401,
    );

    await database()
      .db.update(oauthTokens)
      .set({ revoked: true })
      .where(
        and(
          eq(oauthTokens.userId, user.id),
          eq(oauthTokens.clientId, full.clientId),
        ),
      );
    await assert.rejects(updateMcpToolPreferences(actor, replay), {
      code: "not_found",
    });
    assert.equal(
      (await empireMcp(again.access_token, "get_mcp_tool_preferences", target))
        .status,
      401,
    );
  } finally {
    const dynamicIds = tokens.filter((t) => !t.native).map((t) => t.clientId);
    if (dynamicIds.length) {
      await database()
        .db.delete(mcpToolPreferences)
        .where(inArray(mcpToolPreferences.clientId, dynamicIds));
      await database()
        .db.update(oauthTokens)
        .set({ revoked: true })
        .where(inArray(oauthTokens.clientId, dynamicIds));
    }
    for (const token of tokens.filter((t) => t.native))
      await fetch(origin + "/oauth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: token.clientId,
          token: token.refresh_token,
        }),
      });
    if (operationIds.length)
      await database()
        .db.delete(receipts)
        .where(
          and(
            eq(receipts.actorId, user.id),
            inArray(receipts.operationId, operationIds),
          ),
        );
  }
});
