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

Implementation and checks pending. This change does not activate GitHub branch
protection, restore runner billing or provision an isolated contributor backend.
