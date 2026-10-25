import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { database, users, receipts } from "@wuff/db";
import { AppError, type Actor } from "@wuff/contracts";
export type Db = ReturnType<typeof database>["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export const fail = (code: string, message: string, status: number): never => {
  throw new AppError(code, message, status);
};
export function requireScope(actor: Actor, scope: string) {
  if (!actor.scopes.includes(scope))
    fail(
      "forbidden",
      "This connection does not have permission for that action.",
      403,
    );
}
export async function admission(tx: Tx | Db, actor: Actor) {
  const [user] = await tx
    .select()
    .from(users)
    .where(and(eq(users.id, actor.id), eq(users.enabled, true)));
  if (!user)
    fail("invite_required", "An invitation is required to use Wuff Todo.", 403);
  return user;
}
export async function mutate(
  actor: Actor,
  input: { operationId: string },
  fn: (tx: Tx) => Promise<unknown>,
) {
  return database().db.transaction(async (tx) => {
    await admission(tx, actor);
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${actor.id + ":" + input.operationId}, 0))`,
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
          "This operation ID was already used for a different request.",
          409,
        );
      // Receipts contain identifiers only; callers must reread through current authorization.
      return receipt.result as { id: string };
    }
    const result = (await fn(tx)) as { id: string };
    await tx.insert(receipts).values({
      actorId: actor.id,
      operationId: input.operationId,
      fingerprint,
      result,
    });
    return result;
  });
}
