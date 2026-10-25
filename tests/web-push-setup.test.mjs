import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createECDH } from "node:crypto";
import { writeWebPushEnvironment } from "../scripts/setup-web-push.mjs";
test("private VAPID setup generates a matching P-256 pair, never overwrites, and rejects invalid contact", () => {
  const dir = mkdtempSync(join(tmpdir(), "wuff-push-"));
  const output = join(dir, "keys");
  try {
    assert.throws(
      () => writeWebPushEnvironment(output, "http://localhost"),
      /public HTTPS/,
    );
    writeWebPushEnvironment(output, "https://wuff.example");
    const original = readFileSync(output, "utf8");
    const env = Object.fromEntries(
      original
        .trim()
        .split("\n")
        .map((line) => {
          const split = line.indexOf("=");
          return [line.slice(0, split), line.slice(split + 1)];
        }),
    );
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(env.WEB_PUSH_PRIVATE_KEY, "base64url"));
    assert.equal(
      ecdh.getPublicKey().toString("base64url"),
      env.WEB_PUSH_PUBLIC_KEY,
    );
    if (process.platform !== "win32")
      assert.equal(statSync(output).mode & 0o777, 0o600);
    assert.throws(
      () => writeWebPushEnvironment(output, "mailto:owner@example.invalid"),
      { code: "EEXIST" },
    );
    assert.equal(readFileSync(output, "utf8"), original);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
