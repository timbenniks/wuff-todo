import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  BrowserAuthorization,
  type AuthStorage,
} from "../apps/native/src/auth-flow";
import { tauriClientId, tauriRedirectUri } from "@wuff/contracts";
import {
  firstPartyRedirect,
  validResourceClient,
} from "../apps/web/src/lib/native-policy";
import { validateRedirectUri } from "../apps/web/src/lib/oauth";
const origin = "https://wuff.example";
function fixture() {
  let value: string | null = null;
  const calls: string[][] = [];
  const storage: AuthStorage = {
    read: async () => value,
    write: async (v) => {
      value = v;
    },
    clear: async () => {
      value = null;
    },
  };
  const make = () =>
    new BrowserAuthorization(origin, storage, async (code, verifier) => {
      calls.push([code, verifier]);
    });
  return { storage, calls, make, auth: make() };
}
function callback(start: URL) {
  return (
    tauriRedirectUri +
    "?" +
    new URLSearchParams({
      state: start.searchParams.get("state")!,
      iss: origin,
      code: "synthetic-code",
    })
  );
}
test("Tauri has a fixed callback and cannot use MCP audience or dynamic registration", () => {
  assert.equal(firstPartyRedirect(tauriClientId), tauriRedirectUri);
  assert.ok(validResourceClient(tauriClientId, origin + "/api/mobile", origin));
  assert.equal(
    validResourceClient(tauriClientId, origin + "/api/mcp", origin),
    false,
  );
  assert.equal(validateRedirectUri(tauriRedirectUri), false);
});
test("cold-start callback restores PKCE and duplicate callbacks exchange exactly once", async () => {
  const f = fixture();
  const start = new URL(await f.auth.begin());
  const pending = JSON.parse((await f.storage.read())!);
  assert.equal(
    start.searchParams.get("code_challenge"),
    createHash("sha256").update(pending.verifier).digest("base64url"),
  );
  assert.equal(start.searchParams.get("client_id"), tauriClientId);
  assert.equal(start.searchParams.get("code_challenge_method"), "S256");
  assert.ok(!start.searchParams.get("scope")!.includes("github:manage"));
  const resumed = f.make();
  assert.deepEqual(
    await Promise.all([
      resumed.accept(callback(start)),
      resumed.accept(callback(start)),
    ]),
    [true, false],
  );
  assert.deepEqual(f.calls, [["synthetic-code", pending.verifier]]);
  assert.equal(await f.storage.read(), null);
});
test("unexpected callback, state, issuer and duplicate parameters cannot consume the login", async () => {
  const f = fixture(),
    start = new URL(await f.auth.begin(true));
  assert.ok(start.searchParams.get("scope")!.includes("github:manage"));
  assert.equal(
    await f.auth.accept("https://example.com/oauth/callback"),
    false,
  );
  for (const query of [{ state: "wrong" }, { iss: "https://wrong.example" }]) {
    const bad = new URL(callback(start));
    Object.entries(query).forEach(([k, v]) => bad.searchParams.set(k, v));
    await assert.rejects(f.auth.accept(bad.href));
  }
  await assert.rejects(f.auth.accept(callback(start) + "&state=duplicate"));
  assert.equal(f.calls.length, 0);
  assert.equal(await f.auth.accept(callback(start)), true);
});
test("cancelled, expired and corrupt pending login cannot exchange", async () => {
  const f = fixture(),
    start = new URL(await f.auth.begin());
  await f.auth.cancel();
  assert.equal(await f.auth.accept(callback(start)), false);
  for (const value of [
    "null",
    "{}",
    "not-json",
    JSON.stringify({
      state: "a".repeat(43),
      verifier: "b".repeat(43),
      createdAt: Date.now() - 600001,
    }),
  ]) {
    await f.storage.write(value);
    await assert.rejects(f.auth.accept(callback(start)), /expired/);
    assert.equal(await f.storage.read(), null);
  }
  assert.equal(f.calls.length, 0);
});
