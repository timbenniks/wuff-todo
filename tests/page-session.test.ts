import { test } from "node:test";
import assert from "node:assert/strict";
import { pageSession } from "../apps/web/src/lib/auth/page-session";
import { sessionIdentity } from "../apps/web/src/lib/auth/session-result";

const config = {
  baseUrl: "https://auth.example.invalid/auth",
  cookieSecret: "synthetic-cookie-signing-secret-for-tests",
};
const requestHeaders = new Headers({
  Cookie: "__Secure-neon-auth.session_token=synthetic; unrelated=private",
  Referer: "https://wuff.example.invalid/lists",
});

test("page session reads tolerate upstream cookie clearing without a writable Next context", async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/auth/get-session");
      assert.equal(url.searchParams.get("disableCookieCache"), "true");
      assert.equal(url.searchParams.get("disableRefresh"), "true");
      const sent = new Headers(init?.headers);
      assert.equal(
        sent.get("Cookie"),
        "__Secure-neon-auth.session_token=synthetic",
      );
      assert.equal(sent.get("Origin"), "https://wuff.example.invalid");
      return Response.json(null, {
        headers: {
          "Set-Cookie": "__Secure-neon-auth.session_token=; Path=/; Max-Age=0",
        },
      });
    },
  );
  assert.equal(
    sessionIdentity(await pageSession(config, requestHeaders)),
    null,
  );
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("page sessions use authoritative identity and preserve upstream failure semantics", async (t) => {
  const user = { id: "synthetic-user", name: "Synthetic" };
  let status = 200;
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(status === 200 ? { user } : { message: "Unavailable" }, {
      status,
    }),
  );
  assert.deepEqual(
    sessionIdentity(await pageSession(config, requestHeaders)),
    user,
  );
  for (const [upstream, expected] of [
    [401, 401],
    [429, 429],
    [500, 503],
  ]) {
    status = upstream;
    const result = await pageSession(config, requestHeaders);
    if (expected === 401) assert.equal(sessionIdentity(result), null);
    else
      assert.throws(() => sessionIdentity(result), {
        code: "auth_unavailable",
        status: expected,
      });
  }
});
