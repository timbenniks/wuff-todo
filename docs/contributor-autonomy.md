# Contributor autonomy

October 25, 2026. Tim requested removing repeated approval requirements so his
wife can contribute independently while retaining safeguards against dangerous
changes. This request authorizes changing the contributor instructions and policy.

## Acceptance criteria

- Contributors can implement, change files and iterate on a feature without
  preimplementation approval, scope hashes, path allowlists or size exceptions.
- PR review and merge remain with Tim. Changes to access rules, schema, native
  permissions, production configuration or safeguards are called out for review;
  writing a proposal or implementation does not require a preliminary approval.
- Production operations, migration execution, provisioning, destructive commands,
  credential use and paid execution require explicit operational authorization.
- Secret-file rejection, trustworthy metadata evaluation, current-commit evidence,
  meaningful unit tests and API/MCP parity remain required.
- Maintained instructions, hosted guide sources, generated downloads, PR template
  and policy agree. An ordinary PR passes policy with no approval comments.

## Scope and verification plan

Update contributor documentation/skill, metadata policy/workflow and focused unit
tests. Preserve existing application behavior, API/MCP contracts and connection
semantics. No database, auth implementation or production configuration changes.
Regression cases cover independent iteration, review warnings, secret files and
renames, invalid/incomplete inventories, stale evidence and metadata races/errors.
Run focused tests, `pnpm typecheck`, `pnpm test`, guide generation and relevant
guide/build verification. Record actual outcomes below before review.

## Evidence and limits

- `node --test tests/contributor-policy.test.mjs`: 25 policy cases passed,
  including no-approval iteration, evolving mappings/files, large diffs, review
  hints, credential/rename rejection, stale evidence and metadata races/errors.
- Three autonomy regression cases were also run against the original main policy;
  all failed because it still required a scope-approval comment.
- `pnpm typecheck`: passed for all workspaces and root.
- `pnpm test`: all 117 tests passed across 25 discovered unit files; zero skipped.
  Tests for retired scope approvals were replaced with the new autonomy outcomes;
  test discovery/settings and application permission/parity cases were preserved.
- `pnpm build`: guide/MCP/optimized web build passed. Generated contributor skill,
  workflow, PR template, ZIP and manifest are built from maintained sources.
- `node scripts/verify-contributor-guide.mjs`: passed at 320/390/1280px, including
  copied starter prompt, keyboard/navigation, all guide pages, downloads/manifest
  hashes, raw reference, retired routes and zero application API requests.
  Phone/desktop screenshots were visually inspected.
- `git diff --check`: passed. No product-data integration writes were needed;
  application API/MCP/connection behavior is unchanged. Policy runner HTTP/check
  behavior is verified with synthetic GitHub responses, not a live workflow run.

Verification used the existing local dependency setup. Pre-existing edits to
`package.json`, `pnpm-lock.yaml` and `pnpm-workspace.yaml` are excluded from this PR.

GitHub Verify and policy jobs for the initial draft failed before any steps:
check annotations confirm the account payment/spending-limit block. Keep this PR
as a draft; local passing checks do not resolve that hosted gate. Vercel created
an automatic preview for the initial push; no preview backend writes were made
and its data isolation is unverified. No manual deployment, production operation,
migration or provisioning was performed.

The trusted policy runs from main, so the new workflow must be merged and exercised
before live enforcement can be established. This change does not activate GitHub
branch protection, restore runner billing or provision an isolated contributor
backend. These remain one-time onboarding gates, not repeated feature approvals.
