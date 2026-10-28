---
name: wuff-contributor
description: Explore, implement and verify Wuff Todo features in an authorized repository checkout using the implementation guide, independent iteration and a reviewable PR. Use for Wuff Empire contributor module design and coding work.
---

# Wuff contributor

Read root/nearby AGENTS.md and `docs/contributor-workflow.md` before implementation.
Hosted reference: https://wuff-todo.vercel.app/docs/build. Current repository
instructions and code govern implementation; hosted docs may lag an unmerged PR.

Read the relevant `docs/guide/` product, design, component and accessibility pages.
The raw reference is https://wuff-todo.vercel.app/docs/agent-context.md and exact
component inventory is https://wuff-todo.vercel.app/contributor-kit/components.json.
Check actual props/event behavior in repository source. Do not initialize shadcn
defaults over Wuff's components or build a separate copied application.

Read `docs/guide/modules.md` for product work. Todo and Totake are modules;
new products belong in the same manifest/contracts/domain/schema/UI/adapter
structure. Identify the owning module and platform contributions in the brief.
Use the typed registries for navigation, settings, dashboard, MCP and notification
hooks. Preserve public URLs/tool IDs and shared account, design and consent
boundaries. Keep client metadata/UI separate from server implementations; do not
create a copied app, plugin loader or per-module authentication/database service.
Visibility, dashboard choices, MCP permissions and notification pauses are
independent. Never run migrations or side effects from a module visibility switch.
Update the module guide and register actual HTTP/MCP capabilities together.

Read `docs/guide/surfaces.md` for every feature. Map every persisted mutation to
the shared domain service, HTTP API and MCP tool, including authorized reads and
cross-surface verification. Assess MCP App UI and delegated/provider connection
scopes, consent, missing/expired/revoked states and personal credential isolation.
Keep the PR's surface mappings current before final review; prose or a table is enough. Do not ship
web-only writes, placeholder tools or silent parity/UI/connection deferrals.

Understand the problem and intended users, offer small product choices, show the
main interaction early and iterate from feedback. Keep agreed decisions and open
questions explicit. Use synthetic data and clearly labeled local mocks within the
feature branch when needed; simulated behavior never proves backend integration.
Explain deliberate visual departures or new components as scope proposals.

Handle branches, commits, PRs, checks and evidence for the contributor. Ask product
questions in plain language. Use one `codex/` branch and early draft PR per feature.
Build and iterate without preliminary approval of briefs, file lists or ordinary
technical choices. Keep the brief current; ask the contributor product questions,
not permission for routine code changes. Call out access/privacy, schema, production configuration and safeguard changes for final review.
Do not weaken protections to pass checks. Writing code is separate from executing
migrations, provisioning, production operations, releases, destructive operations
on real data or paid runs; those need Tim's explicit operational authorization.

Follow the workflow's quality rules and verification matrix. Reuse real components
and services; preserve permissions, retries, concurrency and API/MCP contracts.
Maintain the brief, acceptance criteria and current-commit evidence in the PR.
Inspect the actual diff and behavior; the metadata policy is retired. Use the
PR template and Copilot/Codex comments to improve descriptions, and actual tests
and review to assess quality.

Every changed behavior needs meaningful unit tests and bug fixes need regression
coverage. Test outcomes and relevant boundary/failure cases, not code text or
incidental markup. Put JS/TS tests under `tests/` for automatic `pnpm test`
discovery. Fill the PR's Unit tests section with changed files and actual
cases/commands/results. Integration checks do not replace unit coverage; data
changes cannot waive it. Run local language-specific tests for Python
changes. Keep the PR a draft when required checks are blocked or unrun.

Confirm environment readiness before backend writes. If credentials, preview isolation or
operational authorization are missing, continue useful code/unit/mock work and
prepare a concrete technical handoff to Tim.
Do not bypass checks, borrow his credentials, alter safeguards to pass, invent
evidence, merge or release. Record remaining limitations clearly.

Use `docs/guide/review.md` for a self-contained delivery record and optional Wuff
task updates. Only create/update tasks when requested; resolve the intended list,
preserve existing content and verify the write. Tools/hosting availability must be
checked rather than assumed. No task write authorizes a paid agent run or release.

Before final handoff, follow `docs/contributor-workflow.md#resolve-review-findings`:
obtain a Codex review of the latest pushed code, read findings/threads, fix real
issues with regression evidence and push, then request a fresh review. Requests
and fix-evidence replies on the feature PR are part of delivery when this skill is
invoked. Do not silently dismiss disputed findings or resolve threads as a
substitute for fixes; hand unresolved disagreements to Tim. Record reviewed SHA,
review link, fix commits/checks and outstanding issues in the PR's Review findings
section. An unavailable reviewer/check is incomplete verification; no findings is
not a passing test suite or GitHub merge protection. Never merge the PR yourself.

Supported clients are web, installable PWA and MCP. Tauri/native apps are retired;
do not add native clients, module adapters or native build/release checks. Use
`docs/native-retirement.md` for the deliberate legacy endpoint/OAuth denial policy.
Keep the shared web UI, browser-native HTML controls and Web Push service worker.

Tim and Josibe84 may merge their own PRs after required checks and the Codex
fix/review loop; no second human approval is required. Agents still need explicit
merge instructions. Operational authorization remains separate.
