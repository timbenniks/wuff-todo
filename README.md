# Wuff Todo

A private, invite-only todo app for friends and family, starting with two people. Wuff has a little corgi avatar and a consistent experience across its clients.

Web and MCP are released. The online-only Tauri client in `apps/native` shares React UI and the hosted backend across macOS, Windows, iPhone and Android. Installed-platform and signing gates are tracked separately.

## Project documents

- [Contributor implementation guide](docs/implementation-guide.md): `/docs` product/design/component rules, contributor skill and approved feature-to-PR workflow.
- [Build a feature safely](docs/contributor-workflow.md): workspace readiness, scope approval, verification and review requirements.
- [Start here: current status and next build](docs/implementation-plan.md): handoff for a new agent; current scope and remaining work.
- [Product specification](docs/product-spec.md): confirmed scope, permissions, behavior, and acceptance criteria.
- [Architecture](docs/architecture.md): monorepo layout, backend boundaries, authentication, and deployment.
- [Implementation plan](docs/implementation-plan.md): delivery phases, validation, and unresolved decisions.
- [Design language and themes](docs/design-language.md): shared controls, list palettes, DM Sans, spacing fixes and release evidence.
- [Tauri client](docs/tauri-client.md): native workspace, secure sign-in, development commands and platform/release gates.
- [GitHub synchronization](docs/github-sync.md): installed-App setup, issue synchronization, operations and release evidence.
- [Todoist research](docs/todoist-research.md): reference features and deferred ideas.

The app implements private/shared lists, task ordering, admitted-user login, in-app sharing, work lists with immutable task keys and task pages, personal views, rich notes/private images, subtasks and calendar due dates. Web/API/MCP use shared permission and concurrency contracts. MCP tools use the same domain services. Live invalidation refreshes authorized state, with polling/focus fallback. The selected list’s seven named palettes theme the web and MCP App; controls distinguish actions from status tags and use DM Sans throughout.

GitHub App synchronization is implemented across web/API/MCP, with explicit issue linking/creation, two-way title/notes/completion, durable signed events, retry/conflict controls and related PR context. The installed App is restricted to the approved private sandbox repository. Authenticated production design smoke and real signed issue deliveries passed; see [release evidence](docs/github-sync.md). Agent execution is deferred. The Tauri client shares the core list/task workspace; installed-platform and signed-distribution acceptance remains outstanding. See [platform gates](docs/tauri-platforms.md). Native and web are online-only.

- [Development and operations](docs/development.md)
- [Verification evidence and limitations](docs/verification.md)

Use `pnpm dev` to run locally, `pnpm check` for type checks, contract tests, and a production build, and `pnpm test:integration` for live development-only checks. See the development guide for required environment and fixture setup.

Requirements marked **proposed** in the product documents still need a product decision or technical validation. The implementation plan identifies current decisions and supersedes historical milestone wording.

A new agent should read the documents above and inspect the current code/Git state. Chat history, local environment files, synthetic fixture credentials, and authenticated CLI/MCP connections are not part of a Git checkout. See the development guide for setup and environment boundaries; verify tool authentication and live infrastructure state before relying on previous results.
