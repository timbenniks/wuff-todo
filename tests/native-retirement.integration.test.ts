import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { eq, inArray } from "drizzle-orm";
import { database, oauthClients, oauthTokens } from "@wuff/db";
import { retiredNativeClientIds } from "../apps/web/src/lib/oauth-resource-policy";
import { loginFixture } from "./helpers/login";
import {
  empireGrant,
  empireMcp,
  fixtureOrigin as origin,
} from "./helpers/empire-grant";

if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Isolated development only");
const [user] = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
after(() => database().pool.end());

test("retired routes expose no data and stored native grants cannot authenticate or refresh as MCP", async () => {
  const db = database().db;
  const tokenIds: string[] = [],
    insertedClients: string[] = [];
  try {
    for (const [path, method] of [
      ["/oauth/native", "GET"],
      ["/oauth/tauri", "GET"],
      ["/api/mobile", "POST"],
      ["/api/mobile/images?id=private", "GET"],
    ]) {
      const response = await fetch(origin + path, { method });
      assert.equal(response.status, 410);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(Object.keys(await response.json()).sort(), [
        "error",
        "message",
      ]);
    }
    for (const clientId of retiredNativeClientIds) {
      const inserted = await db
        .insert(oauthClients)
        .values({
          id: clientId,
          name: "Retired fixture",
          redirectUris: ["http://127.0.0.1/callback"],
        })
        .onConflictDoNothing()
        .returning({ id: oauthClients.id });
      insertedClients.push(...inserted.map((row) => row.id));
      for (const resource of [origin + "/api/mobile", origin + "/api/mcp"]) {
        const access = randomUUID(),
          refresh = randomUUID();
        const [row] = await db
          .insert(oauthTokens)
          .values({
            clientId,
            userId: user.id,
            accessHash: digest(access),
            refreshHash: digest(refresh),
            scope: ["lists:read"],
            resource,
            issuer: origin,
            accessExpiresAt: new Date(Date.now() + 600_000),
            refreshExpiresAt: new Date(Date.now() + 600_000),
          })
          .returning({ id: oauthTokens.id });
        tokenIds.push(row.id);
        const mcp = await empireMcp(access, "show_lists");
        assert.equal(
          mcp.status,
          401,
          "stored retired grants cannot read MCP data",
        );
        const response = await fetch(origin + "/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            grant_type: "refresh_token",
            refresh_token: refresh,
            resource,
          }),
        });
        assert.equal(response.status, 400);
        const body = await response.json();
        assert.equal(body.error, "invalid_request");
        assert.equal(body.access_token, undefined);
      }
    }
    const cookie = await loginFixture(user);
    const grant = await empireGrant(cookie, "lists:read");
    insertedClients.push(grant.clientId);
    assert.equal(
      (await empireMcp(grant.access_token, "show_lists")).status,
      200,
    );
    const refreshed = await fetch(origin + "/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: grant.clientId,
        refresh_token: grant.refresh_token,
        resource: grant.resource,
      }),
    });
    assert.equal(refreshed.status, 200);
    const token = await refreshed.json();
    assert.equal(token.scope, "lists:read");
    assert.equal(
      (await empireMcp(token.access_token, "show_lists")).status,
      200,
    );
    await db
      .delete(oauthTokens)
      .where(eq(oauthTokens.clientId, grant.clientId));
  } finally {
    if (tokenIds.length)
      await db.delete(oauthTokens).where(inArray(oauthTokens.id, tokenIds));
    // Only rows inserted by this test are removed; existing native connections remain intact.
    for (const id of insertedClients) {
      await db.delete(oauthTokens).where(eq(oauthTokens.clientId, id));
      await db.delete(oauthClients).where(eq(oauthClients.id, id));
    }
  }
});
