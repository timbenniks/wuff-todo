# Build a Wuff feature safely

This workflow covers real feature work in the repository. The contributor chooses
product behavior and tries the result. Their agent handles Git, code, checks and
the PR. Contributors build and iterate independently; Tim reviews and merges. A draft PR may be
incomplete; ready for review requires the evidence below.

## Before the first feature

Tim must finish these gates before granting contributor write access:

- Activate and verify main protection with owner review, `check` and
  `Contributor policy`. This is one-time onboarding, not per-feature approval.
  Current plan and runner billing blocks are recorded in
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

Keep the brief proportional to the change; a small fix needs only a few sentences.
Implementation can start immediately in the ready workspace. Fill `## Feature brief` with the problem, intended users, included/excluded
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

Complete `## API, MCP and connections` using `docs/guide/surfaces.md` as the
implementation develops and before requesting final review. Inventory every persisted mutation and its shared domain/API/MCP mapping,
authorized reads, MCP UI decision and connection/consent/revocation impact. Existing
tools may be extended; web-only data changes cannot be marked complete.

## 2. Build and iterate independently

No preliminary approval from Tim is required for a brief, file list, implementation
choice or ordinary feature iteration. There are no scope hashes, path allowlists
or line-count approval thresholds. Contributors and their agents can edit UI,
styles, domain services, API/MCP adapters, contracts, dependencies and tests as the
feature requires. Keep the brief current when the intended behavior changes.
Ask the contributor product questions when needed; do not route routine technical
decisions through Tim. Show the main interaction early and incorporate feedback.

Call out changes to admission, authorization, sharing/privacy rules, OAuth consent,
schema/migrations, native permissions, production configuration and safeguards in
the PR. You can prepare and test these changes in the isolated workspace without
preliminary permission; Tim reviews their implications before merge. Path-based
policy hints draw attention to likely risk and never replace semantic review.
Do not disable protections or weaken tests to make a feature pass.

Operational authorization is separate from writing code. Explicit authorization
from Tim is required to execute migrations, provision/change infrastructure,
deploy to production, publish releases, run paid agents or perform destructive
operations on real accounts/data. Do not use production credentials or Tim's
personal credentials. Ordinary source edits, synthetic fixture cleanup and local
build/cache operations in the ready workspace do not need extra permission.

If an operation or environment is unavailable, continue useful implementation,
unit tests or clearly labeled mocks and record the concrete handoff. Do not turn
an operational blocker into a blanket stop on feature development.

## Product module ownership

Read [the module guide](guide/modules.md) before adding or changing a product.
The brief names its owning module and platform contributions. Todo and Totake own
contracts, domain, schema, UI and adapters; Empire composes typed registrations.
New modules use this structure, shared authentication/design/transport and the
same API/MCP contract. Keep settings visibility, dashboard preferences, MCP consent
and notification delivery separate. Do not copy the app or add runtime plugins.

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
- Explain dependencies, contract changes and global styling changes in the PR.
  Highlight the high-risk changes listed above for Tim's final review. Routine
  implementation choices and evolving file lists do not require permission.
- Add meaningful regression coverage for changed permissions, retries, concurrency
  and recovery. Do not weaken tests, hide errors with suppressions, mock away the
  tested behavior or change safeguards just to get a green check.
- Keep one feature per PR, record decisions/evidence in its feature document, and
  report unrelated defects separately instead of expanding scope.

The policy conservatively flags sensitive files. It cannot identify every risky
code path or judge architecture; Tim must inspect semantic changes too.

## 4. Verify and record current evidence

Every new or changed behavior requires meaningful unit coverage: successful
outcomes, boundary/invalid inputs and applicable failure/recovery cases. Bug fixes
need regression cases that fail without the fix. Test observable contracts, not
private details, static copy, CSS classes, source text or stubbed success.

`pnpm test` automatically discovers nested JS/TS unit files under `tests/` and
excludes `*.integration.test.*`. Adding a unit test must not require editing a
manual list. Python/native behavior also needs the appropriate local test command.
Line coverage or a test count alone is not proof of meaningful behavior coverage.

Fill `## Unit tests` with one JSON block:

```json
{
  "required": true,
  "files": ["tests/actual-feature.test.ts"],
  "verification": "Actual cases, commands and results including boundary/failure behavior"
}
```

Tests must be added/updated in this PR; deleted or integration-only files cannot
satisfy the declaration. For Rust, list the changed source containing actual inline
tests and record the local test command. Docs/style-only work may use `required:
false` with a concrete `reason` explaining why no testable behavior changes. Data
changes cannot waive unit tests. Policy checks file presence and declarations;
reviewers still inspect the cases and outcomes.

Run `pnpm typecheck`, `pnpm test` and relevant integration/UI checks. Keep the PR a
draft when required checks are blocked/unrun and never claim completion from a
build alone. Write a meaningful failing case first when practical. Use the
configured isolated backend and synthetic accounts for integration tests. Never
fall back to production when local services are unavailable.

For UI changes, exercise 320px, 390px and desktop, long content, keyboard/focus,
labels, relevant palettes and applicable loading/empty/error/denied/conflict
states. Check overflow, cancellation, retries and preserved drafts. Attach
screenshots and reproduction steps. Browser checks do not prove screen-reader or
physical-device behavior; report only accessibility checks actually performed.

For server changes, verify relevant owner/editor/outsider isolation,
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
Policy checks validate delivery declarations and evidence presence, never truth or quality.

Give the contributor a plain-language summary, PR/preview links and remaining
technical help. Do not merge, push main, deploy or mark the feature released. Tim
reviews UI, architecture, evidence and rollout before merging and can request
changes even when automated checks pass.

## Technical help without blocking the idea

When operational authorization or infrastructure is missing, prepare a concrete handoff: user goal,
proposed technical change, affected files, risks and smallest alternative. Keep
the draft PR/mock reviewable. Never ask a nontechnical contributor to authorize
migrations or production commands.
