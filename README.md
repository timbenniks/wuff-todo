# Wuff Todo

A private, invite-only todo app for friends and family, starting with two people. Wuff has a little corgi avatar and a consistent experience across its clients.

Web and MCP ship first. iPhone and Android apps follow using the same backend.

## Project documents

- [Product specification](docs/product-spec.md): confirmed scope, permissions, behavior, and acceptance criteria.
- [Architecture](docs/architecture.md): monorepo layout, backend boundaries, authentication, and deployment.
- [Implementation plan](docs/implementation-plan.md): delivery phases, validation, and unresolved decisions.
- [Todoist research](docs/todoist-research.md): reference features and deferred ideas.

The first technical foundation is implemented: private lists, task editing/ordering, Neon login for provisioned users, and OAuth-protected MCP tools with an embedded UI. Invitation onboarding and sharing controls are the next milestone; this is not the complete first release.

- [Development and operations](docs/development.md)
- [Verification evidence and limitations](docs/verification.md)

Use `pnpm dev` to run locally, `pnpm check` for type checks, contract tests, and a production build, and `pnpm test:integration` for live development-only checks. See the development guide for required environment and fixture setup.

Requirements marked **proposed** in the product documents still need a product decision or technical validation. Confirmed requirements reflect the planning conversation as of October 15, 2026.
