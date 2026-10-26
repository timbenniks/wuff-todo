# Wuff Todo

Start with `docs/implementation-plan.md` for current status and the next planned milestone, then read `docs/product-spec.md` and `docs/architecture.md` before changing behavior. Read `docs/development.md` before running environment, database, or deployment commands, and `docs/verification.md` before making verification claims. Preserve confirmed decisions; record technical decisions and verification evidence in `docs/`.

- Follow the current milestone in `docs/implementation-plan.md`; preserve invite-only access and private/shared list boundaries across web, HTTP API, MCP and PWA.
- Only owners rename/delete lists. Every API and MCP operation enforces access in shared server-side domain services.
- Every persisted-data feature must ship equivalent authorized HTTP API and MCP
  capabilities through shared domain services. Assess MCP App UI and connection/
  scope/consent/revocation impacts explicitly; document and test adapter parity.
  Follow [the surface contract](docs/guide/surfaces.md). Web-only mutations are incomplete.
- Provision and connect Neon through the Vercel CLI. Use `gh` for GitHub and `vercel` for deployment. Never substitute a separately provisioned Neon project.
- Keep secrets in ignored environment files. Never print tokens, passwords, invitation links, or database URLs in logs or chat.
- Use pnpm workspaces. Server packages must not enter client bundles. Keep public contracts independent of database implementation.
- Use Drizzle migrations and direct connections for schema changes. Do not modify auth-managed tables.
- Test permissions, idempotency, concurrent updates, and OAuth flows with synthetic data. Distinguish builds from live integration proof.
- Keep the UI concise, accessible, and consistent. Do not add scheduling or other deferred features without a request.

## Product modules

- Read `docs/guide/modules.md` for product work. Todo and Totake are modules with
  product-owned contracts, domain, schema, UI and adapters. Empire owns shared
  account, shell, design primitives, transport and contribution composition.
- Add products through the typed manifest/UI/server/notification registries;
  preserve client/server separation and independent visibility, dashboard,
  connection tool choices and notification pauses. Keep docs and skill current.
- Preserve existing public routes, tools, scopes and database identities during
  refactors. Use the shared migration chain, never migrations or side effects
  from a visibility toggle. New products still require full surface parity.

## Testing and completion requirements

- Every new or changed behavior needs meaningful unit coverage, including relevant
  success, boundary and failure cases. Bug fixes need a regression test that fails
  without the fix. Test public outcomes; do not mirror implementation or add tests
  merely to assert static copy, CSS classes or code text.
- Put JS/TS unit tests under `tests/` as `*.test.ts`, `*.test.mjs` or the supported
  equivalent. `pnpm test` discovers them automatically and excludes integration
  suites. Run platform-language tests locally when changing Python helper behavior.
- Before completion run `pnpm typecheck`, `pnpm test` and relevant integration/UI
  checks. Unit tests do not replace actual API/MCP parity, connection recovery or
  browser evidence. Use synthetic data; never run integration writes on production.
- List test files, cases and actual command/results in the PR's `Unit tests`
  declaration. Do not weaken/remove tests, skip cases or change test/CI settings to
  get green checks. Docs/style-only work may explain why no behavior test applies;
  data-changing features cannot waive unit coverage.
- A blocked/unrun check is incomplete verification. Keep the PR a draft, record
  the blocker and never claim completion merely because code compiles.

## Contributor delivery

- `/docs` is the implementation guide, backed by `docs/guide/`. Keep its product,
  component, design and accessibility rules consistent with current source. The
  contributor skill applies these rules; GitHub checks and review enforce delivery.
- Follow [the contributor workflow](docs/contributor-workflow.md) and the repository's
  `wuff-contributor` skill for real feature work. Record a proportional
  brief/acceptance criteria in an early draft PR. Contributors may implement and iterate
  without Tim approving briefs, file lists or routine choices. Confirm environment
  readiness before preview or integration writes.
- At the start of a feature, identify the active root/nearby instructions, feature
  scope, unit-test plan and API/MCP/connection impacts in the brief. Do not assume
  this host has loaded a skill or that an earlier session used current rules.
- Implement features on a `codex/` branch and open a draft PR early. Commit and push
  to that branch; do not push directly to `main`. Keep the PR current with scope,
  preview, actual verification evidence and remaining technical work.
- Keep the feature brief current as the contributor iterates. Call out schema,
  auth/access/privacy, production configuration and safeguard
  changes for review before merge; preparing code needs no preliminary
  approval. Migration execution, provisioning, production operations, releases,
  destructive operations on real data and paid execution require Tim's explicit
  operational authorization. Do not weaken protections to pass checks.
- Reuse existing UI components and tokens. Call out dependencies, global styling
  changes and API contract changes in the PR for review.
- Tim and Josibe84 may review and merge their own PRs after required checks and
  the Codex fix/review loop. Agents need explicit instructions to merge.
  Agent instructions are guidance;
  [GitHub safeguards](docs/contributor-github.md) records actual enforcement and gates.

## Code Review Rules

Review the complete diff and related call paths. Report actionable defects with a
concrete trigger, consequence and smallest relevant location. Do not invent
findings, treat style preferences as bugs, or claim checks ran without evidence.

- Flag any path that bypasses current account admission, ownership/membership,
  OAuth scope/consent, device ownership or revocation checks, including retries.
  Check that HTTP and MCP adapters reuse authorized domain operations.
- For Totake changes, trace the affected scheduled occurrence through due-time/
  timezone/DST, selected snooze, repeats, Taken/Skip/Undo and stock. Flag inferred
  medicine intake, changed selection/dose accepted from an old notice, partial
  group mutation, canceled-item alerts, or duplicate recording/stock deduction.
- For persisted writes, examine transaction boundaries, optimistic versions and
  actor-scoped exact-payload receipts. Flag demonstrable concurrent/uncertain-reply
  failures and privacy leaks in payloads, logs, errors or client bundles.
- Check regression tests against the described failure: a relevant assertion must
  fail without the fix. Flag concrete permission/failure/parity gaps; do not accept
  static copy/class/source assertions or weakened/skipped tests as behavior proof.

## PR review findings

Before handoff, follow the author fix/review loop in
[the contributor workflow](docs/contributor-workflow.md#resolve-review-findings).
Read current-head Codex findings and human review threads, fix actionable issues,
verify the fixes and request a fresh review after code changes. Disputed findings
need a reason and Tim's decision; do not dismiss or silently resolve them. Review
completion is not evidence of passing tests. Keep missing reviews/checks explicit
and retain the draft while required verification is incomplete. Tim and Josibe84 may merge their own verified PRs;
these instructions do not enforce GitHub branch protection.

## Supported clients

Web, installable PWA and MCP are the supported clients. Tauri/native apps and
native distribution are retired; do not add native module adapters or platform
build/release requirements. Preserve the web push worker and browser-native HTML
controls. Retired client IDs/resources must never fall back to MCP authorization.
See [native retirement](docs/native-retirement.md).
