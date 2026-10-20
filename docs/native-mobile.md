# Native iPhone and Android app

Updated: October 17, 2026

## Confirmed direction and delivery state

The user selected React Native/Expo for iPhone and Android as the next milestone and explicitly chose **online-only for now**. Developer-agent handoff remains deferred. The website's online behavior is unchanged. No service worker, persistent list/task cache, queued offline edits, notifications or background synchronization is introduced.

The initial native slice is implemented locally in `apps/mobile`. It is a development app, not a published or device-certified release. Expo SDK 58.0.14 selects React Native 0.88.0 and React 19.3.0 through `expo install`; mobile uses its own SDK-compatible TypeScript 6 while the existing web/server tooling remains on TypeScript 5.9.3. This is a pnpm workspace using Expo's built-in monorepo support, without custom Metro resolution hacks.

Delivered UI:

- Browser sign-in through the existing admitted Wuff identity, secure session restoration, refresh and sign-out.
- Accessible list catalog, create list, owner rename/description/color/archive/restore/delete and editor leaving. Permanent deletion requires confirmation.
- Task capture, rename, independent completion/reopening, calendar dates, work status/priority, section selection, subtasks, deletion and explicit earlier/later manual ordering. Editing does not overwrite notes, references, assignment or other omitted fields.
- Existing personal-view projection determines visible task groups/filtering/sorting. Native preference editing is a later slice; no native setting overwrites the saved website view.
- Existing-account invitation inbox/accept/decline, owner invitation/cancellation/removal and membership display. Invitations still send no email.
- Shared Waffles assets, licensed local DM Sans fonts and all seven list palettes. `@wuff/design` now owns pure palette derivation for web, MCP and native; browser DOM application remains in the web package.

Notes, private image rendering/upload, assignee/reference editing, section administration, sidebar ordering controls, native personal-view controls and GitHub setup/synchronization controls are not yet native UI features. Task details offer an authenticated website link for full content; no WebView is embedded. Existing GitHub-linked tasks retain the explicit `github:manage` permission requirement for synchronized-field edits. Default native sign-in does not request it; the explicit “Enable GitHub sync” action starts a new browser consent and allows synchronized Work writes only after approval. Old grants cannot gain it through refresh. Notes and private images are now required for the first native release, but their native UI/transport are still a next implementation slice. See [pre-mobile checkpoint](pre-mobile-checkpoint.md).

## Future push notifications — noted October 20, 2026

The user requested that native push notifications be recorded for later research and implementation. This remains deferred and does not change the current online-only delivery scope.

For the proposed GitHub/Cursor workflow, candidate notifications are agent completion or failure, an agent needing user input, and a PR ready for review. Later planning should select the delivery provider, define opt-in preferences, register and revoke device tokens, protect private content on lock screens, and deep-link into the authorized task or agent conversation. Recheck current account/list access before delivery and when opening a notification. Provider selection and notification behavior are not yet decided.

## Authentication and backend boundary

Keep managed Neon Auth and its existing website sign-in/activation flow. Do not install an upstream Better Auth native plugin into the managed service or send a database credential to a device. The system browser visits Wuff's existing `/oauth/authorize`, which signs in through the website and requires explicit consent. The mobile app is a public client with no client secret.

- `GET /oauth/native` idempotently registers the fixed first-party client `wuff-native-v1` in existing application-owned OAuth tables. Its only callback is `com.timbenniks.wufftodo://oauth/callback`.
- Custom-scheme callbacks remain forbidden in dynamic third-party `/oauth/register`. Native authorization requires that fixed client, exact callback, a state value and S256 PKCE. Expo AuthRequest verifies state; the client also verifies the returned issuer before exchanging a code.
- Native codes/access/refresh tokens use the distinct resource `<WUFF_ORIGIN>/api/mobile`. MCP uses `<WUFF_ORIGIN>/api/mcp`. Client/resource checks apply to authorization and token issuance; access-token reads check audience, issuer, expiry, revocation and current enabled admission. Native credentials cannot authorize MCP or cookie-only `/api/v1` routes, and MCP credentials cannot authorize native calls.
- Default native sign-in requests `lists:read`, `tasks:write` and `lists:manage`; an explicit permission upgrade can additionally request `github:manage`. Refresh cannot add GitHub permission. Access tokens last 15 minutes; refresh tokens last 30 days and rotate using the existing OAuth model. Authorization codes last two minutes and are single-use, including consumption on an unsuccessful verifier exchange.
- Expo SecureStore holds the token pair and expiry under an environment-specific key. iOS uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Only auth credentials persist; task/list data and pending edits stay in memory. Android's SecureStore backup handling is supplied by its config plugin.
- `@wuff/client` provides platform-independent authenticated transport, a shared in-flight refresh, serialized secure-storage writes, request deadlines and account-generation guards. Sign-out clears memory immediately, clears stored credentials and attempts remote revocation. A refresh that finishes after sign-out is rejected and its new credentials are revoked. Secure-storage failure fails closed; revocation is still attempted if storage deletion fails.
- If remote revocation fails, the UI says so and points to the website's Connected AI clients page, where the mobile connection appears under its own name. Browser sign-in sessions are independent and are not signed out by mobile disconnection.

`POST /api/mobile` is a bearer-only HTTP adapter with `{ action, input }`. It exposes session identity and existing list/task/section/sharing/order/view domain operations; it has no cookie fallback and grants nothing from an Origin header. Existing web/API/MCP services remain the authority for owner/member access, current admission, validation, scoped writes, versions and actor-scoped idempotency receipts. Task mutations wake the existing GitHub worker, but they retain its permission boundary. Unknown operations are rejected and responses are private/no-store. No database migration, auth-managed write, infrastructure replacement or new environment secret was needed.

## Online freshness, failures and drafts

The first native slice polls authorized state every ten seconds while active, refreshes on foreground and supports pull to refresh. It does not yet subscribe to Neon Realtime; existing web/MCP live delivery remains unchanged. Background polling stops. Reads continue to enforce access; a denied authoritative list read removes the displayed list and editor. Revocation visibility is bounded by the next successful refresh, not instantaneous while disconnected.

Drafts remain in memory through ordinary refreshes and recoverable errors. An editor retains its starting list version. Remote changes disable stale saves and offer an explicit discard/load-latest action. Back from task editing confirms discarding; sign-out explicitly discards unsaved edits. A mutation never appears confirmed before the server succeeds. Network/server ambiguity retains the exact operation UUID, version and input, blocks new writes and offers explicit Retry; the same receipt handles a response lost after commit. Terminal client errors release the operation for an explicit corrected edit. App termination loses in-memory drafts and pending retry state; this is an online development app, not an offline delivery guarantee.

## Local development

Read [development](development.md) first. Reuse the existing isolated development branch and synthetic users. Do not recreate accounts or run migrations. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

In a separate terminal:

```sh
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm --filter @wuff/mobile ios
# Or, with the Android SDK/emulator installed:
pnpm --filter @wuff/mobile android
```

Use `adb reverse tcp:3000 tcp:3000` for Android local backend access. Keep `EXPO_PUBLIC_WUFF_ORIGIN=http://localhost:3000` aligned with the web backend's `WUFF_ORIGIN`; port reversal lets both the device transport and browser address that exact issuer. These run commands need the native toolchains and create ignored generated platform projects. Once a development binary is installed, `pnpm dev:mobile` starts Metro for it.

OAuth requires a development build or installed app with the custom scheme; Expo Go is not a supported sign-in test environment. For physical devices without loopback forwarding, use an HTTPS development origin connected to the isolated backend and set the same public origin in both apps. Do not point development fixture writes at production, and do not assume a Vercel preview has its own database branch. Changing the public origin requires a new bundle; changing native configuration requires rebuilding the binary.

`EXPO_PUBLIC_*` values are compiled into the app. Only the public server origin belongs there. The dynamic Expo config enables local HTTP transport only for loopback origins; production EAS profiles reject non-HTTPS origins. EAS project identity, developer signing accounts, distribution groups, store listings and final store identifiers have not been registered. `eas.json` is a starting configuration, not evidence of a cloud build or distribution setup. The initial bundle identifiers are `com.timbenniks.wufftodo` on both platforms and must be checked against the developer accounts before first signing.

## Verification and next delivery gate

### Resume on another laptop

The user chose to continue native simulator/device work on a faster laptop. Pull this repository, use Node 22 and pnpm 10.33.3, then run `pnpm install --frozen-lockfile`. Read this document and [development](development.md) before starting services.

Git includes the app sources, assets, lockfile, run instructions and verification evidence. It intentionally excludes `.env.local`, `.env.production.local`, `.vercel` linkage/fixture credentials, Expo local state, generated platform projects and exported bundles. Transfer any needed development credentials through a secure channel, or recover access using the existing authenticated provider accounts. Keep the isolated development backend; do not create replacement Neon resources, provision users or rerun migrations for this handoff. Do not use a default production environment pull for synthetic writes.

Install full Xcode/simulators and/or Android Studio/SDK tools on the new laptop. Configure the ignored mobile `.env.local` from its example, align the backend origin, then install a development build using the commands above. Start with native browser sign-in/return, session restoration/sign-out and list/task/sharing flows. Rich notes/images, further feature UI and distribution remain subsequent work; developer-agent handoff remains deferred. Pushing the repository may trigger its existing connected Vercel deployment and CI; inspect those separately before making a new production verification claim.

Fresh checks are recorded in [verification](verification.md): 48 unit tests, 24 isolated-development integration tests, web/MCP builds, final native typecheck, iOS/Android exports, bundle boundary/selected-secret scans and configuration/dependency checks passed. Keep these claims separate:

1. Typechecks, unit tests and Metro/Hermes export validate source and packaging.
2. Synthetic isolated-development HTTP tests validate the real auth/API/domain path, including permissions, retries and revocation.
3. An installed simulator/device must still prove browser redirect, Keychain/Keystore persistence, keyboard/layout/accessibility, interrupted saves, background/foreground refresh and native behavior. Neither an HTTP test nor an exported bundle proves these.
4. Physical iPhone/Android and distribution/release checks follow before describing this as a usable native release.

Next: install development builds on iPhone/Android or simulators, exercise the full sign-in/list/task/sharing path, correct observed native friction, then select the next native feature slice. No production deployment, EAS build or store submission has been performed by this local implementation.

References: [Expo authentication](https://docs.expo.dev/guides/authentication/), [monorepos](https://docs.expo.dev/guides/monorepos/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) and [Neon auth guidance](https://neon.com/docs/ai/skills/neon-auth/SKILL.md).
