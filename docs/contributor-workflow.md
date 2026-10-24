# Build a Wuff feature safely

This workflow covers real feature work in the repository. The contributor chooses
product behavior and tries the result. Their agent handles Git, code, checks and
the PR. Tim approves technical scope, reviews and merges. A draft PR may be
incomplete; ready for review requires the evidence below.

## Before the first feature

Tim must finish these gates before granting contributor write access:

- Activate and verify main protection with owner review, `check` and
  `Contributor policy`. Current plan and runner billing blocks are recorded in
  [GitHub safeguards](https://github.com/timbenniks/wuff-todo/blob/main/docs/contributor-github.md).
- Give each person their own GitHub credentials and no administration or bypass
  access. Never lend Tim's gh login, production credentials or environment files.
  Prefer upstream read access plus a private fork, where the repository's plan and
  fork settings allow it. They push their feature branch to their fork and open
  a PR to upstream main. Upstream write access also permits changing branch
  workflows and emitting similarly named Actions checks; required owner review
  remains essential. Check names alone are not an adversarial security boundary.
- Supply a disposable workspace with synthetic data. A branch/worktree does not
  isolate commands or secrets. Use a dedicated container/account or hosted
  environment without production credentials, privileged MCP connectors or access
  to Tim's credential files. Repository instructions are not a sandbox.
- Confirm preview database, auth and Blob isolation, restrict preview access and
  disable real notifications, paid agent runs and provider side effects. Do not
  test preview writes until Tim confirms this setup; a Vercel URL proves no data
  isolation.

Repository changes do not provision a contributor sandbox or preview backend.
Until those gates pass, use read-only access or clearly labeled local mock work
inside the feature branch. There is no separate standalone prototype workflow.

## 1. Understand and define

Read root/nearby AGENTS.md, implementation plan, product spec, architecture,
development, verification and relevant feature docs. Read the product, design and
accessibility guide. Inspect existing code before inventing another component,
service or dependency.

Create one `codex/` branch and early draft PR using the repository template. Never
reset another person's edits, force push shared work or rebase someone else's
branch. Fetch main and resolve conflicts on the feature branch; ask for technical
help if the correct behavior is unclear.

Fill `## Feature brief` with the problem, intended users, included/excluded
behavior, existing behavior to preserve and testable acceptance checkboxes. Under
`## Scope`, identify files, UI/API interactions and sensitive changes. Resolve
product questions with the contributor in ordinary language. Do not ask them to
choose database designs or approve infrastructure commands.

Use `docs/guide/` (hosted at `/docs`) for product, design, component and accessibility
rules. Show the main interaction early, offer small concrete product choices and
keep a short decision log. Distinguish preserved behavior from proposed changes.
Record entry points, outcomes, cancellation/recovery and personal/shared effects
so the brief stands alone without the chat. Local mocks are an iteration tool,
not proof of backend persistence or authorization.

Complete `## API, MCP and connections` using `docs/guide/surfaces.md` before scope
approval. Inventory every persisted mutation and its shared domain/API/MCP mapping,
authorized reads, MCP UI decision and connection/consent/revocation impact. Existing
tools may be extended; web-only data changes cannot be marked complete.

## 2. Get technical scope approved

Before implementation, obtain Tim's brief and path approval on the PR. Prepare
a mock/proposal while waiting; do not implement outside approved scope. The
contributor cannot authorize sensitive technical changes.

The policy reports a SHA-256 binding `## Feature brief` and the scope fields of
`## API, MCP and connections`: data-change classification, operation/domain/API/MCP
mappings, MCP UI decision/reason and connection impact/review. Verification results
and implementation status may evolve without changing scope; mappings and decisions
need renewed approval. Brief text has normalized line endings, comments removed
and outer whitespace trimmed; surface fields use the helper's canonical JSON.
Tim can compute the hash read-only from a
trusted checkout:

```sh
gh pr view NUMBER --json body --jq .body > /tmp/wuff-pr-body.md
node --input-type=module -e 'import {readFileSync} from "node:fs"; import {briefHash} from "./scripts/contributor-policy.mjs"; console.log(briefHash(readFileSync("/tmp/wuff-pr-body.md", "utf8")))'
```

Tim posts a comment starting with `/wuff-scope`, followed by JSON on the next line:

```text
/wuff-scope
{"briefSha256":"PASTE_THE_REPORTED_HASH","allowedPaths":["packages/ui/src/features/app/lists/task-row.tsx","tests/task-metadata.test.ts","docs/task-content.md"],"sensitivePaths":[],"allowLargeDiff":false}
```

Paths are exact repository-relative files or `directory/**`. Root wildcards and
path traversal are rejected. Renames require both paths. Sensitive files need
their exact names in `sensitivePaths` as well as an allowed path. Diffs over 800
added/deleted lines require `allowLargeDiff: true` or a smaller PR. The latest
scope comment **created** by Tim's numeric GitHub ID wins; editing it updates that
approval. Revoke by posting:

```text
/wuff-scope
{"revoke":true}
```

Changing the brief invalidates approval. Expanding scope requires renewed Tim
approval. Never impersonate Tim or use his credentials for contributor approvals.

## 3. Implement within Wuff's boundaries

- Reuse components, tokens, typography and interactions from `@wuff/ui`. Preserve
  compact layouts, 44px grouped action targets, keyboard/focus and accessible
  labels. Do not initialize a replacement component system.
- Keep server/domain/database code out of browser bundles. Use existing authorized
  services. Every persisted-data feature ships equivalent API and MCP capabilities
  through the same domain operations. Assess MCP App UI and connection handling
  explicitly; do not postpone parity until a later feature.
- Preserve private admission, owner-only list administration, shared editor
  permissions, personal preferences/credentials and online-only behavior. Use no
  real private data in previews.
- Preserve version checks, operation IDs and exact-payload retries. Handle stale
  writes and uncertain saves without duplicate mutations or silently losing drafts.
- Avoid unbounded reads, per-row repeated requests, eager heavy editors and
  duplicate subscriptions. Measure query/request or bundle impact when affected.
- Dependencies, contracts, global CSS/tokens, auth, schema, native permissions,
  CI and deployment changes need Tim's explicit scope approval. Ordinary scope
  approval never authorizes migration execution, provisioning, production deploys,
  paid agent runs or release publication.
- Add meaningful regression coverage for changed permissions, retries, concurrency
  and recovery. Do not weaken tests, hide errors with suppressions, mock away the
  tested behavior or change safeguards just to get a green check.
- Keep one feature per PR, record decisions/evidence in its feature document, and
  report unrelated defects separately instead of expanding scope.

The policy conservatively flags sensitive files. It cannot identify every risky
code path or judge architecture; Tim must inspect semantic changes too.

## 4. Verify and record current evidence

Run `pnpm typecheck`, `pnpm test` and relevant regression checks. For new behavior,
write a meaningful failing regression case before the fix when practical. Use the
configured isolated backend and synthetic accounts for integration tests. Never
fall back to production when local services are unavailable.

For UI changes, exercise 320px, 390px and desktop, long content, keyboard/focus,
labels, relevant palettes and applicable loading/empty/error/denied/conflict
states. Check overflow, cancellation, retries and preserved drafts. Attach
screenshots and reproduction steps. Browser checks do not prove screen-reader or
physical-device behavior; report only accessibility checks actually performed.

For authorized server changes, verify relevant owner/editor/outsider isolation,
revocation, idempotency, concurrent/stale writes and API/MCP parity. Record actual
performance measurements when affected. Native compilation and installed-platform
checks are Tim's local release gate; Vercel's web build is separate evidence.

For each persisted mutation, prove API-write/MCP-read and MCP-write/API-or-web-read
against isolated data, including relevant permission/conflict/retry failures. For
affected connections, test missing/expired/revoked grants, insufficient scopes,
explicit consent recovery, disconnect and cross-account credential privacy. MCP
UI needs actual control checks and tool-only fallback; report the host tested.

Fill `## Verification` with commands/results and the full current source commit:

```text
Evidence commit: FULL_40_CHARACTER_HEAD_SHA
```

After new code, rerun affected checks and update evidence; do not just relabel old
results with a new SHA. Under `## Preview`, link the deployment for that commit,
test steps and who confirmed backend isolation. If unavailable, explain the
blocker and local evidence. Never invent a preview or isolation claim.

## 5. Submit for review

Review the entire diff for unintended files, secrets, debug data and regressions.
Match acceptance criteria to observed behavior. Fill `## Remaining work or risks`
with gaps, consequences, rollout steps and responsible people; explain when no
known risks remain. Mark ready only when checks pass and evidence is sufficient.
Policy checks prove scope matching and evidence presence, never truth or quality.

Give the contributor a plain-language summary, PR/preview links and remaining
technical help. Do not merge, push main, deploy or mark the feature released. Tim
reviews UI, architecture, evidence and rollout before merging and can request
changes even when automated checks pass.

## Technical help without blocking the idea

When scope/infrastructure is missing, prepare a concrete handoff: user goal,
proposed technical change, affected files, risks and smallest alternative. Keep
the draft PR/mock reviewable. Never ask a nontechnical contributor to authorize
migrations or production commands.
