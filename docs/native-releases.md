# Native download releases

Updated decision, October 24, 2026: Tim handles platform compilation locally.
**Native test builds** is manual-only; pushes and PRs no longer launch platform
builds or publish releases. This supersedes the October 22 (WUFF-82) automatic
release decision. The retained manual fallback publishes one private GitHub
prerelease only when explicitly run on `main`, after application checks and all
four package jobs succeed. No signing credentials are required by this test
distribution workflow.

Download from the private [Releases page](https://github.com/timbenniks/wuff-todo/releases). Unlike Actions artifacts, release assets have no 14-day artifact expiry. GitHub requires repository access; the owner can download and share the files directly with authorized testers. The workflow does not change repository visibility or grant access.

Each release includes:

- macOS Apple Silicon `.app` in a ZIP (unsigned debug build).
- Windows x64 NSIS `.exe` (unsigned debug installer).
- Android ARM64 debug APK (runner-generated debug key).
- Apple Silicon iOS simulator `.app` in a ZIP (**not installable on an iPhone**).
- `SHA256SUMS.txt` covering the four packages.

The release title records the native version and workflow run. Tags use `native-v<version>-build.<run_id>` so packaging changes need no artificial application version bump. Download filenames include the native version, source commit prefix and target. Notes include the full source commit, build-run link, generated GitHub change notes and installation limits. Package JSON, Tauri configuration, Cargo manifest and Cargo lock versions must agree before publication.

The release uses the exact `main` commit built by that run. The publisher downloads only that run's SHA-named artifacts, requires exactly one nonempty package per target, computes checksums, creates a draft, uploads every file, verifies the exact asset names and sizes, then publishes as a prerelease. A failed build does not invoke publication; a failed upload leaves a draft. Only the final main-branch publisher job has `contents: write`.

## Manual batches and retries

In Actions → **Native test builds** → **Run workflow**, select **main**. CLI equivalent:

```sh
gh workflow run native-builds.yml --ref main
```

This rebuilds and publishes the current main commit with a new run ID. Manual runs
on other branches only build; they cannot publish. An active manual build is never
interrupted by another run. GitHub retains only the newest pending run in the same
branch concurrency group. Merges do not queue a build.

For a failed publication, use **Re-run failed jobs** on the original run while its build artifacts still exist. The same run ID resumes its draft and replaces draft assets before validation. A retry of a completed publication verifies its commit and asset set and preserves the published files. It never clobbers published assets. If a draft contains unexpected files, publication fails rather than silently dropping them; inspect and correct that draft before retrying. After artifact expiry, run a fresh main build.

The existing [platform checklist and signing gates](tauri-platforms.md) still apply. These releases do not enable an updater or establish installed Windows/phone behavior. Debug Android builds may use a different signing key on each runner, preventing in-place updates; stable owner-controlled Android signing and Apple signing/TestFlight remain separate work.

## Verification

Nine synthetic Python tests cover complete package checksums/source names, missing or wrong-commit artifacts, ambiguous packages, version mismatch, immutable published-release retries, wrong-commit releases, interrupted uploads, incomplete upload sets and complete-draft publication. Run with Python 3.12:

```sh
python3 -m unittest discover -s tests -p test_native_release.py -v
```

Local tests passed with the bundled Python 3.12 runtime. macOS system Python 3.9
lacks `tomllib`; the manual workflow explicitly selects Python 3.12. A successful
manual main-branch publication is required before claiming the current manual
release path verified live.
