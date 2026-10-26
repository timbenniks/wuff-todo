import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authorizationScopes,
  validateRedirectUri,
} from "../apps/web/src/lib/oauth";
import { retiredNativeClientIds } from "../apps/web/src/lib/oauth-resource-policy";

test("omitted MCP scopes default to basic list/task consent without elevated access", () => {
  assert.deepEqual(authorizationScopes(null, "synthetic-client"), [
    "lists:read",
    "tasks:write",
    "lists:manage",
  ]);
  assert.deepEqual(authorizationScopes("lists:read", "synthetic-client"), [
    "lists:read",
  ]);
  assert.deepEqual(
    authorizationScopes(
      "lists:read github:manage agents:manage",
      "synthetic-client",
    ),
    ["lists:read", "github:manage", "agents:manage"],
  );
});

test("explicit invalid scopes and retired native identities remain rejected", () => {
  for (const value of ["", " ", "tasks:write", "lists:read unknown"])
    assert.throws(() => authorizationScopes(value, "synthetic-client"), {
      code: "invalid_scope",
    });
  for (const clientId of retiredNativeClientIds) {
    assert.throws(() => authorizationScopes(null, clientId), {
      code: "invalid_client",
    });
    assert.throws(
      () => authorizationScopes("lists:read agents:manage", clientId),
      { code: "invalid_client" },
    );
  }
});
test("OAuth redirects allow HTTPS and loopback while rejecting unsafe destinations", () => {
  for (const value of [
    "https://client.example/callback",
    "http://127.0.0.1:4242/callback",
    "http://localhost:4242/callback",
  ])
    assert.equal(validateRedirectUri(value), true);
  for (const value of [
    "not a URL",
    "javascript:alert(1)",
    "http://remote.example/callback",
    "https://client.example/callback#token",
    "https://user:password@client.example/callback",
  ])
    assert.equal(validateRedirectUri(value), false);
});
