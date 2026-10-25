# Wuff Empire product modules

Status: locally verified; draft PR #32; not released.

## Brief and acceptance

Refactor Todo and Totake into explicit product-owned modules within the existing
monorepo. Empire owns the shell, account/consent, settings composition, dashboard
layout, design primitives and transport. Modules own their contracts, domain rules,
UI and adapters, and contribute through typed registries.

- [x] Todo and Totake have identifiable manifest, contracts, server and UI boundaries.
- [x] Navigation, settings, dashboard and MCP composition consume contributions.
- [x] Existing URLs, tool IDs/scopes, database tables, preferences, sharing,
      retry/concurrency rules and notification behavior remain compatible.
- [x] Module visibility, dashboard choices, MCP permissions and notification pauses
      remain separate; hiding an app never stops reminders or grants/revokes consent.
- [x] Contributor guide and skill explain adding a module and its verification.
- [x] Unit, type, build and isolated HTTP/MCP/browser regressions recorded.

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

## Architecture decisions

The existing packages each have a `modules/todo` and `modules/totake` ownership
boundary. This keeps contracts/UI client-safe and domain/database server-only
without introducing packages, runtime plugin downloads or new dependencies.
Shared account/error/ID/native/design/device contracts live in `contracts/platform`.
Todo retains its lists/tasks/sharing/Work/GitHub/Cursor rules; Totake retains the
original engine and recording UI. The public barrels and original routes remain
compatible. Next route files keep literal framework configuration and delegate to
product-owned implementations.

The client-safe registry validates module IDs, owned routes, widget names, settings
paths, tool groups/IDs and declared scopes. Manifest permissions compose the known
OAuth permission catalog and labels; consent defaults and native grants remain
unchanged. Typed UI/server/native/embedded registries require actual product entries.
The MCP platform supplies each registrar only its declared tools, with no raw
server access; existing scope ceilings, saved allowlists, mandatory platform
controls and cached-call denial still apply.

The dashboard owns layout/selection and mounts lazy module cards with independent
loading and error boundaries. Settings discovery and top navigation use manifests.
Notification pause orchestration invokes product contributions in the existing
transaction/lock order; devices, queue readiness and delivery adapters belong to
the platform. Existing per-app pause columns remain unchanged; a future third
notification product will extend that storage through normal reviewed migrations.
Legacy reminder adapters preserve their existing scopes/response shapes while
calling platform device operations. There is no destructive uninstall/deactivation
feature or changed background behavior associated with hiding a module.

The module guide is published at `/docs/modules`, included in plain-text agent
reference/download provenance, and linked from product/build/start pages. Root
AGENTS, contributor workflow, feature brief, review guide and contributor skill
now require module ownership and contribution review.

## Delivery evidence

- `pnpm typecheck`: workspace packages, web/native and root checks pass.
- `pnpm test`: **181 tests in 32 files, no skips**. Nine new module cases cover
  third-product composition/nested routes/prefix lookalikes; invalid/duplicate
  declarations; independent visibility/defaults/scopes; actual scoped registration
  and disabled tools; complete schema equivalence; client metadata and real
  dashboard browser bundles without domain/database drivers; and visible isolated
  widget recovery; and native dispatch ownership/prototype isolation/background hooks. Existing permission, OAuth, retry, stock/calendar and native
  policy suites remain enabled.
- `pnpm build`: optimized website, nine-page guide and standalone MCP App pass.
- `pnpm build:native:web`: frontend passes; existing >500kB chunk warning remains.
- Actual isolated development integration command:
  `node --env-file=.env.local --import tsx --test --test-concurrency=1 tests/domain.integration.test.ts tests/list-features.integration.test.ts tests/empire-adapters.integration.test.ts tests/totake.integration.test.ts tests/mcp-tool-choices.integration.test.ts tests/reminders.integration.test.ts`
  passed **14 tests, no skips**. This exercises actual HTTP/MCP/native adapters,
  sharing/admission/revocation, stale/concurrent/idempotent writes, settings/tool
  selection parity, consent/refresh/expiry/narrowing, Totake stock/recording and
  paused/stale/deduplicated reminder callbacks. Push delivery is mocked; local
  QStash is unconfigured and Totake delivery disabled.
- Drizzle's `generateDrizzleJson` + `generateMigration` compares the composed schema
  with snapshot 0020 and returns **zero SQL statements**, preserving table count,
  columns, constraints and indexes. No migration was generated/executed and no
  production operation occurred.
- Actual Chrome via CUA on the optimized local build: both dashboard cards load;
  phone 320/390 and desktop 1280 dashboard have no horizontal overflow; desktop
  main width is 1280px. Totake at 320 and Todo at 390 fit without overflow. App
  switching, settings discovery, synthetic hide/save/direct access/restore,
  Totake View reminder/record/history/Undo and future-snooze gating work.
- A loopback proxy returned 503 for the actual lazy Todo chunk: its slot showed
  Reload dashboard while Totake and the shell remained usable. After restoring
  the chunk, Reload dashboard restored Todo. This intentional failure's console
  error is expected; regular web/MCP tabs reported no console errors.
- Actual local MCP Apps SDK host in Chrome: Todo task creation/completion,
  Totake empty-selection disabling/keyboard selection/record/Undo and platform
  app-summary save/restore all pass. Each post-save view has one product heading,
  verifying host dispatch replaces rather than duplicates module content.
  This is local SDK-host proof, not a named production ChatGPT host/device test.
- Synthetic Totake data and temporary lists were removed, OAuth fixture grants
  revoked and original Empire/notification preferences restored. Local servers
  and proxy stopped; viewport reset. No real provider send or paid run occurred.

Screenshots: `docs/screenshots/empire-modules/` contains dashboard 320/390/1280,
Todo/Totake phone screens, widget failure and real MCP Todo/Totake/settings views.
PR metadata carries the final source SHA, preview and remote-check status. A build
alone does not prove deployed behavior. Tim owns merge and production release.
