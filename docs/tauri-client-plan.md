# Tauri client implementation plan

Date: October 22, 2026
Status: implementation started; WUFF-70 adds the frontend workspace and Tauri shell. Native runtime verification is pending. See [development and task tracking](tauri-client.md).

## Direction and scope

Build an online-only, client-side React application packaged with stable Tauri 2 for macOS, Windows, iOS and Android. Use Vite, TypeScript, the existing shadcn-based controls and shared Wuff design language. Pin current compatible stable dependencies when implementation starts; Tauri 3 prereleases are outside this plan.

The hosted Next.js application remains the API, authentication and MCP backend as well as the website. Packaged clients contain UI/assets and call authorized APIs. No Next.js server, database credentials or domain implementation runs on a device. Reuse the existing Vercel-managed infrastructure and isolated development environment.

This becomes the next cross-platform client workstream. Keep the existing Expo source as a working reference until Tauri passes the replacement gates; avoid developing two competing mobile interfaces. Retiring Expo is a later explicit cleanup, after preserving reusable code and proving the replacement.

Preserve invite-only access, owner-only list administration, shared editor permissions, server-side concurrency/idempotency, explicit GitHub consent, Waffles branding and accessible controls. Existing notes and private image viewing/upload/removal are required for the first complete client release. Offline task storage, offline writes, push notifications, widgets and share extensions remain deferred.

## Proposed workspace boundaries

| Location             | Responsibility                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/native`        | Vite/React routes, Tauri shell/configuration, lifecycle and platform adapters                                           |
| `packages/ui`        | Shared browser-compatible controls, styles and progressively extracted feature components used by web and Tauri         |
| `packages/client`    | Authenticated API transport, token lifecycle and exact-payload mutation retry; configurable first-party client identity |
| `packages/contracts` | Public schemas, DTOs, view projection and client identifiers                                                            |
| `packages/design`    | Existing palettes/tokens and shared asset responsibilities                                                              |
| `apps/web`           | Hosted backend, website, OAuth and MCP adapters                                                                         |

Create packages only as real code moves into them. Keep routing, session acquisition and platform file access behind explicit adapters. Shared UI must not import Next.js server APIs, database/domain packages, environment secrets or app-local aliases. Larger views need extraction, not wholesale copying of Next.js routes. Reuse fonts, licenses, Waffles assets and existing CSS themes.

## Phase 1 — prove the shell and platform boundaries

Build the smallest useful end-to-end slice before migrating full screens.

- Add `apps/native` with React/Vite, Tauri 2, workspace scripts and a bundled Wuff loading/sign-in/list screen. Document Rust, Xcode and Windows/Android build prerequisites.
- Package local frontend assets; restrict Tauri capabilities and content security policy to the required commands and network destinations. Open external content in the system browser.
- Parameterize the existing `NativeClient`, which currently hardcodes the Expo client ID, callback and native API audience. Preserve refresh rotation, serialized storage, account-generation guards and exact retry payloads.
- Register a distinct fixed first-party Tauri client/callback so Expo and Tauri installations cannot compete for the same custom scheme. Keep the existing native API audience initially; desktop does not require renaming `/api/mobile`. Do not widen third-party redirect registration.
- Use system-browser authorization with S256 PKCE, random state, issuer verification and exact callback matching. Handle both a running app and a cold-start callback, duplicate callbacks, cancellation and expired codes. Store pending authorization state only as necessary for process recovery and remove it after completion.
- Select and document a maintained credential-storage integration with confirmed support on all four targets. Test persistence/removal and failure behavior; tokens never go into localStorage, a plain preferences file or logs. Keep the existing `TokenStorage` interface where practical.
- Prove a restricted native HTTP transport for OAuth/API requests, using the client's injectable fetcher where compatible. Validate request/response, timeout and redirect semantics. If WebView fetch is chosen instead, implement exact origin/preflight handling without weakening cookie-route CSRF checks. Do not assume browser CORS permits Tauri origins.
- Install and run the first slice on macOS, then exercise Windows and iOS/Android development builds early. Build success alone does not pass callback or storage checks.

Exit: sign in, read accessible lists, create/complete a synthetic task, restart and restore the session, sign out and revoke access. Record each platform as passed, failed or unavailable with its actual evidence. Resolve unsupported authentication/storage/transport choices before broad UI migration.

## Phase 2 — share controls and deliver the core client

- Extract existing buttons, inputs, selects, status tags, typography and themes into `@wuff/ui`; make the website consume the same sources. Check the existing MCP asset/style build after extraction.
- Add client routing and adapters for navigation, authenticated requests, file access and external links. Separate pure rendering from website cookies, server rendering and Next-specific hooks.
- Deliver list navigation, creation/settings/archive, sections, task/subtask CRUD, completion, ordering and sharing/invitations. Preserve owner/editor distinctions and confirmation behavior.
- Include calendar dates, Work status/priority/assignment/references, personal list views and sidebar ordering through existing contracts. Inventory the actual native adapter before promising endpoint parity; add missing thin adapters through existing domain services.
- Use responsive layouts for desktop and phone, safe areas, virtual keyboards, keyboard navigation, accessible names and 44px touch controls. Preserve direct task actions and alternatives to dragging.

Exit: the two-account shared-list scenario works in the Tauri UI, and extracting components does not regress website or MCP behavior. Check computed phone layout at 320px and 390px as well as desktop widths; physical touch/accessibility checks remain separate.

## Phase 3 — cache and live updates

- Use one account/environment-scoped in-memory server-state cache. TanStack Query is the proposed fetch/cache coordinator; port the existing version-aware merge logic into that cache rather than creating two competing sources of truth.
- Preserve independent list and personal-view versions, reject late responses from old accounts, deduplicate reads and clear state on sign-out/access loss. Bound inactive cache retention; do not persist task data to disk.
- Render cached lists while refreshing, refresh authoritative state after saves and invalidate only affected queries. Lazy-load the editor and image content; avoid sequential independent requests and per-row fetching.
- Keep saves visibly pending until acknowledged. An uncertain write retains its operation ID, version and exact payload for explicit retry. Do not enable generic automatic mutation retries or silently overwrite drafts after a conflict.
- Add native bearer-authorized live capability issuance/renewal, reusing `sealLiveLists` and the existing membership-aware query. Verify current admission, required scope and account identity. The current `/api/v1/live` cookie/same-origin endpoint cannot be called as-is.
- Extract the reusable subscription/refresh behavior with injected authorization and session-loss handling. Replace website redirects with client session transitions. Treat stream snapshots as invalidations, then read authoritative API data.
- Prove WebSocket access in each installed WebView. Current Realtime origin configuration allows website/localhost origins only: identify actual development/packaged origins, validate provider support and explicitly configure required origins on the existing environment. Keep secrets and sealed capabilities out of logs and persistent storage. If transport/origin support fails, record the blocker and choose an authenticated transport design before claiming live support.
- Preserve coalesced refresh, deferred reads during local writes, independent polling fallback and reconnect/focus refresh. Pause background work and reconcile on resume; do not promise phone background synchronization.

Exit: website, MCP and another user's changes update open Tauri views; renewal, disconnect/reconnect, background/resume, membership revocation and account switching work without losing drafts or restoring stale data. Polling alone is not evidence that the live transport works.

## Phase 4 — notes, private images and existing Work features

- Reuse the formatted editor and safe renderer through client-compatible components. Keep canonical Markdown and attachment references consistent with the website/MCP.
- Add native bearer-authorized image upload/read/removal adapters where absent. Reuse attachment ownership and lifecycle services; cookie-authenticated image URLs are not directly reusable with app tokens. Avoid tokens in URLs and public image delivery.
- Implement authenticated image fetching, bounded in-memory blobs and object-URL cleanup, platform file selection, upload progress and recoverable failures. Test phone keyboard/editor behavior, photo selection and desktop paste/drop.
- Inventory current GitHub/PR/agent screens against bearer API coverage. Include existing task context and optional `github:manage` consent; preserve all current execution gates. Any deferred settings/agent administration gets an explicit authenticated browser handoff and a documented parity gap rather than an implied complete port.

Exit: core lists/tasks/sharing plus notes and private images are usable end to end. Publish a feature matrix for website, Tauri and MCP, explicitly listing any remaining browser handoffs.

## Phase 5 — platform verification and distribution

Run relevant existing checks after each meaningful implementation slice, then complete the release matrix using synthetic data in the isolated development environment.

| Evidence level    | Required coverage                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source/build      | Typecheck, meaningful unit tests, web/MCP regression builds, native bundles and client/server boundary checks                                                         |
| Live protocol     | Admission/ownership, scope/audience isolation, PKCE rejection paths, refresh races, revocation, idempotency, stale writes, private images and live capability renewal |
| Installed desktop | macOS and Windows login cold/warm callbacks, secure storage, focus/resume, links, keyboard, resize, live transport and installer behavior                             |
| Installed phone   | iOS and Android login, session restore, safe areas, keyboard, touch/reordering, image selection, foreground recovery and accessibility                                |
| Release           | Signed macOS/notarized distribution, signed Windows installer, iOS/Android signed test distribution, update and backend compatibility checks                          |

Build/sign on appropriate hosts or CI runners. Record missing machines, certificates and developer-account access as concrete distribution prerequisites. Choose private distribution channels before configuring release automation. Desktop signed updates and mobile store/test-distribution updates have different lifecycles; keep APIs backward-compatible with installed older clients.

Record commands, versions, device/OS, results and remaining limits in a dedicated Tauri verification document. Never infer installed-device readiness from an export or protocol test. Production backend releases use the existing Vercel workflow after development verification; no infrastructure replacement is needed.

## First implementation task

Implement Phase 1 as a reviewable vertical slice: `apps/native`, fixed Tauri identity, reusable client configuration, secure storage, system-browser login, list display and one task mutation. Start on macOS and immediately validate the same authentication/storage choices on phone and Windows targets. Bring live capability issuance and a minimal subscription probe forward into this slice to expose origin/transport blockers early. Full shared-view migration follows once these foundations work.

## Planning evidence and references

This plan is based on the current source: `packages/client/src/index.ts`, `apps/web/src/app/api/mobile/route.ts`, `apps/web/src/app/api/v1/live/route.ts`, `apps/web/src/lib/live-server.ts`, `apps/web/src/app/lists/live-updates.tsx`, `apps/web/src/lib/list-cache.ts`, `apps/web/src/lib/live-refresh.ts` and the current UI controls. Source inspection establishes reuse opportunities, not Tauri runtime compatibility.

- [Native implementation and prior delivery limits](native-mobile.md)
- [Development environments and Realtime origins](development.md)
- [Verification requirements](verification.md)
- [Tauri frontend architecture](https://v2.tauri.app/start/frontend/)
- [Tauri releases](https://github.com/tauri-apps/tauri/releases)
- [shadcn installation](https://ui.shadcn.com/docs/installation/manual)
- [TanStack Query defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)

The original planning change performed no runtime verification. Subsequent implementation evidence and the ten MCP-created Work tasks are recorded in [Tauri client development](tauri-client.md).
