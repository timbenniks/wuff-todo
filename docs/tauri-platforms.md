# Tauri platform and distribution gates

The private repository's **Native test builds** workflow creates unsigned macOS/Windows debug packages, an Android debug APK and an unsigned iOS simulator build. Artifacts expire after 14 days and are accessible through authenticated GitHub repository access. No production credentials, signing certificates or release publication permissions are supplied to PR jobs. These are validation artifacts, not signed end-user releases. Generated mobile projects are ephemeral CI output; the checked-in Tauri configuration remains the source of truth.

## Build evidence — October 22, 2026

[CI run 39839001570](https://github.com/timbenniks/wuff-todo/actions/runs/39839001570) produced all four private artifacts: macOS (~17.9 MB), Windows installer (~10.1 MB), Android APK (~55.3 MB), and iOS simulator (~28.2 MB). Sizes are compressed debug artifacts, not release-size promises. Initial setup failures were corrected: obsolete Android SDK `tools` package and PowerShell JSON argument quoting.

Inspecting the compiled iOS Info.plist revealed missing callback registration despite a successful build. A checked-in Info.ios.plist now declares the fixed scheme. CI regenerates the deep-link plugin metadata after mobile project initialization even with restored Cargo caches, and verifies callback entries in the final iOS plist and Android APK manifest before upload. This is package-registration evidence; an installed browser callback is still a device test.

## Acceptance matrix

| Platform | Build evidence | Installed evidence | Remaining release gate |
| --- | --- | --- | --- |
| macOS | Local debug app and Rust check passed | Browser login, warm/cold callback, Keychain restart, live connection, list/task edits, formatted notes, private image upload/read, date and subtask verified | Signed/notarized clean-machine install, background/reconnect/accessibility acceptance |
| Windows | Rust CI check passed; unsigned NSIS installer artifact built | Not yet performed | Install/WebView2, Credential Manager, warm/cold callback, keyboard/live/image acceptance, signing |
| iOS | Unsigned Apple Silicon simulator app artifact built | Not yet performed | Full Xcode/device, developer team, provisioning, Keychain/auth/photo/keyboard/safe-area/live acceptance, TestFlight |
| Android | ARM64 debug APK artifact built | Not yet performed | Device/emulator, Keystore/auth/photo/keyboard/back/live acceptance, private signed test channel |

Use synthetic data on the existing development backend for destructive and account-isolation acceptance. Production-configured build artifacts must never embed development credentials or a localhost override. Development overrides stay in the existing explicit local build configuration.

For every installed target record OS/device, commit, cold and warm callbacks, cancellation, restart, sign-out/revocation, foreground/background recovery, cross-client edits, retained drafts during reconnect, screen-reader and keyboard/touch operation, image selection/upload/removal, and owner/editor authorization. Browser widths and API tests are supporting evidence, not installed-phone proof.

## Private release preparation

Keep distribution private. Desktop signed installers require the owner's Apple Developer signing/notarization identity and a Windows code-signing identity. iPhone TestFlight requires an Apple developer team/app record and provisioning; Android requires an owned release keystore and a private testing channel. No accounts or certificates have been invented, no public GitHub release is published, and no auto-updater is enabled before signed-update keys and an authenticated distribution design exist.

For now distribute test artifacts through repository access. iOS simulator output cannot be installed on a physical iPhone. An Android debug APK is test-only and must be replaced with a stable owner-controlled signing key before persistent private releases. Unsigned desktop builds may trigger OS trust checks and are not a production installation experience.

Installed app versions are decoupled from the API. Preserve existing native audience/client ID, additive request fields and optional GitHub scope; deploy backend additions before shipping a client that calls them. Retain old actions during rollout. Release notes should record native version/commit and minimum backend capability, and exercise the previous client against each backend release. Do not force-update by silently changing authentication or discarding pending drafts.

References: [Tauri distribution](https://v2.tauri.app/distribute/), [GitHub pipelines](https://v2.tauri.app/distribute/pipelines/github/). Current CLI help verifies the Android APK and iOS simulator/no-sign/archive options used here. Local host has Command Line Tools but no full Xcode or attached phone tooling; CI builds do not replace device acceptance.

## Feature coverage

| Feature | Website | Tauri | MCP |
| --- | --- | --- | --- |
| Lists, tasks, sections, subtasks, dates, personal views | Shared screens | Same shared screens through bearer adapters | Existing domain-backed tools |
| Sharing and owner controls | Shared screens | Same screens and server permissions | Existing sharing tools |
| Formatted notes/private images | Cookie-authorized editor and image streams | Same editor; bearer streams and bounded blob previews | Canonical Markdown and attachment tools |
| Work metadata, linked issues and PR context | Existing screens | Shared context; synchronized mutations require optional GitHub consent | Existing Work/GitHub tools |
| Agent conversations/run context | Existing screens | Readable task context | Existing agent tools |
| Agent launch/recovery, personal credentials and repository administration | Existing authorized website flows | Explicit system-browser handoff | Existing tools subject to personal credentials and execution gates |

No native offline write queue, reminders or push notification service is introduced. Existing Expo remains until the Tauri installed-platform gates pass.

## Device handoff (owner confirmed October 22)

The owner has Windows, iPhone and Android devices, plus an Apple account configured in Xcode on another Mac. Keep heavy mobile tooling off this Mac. Apple Developer Program membership/team and signing material are not yet confirmed.

1. Open the successful **Native test builds** run in this private repository and download the artifact matching the device and commit. Unzip the artifact wrapper first. Record the run URL and version with each result.
2. On Windows, use the `windows-debug` NSIS installer on the Windows machine. Verify launch, browser sign-in/return, restart/session restoration and sign-out before task tests. The unsigned test installer is not release-signing evidence; report any OS trust or WebView2 installation blocker.
3. On Android, transfer the APK inside `android-debug` to the test phone and install using the phone's normal test-app installation flow. No Android Studio is required on this Mac. CI debug signing keys may differ between fresh runners, so an update can fail with a signature mismatch; use a disposable test installation and report that mismatch before replacing it. Account data remains server-side, but uninstalling removes the device session.
4. `ios-simulator` is for an Apple Silicon iOS simulator, not a physical iPhone. For the phone, use the other Mac's Xcode/team or configure owner-supplied signing in a protected CI release job. Confirm Developer Program membership before selecting TestFlight; merely having an Apple ID does not establish TestFlight eligibility. Never paste certificate passwords, private keys or provisioning credentials into task notes/chat.
5. For each installed target, sign in with an admitted test account and create a clearly named disposable list. Add/edit/complete a task, create an independent child, save a date, edit formatted notes, select and remove a private image, check a shared editor versus owner, reorder with accessible controls, switch away/back, restart, change the list from the website, and sign out. Record expected versus actual results. Do not perform destructive permission tests on real shared lists.

The first APK/installer is a delivery aid for these tests. WUFF-71/72/76/78/79 remain open where device/runtime/signing acceptance is outstanding.
