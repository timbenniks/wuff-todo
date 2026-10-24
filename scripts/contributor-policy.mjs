import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const CHECK_NAME = "Contributor policy";
export const MAINTAINER_ID = 121096;
const sections = [
  "Feature brief",
  "Scope",
  "API, MCP and connections",
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

export function briefHash(body) {
  const content = section(body, "API, MCP and connections");
  let scope = content;
  try {
    const matches = [...content.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
    if (matches.length !== 1) throw new Error("Invalid contract");
    const value = JSON.parse(matches[0][1]);
    // Bind intended capabilities, not results/status that must evolve during implementation.
    scope = JSON.stringify({
      dataChanges: value.dataChanges,
      noDataChangesReason:
        value.dataChanges === false ? value.noDataChangesReason : undefined,
      operations: Array.isArray(value.operations)
        ? value.operations.map((op) => ({
            action: op?.action,
            domain: op?.domain,
            api: op?.api,
            mcp: op?.mcp,
          }))
        : value.operations,
      mcpUi: { decision: value.mcpUi?.decision, reason: value.mcpUi?.reason },
      connections: {
        affected: value.connections?.affected,
        review: value.connections?.review,
      },
    });
  } catch {
    /* Invalid declarations still get a reportable hash but can never pass policy. */
  }
  return createHash("sha256")
    .update(
      section(body, "Feature brief") +
        "\n\n## API, MCP and connections\n" +
        scope,
    )
    .digest("hex");
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

function validPattern(pattern) {
  if (typeof pattern !== "string") return false;
  const prefix = pattern?.endsWith("/**") ? pattern.slice(0, -3) : pattern;
  return validPath(prefix) && !/[\*?\[\]{}!]/.test(prefix);
}

function matches(path, pattern) {
  return pattern.endsWith("/**")
    ? path.startsWith(pattern.slice(0, -2))
    : path === pattern;
}

export function sensitive(path) {
  return (
    /^(?:\.github\/|\.codex\/|\.agents\/|scripts\/|packages\/(?:db|domain|contracts|design)\/)/.test(
      path,
    ) ||
    /(?:^|\/)AGENTS\.md$/.test(path) ||
    /(?:^|\/)(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|vercel\.json|drizzle\.config\.[^/]+|tsconfig[^/]*\.json|next\.config\.[^/]+|postcss\.config\.[^/]+|Cargo\.(?:toml|lock)|\.gitignore)$/.test(
      path,
    ) ||
    /\.(?:css|scss)$/.test(path) ||
    /^(?:apps\/web\/src\/(?:app\/(?:api|oauth|\.well-known)(?:\/|$)|lib\/)|packages\/(?:client|ui)\/src\/.*(?:auth|api|runtime|live))/i.test(
      path,
    ) ||
    /^(?:apps\/native\/src-tauri\/|apps\/mobile\/.*(?:app\.config|app\.json))/.test(
      path,
    ) ||
    /^(?:docs\/(?:contributor|github-main|guide\/|implementation-guide\.md)|\.env\.example|tsconfig)/.test(
      path,
    )
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

export function evaluate({ pr, files, comments }) {
  const errors = surfaceContractErrors(pr.body);
  const hash = briefHash(pr.body);
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
  const approvals = comments
    .filter(
      (comment) =>
        comment.user?.id === MAINTAINER_ID &&
        comment.body?.startsWith("/wuff-scope\n"),
    )
    .sort((a, b) => a.id - b.id);
  let approval;
  try {
    approval = JSON.parse(
      approvals.at(-1)?.body.slice("/wuff-scope\n".length) ?? "null",
    );
  } catch {
    errors.push("Latest maintainer scope comment is invalid JSON.");
  }
  if (!approval || approval.revoke === true)
    errors.push(
      "Tim must approve scope using a /wuff-scope comment; approval is missing or revoked.",
    );
  else {
    if (approval.briefSha256 !== hash)
      errors.push(
        "The feature brief changed or its API/MCP/connection scope is not approved; request a new scope approval.",
      );
    if (
      !Array.isArray(approval.allowedPaths) ||
      approval.allowedPaths.length === 0 ||
      approval.allowedPaths.length > 100 ||
      !approval.allowedPaths.every(validPattern)
    )
      errors.push(
        "Approved paths must be repository-relative exact files or directory/** patterns; broad root wildcards are not accepted.",
      );
    if (
      !Array.isArray(approval.sensitivePaths) ||
      !approval.sensitivePaths.every(
        (path) => validPath(path) && !path.includes("*"),
      )
    )
      errors.push(
        "sensitivePaths must list exact files (or be an empty array).",
      );
    if (!errors.some((error) => /Approved paths|sensitivePaths/.test(error))) {
      for (const file of files) {
        for (const path of new Set(
          [file.filename, file.previous_filename].filter(Boolean),
        )) {
          if (!validPath(path)) {
            errors.push("A changed path is invalid.");
            continue;
          }
          if (!approval.allowedPaths.some((pattern) => matches(path, pattern)))
            errors.push(`Outside approved scope: ${path}`);
          if (sensitive(path) && !approval.sensitivePaths.includes(path))
            errors.push(`Needs explicit sensitive-file approval: ${path}`);
        }
      }
    }
    if (
      files.reduce(
        (sum, file) => sum + (file.additions ?? 0) + (file.deletions ?? 0),
        0,
      ) > 800 &&
      approval.allowLargeDiff !== true
    )
      errors.push(
        "Diff exceeds 800 changed lines; split the feature or ask Tim to approve allowLargeDiff.",
      );
  }
  for (const file of files) {
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
  return { errors: [...new Set(errors)], briefSha256: hash };
}

export async function run({ event, request = fetch, env = process.env } = {}) {
  event ??= JSON.parse(await readFile(env.GITHUB_EVENT_PATH, "utf8"));
  const number =
    event.pull_request?.number ??
    (event.issue?.pull_request && event.issue.number);
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
    const [files, comments] = await Promise.all([
      pages(`pulls/${number}/files`),
      pages(`issues/${number}/comments`),
    ]);
    const result = evaluate({ pr, files, comments });
    const [latest, latestComments] = await Promise.all([
      api(`pulls/${number}`),
      pages(`issues/${number}/comments`),
    ]);
    if (
      latest.head.sha !== pr.head.sha ||
      latest.body !== pr.body ||
      latest.base.sha !== pr.base.sha ||
      JSON.stringify(
        latestComments.filter(
          (c) =>
            c.user?.id === MAINTAINER_ID && c.body?.startsWith("/wuff-scope\n"),
        ),
      ) !==
        JSON.stringify(
          comments.filter(
            (c) =>
              c.user?.id === MAINTAINER_ID &&
              c.body?.startsWith("/wuff-scope\n"),
          ),
        )
    )
      result.errors.push(
        "PR changed during evaluation. Rerun the policy before review.",
      );
    const summary = [
      `Feature scope SHA-256: \`${result.briefSha256}\``,
      `Evidence commit: ${pr.head.sha}`,
      ...result.errors.map((error) => `- ${error}`),
      "This check validates declared scope and evidence presence, not evidence truth or application quality. Tim's review and passing Verify checks remain required.",
    ].join("\n\n");
    await api(`check-runs/${check.id}`, "PATCH", {
      status: "completed",
      conclusion: result.errors.length ? "failure" : "success",
      output: {
        title: result.errors.length
          ? "Contributor requirements need attention"
          : "Scope and evidence requirements satisfied",
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
