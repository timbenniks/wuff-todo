import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizationScopes } from "../apps/web/src/lib/oauth";
import {
  approvedConsentScopes,
  optionalConsentPermissions,
} from "../apps/web/src/lib/oauth-consent-policy";

const defaults = authorizationScopes(null, "synthetic-client");
test("default consent preserves Todo unless private Totake access is explicitly selected", () => {
  assert.deepEqual(approvedConsentScopes(defaults, null), defaults);
  assert.deepEqual(approvedConsentScopes(defaults, null, ["totake:read"]), [
    ...defaults,
    "totake:read",
  ]);
  assert.deepEqual(
    approvedConsentScopes(defaults, null, ["totake:read", "totake:write"]),
    [...defaults, "totake:read", "totake:write"],
  );
  assert.equal(optionalConsentPermissions(null).length, 2);
});
test("optional consent rejects unoffered, duplicate and write-only permissions", () => {
  for (const extra of [
    ["empire:manage"],
    ["totake:read", "agents:manage"],
    ["unknown"],
    ["totake:write"],
    ["totake:read", "totake:read"],
  ]) {
    assert.throws(() => approvedConsentScopes(defaults, null, extra), {
      code: "invalid_scope",
    });
  }
});
test("explicit client scope requests cannot expand through optional consent", () => {
  for (const requested of [
    "lists:read",
    "totake:read",
    "totake:read totake:write",
  ]) {
    const scopes = authorizationScopes(requested, "synthetic-client");
    assert.deepEqual(optionalConsentPermissions(requested), []);
    assert.deepEqual(approvedConsentScopes(scopes, requested), scopes);
    assert.throws(
      () => approvedConsentScopes(scopes, requested, ["totake:read"]),
      { code: "invalid_scope" },
    );
  }
});
