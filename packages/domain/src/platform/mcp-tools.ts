
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { database, users, oauthClients, oauthTokens, mcpToolPreferences, receipts } from "@wuff/db";
import { AppError, mcpToolQuerySchema, mcpToolSelectionAllowed, updateMcpToolsSchema, optionalMcpToolIds, mcpToolCatalog, mcpToolGroups, type Actor, type McpToolPreferences } from "@wuff/contracts";
type Db = ReturnType<typeof database>["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
async function admit(
  db: Db | Tx,
  actor: Actor,
  required: readonly string[] = [],
) {
  if (required.some((scope) => !actor.scopes.includes(scope)))
    throw new AppError(
      "forbidden",
      "Allow Empire connection management in your connection consent.",
      403,
    );
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, actor.id), eq(users.enabled, true)));
  if (!user)
    throw new AppError(
      "invite_required",
      "An active Wuff account is required.",
      403,
    );
}
async function connection(
  db: Db | Tx,
  actor: Actor,
  clientId: string,
  lock = false,
) {
  const query = db
    .select({
      name: oauthClients.name,
      scope: oauthTokens.scope,
      expiresAt: oauthTokens.refreshExpiresAt,
    })
    .from(oauthTokens)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthTokens.clientId))
    .where(
      and(
        eq(oauthTokens.userId, actor.id),
        eq(oauthTokens.clientId, clientId),
        eq(oauthTokens.revoked, false),
        sql`${oauthTokens.resource} like '%/api/mcp'`,
      ),
    );
  const rows = await (lock ? query.for("share") : query);
  if (!rows.length)
    throw new AppError("not_found", "MCP connection not found.", 404);
  return {
    name: rows[0].name,
    scopes: [
      ...new Set(
        rows
          .filter((r) => r.expiresAt.getTime() > Date.now())
          .flatMap((r) => r.scope),
      ),
    ].sort(),
  };
}
async function preference(db: Db | Tx, userId: string, clientId: string) {
  const [row] = await db
    .select()
    .from(mcpToolPreferences)
    .where(
      and(
        eq(mcpToolPreferences.userId, userId),
        eq(mcpToolPreferences.clientId, clientId),
      ),
    );
  return row;
}
export async function getMcpToolPreferences(
  actor: Actor,
  data: unknown,
): Promise<McpToolPreferences> {
  const { clientId } = mcpToolQuerySchema.parse(data),
    db = database().db;
  await admit(db, actor, ["empire:read"]);
  const own = await connection(db, actor, clientId),
    row = await preference(db, actor.id, clientId);
  return {
    userId: actor.id,
    clientId,
    clientName: own.name,
    version: row?.version ?? 0,
    configured: !!row,
    enabledTools: optionalMcpToolIds.filter(
      (id) => !row || row.enabledTools.includes(id),
    ),
    grantedScopes: own.scopes,
    catalog: mcpToolCatalog,
    groups: mcpToolGroups,
    canEnable: !actor.mcpClientId,
    setupPath: `/settings/connections?clientId=${encodeURIComponent(clientId)}`,
  };
}
// Internal transport read: client identity comes only from verified OAuth, never tool input.
export async function getEffectiveMcpToolSelection(actor: Actor) {
  if (!actor.mcpClientId)
    throw new AppError(
      "forbidden",
      "An authenticated MCP connection is required.",
      403,
    );
  const db = database().db;
  await admit(db, actor);
  return (
    (await preference(db, actor.id, actor.mcpClientId))?.enabledTools ?? null
  );
}
export async function updateMcpToolPreferences(actor: Actor, data: unknown) {
  const input = updateMcpToolsSchema.parse(data);
  await database().db.transaction(async (tx) => {
    await admit(tx, actor, ["empire:read", "empire:manage"]);
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${actor.id + ":" + input.operationId},0))`,
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"mcp-tools:" + actor.id + ":" + input.clientId},0))`,
    );
    await connection(tx, actor, input.clientId, true);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ kind: "mcp_tool_preferences", ...input }))
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
        throw new AppError(
          "idempotency_conflict",
          "This operation ID was used for a different request.",
          409,
        );
      return;
    }
    const row = await preference(tx, actor.id, input.clientId);
    if ((row?.version ?? 0) !== input.version)
      throw new AppError(
        "conflict",
        "Tool choices changed. Load the latest choices before saving.",
        409,
      );
    if (
      !mcpToolSelectionAllowed(
        row?.enabledTools ?? null,
        input.enabledTools,
        !!actor.mcpClientId,
      )
    )
      throw new AppError(
        "forbidden",
        "AI connections can turn tools off. Re-enable tools in Wuff Settings.",
        403,
      );
    await tx
      .insert(mcpToolPreferences)
      .values({
        userId: actor.id,
        clientId: input.clientId,
        version: input.version + 1,
        enabledTools: [...input.enabledTools].sort(),
      })
      .onConflictDoUpdate({
        target: [mcpToolPreferences.userId, mcpToolPreferences.clientId],
        set: {
          version: input.version + 1,
          enabledTools: [...input.enabledTools].sort(),
        },
      });
    await tx.insert(receipts).values({
      actorId: actor.id,
      operationId: input.operationId,
      fingerprint,
      result: { id: input.clientId },
    });
  });
  return getMcpToolPreferences(actor, { clientId: input.clientId });
}
