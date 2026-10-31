# Tasks-first list workspace

October 31, 2026. Tim selected the Tasks first proposal after inspecting the live
Cosmic Breakfast list. Todo owns this presentation-only follow-up to the
productivity redesign. Root AGENTS.md, apps/web/AGENTS.md (when touching the web
app), wuff-contributor and the module/surface/design/accessibility guides apply.

## Brief and acceptance

- Open each list on Tasks. Offer Tasks / Sublists tabs only when accessible active
  sublists exist. Show all sublists as aligned directory rows, not wrapping links.
- Preserve the parent/sibling navigation, personal tree order, shared indicators,
  permission boundaries, task drafts and existing view controls. Tab selection is
  transient, list-local UI state; it creates no saved preference.
- Add task from Sublists returns to Tasks and opens the existing inline composer.
- Remove the desktop sidebar's nested scrolling region. Navigation and content
  flow in the document; long trees and footer controls remain reachable.
- Tighten heading/toolbar/section spacing and sidebar rows while retaining touch
  targets, keyboard focus, long-title wrapping and existing palettes/appearance.
- Exercise 320/390px, intermediate and desktop layouts, light/dark, keyboard tabs,
  draft preservation, child/parent navigation and loss of catalog access.

## Surfaces and scope

Shared Todo web/PWA/MCP App components and presentation CSS. Existing authorized
catalogs and list/task/view HTTP/MCP domain operations remain the data source.
No persisted mutation, API contract, schema, scope, consent, connection lifecycle,
provider, dependency or safeguard change. MCP App gets the same tabs/directory
through ListApp; tool-only capabilities are unchanged. No production writes or
deployment are authorized by this work.

Unit plan: list-local tab selection, no-child/removed-child fallback, capture
event isolation and accessible catalog filtering. Browser checks must exercise
real components; synthetic local runtime fixtures are presentation evidence only,
not backend/auth integration proof. This Windows checkout's documented main-data
configuration prohibits integration seeding/writes unless isolated readiness is
independently confirmed.

## Evidence

Implementation and verification pending. Preserve pre-existing local edits to
docs/development.md and docs/verification.md outside this feature's commits.
