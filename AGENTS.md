# Wuff Todo

Read `docs/product-spec.md`, `docs/architecture.md`, and `docs/implementation-plan.md` before changing behavior. Preserve confirmed decisions; record technical decisions and verification evidence in `docs/`.

- First release: invite-only, private/shared basic lists, tasks, ordering, web and MCP/MCP Apps. Mobile and list themes follow later.
- Only owners rename/delete lists. Every API and MCP operation enforces access in shared server-side domain services.
- Provision and connect Neon through the Vercel CLI. Use `gh` for GitHub and `vercel` for deployment. Never substitute a separately provisioned Neon project.
- Keep secrets in ignored environment files. Never print tokens, passwords, invitation links, or database URLs in logs or chat.
- Use pnpm workspaces. Server packages must not enter client bundles. Keep public contracts independent of database implementation.
- Use Drizzle migrations and direct connections for schema changes. Do not modify auth-managed tables.
- Test permissions, idempotency, concurrent updates, and OAuth flows with synthetic data. Distinguish builds from live integration proof.
- Keep the UI concise, accessible, and consistent. Do not add scheduling or other deferred features without a request.
