# Wuff Todo

A private, invite-only todo app for friends and family, starting with two people. Wuff has a little corgi avatar and a consistent experience across its clients.

Web and MCP are released. Online-only iPhone and Android development has started with React Native/Expo and the same backend.

## Project documents

- [Contributor implementation guide](docs/implementation-guide.md): `/docs` product/design/component rules, contributor skill and approved feature-to-PR workflow.
- [Build a feature safely](docs/contributor-workflow.md): workspace readiness, scope approval, verification and review requirements.
- [Start here: current status and next build](docs/implementation-plan.md): handoff for a new agent; current scope and remaining work.
- [Product specification](docs/product-spec.md): confirmed scope, permissions, behavior, and acceptance criteria.
- [Architecture](docs/architecture.md): monorepo layout, backend boundaries, authentication, and deployment.
- [Implementation plan](docs/implementation-plan.md): delivery phases, validation, and unresolved decisions.
- [Design language and themes](docs/design-language.md): shared controls, list palettes, DM Sans, spacing fixes and release evidence.
- [Native mobile](docs/native-mobile.md): Expo scope, secure sign-in, run instructions and device/release gates.
- [GitHub synchronization](docs/github-sync.md): installed-App setup, issue synchronization, operations and release evidence.
- [Todoist research](docs/todoist-research.md): reference features and deferred ideas.

The app implements private/shared lists, task ordering, admitted-user login, in-app sharing, work lists with immutable task keys and task pages, personal views, rich notes/private images, subtasks and calendar due dates. Web/API/MCP use shared permission and concurrency contracts; MCP currently exposes 41 tools. Live invalidation refreshes authorized state, with polling/focus fallback. The selected list’s seven named palettes theme the web and MCP App; controls distinguish actions from status tags and use DM Sans throughout.

GitHub App synchronization is implemented across web/API/MCP, with explicit issue linking/creation, two-way title/notes/completion, durable signed events, retry/conflict controls and related PR context. The installed App is restricted to the approved private sandbox repository. Authenticated production design smoke and real signed issue deliveries passed; see [release evidence](docs/github-sync.md). Agent execution is deferred. The first local native slice is implemented; installed-device checks, remaining native feature UI and distribution are outstanding. Native and web are online-only.

- [Development and operations](docs/development.md)
- [Verification evidence and limitations](docs/verification.md)

Use `pnpm dev` to run locally, `pnpm check` for type checks, contract tests, and a production build, and `pnpm test:integration` for live development-only checks. See the development guide for required environment and fixture setup.

Requirements marked **proposed** in the product documents still need a product decision or technical validation. Confirmed requirements reflect the planning conversation as of October 17, 2026.

A new agent should read the documents above and inspect the current code/Git state. Chat history, local environment files, synthetic fixture credentials, and authenticated CLI/MCP connections are not part of a Git checkout. See the development guide for setup and environment boundaries; verify tool authentication and live infrastructure state before relying on previous results.
