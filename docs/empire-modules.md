# Wuff Empire product modules

Status: implementation in progress; not released.

## Brief and acceptance

Refactor Todo and Totake into explicit product-owned modules within the existing
monorepo. Empire owns the shell, account/consent, settings composition, dashboard
layout, design primitives and transport. Modules own their contracts, domain rules,
UI and adapters, and contribute through typed registries.

- [ ] Todo and Totake have identifiable manifest, contracts, server and UI boundaries.
- [ ] Navigation, settings, dashboard and MCP composition consume contributions.
- [ ] Existing URLs, tool IDs/scopes, database tables, preferences, sharing,
  retry/concurrency rules and notification behavior remain compatible.
- [ ] Module visibility, dashboard choices, MCP permissions and notification pauses
  remain separate; hiding an app never stops reminders or grants/revokes consent.
- [ ] Contributor guide and skill explain adding a module and its verification.
- [ ] Unit, type, build and isolated HTTP/MCP/browser regressions recorded.

Root AGENTS.md and apps/web/AGENTS.md apply. The wuff-contributor skill and
surface contract govern delivery. No schema, auth, production configuration,
release, paid action or new product behavior is intended. User edits to root
package/tooling files are preserved and excluded.

## Test plan and surfaces

Unit tests exercise registry composition, route ownership, defaults, invalid and
duplicate contributions and tool scope/allowlist enforcement. Existing domain,
Totake, notification, native and MCP-choice regressions remain mandatory. Run real
isolated development adapter suites and local browser checks at 320/390/desktop.
Existing MCP App UI is retained; this extraction adds no new interactive feature.
Connections retain consent, scopes, narrowing-only updates and immediate revocation.

## Delivery evidence

Pending implementation. Keep the PR draft until evidence and remaining gates are
recorded. Tim owns merge and production release.
