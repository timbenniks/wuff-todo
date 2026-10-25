import { validateNotificationAction } from "@wuff/contracts/modules/totake/notification";
import { notificationPolicy } from "../../platform/notification-settings";
import { createHash } from "node:crypto";
import { and, eq, sql, inArray, asc } from "drizzle-orm";
import {
  database,
  users,
  receipts,
  totakeAccounts,
  totakeTreatments,
  totakeSchedules,
  totakeOccurrences,
  totakeRecords,
  totakeAudit,
  totakeStockMovements,
  totakeJobs,
  reminderDevices,
} from "@wuff/db";
import {
  AppError,
  totakeQuerySchema,
  totakeMutationSchema,
  totakeEngine as e,
  type Actor,
  type TotakeState,
  type TotakeSnapshot,
} from "@wuff/contracts";
import { schedulePendingTotake } from "./delivery";
import {
  emptyTotake,
  refreshTotake,
  applyTotakeAction,
  totakeNeedsScheduler,
} from "./state";
type Db = ReturnType<typeof database>["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
async function admitted(tx: Db | Tx, actor: Actor, write = false) {
  if (
    !actor.scopes.includes("totake:read") ||
    (write && !actor.scopes.includes("totake:write"))
  )
    throw new AppError(
      "forbidden",
      "Allow Totake access in a new connection consent before continuing.",
      403,
    );
  const [user] = await tx
    .select({ enabled: users.enabled })
    .from(users)
    .where(eq(users.id, actor.id));
  if (!user?.enabled)
    throw new AppError(
      "invite_required",
      "An active Wuff account is required.",
      403,
    );
}
export async function loadTotakeState(
  tx: Db | Tx,
  userId: string,
  now: number,
) {
  const [account] = await tx
    .select()
    .from(totakeAccounts)
    .where(eq(totakeAccounts.userId, userId));
  if (!account) return { version: 0, state: emptyTotake(now) };
  const treatments = await tx
    .select()
    .from(totakeTreatments)
    .where(eq(totakeTreatments.userId, userId));
  const groups = await tx
    .select()
    .from(totakeOccurrences)
    .where(eq(totakeOccurrences.userId, userId));
  const records = await tx
    .select()
    .from(totakeRecords)
    .where(eq(totakeRecords.userId, userId));
  const audit = await tx
    .select()
    .from(totakeAudit)
    .where(eq(totakeAudit.userId, userId))
    .orderBy(asc(totakeAudit.ordinal));
  const movements = await tx
    .select()
    .from(totakeStockMovements)
    .where(eq(totakeStockMovements.userId, userId))
    .orderBy(asc(totakeStockMovements.ordinal));
  const scheduled = records.filter((r) => r.kind === "scheduled" && !r.undone);
  const byGroup = new Map<string, e.RecordEntry[]>();
  for (const r of scheduled)
    byGroup.set(r.groupId, [
      ...(byGroup.get(r.groupId) ?? []),
      r.body as e.RecordEntry,
    ]);
  const metadata = account.metadata;
  const state: TotakeState = {
    ...metadata,
    treatments: treatments.map((t) => t.body),
    groups: groups.map((g) => ({
      ...g.body,
      records: byGroup.get(g.id) ?? [],
    })),
    intakes: records
      .filter((r) => r.kind === "intake")
      .map((r) => ({ ...r.body, undone: r.undone }) as e.Intake),
    audit: audit.map((a) => a.body as e.AuditEntry),
    stock: metadata.stock
      ? {
          ...metadata.stock,
          movements: movements.map((m) => m.body as e.StockMovement),
        }
      : undefined,
  };
  return { version: account.version, state };
}
function response(
  userId: string,
  version: number,
  state: TotakeState,
): TotakeSnapshot {
  return {
    userId,
    version,
    state,
    delivery: {
      enabled: process.env.WUFF_TOTAKE_DELIVERY_ENABLED === "true",
      message:
        process.env.WUFF_TOTAKE_DELIVERY_ENABLED === "true"
          ? "Notification scheduling enabled. Device permission and delivery must be checked in Settings."
          : "Notification delivery is being integrated. Saved schedules are not proof of delivery.",
    },
  };
}
export async function getTotake(actor: Actor, data: unknown = {}) {
  const query = totakeQuerySchema.parse(data);
  return database().db.transaction(
    async (tx) => {
      await admitted(tx, actor);
      const { version, state } = await loadTotakeState(
        tx,
        actor.id,
        Date.now(),
      );
      return response(
        actor.id,
        version,
        refreshTotake(state, Date.now(), query.day),
      );
    },
    { isolationLevel: "repeatable read" },
  );
}
const json = (value: unknown) => JSON.stringify(value);
export async function updateTotake(actor: Actor, data: unknown) {
  const input = totakeMutationSchema.parse(data),
    now = Date.now();
  const result = await database().db.transaction(async (tx) => {
    await admitted(tx, actor, true);
    if (input.notification) {
      // Same lock order as delivery/pause/device revocation: platform then product.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`reminders:${actor.id}`},0))`,
      );
      const context = input.notification;
      const [device] = await tx
        .select()
        .from(reminderDevices)
        .where(
          and(
            eq(reminderDevices.id, context.deviceId),
            eq(reminderDevices.userId, actor.id),
            eq(reminderDevices.transport, "web"),
          ),
        );
      const policy = await notificationPolicy(tx, actor.id, "totake");
      const at = Date.now();
      if (
        context.userId !== actor.id ||
        !device ||
        policy.paused ||
        !policy.showContent ||
        context.issuedAt > at ||
        context.expiresAt <= at
      )
        throw new AppError(
          "stale_notification",
          "Open Totake to review this reminder. Notification permission, privacy or device access changed.",
          409,
        );
    }
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`totake:${actor.id}`},0))`,
    );
    const fingerprint = createHash("sha256")
      .update(json({ kind: "totake", ...input }))
      .digest("hex");
    const [receipt] = await tx
      .select()
      .from(receipts)
      .where(
        and(
          eq(receipts.actorId, actor.id),
          eq(receipts.operationId, input.operationId),
        ),
      );
    const current = await loadTotakeState(tx, actor.id, now);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        throw new AppError(
          "idempotency_conflict",
          "This operation ID belongs to another request.",
          409,
        );
      return response(
        actor.id,
        current.version,
        refreshTotake(current.state, now),
      );
    }
    if (current.version !== input.version)
      throw new AppError(
        "conflict",
        "Your Totake data changed. Load the latest version before saving.",
        409,
      );
    let next: TotakeState;
    try {
      const groupDay =
        "groupId" in input.change
          ? Number(input.change.groupId.match(/^(\d+)-/)?.[1])
          : NaN;
      const prepared = Number.isFinite(groupDay)
        ? refreshTotake(current.state, now, groupDay)
        : current.state;
      if (input.notification) {
        try {
          validateNotificationAction(
            refreshTotake(prepared, now),
            input.change,
            input.notification,
            actor.id,
            Date.now(),
          );
        } catch {
          throw new AppError(
            "stale_notification",
            "This notification changed. Open Totake to review before recording.",
            409,
          );
        }
      }
      next = applyTotakeAction(prepared, input.change, input.operationId, now);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "invalid_totake_action",
        error instanceof Error
          ? error.message
          : "Check your input and try again.",
        400,
      );
    }
    await persistTotakeState(
      tx,
      actor.id,
      current.state,
      next,
      current.version + 1,
    );
    await reconcileTotakeJob(tx, actor.id, next);
    await tx.insert(receipts).values({
      actorId: actor.id,
      operationId: input.operationId,
      fingerprint,
      result: { id: actor.id },
    });
    return response(actor.id, current.version + 1, next);
  });
  await schedulePendingTotake(actor.id);
  return result;
}
export async function persistTotakeState(
  tx: Tx,
  userId: string,
  previous: TotakeState,
  next: TotakeState,
  version: number,
) {
  const { treatments = [], groups, audit, intakes = [], ...metadata } = next;
  const oldTreatments = new Map(previous.treatments?.map((t) => [t.id, t])),
    oldGroups = new Map(previous.groups.map((g) => [g.id, g]));
  const oldRecords = new Set(
      previous.groups.flatMap((g) => g.records.map((r) => r.id)),
    ),
    oldIntakes = new Map(previous.intakes?.map((i) => [i.id, i]));
  const oldAudit = new Set(previous.audit.map((a) => a.id)),
    oldMovements = new Set(previous.stock?.movements.map((m) => m.id));
  const nextGroups = new Set(groups.map((g) => g.id));
  // Movements and records have their own immutable ledgers.
  if (metadata.stock) metadata.stock = { ...metadata.stock, movements: [] };
  await tx
    .insert(totakeAccounts)
    .values({ userId, version, metadata })
    .onConflictDoUpdate({
      target: totakeAccounts.userId,
      set: { version, metadata },
    });
  for (const body of treatments) {
    const old = oldTreatments.get(body.id);
    if (json(old) === json(body)) continue;
    await tx
      .insert(totakeTreatments)
      .values({ userId, id: body.id, body })
      .onConflictDoUpdate({
        target: [totakeTreatments.userId, totakeTreatments.id],
        set: { body },
      });
    if (old?.revision !== body.revision)
      await tx
        .insert(totakeSchedules)
        .values({ userId, treatmentId: body.id, revision: body.revision, body })
        .onConflictDoNothing();
  }
  const removed = previous.groups
    .filter((g) => !nextGroups.has(g.id))
    .map((g) => g.id);
  if (removed.length)
    await tx
      .delete(totakeOccurrences)
      .where(
        and(
          eq(totakeOccurrences.userId, userId),
          inArray(totakeOccurrences.id, removed),
        ),
      );
  const liveRecords = new Set(
    groups.flatMap((g) => g.records.map((r) => r.id)),
  );
  for (const g of groups) {
    const body = { ...g, records: [] };
    const old = oldGroups.get(g.id);
    if (json(old && { ...old, records: [] }) !== json(body))
      await tx
        .insert(totakeOccurrences)
        .values({ userId, id: g.id, day: Math.floor(g.due / 1440), body })
        .onConflictDoUpdate({
          target: [totakeOccurrences.userId, totakeOccurrences.id],
          set: { day: Math.floor(g.due / 1440), body },
        });
    for (const r of g.records)
      if (!oldRecords.has(r.id))
        await tx
          .insert(totakeRecords)
          .values({
            userId,
            id: r.id,
            groupId: g.id,
            kind: "scheduled",
            body: { ...r, item: g.items.find((i) => i.id === r.itemId) },
          })
          .onConflictDoNothing();
  }
  for (const old of previous.groups.flatMap((g) => g.records))
    if (!liveRecords.has(old.id))
      await tx
        .update(totakeRecords)
        .set({ undone: true })
        .where(
          and(eq(totakeRecords.userId, userId), eq(totakeRecords.id, old.id)),
        );
  for (const r of intakes) {
    const old = oldIntakes.get(r.id);
    if (!old)
      await tx.insert(totakeRecords).values({
        userId,
        id: r.id,
        groupId: `intake-${r.id}`,
        kind: "intake",
        body: r,
        undone: !!r.undone,
      });
    else if (old.undone !== r.undone)
      await tx
        .update(totakeRecords)
        .set({ undone: !!r.undone })
        .where(
          and(eq(totakeRecords.userId, userId), eq(totakeRecords.id, r.id)),
        );
  }
  for (const [ordinal, body] of audit.entries())
    if (!oldAudit.has(body.id))
      await tx
        .insert(totakeAudit)
        .values({ userId, id: body.id, body, ordinal })
        .onConflictDoNothing();
  for (const [ordinal, body] of (next.stock?.movements ?? []).entries())
    if (!oldMovements.has(body.id))
      await tx
        .insert(totakeStockMovements)
        .values({ userId, id: body.id, body, ordinal })
        .onConflictDoNothing();
}

export async function reconcileTotakeJob(
  tx: Tx,
  userId: string,
  state: TotakeState,
) {
  const now = state.clock!.instant;
  const future = state.groups.flatMap((g) =>
    e
      .pending(g)
      .map((i) => g.reminders[i.id].nextInstant ?? i.alertInstant ?? Infinity),
  );
  const enabled = totakeNeedsScheduler(state);
  const runAt = new Date(
    Math.max(now + 1000, Math.min(now + 6 * 86400000, ...future)),
  );
  await tx
    .insert(totakeJobs)
    .values({ userId, runAt, enabled })
    .onConflictDoUpdate({
      target: totakeJobs.userId,
      set: {
        version: sql`${totakeJobs.version}+1`,
        runAt,
        enabled,
        scheduling: "pending",
      },
    });
}

export async function getTotakeSummary(
  actor: Actor,
): Promise<import("@wuff/contracts").TotakeSummary> {
  const { state } = await getTotake(actor),
    today = Math.floor(state.now / 1440),
    now = state.clock!.instant;
  const groups = state.groups.filter((g) => e.pending(g).length);
  return {
    userId: actor.id,
    timezone: state.clock!.zone,
    today: groups
      .filter((g) => Math.floor(g.due / 1440) === today)
      .reduce((n, g) => n + e.pending(g).length, 0),
    overdue: groups.reduce(
      (n, g) =>
        n +
        e.pending(g).filter((i) => (i.alertInstant ?? Infinity) < now).length,
      0,
    ),
    recordedToday:
      state.groups
        .filter((g) => Math.floor(g.due / 1440) === today)
        .reduce((n, g) => n + g.records.length, 0) +
      (state.intakes ?? []).filter(
        (i) => !i.undone && Math.floor(i.at / 1440) === today,
      ).length,
    lowStock: state.treatments!.filter(
      (t) =>
        t.inventory.enabled &&
        Number(t.inventory.current) <= Number(t.inventory.threshold),
    ).length,
    next: groups
      .map((g) => ({
        id: g.id,
        at: Math.min(...e.pending(g).map((i) => i.alertInstant ?? Infinity)),
        count: e.pending(g).length,
      }))
      .sort((a, b) => a.at - b.at)
      .slice(0, 5),
  };
}
