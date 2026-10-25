# Stable Empire menu and names

October 25, 2026. Tim reports app links and his name appearing after navigation.
Root/web AGENTS.md, contributor workflow/skill and surface requirements apply.

The root frame currently starts with empty preferences on every full document
navigation. Its links use ordinary anchors, so every app switch repeats the fetch.
Dashboard names also wait for task-preview responses.

Acceptance:

- [ ] Private routes share a server-seeded layout with account name and current
  authorized app choices in the first HTML. Public docs/auth retain their own layout.
- [ ] Top-menu links use client navigation, retaining the mounted frame and choices.
- [ ] Background refresh retains current choices; newer saves beat stale reads.
- [ ] Account changes/sign-out/denial clear the in-memory snapshot; no browser
  persistence, global cross-user cache or automatic permission expansion.
- [ ] Dashboard and Todo overview names do not depend on task-preview completion.

This changes rendering/navigation, not saved settings or domain/API/MCP contracts.
Existing settings APIs/MCP remain authoritative and enforce access. No migration,
dependency, provider configuration or native permission changes. Call out the
private route-group/layout and read-only auth deduplication for merge review.
URL paths and public/docs/static behavior must be preserved.

Tests: meaningful unit regressions for first snapshot, refresh retention, stale
versions/requests, account isolation, network failure versus denied access and
sign-out invalidation; isolated HTTP integration for first-response links/name,
hidden choices and parallel identities. Actual desktop/mobile navigation checks;
pnpm typecheck/test/build. No integration writes to production or unverified preview.
