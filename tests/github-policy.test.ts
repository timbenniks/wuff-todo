import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  githubSafeFields,
  mergeGithub,
  verifyGithubSignature,
} from "../packages/domain/src/modules/todo/github-policy";
const base = { title: "Before", body: "Notes", closed: false };
test("GitHub merges independent edits and preserves Wuff-only workflow state", () => {
  assert.deepEqual(
    mergeGithub(
      base,
      { ...base, title: "From Wuff" },
      { ...base, body: "From GitHub" },
    ),
    {
      merged: { title: "From Wuff", body: "From GitHub", closed: false },
      conflict: false,
    },
  );
  assert.equal(
    mergeGithub(base, { ...base, title: "Local" }, { ...base, title: "Remote" })
      .conflict,
    true,
  );
  assert.equal(
    mergeGithub(base, { ...base, closed: true }, { ...base, closed: true })
      .conflict,
    false,
  );
});
test("private attachments and unsupported imported notes are never copied to GitHub", () => {
  for (const body of [
    "![private](/api/v1/attachments/abc)",
    "<script>x</script>",
    "![data](data:image/png;base64,a)",
    "x".repeat(16001),
  ])
    assert.throws(() => githubSafeFields({ ...base, body }));
  assert.deepEqual(githubSafeFields({ ...base, body: "**Safe**\r\nnotes" }), {
    ...base,
    body: "**Safe**\nnotes",
  });
});
test("webhook verification uses exact body and constant-length signature validation", () => {
  const body = '{"title":"é"}',
    secret = "synthetic-secret",
    signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  assert.equal(verifyGithubSignature(body, signature, secret), true);
  assert.equal(verifyGithubSignature(body + " ", signature, secret), false);
  assert.equal(verifyGithubSignature(body, "", secret), false);
});
