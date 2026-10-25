import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { database, empirePreferences, users } from "@wuff/db";
import { scopes } from "@wuff/contracts";
import {
  getEmpireSettings,
  updateEmpireSettings,
  getDashboardPreferences,
  getListOrder,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Development only");
const fixtures = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const actor = { id: fixtures[0].id, scopes },
  other = { id: fixtures[1].id, scopes };
after(() => database().pool.end());
test("Empire choices have isolated revisions, patch semantics, scope/admission checks and retry/concurrency safety", async () => {
  const db = database().db;
  const [original] = await db
    .select()
    .from(empirePreferences)
    .where(eq(empirePreferences.userId, actor.id));
  const otherBefore = await getEmpireSettings(other),
    dashboardBefore = await getDashboardPreferences(actor),
    listsBefore = await getListOrder(actor);
  const op = () => crypto.randomUUID();
  try {
    const initial = await getEmpireSettings(actor);
    const seeded = {
      ...initial.apps,
      future: { visible: false, dashboard: false },
    };
    await db
      .insert(empirePreferences)
      .values({ userId: actor.id, version: initial.version, apps: seeded })
      .onConflictDoUpdate({
        target: empirePreferences.userId,
        set: { apps: seeded },
      });
    const input = {
      version: initial.version,
      operationId: op(),
      changes: [{ appId: "todo", visible: false }],
    };
    const saved = await updateEmpireSettings(actor, input);
    assert.equal(saved.version, initial.version + 1);
    assert.equal(saved.apps.todo.visible, false);
    assert.deepEqual(saved.apps.future, seeded.future);
    assert.deepEqual(await updateEmpireSettings(actor, input), saved);
    await assert.rejects(
      updateEmpireSettings(actor, {
        ...input,
        changes: [{ appId: "todo", visible: true }],
      }),
      { code: "idempotency_conflict" },
    );
    await assert.rejects(
      updateEmpireSettings(actor, { ...input, operationId: op() }),
      { code: "conflict" },
    );
    const concurrent = await Promise.allSettled(
      [false, true].map((visible) =>
        updateEmpireSettings(actor, {
          version: saved.version,
          operationId: op(),
          changes: [{ appId: "todo", visible }],
        }),
      ),
    );
    assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      concurrent.filter(
        (r) => r.status === "rejected" && r.reason.code === "conflict",
      ).length,
      1,
    );
    assert.deepEqual(await getEmpireSettings(other), otherBefore);
    assert.deepEqual(await getDashboardPreferences(actor), dashboardBefore);
    assert.deepEqual(await getListOrder(actor), listsBefore);
    await assert.rejects(
      getEmpireSettings({ ...actor, scopes: ["lists:read", "lists:manage"] }),
      { code: "forbidden" },
    );
    await assert.rejects(
      updateEmpireSettings(
        { ...actor, scopes: ["empire:read"] },
        { ...input, operationId: op() },
      ),
      { code: "forbidden" },
    );
    const onlyEmpire = await getEmpireSettings({
      ...actor,
      scopes: ["empire:read"],
    });
    assert.equal(onlyEmpire.userId, actor.id);
    await db
      .update(users)
      .set({ enabled: false })
      .where(eq(users.id, actor.id));
    await assert.rejects(updateEmpireSettings(actor, input), {
      code: "invite_required",
    });
  } finally {
    await db.update(users).set({ enabled: true }).where(eq(users.id, actor.id));
    if (original)
      await db.insert(empirePreferences).values(original).onConflictDoUpdate({
        target: empirePreferences.userId,
        set: original,
      });
    else
      await db
        .delete(empirePreferences)
        .where(eq(empirePreferences.userId, actor.id));
  }
});
