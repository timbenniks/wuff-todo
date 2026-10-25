import { moduleServices } from "./module-services";
import { notificationDeliveryPolicy } from "./notification-policy";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { database, users, notificationPreferences, receipts } from "@wuff/db";
import {
  AppError,
  notificationSettingsSchema,
  type Actor,
  type NotificationSettings,
} from "@wuff/contracts";
type Db = ReturnType<typeof database>["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
async function admitted(tx: Db | Tx, actor: Actor, write = false) {
  if (
    !actor.scopes.includes("notifications:read") ||
    (write && !actor.scopes.includes("notifications:manage"))
  )
    throw new AppError(
      "forbidden",
      "Allow notification settings access in a new connection consent.",
      403,
    );
  const [user] = await tx.select().from(users).where(eq(users.id, actor.id));
  if (!user?.enabled)
    throw new AppError(
      "invite_required",
      "An active account is required.",
      403,
    );
}
async function snapshot(
  tx: Db | Tx,
  userId: string,
): Promise<NotificationSettings> {
  const [p] = await tx
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  return {
    userId,
    version: p?.version ?? 0,
    paused: p?.paused ?? false,
    apps: { todo: p?.todo ?? false, totake: p?.totake ?? false },
    showContent: p?.showContent ?? true,
  };
}
export async function getNotificationSettings(actor: Actor) {
  await admitted(database().db, actor);
  return snapshot(database().db, actor.id);
}
/** Called inside the same personal notification lock as saves and sends. */
export async function notificationPolicy(
  tx: Db | Tx,
  userId: string,
  app: "todo" | "totake",
) {
  const [p] = await tx
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  return notificationDeliveryPolicy(p, app);
}
export async function updateNotificationSettings(actor: Actor, data: unknown) {
  const input = notificationSettingsSchema.parse(data);
  const result = await database().db.transaction(async (tx) => {
    await admitted(tx, actor, true);
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`reminders:${actor.id}`},0))`,
    );
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ kind: "notification_settings", ...input }))
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
    const previous = await snapshot(tx, actor.id);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        throw new AppError(
          "idempotency_conflict",
          "Operation ID already used.",
          409,
        );
      return previous;
    }
    if (previous.version !== input.version)
      throw new AppError(
        "conflict",
        "Notification settings changed. Load the latest before saving.",
        409,
      );
    const values = {
      version: input.version + 1,
      paused: input.paused,
      todo: input.apps.todo,
      totake: input.apps.totake,
      showContent: input.showContent,
    };
    await tx
      .insert(notificationPreferences)
      .values({ userId: actor.id, ...values })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: values,
      });
    for (const module of moduleServices)
      await module.reconcileNotificationPause(tx, actor.id, previous, input);
    await tx.insert(receipts).values({
      actorId: actor.id,
      operationId: input.operationId,
      fingerprint,
      result: { id: actor.id },
    });
    return snapshot(tx, actor.id);
  });
  for (const module of moduleServices) await module.schedulePending(actor.id);
  return result;
}
