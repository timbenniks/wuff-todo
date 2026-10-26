import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluate,
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
  return { pr, files, surface, unit, comments: [] };
}
function setSurface(f, patch) {
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
    f.pr.body = f.pr.body.replace(
      /(## Unit tests\n```json\n)[\s\S]*?(\n```)/,
      (_match, start, end) => start + JSON.stringify(f.unit) + end,
    );
  }
  f.pr.body = f.pr.body.replace(
    /```json\n[\s\S]*?\n```/,
    "```json\n" + JSON.stringify(f.surface) + "\n```",
  );
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
test("contributors can evolve complete capability mappings without approval", () => {
  const f = fixture();
  setSurface(f, { dataChanges: true, operations: [mutation()] });
  assert.deepEqual(evaluate(f).errors, []);
  setSurface(f, { operations: [{ ...mutation(), mcp: "another_mutation" }] });
  assert.deepEqual(evaluate(f).errors, []);
  setSurface(f, { operations: [{ ...mutation(), verification: "Pending" }] });
  assert.match(evaluate(f).errors.join(" "), /actual adapter verification/);
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
function apiFixture({ failInventory = false, change = null } = {}) {
  const f = fixture();
  f.pr.state = "open";
  f.pr.base.sha = "b".repeat(40);
  const calls = [];
  let prReads = 0;
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
      if (++prReads > 1) {
        if (change === "head") data.head.sha = "c".repeat(40);
        if (change === "body") data.body += "Updated during evaluation.";
        if (change === "base") data.base.sha = "c".repeat(40);
        if (change === "target") data.base.ref = "another-branch";
        if (change === "closed") data.state = "closed";
      }
    } else if (path === "pulls/22/files") {
      if (failInventory) return Response.json({}, { status: 403 });
      data = f.files;
    } else if (path === "check-runs" && options.method === "POST")
      data = { id: 45 };
    else if (path === "check-runs/45" && options.method === "PATCH")
      data = { id: 45 };
    else throw new Error("Unexpected policy API request");
    return Response.json(data);
  };
  return {
    args: {
      event: { pull_request: { number: 22 } },
      request,
      env: {
        GITHUB_REPOSITORY: "timbenniks/wuff-todo",
        GITHUB_TOKEN: "synthetic-test-token",
      },
    },
    calls,
    fixture: f,
  };
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

test("head, body, base, target and state changes during evaluation fail closed", async () => {
  for (const change of ["head", "body", "base", "target", "closed"]) {
    const f = apiFixture({ change });
    assert.equal(await run(f.args), false, change);
    assert.equal(f.calls.at(-1).body.conclusion, "failure", change);
  }
});

test("unrelated comment events do not run policy or require comment access", async () => {
  const f = apiFixture();
  f.args.event = { issue: { number: 22, pull_request: {} } };
  assert.equal(await run(f.args), undefined);
  assert.deepEqual(f.calls, []);
});

test("an ordinary feature passes without approval comments or scope lists", () => {
  assert.deepEqual(evaluate(fixture()).errors, []);
});

test("legacy approval and revocation comments cannot restrict contributor iteration", () => {
  const f = fixture();
  for (const body of [
    '/wuff-scope\n{"revoke":true}',
    '/wuff-scope\n{"broken"',
  ]) {
    f.comments = [{ id: 1, user: { id: 121096 }, body }];
    assert.deepEqual(evaluate(f).errors, []);
  }
});

test("brief and routine file changes need no renewed approval", () => {
  const f = fixture();
  f.pr.body = f.pr.body.replace(
    "Exclude backend changes.",
    "Reuse existing backend capabilities.",
  );
  for (const filename of [
    "packages/ui/src/features/app/lists/new-control.tsx",
    "packages/ui/src/theme.css",
    "packages/design/src/index.ts",
    "packages/contracts/src/index.ts",
    "package.json",
    "pnpm-lock.yaml",
  ]) {
    f.files[0].filename = filename;
    assert.deepEqual(evaluate(f).errors, [], filename);
    assert.deepEqual(evaluate(f).reviewPaths, [], filename);
  }
});

test("high-risk edits and renames are visible for review without preliminary approval", () => {
  const f = fixture();
  f.files[0].previous_filename = "packages/domain/src/index.ts";
  assert.deepEqual(evaluate(f).errors, []);
  assert.deepEqual(evaluate(f).reviewPaths, ["packages/domain/src/index.ts"]);
  f.files[0].filename = "packages/db/src/schema.ts";
  assert.deepEqual(evaluate(f).errors, []);
  assert.deepEqual(evaluate(f).reviewPaths, [
    "packages/db/src/schema.ts",
    "packages/domain/src/index.ts",
  ]);
});

test("invalid paths fail closed for current and renamed files", () => {
  for (const path of [
    "../packages/task.ts",
    "/packages/task.ts",
    "packages/../task.ts",
    "packages//task.ts",
    "bad\\path.ts",
    "bad\u0000path.ts",
  ]) {
    for (const field of ["filename", "previous_filename"]) {
      const f = fixture();
      f.files[0][field] = path;
      assert.match(
        evaluate(f).errors.join(" "),
        /path is invalid/,
        `${field}: ${path}`,
      );
    }
  }
});

test("credentials and generated dependency files remain forbidden, including rename sources", () => {
  for (const path of [
    ".env.local",
    "apps/web/.env.production",
    "secret.pem",
    "secret.p12",
    "secret.pfx",
    "secret.key",
    "id_ed25519",
    ".vercel/project.json",
    "node_modules/example/index.js",
  ]) {
    for (const field of ["filename", "previous_filename"]) {
      const f = fixture();
      f.files[0][field] = path;
      assert.match(
        evaluate(f).errors.join(" "),
        /cannot be submitted/,
        `${field}: ${path}`,
      );
    }
  }
  const f = fixture();
  f.files[0].filename = ".env.example";
  assert.deepEqual(evaluate(f).errors, []);
});

test("large diffs need no size exception but incomplete inventories still fail", () => {
  const f = fixture();
  f.files[0].additions = 801;
  assert.deepEqual(evaluate(f).errors, []);
  f.pr.changed_files = 2;
  assert.match(evaluate(f).errors.join(" "), /Incomplete/);
  f.files = [];
  f.pr.changed_files = 0;
  assert.match(evaluate(f).errors.join(" "), /No changed files/);
});

test("stale evidence, missing acceptance and template-only sections cannot pass", () => {
  const f = fixture();
  f.pr.head.sha = "b".repeat(40);
  assert.match(evaluate(f).errors.join(" "), /Evidence commit/);
  f.pr.body = "## Feature brief\n<!-- template only -->";
  assert.match(evaluate(f).errors.join(" "), /acceptance criteria/);
  assert.match(evaluate(f).errors.join(" "), /Complete the/);
});
test("line endings and explanatory comments do not block delivery", () => {
  const f = fixture();
  f.pr.body = f.pr.body.replaceAll("\n", "\r\n");
  assert.deepEqual(evaluate(f).errors, []);
  f.pr.body = f.pr.body.replace(
    "## Feature brief",
    "## Feature brief\n<!-- instructions -->",
  );
  assert.deepEqual(evaluate(f).errors, []);
});

test("review hints focus on safeguards, schema, access and operational permissions", () => {
  for (const path of [
    ".github/workflows/ci.yml",
    ".agents/skills/wuff-contributor/SKILL.md",
    "AGENTS.md",
    "AGENTS.override.md",
    "apps/web/AGENTS.override.md",
    "packages/db/migrations/a.sql",
    "packages/domain/src/index.ts",
    "apps/web/src/lib/auth/server.ts",
    "apps/web/src/lib/oauth.ts",
    "apps/web/src/lib/oauth-resource-policy.ts",
    "apps/web/src/lib/retired-native.ts",
    "apps/native/src-tauri/tauri.conf.json",
    "apps/native/src-tauri/capabilities/default.json",
    "scripts/contributor-policy.mjs",
    "scripts/migrate.ts",
    "vercel.json",
  ])
    assert.equal(sensitive(path), true, path);
  for (const path of [
    "docs/guide/product.md",
    "packages/ui/src/features/app/lists/task-row.tsx",
    "packages/ui/src/theme.css",
    "packages/design/src/index.ts",
    "pnpm-lock.yaml",
  ])
    assert.equal(sensitive(path), false, path);
});

test("trusted runner reports review hints without making them an approval gate", async () => {
  const f = apiFixture();
  f.fixture.files[0].filename = "packages/db/src/schema.ts";
  assert.equal(await run(f.args), true);
  assert.match(
    f.calls.at(-1).body.output.summary,
    /packages\/db\/src\/schema.ts/,
  );
  assert.match(
    f.calls.at(-1).body.output.summary,
    /no preliminary approval required/,
  );
  assert.ok(f.calls.every((c) => !c.path.includes("comments")));
});

test("feature branches and the main target remain required", () => {
  const f = fixture();
  f.pr.head.ref = "main";
  f.pr.base.ref = "other";
  assert.match(evaluate(f).errors.join(" "), /codex\//);
  assert.match(evaluate(f).errors.join(" "), /target main/);
});
