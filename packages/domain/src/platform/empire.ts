import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  database,
  users,
  oauthTokens,
  oauthClients,
  empirePreferences,
} from "@wuff/db";
import {
  summarizeAiConnections,
  disconnectAiClientSchema,
  empireAppCatalog,
  updateEmpireSettingsSchema,
  applyEmpireChanges,
  type Actor,
  type EmpireSettings,
} from "@wuff/contracts";
import {
  requireScope,
  admission,
  mutate,
  fail,
  type Db,
  type Tx,
} from "./access";
export async function getAiConnections(actor: Actor) {
  requireScope(actor, "empire:read");
  await admission(database().db, actor);
  const rows = await database()
    .db.select({
      id: oauthClients.id,
      name: oauthClients.name,
      scopes: oauthTokens.scope,
      expiresAt: oauthTokens.refreshExpiresAt,
      resource: oauthTokens.resource,
    })
    .from(oauthTokens)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthTokens.clientId))
    .where(
      and(eq(oauthTokens.userId, actor.id), eq(oauthTokens.revoked, false)),
    );
  return summarizeAiConnections(
    rows.map((row) => ({ ...row, expiresAt: row.expiresAt.getTime() })),
    Date.now(),
  ).map((client) => ({
    ...client,
    mcp: rows.some(
      (row) => row.id === client.id && row.resource.endsWith("/api/mcp"),
    ),
  }));
}
export async function disconnectAiClient(actor: Actor, data: unknown) {
  requireScope(actor, "empire:manage");
  const parsed = disconnectAiClientSchema.parse(data);
  const input = {
    ...parsed,
    operationId: parsed.operationId ?? randomUUID(),
    kind: "disconnect_ai_client",
  };
  await mutate(actor, input, async (tx) => {
    await tx
      .update(oauthTokens)
      .set({ revoked: true })
      .where(
        and(
          eq(oauthTokens.userId, actor.id),
          eq(oauthTokens.clientId, input.clientId),
        ),
      );
    return { id: input.clientId };
  });
  return { disconnected: true };
}

async function empirePreference(
  tx: Tx | Db,
  actor: Actor,
): Promise<EmpireSettings> {
  const [row] = await tx
    .select()
    .from(empirePreferences)
    .where(eq(empirePreferences.userId, actor.id));
  return {
    userId: actor.id,
    version: row?.version ?? 0,
    apps: row?.apps ?? {},
    catalog: empireAppCatalog,
  };
}
export async function getEmpireSettings(actor: Actor) {
  requireScope(actor, "empire:read");
  await admission(database().db, actor);
  return empirePreference(database().db, actor);
}
export async function updateEmpireSettings(actor: Actor, data: unknown) {
  requireScope(actor, "empire:read");
  requireScope(actor, "empire:manage");
  const input = updateEmpireSettingsSchema.parse(data);
  await mutate(
    actor,
    { ...input, kind: "update_empire_settings" } as typeof input,
    async (tx) => {
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, actor.id))
        .for("update");
      const current = await empirePreference(tx, actor);
      if (current.version !== input.version)
        fail(
          "conflict",
          "Your Empire settings changed. Load the latest settings before saving.",
          409,
        );
      const values = {
        version: input.version + 1,
        apps: applyEmpireChanges(current.apps, input.changes),
      };
      await tx
        .insert(empirePreferences)
        .values({ userId: actor.id, ...values })
        .onConflictDoUpdate({ target: empirePreferences.userId, set: values });
      return { id: actor.id };
    },
  );
  return getEmpireSettings(actor);
}
