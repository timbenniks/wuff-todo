import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRedirectUri } from "../apps/web/src/lib/oauth";
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
