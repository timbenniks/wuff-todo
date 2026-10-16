import { loginFixture } from "./helpers/login";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { database, users } from "@wuff/db";
import { scopes, type ListSummary } from "@wuff/contracts";
import {
  createList,
  createTask,
  getList,
  deleteList,
  inviteToList,
  respondToInvitation,
  removeListMember,
} from "@wuff/domain";
import {
  createRealtimeClient,
  waitForLive,
  disconnectLiveConnections,
} from "./helpers/live";
import type { SealedLiveQuery } from "@neon/realtime/client";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw new Error("Isolated development only");
if (!process.env.NEON_REALTIME_SECRET || !process.env.NEON_REALTIME_URL)
  throw new Error("Development Realtime configuration required");
const origin = "http://localhost:3000";
const fixtures = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const a = { id: fixtures[0].id, scopes },
  b = { id: fixtures[1].id, scopes };
const op = () => crypto.randomUUID();
const headers = { Origin: origin, "Content-Type": "application/json" };
after(async () => database().pool.end());
async function login(index = 0) {
  return loginFixture(fixtures[index]);
}
async function seal(cookie: string, userId: string, extraHeaders = {}) {
  return fetch(origin + "/api/v1/live", {
    method: "POST",
    headers: { ...headers, Cookie: cookie, ...extraHeaders },
    body: JSON.stringify({ userId }),
  });
}
test("live subscriptions enforce identity, admission, shared membership and revocation", async () => {
  const ca = await login(0),
    cb = await login(1),
    co = await login(2);
  assert.equal((await seal("", a.id)).status, 401);
  assert.equal((await seal(co, fixtures[2].id)).status, 403);
  assert.equal(
    (await seal(cb, a.id)).status,
    409,
    "Old page cannot renew as a different signed-in user",
  );
  assert.equal(
    (await seal(ca, a.id, { Origin: "https://other.example" })).status,
    403,
  );
  const ra = await seal(ca, a.id),
    rb = await seal(cb, b.id);
  assert.equal(ra.status, 200);
  assert.equal(rb.status, 200);
  assert.equal(rb.headers.get("Cache-Control"), "no-store");
  const configA = await ra.json(),
    configB = await rb.json();
  assert.ok(
    !JSON.stringify(configB).includes(process.env.NEON_REALTIME_SECRET!),
    "Capability response never contains the sealing secret",
  );
  assert.equal(typeof configB.query.capability, "string");
  const clientA = createRealtimeClient({
    url: configA.url,
    logLevel: "silent",
  });
  const clientB = createRealtimeClient({
    url: configB.url,
    logLevel: "silent",
  });
  const sa = clientA.subscribe(configA.query as SealedLiveQuery<ListSummary>),
    sb = clientB.subscribe(configB.query as SealedLiveQuery<ListSummary>);
  let list = await createList(a, {
    title: "Live permissions proof",
    operationId: op(),
  });
  let own = await createList(b, {
    title: "Recipient private proof",
    operationId: op(),
  });
  try {
    await Promise.all([
      waitForLive(sa, (rows) => rows.some((r) => r.id === list.id), 20000),
      waitForLive(sb, (rows) => rows.some((r) => r.id === own.id), 20000),
    ]);
    assert.ok(!sb.getSnapshot().data!.some((r) => r.id === list.id));
    assert.ok(!sa.getSnapshot().data!.some((r) => r.id === own.id));
    let sharing = await inviteToList(a, {
      listId: list.id,
      version: list.version,
      email: fixtures[1].email,
      operationId: op(),
    });
    assert.ok(
      !sb.getSnapshot().data!.some((r) => r.id === list.id),
      "Pending invitation is not membership",
    );
    await respondToInvitation(b, {
      invitationId: sharing.invitations[0].id,
      accept: true,
      operationId: op(),
    });
    await waitForLive(sb, (rows) => rows.some((r) => r.id === list.id));
    list = await getList(a, list.id);
    list = await createTask(a, {
      listId: list.id,
      version: list.version,
      title: "Live shared task",
      operationId: op(),
    });
    await waitForLive(sb, (rows) =>
      rows.some((r) => r.id === list.id && r.version === list.version),
    );
    const renewed = await (await seal(cb, b.id)).json();
    assert.equal(
      renewed.query.queryFingerprint,
      configB.query.queryFingerprint,
    );
    await sb.renew(renewed.query);
    const states: string[] = [];
    const stopState = sb.onStateChange((state) => states.push(state.status));
    disconnectLiveConnections();
    list = await createTask(a, {
      listId: list.id,
      version: list.version,
      title: "Changed while reconnecting",
      operationId: op(),
    });
    await waitForLive(sb, (rows) =>
      rows.some((row) => row.id === list.id && row.version === list.version),
    );
    assert.ok(
      states.includes("connecting"),
      "A dropped transport reconnects and reconciles committed state",
    );
    stopState();
    await removeListMember(a, {
      listId: list.id,
      version: list.version,
      userId: b.id,
      operationId: op(),
    });
    await waitForLive(sb, (rows) => !rows.some((r) => r.id === list.id));
    const after = await createTask(a, {
      listId: list.id,
      version: (await getList(a, list.id)).version,
      title: "Private after removal",
      operationId: op(),
    });
    await waitForLive(sa, (rows) =>
      rows.some((r) => r.id === list.id && r.version === after.version),
    );
    assert.ok(!sb.getSnapshot().data!.some((r) => r.id === list.id));
    const pinned = await fetch(origin + "/api/v1/tasks", {
      method: "POST",
      headers: { ...headers, Cookie: cb, "X-Wuff-User": a.id },
      body: JSON.stringify({
        listId: own.id,
        version: own.version,
        title: "Must not write under another account",
        operationId: op(),
      }),
    });
    assert.equal(pinned.status, 409);
    assert.equal((await getList(b, own.id)).tasks.length, 0);
    // Disable only a dedicated synthetic profile; don't race other test files'
    // shared Alex/Sam login fixtures.
    const disabledId = "live-disabled-fixture";
    await database()
      .db.insert(users)
      .values({
        id: disabledId,
        email: `${disabledId}@example.invalid`,
        name: "Disabled live proof",
      })
      .onConflictDoNothing();
    await database()
      .db.update(users)
      .set({ enabled: true })
      .where(eq(users.id, disabledId));
    try {
      const { getLiveQuery } = await import("@wuff/domain");
      const { createRealtime, rawSql } = await import("@neon/realtime/server");
      const rt = createRealtime({
        secret: process.env.NEON_REALTIME_SECRET!,
        db: new URL(process.env.DATABASE_URL!).pathname.slice(1),
      });
      const actor = { id: disabledId, scopes };
      const def = await getLiveQuery(actor);
      const capability = await rt.seal({
        query: rawSql<ListSummary>(def.query, def.params),
      });
      const sub = clientB.subscribe(capability);
      const enabledList = await createList(actor, {
        title: "Admission live proof",
        operationId: op(),
      });
      try {
        await waitForLive(sub, (rows) =>
          rows.some((r) => r.id === enabledList.id),
        );
        await database()
          .db.update(users)
          .set({ enabled: false })
          .where(eq(users.id, disabledId));
        await waitForLive(sub, (rows) => rows.length === 0);
      } finally {
        sub.unsubscribe();
        await database()
          .db.update(users)
          .set({ enabled: true })
          .where(eq(users.id, disabledId));
        await deleteList(actor, {
          listId: enabledList.id,
          version: (await getList(actor, enabledList.id)).version,
          operationId: op(),
        });
      }
    } finally {
      // Mutation receipts reference this synthetic profile, so retain it as a
      // disabled fixture instead of deleting audit records.
      await database()
        .db.update(users)
        .set({ enabled: false })
        .where(eq(users.id, disabledId));
    }
  } finally {
    sa.unsubscribe();
    sb.unsubscribe();
    clientA.close();
    clientB.close();
    for (const [actor, id] of [
      [a, list.id],
      [b, own.id],
    ] as const)
      await deleteList(actor, {
        listId: id,
        version: (await getList(actor, id)).version,
        operationId: op(),
      });
  }
});
