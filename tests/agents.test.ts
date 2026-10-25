import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CursorError,
  environmentMatches,
  publicAgentEvent,
  sealCursorKey,
  openCursorKey,
  agentPullRequestUrls,
} from "../packages/domain/src/modules/todo/cursor-provider";
test("agent PR references remain in the authorized GitHub repository", () => {
  assert.deepEqual(
    agentPullRequestUrls(
      {
        branches: [
          {
            repoUrl: "github.com/owner/repo",
            prUrl: "https://github.com/owner/repo/pull/12",
          },
          {
            repoUrl: "github.com/owner/repo",
            prUrl: "https://evil.example/owner/repo/pull/12",
          },
          {
            repoUrl: "github.com/owner/other",
            prUrl: "https://github.com/owner/other/pull/12",
          },
        ],
      },
      "owner/repo",
    ),
    ["https://github.com/owner/repo/pull/12"],
  );
});
import {
  reviewState,
  checkState,
} from "../packages/domain/src/modules/todo/github-pr-policy";
import { agentLaunchSchema } from "@wuff/contracts";
test("agent launch requires explicit confirmation and defaults to planning", () => {
  const input = {
    listId: crypto.randomUUID(),
    taskId: crypto.randomUUID(),
    version: 1,
    operationId: crypto.randomUUID(),
  };
  assert.equal(agentLaunchSchema.safeParse(input).success, false);
  assert.equal(
    agentLaunchSchema.parse({ ...input, confirmed: true }).mode,
    "plan",
  );
});
test("environment boundary rejects extra repositories and ambiguous names", () => {
  const env = {
    name: "Dev",
    repos: [{ url: "https://github.com/owner/repo.git" }],
  };
  assert.equal(environmentMatches(env, "owner/repo"), true);
  assert.equal(
    environmentMatches(
      {
        ...env,
        repos: [...env.repos, { url: "https://github.com/private/other" }],
      },
      "owner/repo",
    ),
    false,
  );
  assert.equal(environmentMatches(env, "owner/other"), false);
});
test("tool activity never returns raw arguments or results", () => {
  assert.deepEqual(
    publicAgentEvent("tool_call", {
      name: "shell",
      status: "completed",
      args: { token: "private" },
      result: "secret",
    }),
    { type: "tool_call", name: "shell", status: "completed" },
  );
  assert.equal(
    publicAgentEvent("interaction_update", { secret: "private" }),
    null,
  );
});
test("Cursor credentials use authenticated encryption", () => {
  process.env.CURSOR_TOKEN_SECRET =
    "synthetic-encryption-key-at-least-32-characters";
  const sealed = sealCursorKey("synthetic-api-key");
  assert.equal(sealed.includes("synthetic-api-key"), false);
  assert.equal(openCursorKey(sealed), "synthetic-api-key");
  const bytes = Buffer.from(sealed, "base64url");
  bytes[30] ^= 1;
  assert.throws(() => openCursorKey(bytes.toString("base64url")));
});
test("review and check summaries preserve failures and superseded approvals", () => {
  assert.equal(
    reviewState([
      { user: { id: 1 }, state: "APPROVED" },
      { user: { id: 1 }, state: "DISMISSED" },
    ]),
    "pending",
  );
  assert.equal(
    reviewState([
      { user: { id: 1 }, state: "APPROVED" },
      { user: { id: 2 }, state: "CHANGES_REQUESTED" },
    ]),
    "changes_requested",
  );
  assert.equal(
    checkState([
      { status: "completed", conclusion: "failure" },
      { status: "queued", conclusion: null },
    ]),
    "failing",
  );
  assert.equal(checkState([]), "none");
});

test("Cursor authentication errors distinguish invalid credentials from provider failure", () => {
  const rejected = new CursorError(401);
  assert.equal(rejected.code, "cursor_invalid_key");
  assert.equal(rejected.status, 400);
  assert.match(rejected.message, /HTTP 401/);
  assert.equal(new CursorError(403).status, 403);
  assert.equal(new CursorError(429).status, 503);
  assert.equal(new CursorError(503).status, 502);
  assert.match(new CursorError(503).message, /HTTP 503/);
});
