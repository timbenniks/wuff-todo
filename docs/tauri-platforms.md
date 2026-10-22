# Tauri platform and distribution gates

The private repository's **Native test builds** workflow creates unsigned macOS/Windows debug packages, an Android debug APK and an unsigned iOS simulator build. Artifacts expire after 14 days and are accessible through authenticated GitHub repository access. No production credentials, signing certificates or release publication permissions are supplied to PR jobs. These are validation artifacts, not signed end-user releases. Generated mobile projects are ephemeral CI output; the checked-in Tauri configuration remains the source of truth.

## Acceptance matrix

| Platform | Build evidence | Installed evidence | Remaining release gate |
| --- | --- | --- | --- |
| macOS | Local debug app and Rust check passed | Browser login, warm/cold callback, Keychain restart, live connection, list/task edits, formatted notes, private image upload/read, date and subtask verified | Signed/notarized clean-machine install, background/reconnect/accessibility acceptance |
| Windows | Rust CI check passed; installer workflow pending | Not yet performed | Install/WebView2, Credential Manager, warm/cold callback, keyboard/live/image acceptance, signing |
| iOS | Simulator workflow pending | Not yet performed | Full Xcode/device, developer team, provisioning, Keychain/auth/photo/keyboard/safe-area/live acceptance, TestFlight |
| Android | APK workflow pending | Not yet performed | Device/emulator, Keystore/auth/photo/keyboard/back/live acceptance, private signed test channel |

Use synthetic data on the existing development backend for destructive and account-isolation acceptance. Production-configured build artifacts must never embed development credentials or a localhost override. Development overrides stay in the existing explicit local build configuration.

For every installed target record OS/device, commit, cold and warm callbacks, cancellation, restart, sign-out/revocation, foreground/background recovery, cross-client edits, retained drafts during reconnect, screen-reader and keyboard/touch operation, image selection/upload/removal, and owner/editor authorization. Browser widths and API tests are supporting evidence, not installed-phone proof.

## Private release preparation

Keep distribution private. Desktop signed installers require the owner's Apple Developer signing/notarization identity and a Windows code-signing identity. iPhone TestFlight requires an Apple developer team/app record and provisioning; Android requires an owned release keystore and a private testing channel. No accounts or certificates have been invented, no public GitHub release is published, and no auto-updater is enabled before signed-update keys and an authenticated distribution design exist.

For now distribute test artifacts through repository access. iOS simulator output cannot be installed on a physical iPhone. An Android debug APK is test-only and must be replaced with a stable owner-controlled signing key before persistent private releases. Unsigned desktop builds may trigger OS trust checks and are not a production installation experience.

Installed app versions are decoupled from the API. Preserve existing native audience/client ID, additive request fields and optional GitHub scope; deploy backend additions before shipping a client that calls them. Retain old actions during rollout. Release notes should record native version/commit and minimum backend capability, and exercise the previous client against each backend release. Do not force-update by silently changing authentication or discarding pending drafts.

References: [Tauri distribution](https://v2.tauri.app/distribute/), [GitHub pipelines](https://v2.tauri.app/distribute/pipelines/github/). Current CLI help verifies the Android APK and iOS simulator/no-sign/archive options used here. Local host has Command Line Tools but no full Xcode or attached phone tooling; CI builds do not replace device acceptance.
