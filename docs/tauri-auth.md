# Tauri browser sign-in

WUFF-71 / GitHub #9. This is the authentication foundation, not completion of the four-platform acceptance gate.

The fixed `wuff-tauri-v1` public client uses `com.timbenniks.wufftodo.tauri://oauth/callback` and the existing `/api/mobile` audience. `/oauth/tauri` registers only that callback. Expo retains its original identity. Dynamic clients cannot register either custom scheme or obtain the native audience. Existing admission, scope, PKCE, refresh rotation and revocation enforcement are unchanged.

The bundled client opens the system browser with random state and S256 PKCE. Pending state/verifier live in native credential storage for at most ten minutes, enabling process-restart recovery. Callback parsing requires the exact scheme/host/path, one matching state, one matching issuer and one code. Duplicate callbacks serialize and cannot exchange twice. Cancellation deletes pending state. Tokens use the existing serialized storage/account-generation transport; logout clears local credentials even if cancellation cleanup fails.

## Native boundaries

The HTTP plugin is restricted to four API/OAuth paths on the configured server. Redirect following is disabled per request and scope checking is enabled at every redirect hop. Cargo disables HTTP cookie persistence entirely. WebView cookie sessions cannot authorize `/api/mobile`. Task data stays in memory.

Credential integration: `tauri-plugin-keyring` pinned to source revision `b0a137bab0c3e592c637c32c328040d86f28256a`; its source version 0.2.1 is not yet published on crates.io, and its published JS package exposes an older incompatible API. The small frontend adapter invokes the reviewed Rust commands directly. The service is initialized once by Rust, not by page load. A mock-store environment setting fails startup. macOS explicitly selects `apple-native-keyring-store`'s native Keychain backend; the plugin's protected-store default needs a provisioning profile and failed the unsigned development login probe. Windows uses Windows Credential Manager, iOS the protected Apple store, Android the Android native keyring implementation. These are source selections; only actual installed tests establish support.

Production capabilities select `main` only. Explicit local builds additionally select `local-backend` and build with Vite mode `development-local`, using the isolated localhost backend. The public origin is not user-editable. Never distribute a local-mode bundle.

```sh
pnpm preview:local
pnpm --filter @wuff/native tauri build --debug --bundles app --config src-tauri/tauri.local.conf.json
```

The default build uses the hosted production server. Mobile schemes are declared for the exact OAuth host/path. Desktop single-instance forwarding passes callbacks to the running app. Tauri registers packaged macOS schemes through the app bundle; a plain executable is insufficient callback evidence.

## Verification — October 22, 2026

- Frozen pnpm install, workspace TypeScript and native frontend production build passed.
- 65 unit tests passed, including cold-state recovery, duplicate callbacks, cancellation, malformed/expired state, wrong issuer/state and configured identity across exchange/refresh/revoke.
- Three focused development integration tests passed against the real isolated development backend: Expo permissions/retry/membership/rotation regressions plus Tauri PKCE, native audience, read-only denial, refresh and revocation. Synthetic grants were revoked; disposable lists were removed.
- Rust 1.99.1 on Apple Silicon compiled the shell and packaged a debug `.app`. Native WKWebView renders the bundled interface. RGBA icon and explicit serde_json dependency fix scaffold compile errors.
- macOS/Windows Cargo checks and frontend builds are added to CI. Their run results and full installed callback/session tests remain to be recorded.
- Windows, iOS and Android installed behavior, signing and release distribution remain unverified. Full Xcode and Android tooling are absent locally. No store certificates or developer-account configuration have been assumed.

Remaining WUFF-71 acceptance: installed warm/cold browser callback, session restoration, a synthetic task mutation and sign-out on supported platforms. Core interface and live transport are separate follow-on tasks. Do not close #9 solely because a foundation PR merges.

Packaged macOS follow-up: the explicit localhost development build opened Chrome, completed consent, received the warm custom-scheme callback and displayed the synthetic account's lists. Quitting and relaunching restored the session from Keychain and reloaded lists. Sign-out returned to the sign-in screen without error. This is installed macOS evidence for that flow, not Windows/phone proof. The initial unsigned protected-store failure was resolved by selecting macOS Keychain as described above. Core task mutation UI is still pending.
