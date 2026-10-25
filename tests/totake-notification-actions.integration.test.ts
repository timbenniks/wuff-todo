import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  database,
  notificationPreferences,
  oauthTokens,
  reminderDevices,
  totakeJobs,
} from "@wuff/db";
import {
  getTotake,
  deliverTotake,
  getNotificationSettings,
  updateNotificationSettings,
  registerReminderDevice,
  removeReminderDevice,
} from "@wuff/domain";
import { makeTotakeNotification } from "@wuff/contracts/modules/totake/notification";
import { loginFixture } from "./helpers/login";
import {
  empireGrant,
  empireMcp,
  fixtureOrigin as origin,
} from "./helpers/empire-grant";
import {
  seedTotakeNotice,
  cleanupTotakeNotice,
} from "./helpers/totake-notice-fixture";
if (
  !process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l") ||
  process.env.QSTASH_TOKEN
)
  throw Error("Isolated development only, QStash disabled");
after(() => database().pool.end());
test("guarded Totake actions preserve real HTTP/MCP/native parity, current policy/device checks, races, receipts, stock and Undo", async () => {
  const [user, other] = JSON.parse(
    await readFile(".vercel/dev-users.json", "utf8"),
  );
  const operations: string[] = [],
    tokens: Awaited<ReturnType<typeof empireGrant>>[] = [],
    devices: string[] = [];
  const op = () => {
    const id = crypto.randomUUID();
    operations.push(id);
    return id;
  };
  const db = database().db;
  const [oldPolicy] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, user.id));
  const f = await seedTotakeNotice(user.id),
    cookie = await loginFixture(user);
  const headers = {
    Cookie: cookie,
    Origin: origin,
    "Content-Type": "application/json",
    "X-Wuff-User": user.id,
  };
  const put = (input: unknown, h = headers) =>
    fetch(origin + "/api/v1/totake", {
      method: "PUT",
      headers: h,
      body: JSON.stringify(input),
    });
  const read = async () => {
    const r = await fetch(origin + "/api/v1/totake", { headers });
    assert.equal(r.status, 200);
    return r.json();
  };
  const grant = async (scope: string, native = false) => {
    const t = await empireGrant(cookie, scope, native);
    tokens.push(t);
    return t;
  };
  const policy = async (paused = false, showContent = true) => {
    const p = await getNotificationSettings(f.actor);
    await updateNotificationSettings(f.actor, {
      version: p.version,
      operationId: op(),
      paused,
      apps: { todo: false, totake: false },
      showContent,
    });
  };
  const oldGate = process.env.WUFF_TOTAKE_DELIVERY_ENABLED;
  process.env.WUFF_TOTAKE_DELIVERY_ENABLED = "true";
  try {
    await policy();
    const address = `https://fcm.googleapis.com/fcm/send/synthetic-${crypto.randomUUID()}`;
    const settings = await registerReminderDevice(f.actor, {
      operationId: op(),
      transport: "web",
      label: "Fictional action browser",
      address,
      subscription: {
        endpoint: address,
        expirationTime: null,
        keys: {
          p256dh: Buffer.concat([
            Buffer.from([4]),
            Buffer.alloc(64, 1),
          ]).toString("base64url"),
          auth: Buffer.alloc(16, 1).toString("base64url"),
        },
      },
    });
    const deviceId = settings.devices.find(
      (d) => d.label === "Fictional action browser",
    )!.id;
    devices.push(deviceId);
    const writable = await grant("totake:read totake:write"),
      readonly = await grant("totake:read"),
      native = await grant("lists:read totake:read totake:write", true);
    const [job] = await db
      .select()
      .from(totakeJobs)
      .where(eq(totakeJobs.userId, user.id));
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, job.runAt.getTime() - Date.now() + 1)),
    );
    let delivered: any;
    await deliverTotake(
      { id: job.id, version: job.version },
      async (target, payload) => {
        if (target.id === deviceId) delivered = payload;
      },
    );
    assert(
      delivered?.totake?.direct,
      "Real callback must attach guarded web actions",
    );
    assert.equal(
      new URL(delivered.path, origin).searchParams.get("account"),
      user.id,
    );
    assert.equal(delivered.totake.direct.deviceId, deviceId);
    const current = await read(),
      group = current.state.groups.find((g: any) => g.id === f.group.id),
      context = delivered.totake.direct;

    const change = {
      action: "record",
      groupId: group.id,
      itemIds: [group.items[0].id],
      outcome: "taken",
    };
    const input = {
      operationId: op(),
      version: current.version,
      change,
      notification: context,
    };
    assert.equal(
      (await put(input, { ...headers, Origin: "https://evil.invalid" })).status,
      403,
    );
    assert.equal(
      (await put(input, { ...headers, "X-Wuff-User": other.id })).status,
      409,
    );
    assert.equal(
      (
        await put({
          ...input,
          operationId: op(),
          notification: { ...context, userId: other.id },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await put({
          ...input,
          operationId: op(),
          notification: { ...context, deviceId: crypto.randomUUID() },
        })
      ).status,
      409,
    );
    const denied = await empireMcp(
      readonly.access_token,
      "update_totake",
      input,
    );
    assert(denied.result?.isError || denied.error);
    await policy(true);
    assert.equal((await put(input)).status, 409);
    await policy(false, false);
    assert.equal((await put(input)).status, 409);
    await policy();
    assert.equal(
      (
        await put({
          ...input,
          notification: { ...context, identity: "changed" },
          operationId: op(),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await put({
          ...input,
          notification: {
            ...context,
            issuedAt: Date.now() - 7200000,
            expiresAt: Date.now() - 3600000,
          },
          operationId: op(),
        })
      ).status,
      409,
    );
    // Concurrent duplicate clicks: exactly one new record/stock deduction.
    const otherClick = { ...input, operationId: op() };
    const race = await Promise.all([put(input), put(otherClick)]);
    assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
    const saved = await read();
    assert.equal(saved.state.treatments[0].inventory.current, "9");
    assert.equal(
      saved.state.groups.find((g: any) => g.id === group.id).records.length,
      1,
    );
    const mcpRead = await empireMcp(writable.access_token, "get_totake");
    assert.equal(
      mcpRead.result.structuredContent.totake.state.treatments[0].inventory
        .current,
      "9",
    );
    const winning = race[0].status === 200 ? input : otherClick;
    // Replay the successful HTTP action through the real MCP adapter.
    const replay = await empireMcp(
      writable.access_token,
      "update_totake",
      winning,
    );
    assert(!replay.result.isError);
    const recordId = saved.state.groups.find((g: any) => g.id === group.id)
      .records[0].id;
    const undone = await empireMcp(writable.access_token, "update_totake", {
      operationId: op(),
      version: saved.version,
      change: { action: "undo", groupId: group.id, recordId },
    });
    assert(!undone.result.isError);
    assert.equal((await read()).state.treatments[0].inventory.current, "10");
    const afterUndo = await read();
    assert.equal(
      (await put({ ...input, operationId: op(), version: afterUndo.version }))
        .status,
      409,
      "Old notification cannot record again after Undo",
    );
    const freshContext = makeTotakeNotification(
      afterUndo.state,
      afterUndo.state.groups.find((g: any) => g.id === group.id),
      user.id,
      deviceId,
      true,
      Date.now(),
    ).direct!;
    // Native bearer uses the same strict guard and mutation contract.
    const nativeResult = await fetch(origin + "/api/mobile", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${native.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "updateTotake",
        userId: user.id,
        input: {
          ...input,
          operationId: op(),
          version: afterUndo.version,
          notification: freshContext,
        },
      }),
    });
    assert.equal(nativeResult.status, 200);
    const nativeSaved = await read();
    assert.equal(nativeSaved.state.treatments[0].inventory.current, "9");
    const nativeRecord = nativeSaved.state.groups.find(
      (g: any) => g.id === group.id,
    ).records[0];
    assert.equal(
      (
        await put({
          operationId: op(),
          version: nativeSaved.version,
          change: {
            action: "undo",
            groupId: group.id,
            recordId: nativeRecord.id,
          },
        })
      ).status,
      200,
    );
    // Full app/MCP snooze choices remain legal, preserve due/stock and never record.
    for (const minutes of [15, 30, 45, 60]) {
      const latest = await read();
      const r = await empireMcp(writable.access_token, "update_totake", {
        operationId: op(),
        version: latest.version,
        change: {
          action: "snooze",
          groupId: group.id,
          itemIds: change.itemIds,
          minutes,
        },
      });
      assert(!r.result.isError);
      const x = await read();
      const g = x.state.groups.find((g: any) => g.id === group.id);
      assert.equal(g.due, group.due);
      assert.equal(g.records.length, 0);
      assert.equal(x.state.treatments[0].inventory.current, "10");
    }
    const latest = await read();
    assert.equal(
      (
        await put({
          ...input,
          operationId: op(),
          version: latest.version,
          notification: freshContext,
        })
      ).status,
      409,
      "Currently snoozed notice must be reviewed",
    );
    const skipped = await put({
      operationId: op(),
      version: latest.version,
      change: { ...change, outcome: "skipped" },
    });
    assert.equal(skipped.status, 200);
    assert.equal((await read()).state.treatments[0].inventory.current, "10");
    // Removing the device revokes even acknowledged notification receipt replay.
    await removeReminderDevice(f.actor, { deviceId, operationId: op() });
    assert.equal((await put(winning)).status, 409);
    await db
      .update(oauthTokens)
      .set({ revoked: true })
      .where(eq(oauthTokens.clientId, writable.clientId));
    assert.equal(
      (await empireMcp(writable.access_token, "update_totake", winning)).status,
      401,
    );
    assert.equal(
      (await getTotake(f.actor)).state.treatments![0].inventory.current,
      "10",
    );
  } finally {
    if (oldGate === undefined) delete process.env.WUFF_TOTAKE_DELIVERY_ENABLED;
    else process.env.WUFF_TOTAKE_DELIVERY_ENABLED = oldGate;
    for (const deviceId of devices)
      await removeReminderDevice(f.actor, { deviceId, operationId: op() });
    for (const t of tokens)
      await db
        .update(oauthTokens)
        .set({ revoked: true })
        .where(
          eq(
            oauthTokens.accessHash,
            createHash("sha256").update(t.access_token).digest("hex"),
          ),
        );
    await cleanupTotakeNotice(user.id, operations);
    await db
      .delete(notificationPreferences)
      .where(eq(notificationPreferences.userId, user.id));
    if (oldPolicy) await db.insert(notificationPreferences).values(oldPolicy);
  }
});
