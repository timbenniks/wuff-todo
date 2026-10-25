# Stable Empire menu and names

October 25, 2026. Tim reports app links and his name appearing after navigation.
Root/web AGENTS.md, contributor workflow/skill and surface requirements apply.

The root frame currently starts with empty preferences on every full document
navigation. Its links use ordinary anchors, so every app switch repeats the fetch.
Dashboard names also wait for task-preview responses.

Acceptance:

- [x] Private routes share a server-seeded layout with account name and current
      authorized app choices in the first HTML. Public docs/auth retain their own layout.
- [x] Top-menu links use client navigation, retaining the mounted frame and choices.
- [x] Background refresh retains current choices; newer saves beat stale reads.
- [x] Account changes/sign-out/denial clear the in-memory snapshot; no browser
      persistence, global cross-user cache or automatic permission expansion.
- [x] Dashboard and Todo overview names do not depend on task-preview completion.

This changes rendering/navigation, not saved settings or domain/API/MCP contracts.
Existing settings APIs/MCP remain authoritative and enforce access. No migration,
dependency, provider configuration or native permission changes. Call out the
private route-group/layout and read-only auth deduplication for merge review.
URL paths and public/docs/static behavior must be preserved.

Private page/layout wrappers live under `app/(empire)/`; their URL paths do not
change. Existing client components stay at their original module paths. The
private layout reads the admitted actor, identity name and Empire settings using
read-only server auth. `pageActor` is React request-memoized like `webIdentity`;
there is no cross-request or cross-account server data cache. Public docs and
auth do not mount the frame. Transient preferences failure allows an account-
pinned retry rather than inventing visible apps.

The client store starts from that server snapshot and refreshes every ten seconds,
on focus, reconnect and visibility. Normal seeded mounts need no second settings
fetch. Both sign-out entry points clear only after confirmed success. A changed
child actor clears the old snapshot before paint and reloads to obtain the new
server seed. Private menu/Settings links use Next client navigation with prefetch
disabled, retaining the layout while destination pages still authorize access.
Dashboard name is independent of Todo summary visibility/requests; Todo receives
the name already used by its sidebar. Task previews still load independently.

Tests: meaningful unit regressions for first snapshot, refresh retention, stale
versions/requests, account isolation, network failure versus denied access and
sign-out invalidation; isolated HTTP integration for first-response links/name,
hidden choices and parallel identities. Actual desktop/mobile navigation checks;
pnpm typecheck/test/build. No integration writes to production or unverified preview.

## Verification

- `pnpm typecheck`: all workspaces/root passed. Old ignored `.next/dev` route type
  output was removed after moving page wrappers; fresh generated types pass.
- `pnpm test`: **166 passed, zero skips**. Ten new cases in
  `tests/empire-preferences-store.test.ts` cover initial name/menu with no request,
  refresh retention, save versus delayed success/failure, overlapping reads,
  older versions, network versus 401/403/409 errors, cross-account responses,
  account/sign-out invalidation, recoverable initial preference failure, lifecycle
  cancellation/unsubscribe and confirmed versus rejected/uncertain sign-out.
- `pnpm build`: guide, MCP and optimized web passed. Public `/docs` and its
  generated guide pages remain prerendered; existing route URLs are unchanged.
- `pnpm build:native:web`: passed, with the existing >500kB chunk advisory.
  This is frontend compilation, not installed-device proof.
- `node --env-file=.env.local --import tsx --test tests/empire-shell.integration.test.ts`:
  **one passed** using two synthetic development identities. Raw first HTML for
  dashboard/Todo/Totake/Settings contains the correct menu; dashboard and Todo
  greetings contain the name before any client preview fetch. Hidden Totake is
  absent in the header before JS, saving visible restores the server-rendered link,
  parallel accounts get separate names, private HTML is not publicly cacheable,
  signed-out requests redirect and public docs omit the private frame. Original
  synthetic app visibility restored; test-created sessions signed out.
- Serial `tests/empire-adapters.integration.test.ts` and
  `tests/totake.integration.test.ts`: **three passed**, real HTTP/MCP/native
  adapter parity, consent/account isolation, receipts/concurrency and mocked
  notification policy/retry behavior. No real provider messages.
- Actual Chrome against optimized localhost: dashboard reload already shows its
  name and app links while task previews are pending. Complete desktop app and
  Settings switches and mobile Apps → Totake → Dashboard pass. Phone dropdown
  closes on destination change; 320/390px have no horizontal overflow. Captured
  console errors empty. Screenshots `instant-empire-shell-{1280,390}.png` contain
  synthetic data only. No persistent browser preference/name cache was added.

No production or preview writes/deployment, named production MCP-host, physical
phone or screen-reader proof claimed. Remote checks/preview are recorded in the
draft PR; existing GitHub billing may block runners.
