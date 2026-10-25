import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { eq, inArray } from "drizzle-orm";
import { database, oauthTokens, reminderDevices } from "@wuff/db";
import { loginFixture } from "./helpers/login";
import {
  empireGrant,
  empireMcp,
  fixtureOrigin as origin,
} from "./helpers/empire-grant";
if (
  !process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l") ||
  process.env.QSTASH_TOKEN
)
  throw Error("Isolated development with QStash disabled only");
after(() => database().pool.end());
test("web subscription HTTP/secure MCP handoff/removal parity, exact retries, ownership, insufficient scope and revoked replay", async () => {
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
  const grants: Awaited<ReturnType<typeof empireGrant>>[] = [];
  const grant = async (scope: string) => {
    const g = await empireGrant(cookie, scope);
    grants.push(g);
    return g;
  };
  const address = `https://fcm.googleapis.com/fcm/send/synthetic-${crypto.randomUUID()}`;
  const input = {
    operationId: crypto.randomUUID(),
    label: "Synthetic browser parity",
    transport: "web",
    address,
    subscription: {
      endpoint: address,
      expirationTime: null,
      keys: {
        p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString(
          "base64url",
        ),
        auth: Buffer.alloc(16, 1).toString("base64url"),
      },
    },
  };
  const write = (action: string, data: unknown, h = headers) =>
    fetch(origin + "/api/v1/reminders", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ action, input: data }),
    });
  const read = async () => {
    const r = await fetch(origin + "/api/v1/reminders", { headers });
    assert.equal(r.status, 200);
    return r.json();
  };
  try {
    const token = await grant("lists:read tasks:write"),
      readonly = await grant("lists:read");
    assert.equal(
      (
        await write("device", input, {
          ...headers,
          Origin: "https://evil.invalid",
        })
      ).status,
      403,
    );
    assert.equal(
      (await write("device", input, { ...headers, "X-Wuff-User": other.id }))
        .status,
      409,
    );
    assert.equal(
      (
        await write("device", {
          ...input,
          subscription: { ...input.subscription, expirationTime: -1 },
        })
      ).status,
      400,
    );
    assert.equal((await write("device", input)).status, 200);
    assert.equal((await write("device", input)).status, 200);
    const current = await read(),
      device = current.devices.find((d: any) => d.label === input.label);
    assert(device);
    assert.equal(
      current.devices.filter((d: any) => d.label === input.label).length,
      1,
    );
    assert(!JSON.stringify(current).includes(address));
    assert(!JSON.stringify(current).includes(input.subscription.keys.auth));
    const mcp = await empireMcp(token.access_token, "get_reminder_settings");
    assert.equal(
      mcp.result.structuredContent.setupPath,
      "/settings/notifications",
    );
    assert.deepEqual(
      mcp.result.structuredContent.settings.devices,
      current.devices,
    );
    assert.equal(
      (await write("device", { ...input, label: "Altered retry" })).status,
      409,
    );
    const takeover = await write(
      "device",
      { ...input, operationId: crypto.randomUUID() },
      { ...headers, Cookie: otherCookie, "X-Wuff-User": other.id },
    );
    assert.equal(takeover.status, 409);
    assert.equal(
      (
        await write(
          "removeDevice",
          { deviceId: device.id, operationId: crypto.randomUUID() },
          { ...headers, Cookie: otherCookie, "X-Wuff-User": other.id },
        )
      ).status,
      200,
    );
    assert((await read()).devices.some((d: any) => d.id === device.id));
    const remove = { deviceId: device.id, operationId: crypto.randomUUID() };
    const denied = await empireMcp(
      readonly.access_token,
      "remove_reminder_device",
      remove,
    );
    assert(denied.result?.isError || denied.error || denied.status === 403);
    const removed = await empireMcp(
      token.access_token,
      "remove_reminder_device",
      remove,
    );
    assert(!removed.result.isError);
    assert(!(await read()).devices.some((d: any) => d.id === device.id));
    assert.equal(
      (await write("device", { ...input, operationId: crypto.randomUUID() }))
        .status,
      200,
    );
    assert.equal(
      (
        await write("disableBrowser", {
          endpoint: address,
          operationId: crypto.randomUUID(),
        })
      ).status,
      200,
    );
    const afterDisable = await empireMcp(
      token.access_token,
      "get_reminder_settings",
    );
    assert(
      !afterDisable.result.structuredContent.settings.devices.some(
        (d: any) => d.label === input.label,
      ),
    );
    const revoke = await fetch(origin + "/api/v1/connections", {
      method: "DELETE",
      headers,
      body: JSON.stringify({
        clientId: token.clientId,
        operationId: crypto.randomUUID(),
      }),
    });
    assert.equal(revoke.status, 200);
    assert.equal(
      (await empireMcp(token.access_token, "remove_reminder_device", remove))
        .status,
      401,
    );
  } finally {
    await database()
      .db.delete(reminderDevices)
      .where(eq(reminderDevices.address, address));
    if (grants.length)
      await database()
        .db.update(oauthTokens)
        .set({ revoked: true })
        .where(
          inArray(
            oauthTokens.clientId,
            grants.map((g) => g.clientId),
          ),
        );
  }
});
