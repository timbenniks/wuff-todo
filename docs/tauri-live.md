# Tauri live updates

WUFF-72 adds a bearer-only `getLive` action to `/api/mobile`. It requires the native audience and `lists:read`, pins the expected actor, checks admission through the existing bearer middleware, and returns the same short-lived membership-aware sealed query as the website. Responses use `no-store`. No database credential is sent to the client.

## Transport decision

The packaged macOS WebView reports `tauri://localhost`. Neon's Realtime origin configuration accepts HTTP(S) origins; development currently permits `http://localhost:3000`. We did not replace that allowlist with a wildcard. The native app uses a small Rust TLS WebSocket relay and the existing Neon SDK protocol/subscription logic. Rust accepts only the two exact existing Realtime hosts (development only in debug builds), only the fixed Neon subprotocol, bounded frames/queues/connections, and bounded connect/write/close operations. It sends no browser Origin header. Native command capabilities are restricted to the local main window. The general-purpose WebSocket plugin was not used because its current commands do not enforce URL scopes.

The SDK currently constructs global WebSockets. An app-local adapter implements its required text-frame/event interface, serializes IPC writes, ignores late frames after closure and closes active sockets on page exit. No capabilities or frames are persisted or logged. Host changes require an application update; the server cannot direct installed clients to an arbitrary host.

## Lifecycle

The web and native clients share `@wuff/ui/live-updates` with injected capability renewal and terminal-auth behavior. Fresh subscriptions are owned by an effect; renewal/retry stops after unmount or terminal auth failure. Native visibility changes stop the stream and reacquire it on resume. Polling every ten seconds, focus and online events remain a fallback. Invalidation reads use the shared coalescing queue. Current native screen only reads list summaries; integration with mutation deferral/draft preservation is WUFF-74/75.

## Verification

October 22, 2026: workspace/root TypeScript, all 68 unit tests, web/MCP build, native frontend/local packaged macOS build and Rust endpoint-allowlist test passed. Adapter tests cover close during pending IPC, late frames, protocol rejection, serialized sends and cleanup. Existing three native OAuth/permission integration cases passed in isolated development. The first attempt was affected by managed-auth 429s while the website was polling; closing competing browser sessions resolved that. A fourth bearer live-stream test passed: initial snapshot, create/delete invalidations, actor mismatch and revoked renewal. The packaged macOS app displayed “Live updates connected” using the Rust transport and reflected a synthetic development list create/delete without manual refresh. The SDK live state proves a connected subscription; polling remained enabled during the UI observation.

Installed stream/reconnect and Windows/iOS/Android runtime evidence are separate gates. Build success and polling do not prove a live stream. No production Realtime configuration was changed.
