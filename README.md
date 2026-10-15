# Wuff Todo

A private, invite-only todo app for friends and family, starting with two people. Wuff has a little corgi avatar and a consistent experience across its clients.

Web and MCP ship first. iPhone and Android apps follow using the same backend.

## Project documents

- [Start here: current status and next build](docs/implementation-plan.md): handoff for a new agent; live list updates are next.
- [Product specification](docs/product-spec.md): confirmed scope, permissions, behavior, and acceptance criteria.
- [Architecture](docs/architecture.md): monorepo layout, backend boundaries, authentication, and deployment.
- [Implementation plan](docs/implementation-plan.md): delivery phases, validation, and unresolved decisions.
- [Todoist research](docs/todoist-research.md): reference features and deferred ideas.

The deployed app includes private/shared lists, task editing/ordering, Neon login for admitted users, in-app invitations and owner-managed sharing, OAuth-protected MCP with 18 tools, an embedded list/task UI, and Waffles branding. Live list updates are the next planned build: both collaborator edits and ChatGPT/MCP changes should appear in an open website, including private lists. Current ten-second polling and focus refresh stay in place until that work is authorized and implemented.

- [Development and operations](docs/development.md)
- [Verification evidence and limitations](docs/verification.md)

Use `pnpm dev` to run locally, `pnpm check` for type checks, contract tests, and a production build, and `pnpm test:integration` for live development-only checks. See the development guide for required environment and fixture setup.

Requirements marked **proposed** in the product documents still need a product decision or technical validation. Confirmed requirements reflect the planning conversation as of October 15, 2026.

A new agent should read the documents above and inspect the current code/Git state. Chat history, local environment files, synthetic fixture credentials, and authenticated CLI/MCP connections are not part of a Git checkout. See the development guide for setup and environment boundaries; verify tool authentication and live infrastructure state before relying on previous results.
