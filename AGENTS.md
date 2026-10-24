# Wuff Todo

Start with `docs/implementation-plan.md` for current status and the next planned milestone, then read `docs/product-spec.md` and `docs/architecture.md` before changing behavior. Read `docs/development.md` before running environment, database, or deployment commands, and `docs/verification.md` before making verification claims. Preserve confirmed decisions; record technical decisions and verification evidence in `docs/`.

- First release: invite-only, private/shared basic lists, tasks, ordering, web and MCP/MCP Apps. Mobile and list themes follow later.
- Only owners rename/delete lists. Every API and MCP operation enforces access in shared server-side domain services.
- Provision and connect Neon through the Vercel CLI. Use `gh` for GitHub and `vercel` for deployment. Never substitute a separately provisioned Neon project.
- Keep secrets in ignored environment files. Never print tokens, passwords, invitation links, or database URLs in logs or chat.
- Use pnpm workspaces. Server packages must not enter client bundles. Keep public contracts independent of database implementation.
- Use Drizzle migrations and direct connections for schema changes. Do not modify auth-managed tables.
- Test permissions, idempotency, concurrent updates, and OAuth flows with synthetic data. Distinguish builds from live integration proof.
- Keep the UI concise, accessible, and consistent. Do not add scheduling or other deferred features without a request.

## Contributor delivery

- Implement features on a `codex/` branch and open a draft PR early. Commit and push
  to that branch; do not push directly to `main`. Keep the PR current with scope,
  preview, actual verification evidence and remaining technical work.
- Stay within the agreed feature brief. Hand off database migrations, auth/access
  changes, production operations and changes to GitHub safeguards to Tim unless
  he explicitly authorizes that work. Explain the concrete proposed change.
- Reuse existing UI components and tokens. Call out dependencies, global styling
  changes and API contract changes in the PR for review.
- Tim reviews and merges contributor work. Agent instructions are guidance;
  [GitHub safeguards](docs/contributor-github.md) records actual enforcement and gates.
