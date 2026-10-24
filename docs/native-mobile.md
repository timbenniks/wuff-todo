# Retired Expo mobile client

Retired: October 24, 2026, at the maintainer’s request.

Tauri in `apps/native` is the maintained online-only client for macOS, Windows,
iPhone and Android. Start with [Tauri development](tauri-client.md),
[authentication](tauri-auth.md), [shared features](tauri-features.md) and
[platform/distribution gates](tauri-platforms.md).

The October 17 React Native/Expo development app, its duplicated assets, Expo/EAS
configuration and exclusive export checker were removed. Sources and setup details
remain in Git history. Dated [verification evidence](verification.md#native-mobile-development--october-17-2026)
records what was tested then; it does not certify the Tauri replacement.

The shared `NativeClient`, `/api/mobile` adapter, legacy fixed OAuth client and
regression tests remain supported. They have active Tauri/server/test consumers;
removing the Expo frontend does not revoke grants, change consent, widen callback
registration or remove authorization boundaries.

Task data and drafts remain in memory. No offline writes or device/signing
acceptance is implied by this retirement. Use the existing isolated development
backend and synthetic data for integration checks; see [development](development.md).
