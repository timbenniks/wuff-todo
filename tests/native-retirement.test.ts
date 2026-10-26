import { test } from "node:test";
import assert from "node:assert/strict";
import {
  retiredNativeClientIds,
  validResourceClient,
} from "../apps/web/src/lib/oauth-resource-policy";
import {
  authorizationScopes,
  validateRedirectUri,
  oauthServer,
} from "../apps/web/src/lib/oauth";
import { retiredNativeResponse } from "../apps/web/src/lib/retired-native";
import {
  GET as retiredImageRead,
  POST as retiredImageUpload,
} from "../apps/web/src/app/api/mobile/images/route";
const origin = "https://wuff.example";
test("retired native identities cannot receive either native or MCP audience grants", async () => {
  for (const id of retiredNativeClientIds) {
    for (const resource of [origin + "/api/mobile", origin + "/api/mcp"])
      assert.equal(validResourceClient(id, resource, origin), false);
    for (const scope of [
      null,
      "lists:read",
      "notes:read",
      "totake:read totake:write",
    ])
      assert.throws(() => authorizationScopes(scope, id), {
        code: "invalid_client",
      });
    assert.equal(
      await (oauthServer(origin + "/api/mcp") as any).options.model.getClient(
        id,
      ),
      null,
    );
  }
});
test("supported MCP resource matching, defaults, opt-in scopes and redirect restrictions remain intact", () => {
  assert.equal(
    validResourceClient("mcp-client", origin + "/api/mcp", origin),
    true,
  );
  for (const value of [
    origin + "/api/mobile",
    "https://other.example/api/mcp",
    origin + "/api/mcp?x=1",
  ])
    assert.equal(validResourceClient("mcp-client", value, origin), false);
  assert.equal(validResourceClient("", origin + "/api/mcp", origin), false);
  assert.deepEqual(authorizationScopes(null, "mcp-client"), [
    "lists:read",
    "tasks:write",
    "lists:manage",
  ]);
  assert.deepEqual(
    authorizationScopes("totake:read totake:write", "mcp-client"),
    ["totake:read", "totake:write"],
  );
  assert.throws(() => authorizationScopes("totake:write", "mcp-client"), {
    code: "invalid_scope",
  });
  assert.equal(
    validateRedirectUri("com.timbenniks.wufftodo.tauri://oauth/callback"),
    false,
  );
  assert.equal(
    validateRedirectUri("com.timbenniks.wufftodo://oauth/callback"),
    false,
  );
  assert.equal(validateRedirectUri("https://client.example/callback"), true);
});
test("retired transport responses explicitly fail without data or cacheable credentials", async () => {
  const r = retiredNativeResponse();
  assert.equal(r.status, 410);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const body = await r.json();
  assert.equal(body.error, "client_retired");
  assert.equal(body.access_token, undefined);
  assert.equal(body.userId, undefined);
});

test("legacy private image uploads and reads both return retirement guidance without reading input", async () => {
  for (const handler of [retiredImageRead, retiredImageUpload]) {
    const response = handler();
    assert.equal(response.status, 410);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.error, "client_retired");
    assert.equal(body.imageBase64, undefined);
  }
});
