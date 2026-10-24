import test from "node:test";
import assert from "node:assert/strict";
import {
  briefHash,
  evaluate,
  MAINTAINER_ID,
  sensitive,
  run,
  surfaceContractErrors,
  unitTestErrors,
} from "../scripts/contributor-policy.mjs";

function fixture() {
  const sha = "a".repeat(40);
  const surface = {
    dataChanges: false,
    operations: [],
    noDataChangesReason:
      "Only the visual task summary changes; all existing persistence behavior is preserved.",
    mcpUi: {
      decision: "not-needed",
      reason:
        "No new agent capability or interactive control is introduced by this layout change.",
    },
    connections: {
      affected: false,
      review:
        "No connection types, scopes, consent, token handling or revocation behavior changes.",
    },
  };
  const unit = {
    required: false,
    reason:
      "This fixture is a visual-only summary change with no new logic or persistence behavior.",
  };
  const body = `## Feature brief
Let editors see a compact task summary using existing controls. Preserve permissions and ordering. Exclude backend changes.
- [ ] The summary is usable by keyboard and at phone widths.
## Scope
Change the task row and its focused regression test only.
## API, MCP and connections
\`\`\`json
${JSON.stringify(surface)}
\`\`\`
## Unit tests
\`\`\`json
${JSON.stringify(unit)}
\`\`\`
## Preview
Preview unavailable until Tim confirms the isolated backend; local screenshots attached.
## Verification
Evidence commit: ${sha}
pnpm typecheck and pnpm test passed locally; phone, desktop and keyboard checks recorded.
## Remaining work or risks
Tim must verify installed native behavior before the native release.
`;
  const pr = {
    body,
    head: { ref: "codex/task-summary", sha },
    base: { ref: "main" },
    changed_files: 1,
  };
  const files = [
    {
      filename: "packages/ui/src/features/app/lists/task-row.tsx",
      additions: 10,
      deletions: 2,
    },
  ];
  const approval = {
    briefSha256: briefHash(body),
    allowedPaths: [files[0].filename],
    sensitivePaths: [],
  };
  const comments = [
    {
      id: 1,
      user: { id: MAINTAINER_ID },
      body: `/wuff-scope\n${JSON.stringify(approval)}`,
    },
  ];
  return { pr, files, comments, approval, surface, unit };
}
function setSurface(f, patch, approve = true) {
  Object.assign(f.surface, patch);
  if (patch.dataChanges === true && !f.unit.required) {
    f.unit = {
      required: true,
      files: ["tests/task-metadata.test.ts"],
      verification:
        "New success, boundary, denial and failure regression cases passed with pnpm test.",
    };
    f.files.push({ filename: f.unit.files[0], additions: 1, deletions: 0 });
    f.pr.changed_files = f.files.length;
    f.approval.allowedPaths.push(f.unit.files[0]);
    f.pr.body = f.pr.body.replace(
      /(## Unit tests\n```json\n)[\s\S]*?(\n```)/,
      (_match, start, end) => start + JSON.stringify(f.unit) + end,
    );
  }
  f.pr.body = f.pr.body.replace(
    /```json\n[\s\S]*?\n```/,
    "```json\n" + JSON.stringify(f.surface) + "\n```",
  );
  if (approve) setApproval(f, { briefSha256: briefHash(f.pr.body) });
}
function mutation() {
  return {
    action: "Save a task preference",
    domain: "saveTaskPreference in packages/domain/src/index.ts",
    api: "PUT /api/v1/tasks/preferences",
    mcp: "update_task_preference",
    status: "implemented",
    verification:
      "Isolated API write/MCP read and MCP write/API read tests passed with denied/conflict/retry coverage.",
  };
}

test("unit coverage declarations require changed unit files and concrete verification", () => {
  const f = fixture();
  setSurface(f, { dataChanges: true, operations: [mutation()] });
  assert.deepEqual(unitTestErrors(f.pr.body, f.files), []);
  assert.match(
    unitTestErrors(f.pr.body, [f.files[0]]).join(" "),
    /actual added\/updated/,
  );
  assert.match(
    unitTestErrors(
      f.pr.body,
      f.files.map((file) => ({ ...file, status: "removed" })),
    ).join(" "),
    /deleted tests/,
  );
});
test("unit declarations cannot waive data changes or substitute integration-only tests", () => {
  const f = fixture();
  setSurface(f, { dataChanges: true, operations: [mutation()] });
  const replace = (value) =>
    f.pr.body.replace(
      /(## Unit tests\n```json\n)[\s\S]*?(\n```)/,
      (_match, start, end) => start + JSON.stringify(value) + end,
    );
  assert.match(
    unitTestErrors(
      replace({
        required: false,
        reason: "We only want to run integration tests for this data feature.",
      }),
      f.files,
    ).join(" "),
    /cannot waive/,
  );
  assert.match(
    unitTestErrors(
      replace({
        required: true,
        files: ["tests/domain.integration.test.ts"],
        verification:
          "The integration checks passed locally on isolated synthetic data.",
      }),
      [{ filename: "tests/domain.integration.test.ts" }],
    ).join(" "),
    /integration-only/,
  );
});
test("unit declarations fail closed when missing, malformed or unexplained", () => {
  assert.ok(unitTestErrors("", []).length);
  assert.match(
    unitTestErrors("## Unit tests\n```json\n{bad}\n```", []).join(" "),
    /valid JSON/,
  );
  assert.match(
    unitTestErrors(
      '## Unit tests\n```json\n{"required":false,"reason":"None"}\n```',
      [],
    ).join(" "),
    /concrete explanation/,
  );
});

test("data-changing features require complete implemented domain/API/MCP mappings", () => {
  const f = fixture();
  setSurface(f, { dataChanges: true, operations: [] });
  assert.match(evaluate(f).errors.join(" "), /operation mappings/);
  setSurface(f, { operations: [mutation()] });
  assert.deepEqual(evaluate(f).errors, []);
  for (const field of ["domain", "api", "mcp"]) {
    const op = mutation();
    delete op[field];
    setSurface(f, { operations: [op] });
    assert.match(
      evaluate(f).errors.join(" "),
      /actual API write route and MCP tool/,
    );
  }
  setSurface(f, { operations: [{ ...mutation(), status: "planned" }] });
  assert.match(evaluate(f).errors.join(" "), /placeholders or deferrals/);
});
test("MCP UI decisions require reasons and implemented UI requires verification", () => {
  const f = fixture();
  setSurface(f, {
    mcpUi: {
      decision: "deferred",
      reason: "This is deferred until a later unrelated feature.",
    },
  });
  assert.match(evaluate(f).errors.join(" "), /Decide MCP UI/);
  setSurface(f, {
    mcpUi: {
      decision: "implemented",
      reason: "The structured editor benefits from an interactive MCP App.",
    },
  });
  assert.match(
    evaluate(f).errors.join(" "),
    /UI\/host and tool-only verification/,
  );
  f.surface.mcpUi.verification =
    "Local SDK controls and tool-only fallback passed; named host remains a separate gate.";
  setSurface(f, {});
  assert.deepEqual(evaluate(f).errors, []);
});
test("affected connections cannot omit recovery/privacy verification", () => {
  const f = fixture();
  setSurface(f, {
    connections: {
      affected: true,
      review:
        "Optional scopes and delegated connections are affected by this feature.",
    },
  });
  assert.match(
    evaluate(f).errors.join(" "),
    /Affected connections need verification/,
  );
  f.surface.connections.verification =
    "Missing/revoked/expired grants, consent, missing scope and cross-account privacy tests passed.";
  setSurface(f, {});
  assert.deepEqual(evaluate(f).errors, []);
});
test("surface declaration changes invalidate maintainer scope approval", () => {
  const f = fixture();
  setSurface(f, { dataChanges: true, operations: [mutation()] }, false);
  assert.match(evaluate(f).errors.join(" "), /brief changed/);
});
test("verification updates preserve approved capabilities but mapping changes need reapproval", () => {
  const f = fixture();
  setSurface(f, { dataChanges: true, operations: [mutation()] });
  const hash = briefHash(f.pr.body);
  const op = {
    ...mutation(),
    verification:
      "Additional actual API/MCP retry and conflict checks passed on isolated synthetic data.",
  };
  setSurface(f, { operations: [op] }, false);
  assert.equal(briefHash(f.pr.body), hash);
  assert.deepEqual(evaluate(f).errors, []);
  setSurface(f, { operations: [{ ...op, mcp: "another_mutation" }] }, false);
  assert.match(evaluate(f).errors.join(" "), /brief changed/);
});

test("no-data claims require an explanation and cannot contain mutations", () => {
  const f = fixture();
  setSurface(f, { operations: [mutation()] });
  assert.match(evaluate(f).errors.join(" "), /No-data changes/);
  setSurface(f, { operations: [], noDataChangesReason: "None" });
  assert.match(evaluate(f).errors.join(" "), /noDataChangesReason/);
});
test("missing, malformed and non-object surface contracts fail closed", () => {
  assert.match(surfaceContractErrors("")[0], /exactly one/);
  assert.match(
    surfaceContractErrors(
      "## API, MCP and connections\n```json\n{bad}\n```",
    )[0],
    /valid JSON/,
  );
  assert.match(
    surfaceContractErrors("## API, MCP and connections\n```json\nnull\n```")[0],
    /JSON object/,
  );
});
function setApproval(f, patch) {
  Object.assign(f.approval, patch);
  f.comments[0].body = `/wuff-scope\n${JSON.stringify(f.approval)}`;
}

function apiFixture({
  failInventory = false,
  moveHead = false,
  revokeDuringRun = false,
  missingScope = false,
} = {}) {
  const f = fixture();
  f.pr.state = "open";
  const calls = [];
  let prReads = 0,
    commentReads = 0;
  const request = async (url, options) => {
    const path = new URL(url).pathname.replace(
      "/repos/timbenniks/wuff-todo/",
      "",
    );
    calls.push({
      path,
      method: options.method,
      body: options.body ? JSON.parse(options.body) : undefined,
    });
    let data;
    if (path === "pulls/22") {
      data = structuredClone(f.pr);
      if (++prReads > 1 && moveHead) data.head.sha = "c".repeat(40);
    } else if (path === "pulls/22/files") {
      if (failInventory) return Response.json({}, { status: 403 });
      data = f.files;
    } else if (path === "issues/22/comments") {
      data = structuredClone(missingScope ? [] : f.comments);
      if (++commentReads > 1 && revokeDuringRun)
        data.push({
          id: 2,
          user: { id: MAINTAINER_ID },
          body: '/wuff-scope\n{"revoke":true}',
        });
    } else if (path === "check-runs" && options.method === "POST")
      data = { id: 45 };
    else if (path === "check-runs/45" && options.method === "PATCH")
      data = { id: 45 };
    else throw new Error("Unexpected policy API request");
    return Response.json(data);
  };
  const args = {
    event: { pull_request: { number: 22 } },
    request,
    env: {
      GITHUB_REPOSITORY: "timbenniks/wuff-todo",
      GITHUB_TOKEN: "synthetic-test-token",
    },
  };
  return { args, calls };
}

test("trusted runner posts a successful check on the exact evaluated commit", async () => {
  const f = apiFixture();
  assert.equal(await run(f.args), true);
  assert.equal(
    f.calls.find((c) => c.method === "POST").body.head_sha,
    "a".repeat(40),
  );
  assert.equal(f.calls.at(-1).body.conclusion, "success");
  assert.ok(
    f.calls.every(
      (c) => !c.path.includes("contents") && !c.path.includes("git/"),
    ),
  );
});

test("API failure never produces a passing policy check", async () => {
  const f = apiFixture({ failInventory: true });
  await assert.rejects(run(f.args), /GitHub API/);
  assert.equal(f.calls.at(-1).body.conclusion, "failure");
});

test("head changes and scope revocation during evaluation fail closed", async () => {
  for (const options of [
    { moveHead: true },
    { revokeDuringRun: true },
    { missingScope: true },
  ]) {
    const f = apiFixture(options);
    assert.equal(await run(f.args), false);
    assert.equal(f.calls.at(-1).body.conclusion, "failure");
  }
});

test("issue-comment reevaluation works without running code from the PR", async () => {
  const f = apiFixture();
  f.args.event = { issue: { number: 22, pull_request: {} } };
  assert.equal(await run(f.args), true);
});

test("a scoped feature with current-commit evidence passes", () => {
  assert.deepEqual(evaluate(fixture()).errors, []);
});
test("contributor comments cannot grant or revoke maintainer scope", () => {
  const f = fixture();
  f.comments.push({
    id: 2,
    user: { id: 999 },
    body: '/wuff-scope\n{"revoke":true}',
  });
  assert.deepEqual(evaluate(f).errors, []);
  f.comments[0].user.id = 999;
  assert.match(evaluate(f).errors.join(" "), /missing or revoked/);
});
test("latest maintainer revocation fails closed even when comments are unsorted", () => {
  const f = fixture();
  f.comments.unshift({
    id: 2,
    user: { id: MAINTAINER_ID },
    body: '/wuff-scope\n{"revoke":true}',
  });
  assert.match(evaluate(f).errors.join(" "), /missing or revoked/);
});
test("malformed or missing approvals fail closed", () => {
  const f = fixture();
  f.comments[0].body = '/wuff-scope\n{"broken"';
  assert.match(evaluate(f).errors.join(" "), /invalid JSON/);
  setApproval(f, { allowedPaths: [12], sensitivePaths: null });
  assert.match(evaluate(f).errors.join(" "), /Approved paths/);
});
test("scope hash binds the brief but permits new evidence", () => {
  const f = fixture();
  f.pr.body = f.pr.body.replace("phone, desktop", "phone, wide desktop");
  assert.deepEqual(evaluate(f).errors, []);
  f.pr.body = f.pr.body.replace(
    "Exclude backend changes.",
    "Include backend changes.",
  );
  assert.match(evaluate(f).errors.join(" "), /brief changed/);
});
test("renames cannot move unapproved code into an approved path", () => {
  const f = fixture();
  f.files[0].previous_filename = "packages/domain/src/index.ts";
  assert.match(evaluate(f).errors.join(" "), /Outside approved scope/);
  assert.match(evaluate(f).errors.join(" "), /sensitive-file approval/);
});
test("directory scopes do not grant sensitive-file permissions", () => {
  const f = fixture();
  f.files[0].filename = "packages/db/src/schema.ts";
  setApproval(f, { allowedPaths: ["packages/db/**"] });
  assert.match(evaluate(f).errors.join(" "), /sensitive-file approval/);
  setApproval(f, { sensitivePaths: [f.files[0].filename] });
  assert.deepEqual(evaluate(f).errors, []);
});
test("wildcards are bounded and directory names cannot match siblings", () => {
  for (const pattern of [
    "**",
    "../packages/**",
    "/packages/**",
    "packages/*",
    "packages/../**",
  ]) {
    const f = fixture();
    setApproval(f, { allowedPaths: [pattern] });
    assert.match(evaluate(f).errors.join(" "), /Approved paths/);
  }
  const f = fixture();
  setApproval(f, { allowedPaths: ["packages/ui/src/features/app/list/**"] });
  assert.match(evaluate(f).errors.join(" "), /Outside approved scope/);
});
test("credentials remain forbidden even with explicit maintainer scope", () => {
  for (const path of [
    ".env.local",
    "apps/web/.env.production",
    "secret.pem",
    ".vercel/project.json",
  ]) {
    const f = fixture();
    f.files[0].filename = path;
    setApproval(f, { allowedPaths: [path], sensitivePaths: [path] });
    assert.match(evaluate(f).errors.join(" "), /cannot be submitted/);
  }
});
test("large and incomplete diffs require resolution", () => {
  const f = fixture();
  f.files[0].additions = 801;
  assert.match(evaluate(f).errors.join(" "), /800/);
  setApproval(f, { allowLargeDiff: true });
  assert.deepEqual(evaluate(f).errors, []);
  f.pr.changed_files = 2;
  assert.match(evaluate(f).errors.join(" "), /Incomplete/);
});
test("stale evidence, missing acceptance and template-only sections cannot pass", () => {
  const f = fixture();
  f.pr.head.sha = "b".repeat(40);
  assert.match(evaluate(f).errors.join(" "), /Evidence commit/);
  f.pr.body = "## Feature brief\n<!-- template only -->";
  assert.match(evaluate(f).errors.join(" "), /acceptance criteria/);
  assert.match(evaluate(f).errors.join(" "), /Complete the/);
});
test("line endings and explanatory comments do not change brief approval", () => {
  const f = fixture();
  assert.equal(
    briefHash(f.pr.body.replaceAll("\n", "\r\n")),
    briefHash(f.pr.body),
  );
  assert.equal(
    briefHash(
      f.pr.body.replace(
        "## Feature brief",
        "## Feature brief\n<!-- instructions -->",
      ),
    ),
    briefHash(f.pr.body),
  );
});
test("high-risk boundaries include workflows, migration, auth, dependencies and global styles", () => {
  for (const path of [
    ".github/workflows/ci.yml",
    "docs/guide/product.md",
    ".agents/skills/wuff-contributor/SKILL.md",
    "AGENTS.md",
    "AGENTS.override.md",
    "apps/web/AGENTS.override.md",
    "packages/db/migrations/a.sql",
    "packages/domain/src/index.ts",
    "packages/contracts/src/index.ts",
    "packages/design/src/index.ts",
    "pnpm-lock.yaml",
    "apps/web/src/app/api/v1/route.ts",
    "apps/web/src/lib/auth.ts",
    "packages/ui/src/theme.css",
    "apps/native/src-tauri/tauri.conf.json",
  ])
    assert.equal(sensitive(path), true, path);
  assert.equal(
    sensitive("packages/ui/src/features/app/lists/task-row.tsx"),
    false,
  );
});
