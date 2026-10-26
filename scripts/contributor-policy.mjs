import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const CHECK_NAME = "Contributor policy";
const sections = [
  "Feature brief",
  "Scope",
  "API, MCP and connections",
  "Unit tests",
  "Preview",
  "Verification",
  "Remaining work or risks",
];

export function section(body, title) {
  const lines = String(body ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${title}`);
  if (start < 0) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^## /.test(line));
  return rest
    .slice(0, end < 0 ? undefined : end)
    .join("\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

export function surfaceContractErrors(body) {
  const blocks = [
    ...section(body, "API, MCP and connections").matchAll(
      /```json\s*\n([\s\S]*?)\n```/g,
    ),
  ];
  if (blocks.length !== 1)
    return [
      "Provide exactly one JSON surface contract under 'API, MCP and connections'.",
    ];
  let contract;
  try {
    contract = JSON.parse(blocks[0][1]);
  } catch {
    return ["The API/MCP/connection surface contract must be valid JSON."];
  }
  if (!contract || typeof contract !== "object" || Array.isArray(contract))
    return ["The surface contract must be a JSON object."];
  const errors = [];
  const text = (value, min = 20) =>
    typeof value === "string" &&
    value.trim().length >= min &&
    !/^(?:todo|tbd|pending|n\/a|none|example)[.!]?$/i.test(value.trim());
  if (
    typeof contract.dataChanges !== "boolean" ||
    !Array.isArray(contract.operations)
  )
    errors.push("Declare dataChanges as a boolean and operations as an array.");
  else if (contract.dataChanges) {
    if (!contract.operations.length)
      errors.push(
        "Every data-changing feature needs domain/API/MCP operation mappings.",
      );
    for (const op of contract.operations) {
      if (
        !op ||
        !text(op.action, 8) ||
        !text(op.domain, 5) ||
        !/\b(?:POST|PUT|PATCH|DELETE) \/api\//.test(op.api ?? "") ||
        /\/example\b/.test(op.api ?? "") ||
        !/^[a-z][a-z0-9_]{2,}$/.test(op.mcp ?? "") ||
        op.mcp === "update_example"
      )
        errors.push(
          "Each mutation must name its action, shared domain operation, actual API write route and MCP tool.",
        );
      if (op?.status !== "implemented" || !text(op?.verification))
        errors.push(
          "API/MCP operations must be implemented with actual adapter verification; placeholders or deferrals cannot pass.",
        );
    }
  } else if (contract.operations.length || !text(contract.noDataChangesReason))
    errors.push(
      "No-data changes need empty operations and a concrete noDataChangesReason.",
    );
  if (
    !["implemented", "not-needed"].includes(contract.mcpUi?.decision) ||
    !text(contract.mcpUi?.reason)
  )
    errors.push(
      "Decide MCP UI explicitly: implemented or not-needed, with a concrete reason.",
    );
  if (
    contract.mcpUi?.decision === "implemented" &&
    !text(contract.mcpUi.verification)
  )
    errors.push(
      "Implemented MCP UI needs explicit UI/host and tool-only verification.",
    );
  if (
    typeof contract.connections?.affected !== "boolean" ||
    !text(contract.connections?.review)
  )
    errors.push(
      "Declare connection impact and review scopes, consent, recovery, revocation and credential privacy.",
    );
  if (
    contract.connections?.affected === true &&
    !text(contract.connections.verification)
  )
    errors.push(
      "Affected connections need verification of grant/consent/revocation/privacy behavior.",
    );
  return [...new Set(errors)];
}

function validPath(path) {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    path.length < 300 &&
    !/[\x00-\x1f\x7f]/.test(path) &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").some((part) => !part || part === "." || part === "..")
  );
}

// Review hints only: contributors may prepare these changes without prior approval.
// Semantic access/permission changes still need human review even outside these paths.
export function sensitive(path) {
  return (
    /^(?:\.github\/|\.codex\/|\.agents\/|packages\/db\/)/.test(path) ||
    /(?:^|\/)AGENTS(?:\.override)?\.md$/.test(path) ||
    /^(?:scripts\/(?:contributor-policy|migrate|seed-development|provision)[^/]*|docs\/(?:contributor[^/]*|github-main-ruleset\.json))$/.test(
      path,
    ) ||
    /^(?:apps\/web\/src\/(?:app\/(?:oauth|\.well-known)(?:\/|$)|lib\/(?:auth(?:\/|\.)|oauth\.|oauth-resource-policy\.|retired-native\.|native-policy\.))|packages\/domain\/src\/(?:index|agents|github-policy)\.)/.test(
      path,
    ) ||
    /(?:^|\/)(?:vercel\.json|drizzle\.config\.[^/]+|tauri\.conf\.json)$/.test(
      path,
    ) ||
    /^apps\/native\/src-tauri\/(?:capabilities|permissions)\//.test(path)
  );
}

function forbidden(path) {
  return (
    (/(?:^|\/)(?:\.env(?:\..*)?|[^/]+\.(?:pem|p12|pfx|key)|id_rsa|id_ed25519)$/.test(
      path,
    ) &&
      path.split("/").at(-1) !== ".env.example") ||
    /^(?:\.vercel|node_modules)(?:\/|$)/.test(path)
  );
}

export function unitTestErrors(body, files) {
  const matches = [
    ...section(body, "Unit tests").matchAll(/```json\s*\n([\s\S]*?)\n```/g),
  ];
  if (matches.length !== 1)
    return [
      "Provide one JSON Unit tests declaration with required, files/verification or a no-behavior reason.",
    ];
  let unit;
  try {
    unit = JSON.parse(matches[0][1]);
  } catch {
    return ["Unit tests declaration must be valid JSON."];
  }
  if (!unit || typeof unit.required !== "boolean")
    return ["Unit tests must declare required as a boolean."];
  let dataChanges = false;
  try {
    dataChanges =
      JSON.parse(
        section(body, "API, MCP and connections").match(
          /```json\s*\n([\s\S]*?)\n```/,
        )?.[1],
      ).dataChanges === true;
  } catch {
    /* Surface validator rejects invalid contracts. */
  }
  if (!unit.required)
    return dataChanges
      ? ["Data-changing features cannot waive unit tests."]
      : typeof unit.reason !== "string" || unit.reason.trim().length < 30
        ? [
            "A unit-test exception needs a concrete explanation that no testable behavior changes.",
          ]
        : [];
  const errors = [];
  if (!Array.isArray(unit.files) || unit.files.length === 0)
    errors.push("Required unit tests must name added/updated test files.");
  else
    for (const path of unit.files) {
      const unitPath =
        typeof path === "string" &&
        validPath(path) &&
        (/^tests\/.*\.test\.(?:[cm]?[jt]s|tsx)$/.test(path) ||
          /^tests\/(?:.*\/)?test_[^/]+\.py$/.test(path) ||
          /^apps\/native\/src-tauri\/.*\.rs$/.test(path)) &&
        !/\.integration\.test\./.test(path);
      if (
        !unitPath ||
        !files.some(
          (file) => file.filename === path && file.status !== "removed",
        )
      )
        errors.push(
          "Unit test files must be actual added/updated unit tests in this PR, not integration-only or deleted tests.",
        );
    }
  if (
    typeof unit.verification !== "string" ||
    unit.verification.trim().length < 30
  )
    errors.push(
      "Unit tests need actual cases, commands and results; declarations do not prove coverage.",
    );
  return [...new Set(errors)];
}

export function evaluate({ pr, files }) {
  const errors = surfaceContractErrors(pr.body);
  errors.push(...unitTestErrors(pr.body, files));
  if (pr.base?.ref !== "main") errors.push("Contributor PRs must target main.");
  if (!pr.head?.ref?.startsWith("codex/"))
    errors.push("Use a codex/ feature branch.");
  for (const title of sections) {
    const content = section(pr.body, title);
    if (
      content.length < (title === "Feature brief" ? 80 : 20) ||
      /^(?:todo|tbd|n\/a|none|pending)[.!]?$/i.test(content)
    )
      errors.push(
        `Complete the '${title}' section with concrete information (or explain a non-applicable check).`,
      );
  }
  if (!/- \[[ xX]\] .+/.test(section(pr.body, "Feature brief")))
    errors.push(
      "Feature brief needs testable acceptance criteria as checkboxes.",
    );
  if (
    !section(pr.body, "Verification").includes(
      `Evidence commit: ${pr.head?.sha}`,
    )
  )
    errors.push(
      "Verification must include 'Evidence commit: <current full head SHA>'.",
    );
  const reviewPaths = new Set();
  for (const file of files) {
    for (const path of new Set(
      [file.filename, file.previous_filename].filter(Boolean),
    )) {
      if (!validPath(path)) errors.push("A changed path is invalid.");
      else if (sensitive(path)) reviewPaths.add(path);
    }
    if ([file.filename, file.previous_filename].filter(Boolean).some(forbidden))
      errors.push(
        "Credential/environment/generated dependency files cannot be submitted; remove them and rotate any exposed credentials.",
      );
  }
  if (!files.length) errors.push("No changed files were found.");
  if (
    files.length >= 3000 ||
    (pr.changed_files != null && files.length !== pr.changed_files)
  )
    errors.push(
      "Incomplete changed-file inventory; split the PR or investigate before review.",
    );
  return { errors: [...new Set(errors)], reviewPaths: [...reviewPaths].sort() };
}

export async function run({ event, request = fetch, env = process.env } = {}) {
  event ??= JSON.parse(await readFile(env.GITHUB_EVENT_PATH, "utf8"));
  const number = event.pull_request?.number;
  if (!number) return;
  const repo = env.GITHUB_REPOSITORY;
  if (repo !== "timbenniks/wuff-todo")
    throw new Error(
      "Unexpected repository; configure a separate policy for another repository.",
    );
  async function api(path, method = "GET", body) {
    const response = await request(
      `https://api.github.com/repos/${repo}/${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: body == null ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok)
      throw new Error(
        `GitHub API ${method} failed (${response.status}); check workflow permissions and retry.`,
      );
    return response.json();
  }
  async function pages(path) {
    const result = [];
    for (let page = 1; page <= 30; page++) {
      const batch = await api(`${path}?per_page=100&page=${page}`);
      result.push(...batch);
      if (batch.length < 100) return result;
    }
    throw new Error(
      "Policy inventory exceeds the safe pagination limit; split the PR.",
    );
  }
  const pr = await api(`pulls/${number}`);
  if (pr.state !== "open") return;
  const check = await api("check-runs", "POST", {
    name: CHECK_NAME,
    head_sha: pr.head.sha,
    status: "in_progress",
  });
  try {
    const files = await pages(`pulls/${number}/files`);
    const result = evaluate({ pr, files });
    const latest = await api(`pulls/${number}`);
    if (
      latest.head.sha !== pr.head.sha ||
      latest.body !== pr.body ||
      latest.base.sha !== pr.base.sha ||
      latest.base.ref !== pr.base.ref ||
      latest.state !== "open"
    )
      result.errors.push(
        "PR changed during evaluation. Rerun the policy before review.",
      );
    const summary = [
      `Evidence commit: ${pr.head.sha}`,
      ...result.errors.map((error) => `- ${error}`),
      ...(result.reviewPaths.length
        ? [
            "Review attention (no preliminary approval required):",
            ...result.reviewPaths.map((path) => `- ${path}`),
          ]
        : []),
      "This check validates delivery declarations and evidence presence, not evidence truth or application quality. Tim's review and passing Verify checks remain required.",
    ].join("\n\n");
    await api(`check-runs/${check.id}`, "PATCH", {
      status: "completed",
      conclusion: result.errors.length ? "failure" : "success",
      output: {
        title: result.errors.length
          ? "Contributor requirements need attention"
          : "Delivery requirements satisfied",
        summary: summary.slice(0, 60000),
      },
    });
    return result.errors.length === 0;
  } catch (error) {
    await api(`check-runs/${check.id}`, "PATCH", {
      status: "completed",
      conclusion: "failure",
      output: {
        title: "Policy could not complete",
        summary:
          "GitHub data could not be evaluated. Investigate the workflow and retry; do not bypass for contributors.",
      },
    });
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run()
    .then((passed) => {
      if (passed === false) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
