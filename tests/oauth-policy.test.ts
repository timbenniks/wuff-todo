import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authorizationScopes,
  validateRedirectUri,
} from "../apps/web/src/lib/oauth";
import { nativeClientId, tauriClientId } from "@wuff/contracts";

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

test("explicit invalid scopes and missing native scopes remain rejected", () => {
  for (const value of ["", " ", "tasks:write", "lists:read unknown"])
    assert.throws(() => authorizationScopes(value, "synthetic-client"), {
      code: "invalid_scope",
    });
  for (const clientId of [nativeClientId, tauriClientId]) {
    assert.throws(() => authorizationScopes(null, clientId), {
      code: "invalid_scope",
    });
    assert.throws(
      () => authorizationScopes("lists:read agents:manage", clientId),
      { code: "invalid_scope" },
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
