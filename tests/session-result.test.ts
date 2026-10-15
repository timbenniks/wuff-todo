import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionIdentity } from "../apps/web/src/lib/auth/session-result";

test("session failures distinguish signed-out users from temporary auth unavailability", () => {
  const user = { id: "synthetic-user" };
  assert.equal(sessionIdentity({ data: { user }, error: null }), user);
  assert.equal(sessionIdentity({ data: null, error: null }), null);
  assert.equal(sessionIdentity({ data: null, error: { status: 401 } }), null);
  for (const [upstream, expected] of [
    [429, 429],
    [500, 503],
    [503, 503],
    [undefined, 503],
  ]) {
    assert.throws(
      () => sessionIdentity({ data: null, error: { status: upstream } }),
      {
        code: "auth_unavailable",
        status: expected,
      },
    );
  }
});
