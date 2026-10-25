import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { database, users, receipts } from "@wuff/db";
import { AppError, type Actor } from "@wuff/contracts";
export type Db = ReturnType<typeof database>["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export function fail(code: string, message: string, status = 409): never {
  throw new AppError(code, message, status);
}
export async function admitted(
  tx: Tx | Db,
  actor: Actor,
  scope = "lists:read",
) {
  if (!actor.scopes.includes(scope))
    fail(
      "forbidden",
      "This connection does not have permission for reminders.",
      403,
    );
  const [user] = await tx
    .select()
    .from(users)
    .where(and(eq(users.id, actor.id), eq(users.enabled, true)));
  if (!user)
    fail("invite_required", "An invitation is required to use Wuff Todo.", 403);
}
export async function notificationWrite(
  actor: Actor,
  input: { operationId: string },
  fn: (tx: Tx) => Promise<unknown>,
  beforeLock?: (tx: Tx) => Promise<void>,
) {
  await database().db.transaction(async (tx) => {
    await admitted(tx, actor, "tasks:write");
    await beforeLock?.(tx);
    // Serialize personal settings, device changes and callback execution together.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`reminders:${actor.id}`},0))`,
    );
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(input))
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
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        fail(
          "idempotency_conflict",
          "This operation ID was used for a different request.",
        );
      return;
    }
    await fn(tx);
    await tx.insert(receipts).values({
      actorId: actor.id,
      operationId: input.operationId,
      fingerprint,
      result: { id: actor.id },
    });
  });
}
