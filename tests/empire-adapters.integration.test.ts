import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { scopes } from "@wuff/contracts";
import { registerReminderDevice, removeReminderDevice } from "@wuff/domain";
import { eq, inArray } from "drizzle-orm";
import { database, empirePreferences, oauthTokens } from "@wuff/db";
import { loginFixture } from "./helpers/login";
import {
  empireGrant,
  empireMcp,
  fixtureOrigin as origin,
} from "./helpers/empire-grant";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Development only");
after(() => database().pool.end());
test("real HTTP/MCP/native settings adapters preserve parity, consent, privacy and revocation", async () => {
  const [user, other] = JSON.parse(
    await readFile(".vercel/dev-users.json", "utf8"),
  );
  const cookie = await loginFixture(user),
    otherCookie = await loginFixture(other);
  const headers = {
    Origin: origin,
    Cookie: cookie,
    "Content-Type": "application/json",
    "X-Wuff-User": user.id,
  };
  const [original] = await database()
    .db.select()
    .from(empirePreferences)
    .where(eq(empirePreferences.userId, user.id));
  const tokens: Awaited<ReturnType<typeof empireGrant>>[] = [];
  const deviceIds: string[] = [];
  const read = async () => {
    const response = await fetch(origin + "/api/v1/empire", { headers });
    assert.equal(response.status, 200);
    return response.json();
  };
  const write = async (input: unknown) =>
    fetch(origin + "/api/v1/empire", {
      method: "PUT",
      headers,
      body: JSON.stringify(input),
    });
  const grant = async (scope: string, native = false) => {
    const token = await empireGrant(cookie, scope, native);
    tokens.push(token);
    return token;
  };
  try {
    assert.equal((await fetch(origin + "/api/v1/empire")).status, 401);
    assert.equal(
      (
        await fetch(origin + "/api/v1/empire", {
          headers: { ...headers, "X-Wuff-User": other.id },
        })
      ).status,
      409,
    );
    const otherBefore = await (
      await fetch(origin + "/api/v1/empire", {
        headers: { Cookie: otherCookie },
      })
    ).json();
    const mcp = await grant("empire:read empire:manage"),
      readonly = await grant("empire:read"),
      legacy = await grant("lists:read lists:manage"),
      native = await grant("lists:read empire:read empire:manage", true),
      victim = await grant("empire:read");
    const first = await read(),
      input = {
        version: first.version,
        operationId: crypto.randomUUID(),
        changes: [{ appId: "todo", visible: false }],
      };
    const saved = await write(input);
    assert.equal(saved.status, 200);
    const apiSnapshot = await saved.json();
    const fromMcp = await empireMcp(mcp.access_token, "get_empire_settings");
    assert.deepEqual(
      fromMcp.result.structuredContent.empireSettings,
      apiSnapshot,
    );
    assert.equal((await write(input)).status, 200);
    const update = await empireMcp(mcp.access_token, "update_empire_settings", {
      version: apiSnapshot.version,
      operationId: crypto.randomUUID(),
      changes: [{ appId: "todo", visible: true, dashboard: false }],
    });
    assert(!update.result.isError);
    assert.deepEqual(
      await read(),
      update.result.structuredContent.empireSettings,
    );
    const beforeNative = await read();
    const nativeResponse = await fetch(origin + "/api/mobile", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${native.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "updateEmpireSettings",
        input: {
          version: beforeNative.version,
          operationId: crypto.randomUUID(),
          changes: [{ appId: "totake", visible: false }],
        },
        userId: user.id,
      }),
    });
    assert.equal(nativeResponse.status, 200);
    assert.deepEqual(await nativeResponse.json(), await read());
    assert.equal(
      (
        await fetch(origin + "/api/mobile", {
          method: "POST",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getEmpireSettings" }),
        })
      ).status,
      401,
    );
    const readOnlyDenied = await empireMcp(
      readonly.access_token,
      "update_empire_settings",
      input,
    );
    assert(readOnlyDenied.result.isError);
    assert(JSON.stringify(readOnlyDenied.result).includes("disabled"));
    const legacyDenied = await empireMcp(
      legacy.access_token,
      "get_empire_settings",
    );
    assert(legacyDenied.result.isError);
    assert(JSON.stringify(legacyDenied.result).includes("disabled"));
    const refreshed = await fetch(origin + "/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: legacy.clientId,
        refresh_token: legacy.refresh_token,
        resource: legacy.resource,
      }),
    });
    assert.equal(refreshed.status, 200);
    const renewed = await refreshed.json();
    assert(!(renewed.scope as string).includes("empire:"));
    const renewedDenied = await empireMcp(
      renewed.access_token,
      "get_empire_settings",
    );
    assert(renewedDenied.result.isError);
    assert(JSON.stringify(renewedDenied.result).includes("disabled"));
    const badOrigin = await fetch(origin + "/api/v1/empire", {
      method: "PUT",
      headers: { ...headers, Origin: "https://example.invalid" },
      body: JSON.stringify(input),
    });
    assert.equal(badOrigin.status, 403);
    assert.equal(
      (await write({ ...input, operationId: crypto.randomUUID() })).status,
      409,
    );
    const connections = await empireMcp(mcp.access_token, "get_ai_connections");
    assert(
      connections.result.structuredContent.connections.some(
        (c: any) =>
          c.id === victim.clientId && c.scopes.includes("empire:read"),
      ),
    );
    const disconnect = {
      clientId: victim.clientId,
      operationId: crypto.randomUUID(),
    };
    const revoked = await empireMcp(
      mcp.access_token,
      "disconnect_ai_client",
      disconnect,
    );
    assert(!revoked.result.isError);
    const apiConnections = await (
      await fetch(origin + "/api/v1/connections", { headers })
    ).json();
    assert(!apiConnections.some((c: any) => c.id === victim.clientId));
    assert.equal(
      (await empireMcp(victim.access_token, "get_empire_settings")).status,
      401,
    );
    const reconnected = await empireGrant(cookie, "empire:read", false, {
      clientId: victim.clientId,
      redirectUri: "http://127.0.0.1:4173/callback",
    });
    tokens.push(reconnected);
    assert.equal(
      (
        await fetch(origin + "/api/v1/connections", {
          method: "DELETE",
          headers,
          body: JSON.stringify(disconnect),
        })
      ).status,
      200,
    );
    assert.equal(
      (await empireMcp(reconnected.access_token, "get_empire_settings")).status,
      200,
      "Replaying an acknowledged disconnect cannot revoke a newer explicit consent",
    );
    const otherGrant = await empireGrant(otherCookie, "empire:read");
    tokens.push(otherGrant);
    const ownConnections = await empireMcp(
      mcp.access_token,
      "get_ai_connections",
    );
    assert(
      !ownConnections.result.structuredContent.connections.some(
        (c: any) => c.id === otherGrant.clientId,
      ),
    );
    await empireMcp(mcp.access_token, "disconnect_ai_client", {
      clientId: otherGrant.clientId,
      operationId: crypto.randomUUID(),
    });
    assert.equal(
      (await empireMcp(otherGrant.access_token, "get_empire_settings")).status,
      200,
    );
    const reminderGrant = await grant("lists:read tasks:write");
    for (const throughMcp of [true, false]) {
      const address = randomBytes(32).toString("hex");
      const settings = await registerReminderDevice(
        { id: user.id, scopes },
        {
          label: "Empire device adapter fixture",
          transport: "ios",
          address,
          operationId: crypto.randomUUID(),
        },
      );
      const device = settings.devices.find(
        (d) =>
          d.label === "Empire device adapter fixture" &&
          !deviceIds.includes(d.id),
      )!;
      deviceIds.push(device.id);
      const remove = { deviceId: device.id, operationId: crypto.randomUUID() };
      if (throughMcp) {
        const removed = await empireMcp(
          reminderGrant.access_token,
          "remove_reminder_device",
          remove,
        );
        assert(!removed.result.isError);
        const apiSettings = await (
          await fetch(origin + "/api/v1/reminders", { headers })
        ).json();
        assert(!apiSettings.devices.some((d: any) => d.id === device.id));
      } else {
        assert.equal(
          (
            await fetch(origin + "/api/v1/reminders", {
              method: "POST",
              headers,
              body: JSON.stringify({ action: "removeDevice", input: remove }),
            })
          ).status,
          200,
        );
        const mcpSettings = await empireMcp(
          reminderGrant.access_token,
          "get_reminder_settings",
        );
        assert(
          !mcpSettings.result.structuredContent.settings.devices.some(
            (d: any) => d.id === device.id,
          ),
        );
        assert.equal(
          mcpSettings.result.structuredContent.setupPath,
          "/settings/notifications",
        );
      }
    }
    const revokeMcp = {
      clientId: mcp.clientId,
      operationId: crypto.randomUUID(),
    };
    assert.equal(
      (
        await fetch(origin + "/api/v1/connections", {
          method: "DELETE",
          headers,
          body: JSON.stringify(revokeMcp),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await empireMcp(mcp.access_token, "update_empire_settings", {
          ...input,
          version: (await read()).version,
          operationId: crypto.randomUUID(),
        })
      ).status,
      401,
    );
    assert.deepEqual(
      await (
        await fetch(origin + "/api/v1/empire", {
          headers: { Cookie: otherCookie },
        })
      ).json(),
      otherBefore,
    );
  } finally {
    for (const deviceId of deviceIds)
      await removeReminderDevice(
        { id: user.id, scopes },
        { deviceId, operationId: crypto.randomUUID() },
      );
    if (original)
      await database()
        .db.insert(empirePreferences)
        .values(original)
        .onConflictDoUpdate({
          target: empirePreferences.userId,
          set: original,
        });
    else
      await database()
        .db.delete(empirePreferences)
        .where(eq(empirePreferences.userId, user.id));
    const dynamicIds = tokens.filter((t) => !t.native).map((t) => t.clientId);
    if (dynamicIds.length)
      await database()
        .db.update(oauthTokens)
        .set({ revoked: true })
        .where(inArray(oauthTokens.clientId, dynamicIds));
    for (const token of tokens.filter((t) => t.native))
      await database()
        .db.update(oauthTokens)
        .set({ revoked: true })
        .where(
          eq(
            oauthTokens.accessHash,
            createHash("sha256").update(token.access_token).digest("hex"),
          ),
        );
  }
});
