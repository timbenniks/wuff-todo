import assert from "node:assert/strict";
import { eq, and, inArray } from "drizzle-orm";
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
  receipts,
} from "@wuff/db";
import { scopes, totakeEngine as e } from "@wuff/contracts";
import {
  emptyTotake,
  applyTotakeAction,
} from "../../packages/domain/src/modules/totake/state";
import {
  persistTotakeState,
  reconcileTotakeJob,
} from "../../packages/domain/src/modules/totake/totake";
export async function seedTotakeNotice(userId: string, count = 1) {
  assert(
    process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l") &&
      !process.env.QSTASH_TOKEN,
    "Synthetic isolated development only",
  );
  const db = database().db;
  assert.equal(
    (
      await db
        .select()
        .from(totakeAccounts)
        .where(eq(totakeAccounts.userId, userId))
    ).length,
    0,
    "Never replace pre-existing fixture medical data",
  );
  const at = Math.floor(Date.now() / 60000) * 60000 - 60000;
  const initial = emptyTotake(at);
  let state = initial;
  for (let n = 0; n < count; n++) {
    const draft = e.newTreatment(
      "medication",
      "custom",
      Math.floor(state.now / 1440),
    );
    draft.name = `Fictional notification item ${n + 1}`;
    draft.slots[0].time = e.time(state.now);
    draft.inventory = {
      enabled: true,
      current: "10",
      threshold: "2",
      unit: "tablet",
    };
    state = applyTotakeAction(
      state,
      { action: "save_treatment", draft },
      crypto.randomUUID(),
      at,
    );
  }
  await db.transaction(async (tx) => {
    await persistTotakeState(tx, userId, initial, state, 1);
    await reconcileTotakeJob(tx, userId, state);
  });
  return {
    actor: { id: userId, scopes },
    state,
    group: state.groups.find(
      (g) => (g.items[0].alertInstant ?? Infinity) <= Date.now(),
    )!,
  };
}
export async function cleanupTotakeNotice(
  userId: string,
  operationIds: string[],
) {
  assert(process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"));
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
    await database().db.delete(table).where(eq(table.userId, userId));
  if (operationIds.length)
    await database()
      .db.delete(receipts)
      .where(
        and(
          eq(receipts.actorId, userId),
          inArray(receipts.operationId, operationIds),
        ),
      );
}
