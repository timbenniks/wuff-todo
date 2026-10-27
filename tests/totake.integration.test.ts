import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  database,
  totakeAccounts,
  totakeTreatments,
  totakeSchedules,
  totakeOccurrences,
  totakeRecords,
  totakeAudit,
  totakeStockMovements,
  totakeJobs,
  totakeDeliveries,
  notificationPreferences,
  receipts,
  oauthTokens,
  reminderDevices,
} from "@wuff/db";
import { scopes, totakeEngine as e } from "@wuff/contracts";
import {
  getTotake,
  updateTotake,
  getNotificationSettings,
  updateNotificationSettings,
  registerReminderDevice,
  removeReminderDevice,
  deliverTotake,
  recoverTotakeScheduling,
} from "@wuff/domain";
import { loginFixture } from "./helpers/login";
import {
  empireGrant,
  empireMcp,
  fixtureOrigin as origin,
} from "./helpers/empire-grant";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Isolated development only");
const fixtures = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const actor = { id: fixtures[0].id, scopes },
  other = { id: fixtures[1].id, scopes };
after(() => database().pool.end());
test("Totake real domain/HTTP/MCP parity, consent, account isolation, receipts and concurrent records", async () => {
  const db = database().db;
  assert.equal(
    (
      await db
        .select()
        .from(totakeAccounts)
        .where(eq(totakeAccounts.userId, actor.id))
    ).length,
    0,
    "Synthetic actor must have no pre-existing Totake data",
  );
  const [oldNotifications] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, actor.id));
  const operations: string[] = [],
    tokens: string[] = [];
  let cookie = "";
  let deviceId = "";
  const op = () => {
    const id = crypto.randomUUID();
    operations.push(id);
    return id;
  };
  const update = (version: number, change: unknown) =>
    updateTotake(actor, { version, change, operationId: op() });
  try {
    const otherBefore = await getTotake(other);
    await assert.rejects(
      getTotake({ ...actor, scopes: ["lists:read", "tasks:write"] }),
      { code: "forbidden" },
    );
    await assert.rejects(
      updateTotake(
        { ...actor, scopes: ["totake:read"] },
        {
          version: 0,
          operationId: op(),
          change: { action: "settings", repeat: 30, timezone: "Europe/Paris" },
        },
      ),
      { code: "forbidden" },
    );
    cookie = await loginFixture(fixtures[0]);
    const headers = {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
      "X-Wuff-User": actor.id,
    };
    assert.equal((await fetch(origin + "/api/v1/totake")).status, 401);
    assert.equal(
      (
        await fetch(origin + "/api/v1/totake", {
          headers: { ...headers, "X-Wuff-User": other.id },
        })
      ).status,
      409,
    );
    const grant = await empireGrant(
      cookie,
      "totake:read totake:write notifications:read notifications:manage",
    );
    tokens.push(grant.access_token);
    const readonly = await empireGrant(cookie, "totake:read");
    tokens.push(readonly.access_token);
    const legacy = await empireGrant(cookie, "lists:read tasks:write");
    tokens.push(legacy.access_token);
    const expanded = await fetch(origin + "/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: legacy.clientId,
        refresh_token: legacy.refresh_token,
        resource: legacy.resource,
        scope: "lists:read totake:read",
      }),
    });
    assert.equal(expanded.status, 400);

    const initial = await getTotake(actor),
      today = Math.floor(initial.state.now / 1440),
      draft = e.newTreatment("medication", "custom", today + 1);
    draft.name = "Synthetic integration tablet";
    draft.slots[0].time = "08:00";
    draft.inventory = {
      enabled: true,
      current: "10",
      threshold: "2",
      unit: "tablet",
    };
    const input = {
      version: 0,
      operationId: op(),
      change: { action: "save_treatment", draft },
    };
    assert.equal(
      (
        await fetch(origin + "/api/v1/totake", {
          method: "PUT",
          headers: { ...headers, Origin: "https://other.example" },
          body: JSON.stringify(input),
        })
      ).status,
      403,
    );
    const savedResponse = await fetch(origin + "/api/v1/totake", {
      method: "PUT",
      headers,
      body: JSON.stringify(input),
    });
    assert.equal(savedResponse.status, 200);
    let saved = await savedResponse.json();
    const summaryResponse = await fetch(origin + "/api/v1/totake/summary", {
      headers,
    });
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.next.length, 5);
    assert(!JSON.stringify(summary).includes(draft.name));
    assert.deepEqual(
      (await empireMcp(grant.access_token, "get_totake_summary")).result
        .structuredContent.summary,
      summary,
    );
    const mcp = await empireMcp(grant.access_token, "get_totake");
    assert.equal(mcp.result.structuredContent.totake.version, saved.version);
    assert.equal(
      mcp.result.structuredContent.totake.state.treatments[0].name,
      draft.name,
    );
    assert.equal(
      (await empireMcp(legacy.access_token, "get_totake")).result.isError,
      true,
    );
    const group = saved.state.groups[0],
      change = {
        action: "record",
        groupId: group.id,
        itemIds: [group.items[0].id],
        outcome: "taken",
      };
    const recording = { version: saved.version, operationId: op(), change };
    assert.equal(
      (await empireMcp(readonly.access_token, "update_totake", recording))
        .result.isError,
      true,
    );
    const recorded = await empireMcp(
      grant.access_token,
      "update_totake",
      recording,
    );
    assert.equal(recorded.result.isError, undefined);
    saved = recorded.result.structuredContent.totake;
    assert.equal(saved.state.treatments[0].inventory.current, "9");
    assert.equal(
      (await getTotake(actor)).state.treatments![0].inventory.current,
      "9",
    );
    const retry = await empireMcp(
      grant.access_token,
      "update_totake",
      recording,
    );
    assert.equal(
      retry.result.structuredContent.totake.state.treatments[0].inventory
        .current,
      "9",
    );
    await assert.rejects(
      updateTotake(actor, {
        ...recording,
        change: { ...change, outcome: "skipped" },
      }),
      { code: "idempotency_conflict" },
    );
    const recordId = saved.state.groups.find((g: any) => g.id === group.id)
      .records[0].id;
    const undoResponse = await fetch(origin + "/api/v1/totake", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        version: saved.version,
        operationId: op(),
        change: { action: "undo", groupId: group.id, recordId },
      }),
    });
    assert.equal(undoResponse.status, 200);
    assert.equal(
      (await getTotake(actor)).state.treatments![0].inventory.current,
      "10",
    );
    const current = await getTotake(actor);
    const concurrent = await Promise.allSettled(
      [1, 2].map(() => update(current.version, change)),
    );
    assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      concurrent.filter(
        (r) => r.status === "rejected" && r.reason.code === "conflict",
      ).length,
      1,
    );
    assert.equal(
      (await getTotake(actor)).state.treatments![0].inventory.current,
      "9",
    );
    const otherAfter = await getTotake(other);
    assert.equal(otherAfter.version, otherBefore.version);
    assert.deepEqual(otherAfter.state.treatments, otherBefore.state.treatments);
    const notificationBefore = await getNotificationSettings(actor);
    const pause = {
      ...notificationBefore,
      operationId: op(),
      paused: true,
      apps: { todo: false, totake: false },
    };
    const { userId: _, ...pauseInput } = pause;
    const notificationResponse = await fetch(origin + "/api/v1/notifications", {
      method: "PUT",
      headers,
      body: JSON.stringify(pauseInput),
    });
    assert.equal(notificationResponse.status, 200);
    assert.equal(
      (await empireMcp(grant.access_token, "get_notification_settings")).result
        .structuredContent.notifications.paused,
      true,
    );
    const paused = await getNotificationSettings(actor);
    const resume = {
      version: paused.version,
      operationId: op(),
      paused: false,
      apps: { todo: false, totake: false },
      showContent: false,
    };
    assert.equal(
      (
        await empireMcp(
          grant.access_token,
          "update_notification_settings",
          resume,
        )
      ).result.isError,
      undefined,
    );
    assert.equal((await getNotificationSettings(actor)).paused, false);
    await db
      .update(oauthTokens)
      .set({ revoked: true })
      .where(
        eq(
          oauthTokens.accessHash,
          createHash("sha256").update(grant.access_token).digest("hex"),
        ),
      );
    assert.equal(
      (await empireMcp(grant.access_token, "get_totake")).status,
      401,
    );
    assert.equal(
      (await empireMcp(grant.access_token, "update_totake", recording)).status,
      401,
    );
  } finally {
    if (deviceId)
      await removeReminderDevice(actor, { deviceId, operationId: op() });
    for (const token of tokens)
      await db
        .update(oauthTokens)
        .set({ revoked: true })
        .where(
          eq(
            oauthTokens.accessHash,
            createHash("sha256").update(token).digest("hex"),
          ),
        );
    for (const table of [
      totakeJobs,
      totakeStockMovements,
      totakeAudit,
      totakeRecords,
      totakeOccurrences,
      totakeSchedules,
      totakeTreatments,
      totakeAccounts,
    ])
      await db.delete(table).where(eq(table.userId, actor.id));
    await db
      .delete(notificationPreferences)
      .where(eq(notificationPreferences.userId, actor.id));
    if (oldNotifications)
      await db.insert(notificationPreferences).values(oldNotifications);
    if (operations.length)
      await db
        .delete(receipts)
        .where(
          and(
            eq(receipts.actorId, actor.id),
            inArray(receipts.operationId, operations),
          ),
        );
    if (cookie)
      await fetch(origin + "/api/auth/sign-out", {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
  }
});

test("Totake callbacks enforce pauses, partial-device retry receipts, current state and no repeat backlog", async () => {
  assert.equal(
    process.env.WUFF_ORIGIN,
    origin,
    "No provider publication from integration tests",
  );
  const db = database().db;
  assert.equal(
    (
      await db
        .select()
        .from(totakeAccounts)
        .where(eq(totakeAccounts.userId, actor.id))
    ).length,
    0,
  );
  const [original] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, actor.id));
  const oldGate = process.env.WUFF_TOTAKE_DELIVERY_ENABLED;
  process.env.WUFF_TOTAKE_DELIVERY_ENABLED = "true";
  const operations: string[] = [],
    devices: string[] = [];
  const op = () => {
    const id = crypto.randomUUID();
    operations.push(id);
    return id;
  };
  try {
    let snapshot = await getTotake(actor);
    const t = e.newTreatment(
      "medication",
      "custom",
      Math.floor(snapshot.state.now / 1440) + 1,
    );
    t.name = "Synthetic reminder count";
    t.inventory = {
      enabled: true,
      current: "10",
      threshold: "2",
      unit: "tablet",
    };
    snapshot = await updateTotake(actor, {
      version: 0,
      operationId: op(),
      change: { action: "save_treatment", draft: t },
    });
    for (let n = 0; n < 2; n++) {
      const endpoint = `https://fcm.googleapis.com/fcm/send/totake-${crypto.randomUUID()}`,
        label = `Totake callback fixture ${n}`,
        result = await registerReminderDevice(actor, {
          operationId: op(),
          transport: "web",
          address: endpoint,
          subscription: {
            endpoint,
            keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
          },
          label,
        });
      devices.push(result.devices.find((d) => d.label === label)!.id);
    }
    const [legacy] = await db
      .insert(reminderDevices)
      .values({
        userId: actor.id,
        transport: "android",
        address: crypto.randomUUID(),
        label: "Retired callback fixture",
      })
      .returning({ id: reminderDevices.id });
    devices.push(legacy.id);
    let settings = await getNotificationSettings(actor);
    const pause = async (paused: boolean) => {
      settings = await updateNotificationSettings(actor, {
        version: settings.version,
        operationId: op(),
        paused,
        apps: { todo: false, totake: false },
        showContent: false,
      });
    };
    await pause(true);
    let [job] = await db
      .select()
      .from(totakeJobs)
      .where(eq(totakeJobs.userId, actor.id));
    const due = snapshot.state.groups[0].items[0].alertInstant!;
    let sends = 0;
    await deliverTotake(
      { id: job.id, version: job.version },
      async () => {
        sends++;
      },
      due,
    );
    assert.equal(sends, 0);
    await pause(false);
    [job] = await db
      .select()
      .from(totakeJobs)
      .where(eq(totakeJobs.userId, actor.id));
    const accepted = new Map<string, number>();
    let failure = true;
    const sender = async (
      device: { id: string; transport: string },
      payload: { body: string; urgency: string },
    ) => {
      assert.equal(payload.urgency, "high");
      assert.equal(device.transport, "web");
      assert.equal(payload.body, "Open Wuff to view your reminder.");
      if (accepted.size === 1 && !accepted.has(device.id) && failure) {
        failure = false;
        throw Error("Synthetic later-device failure");
      }
      accepted.set(device.id, (accepted.get(device.id) ?? 0) + 1);
    };
    await assert.rejects(
      deliverTotake({ id: job.id, version: job.version }, sender, due),
      { code: "push_unavailable" },
    );
    assert.equal(accepted.size, 1);
    await deliverTotake({ id: job.id, version: job.version }, sender, due);
    assert.equal(accepted.size, 2);
    assert.equal(
      (
        await db
          .select()
          .from(reminderDevices)
          .where(eq(reminderDevices.id, legacy.id))
      ).length,
      1,
      "legacy device is preserved without receiving medicine alerts",
    );
    assert.deepEqual([...accepted.values()], [1, 1]);
    const [nextJob] = await db
      .select()
      .from(totakeJobs)
      .where(eq(totakeJobs.userId, actor.id));
    assert.ok(nextJob.version > job.version);
    assert.equal(nextJob.runAt.getTime(), due + 30 * 60000);
    await deliverTotake(
      { id: job.id, version: job.version },
      sender,
      due + 60 * 60000,
    );
    assert.deepEqual([...accepted.values()], [1, 1]);
    const current = await getTotake(actor),
      group = current.state.groups.find(
        (g) => g.id === snapshot.state.groups[0].id,
      )!;
    await updateTotake(actor, {
      version: current.version,
      operationId: op(),
      change: {
        action: "record",
        groupId: group.id,
        itemIds: [group.items[0].id],
        outcome: "taken",
      },
    });
    await deliverTotake(
      { id: nextJob.id, version: nextJob.version },
      sender,
      due + 30 * 60000,
    );
    assert.deepEqual([...accepted.values()], [1, 1]);
    assert.equal(
      (await getTotake(actor)).state.treatments![0].inventory.current,
      "9",
    );
    await db
      .update(totakeJobs)
      .set({
        enabled: true,
        scheduling: "scheduled",
        runAt: new Date(Date.now() - 86400000),
      })
      .where(eq(totakeJobs.userId, actor.id));
    const [orphan] = await db
      .select()
      .from(totakeJobs)
      .where(eq(totakeJobs.userId, actor.id));
    await recoverTotakeScheduling();
    const [recovered] = await db
      .select()
      .from(totakeJobs)
      .where(eq(totakeJobs.userId, actor.id));
    assert.equal(recovered.scheduling, "pending");
    assert.equal(recovered.version, orphan.version + 1);
  } finally {
    for (const deviceId of devices)
      await removeReminderDevice(actor, { deviceId, operationId: op() });
    for (const table of [
      totakeJobs,
      totakeStockMovements,
      totakeAudit,
      totakeRecords,
      totakeOccurrences,
      totakeSchedules,
      totakeTreatments,
      totakeAccounts,
    ])
      await db.delete(table).where(eq(table.userId, actor.id));
    await db
      .delete(notificationPreferences)
      .where(eq(notificationPreferences.userId, actor.id));
    if (original) await db.insert(notificationPreferences).values(original);
    if (operations.length)
      await db
        .delete(receipts)
        .where(
          and(
            eq(receipts.actorId, actor.id),
            inArray(receipts.operationId, operations),
          ),
        );
    if (oldGate === undefined) delete process.env.WUFF_TOTAKE_DELIVERY_ENABLED;
    else process.env.WUFF_TOTAKE_DELIVERY_ENABLED = oldGate;
  }
});
