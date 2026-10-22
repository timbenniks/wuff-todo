"""Assemble an exact-commit native test release; publish only a complete draft."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tomllib


PLATFORMS = {
    "macos-debug": ("*.zip", "Mac-Apple-Silicon-test.zip"),
    "windows-debug": ("**/*.exe", "Windows-x64-test.exe"),
    "android-debug": ("**/*.apk", "Android-ARM64-test.apk"),
    "ios-simulator": ("*.zip", "iOS-SIMULATOR-ONLY.zip"),
}


def assemble(root, artifacts, output, sha, run_id, repository):
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("A full source commit is required")
    if not re.fullmatch(r"[0-9]+", run_id):
        raise ValueError("A workflow run ID is required")
    native = root / "apps/native"
    version = json.loads((native / "package.json").read_text())["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Expected a numeric native version")
    config = json.loads((native / "src-tauri/tauri.conf.json").read_text())
    cargo = tomllib.loads((native / "src-tauri/Cargo.toml").read_text())
    lock = tomllib.loads((native / "src-tauri/Cargo.lock").read_text())
    locked = [p["version"] for p in lock["package"] if p["name"] == "wuff-native"]
    if config["version"] != version or cargo["package"]["version"] != version or locked != [version]:
        raise ValueError("Native package/config/Cargo versions disagree")
    # Validate the entire set before copying anything or creating a GitHub draft.
    sources = []
    for platform, (pattern, suffix) in PLATFORMS.items():
        files = list((artifacts / f"{platform}-{sha}").glob(pattern))
        if len(files) != 1 or not files[0].is_file() or files[0].stat().st_size == 0:
            raise ValueError(f"Expected exactly one nonempty {platform} package")
        sources.append((files[0], f"Wuff-Todo-{version}-{sha[:12]}-{suffix}"))
    output.mkdir(parents=True, exist_ok=False)
    checksums = []
    for source, name in sources:
        target = output / name
        shutil.copyfile(source, target)
        with target.open("rb") as package:
            digest = hashlib.file_digest(package, "sha256").hexdigest()
        checksums.append(f"{digest}  {name}\n")
    (output / "SHA256SUMS.txt").write_text("".join(checksums))
    run_url = f"https://github.com/{repository}/actions/runs/{run_id}"
    notes = f"""Native version **{version}**, source commit `{sha}`.

[Build and verification run]({run_url}). Application checks and all four package jobs passed before publication.

| Download | Target |
| --- | --- |
| Mac-Apple-Silicon-test.zip | macOS Apple Silicon; unzip and open Wuff Todo.app |
| Windows-x64-test.exe | Windows x64 NSIS installer |
| Android-ARM64-test.apk | Android ARM64 debug APK |
| iOS-SIMULATOR-ONLY.zip | Apple Silicon iOS simulator; **cannot install on an iPhone** |

These are test builds: desktop packages are unsigned, Android uses a runner-generated debug key (updates may require uninstalling an earlier test build), and iOS is simulator-only. Signing and physical-device acceptance remain separate gates. Quit the previous desktop app before opening this build.

Uses the existing hosted Wuff APIs and optional GitHub consent. No backend migration is required by this packaging workflow. Client compatibility is documented in docs/tauri-platforms.md at the source commit.

Verify downloads with SHA256SUMS.txt. These release assets do not have the Actions artifacts' 14-day expiry. This repository is private: GitHub downloads require repository access. The owner can also download and share these test files directly.
"""
    (output / "RELEASE-NOTES.md").write_text(notes)
    return f"native-v{version}-build.{run_id}", version


def gh(*args):
    return subprocess.run(["gh", *args], check=True, text=True, capture_output=True).stdout


def publish(output, tag, version, sha):
    files = sorted(p for p in output.iterdir() if p.name != "RELEASE-NOTES.md")
    # A failed lookup never triggers an overwrite: create will fail if the tag
    # already has a release, including a transient auth/network lookup failure.
    lookup = subprocess.run(
        ["gh", "release", "view", tag, "--json", "isDraft,targetCommitish,assets,url"],
        text=True, capture_output=True,
    )
    if lookup.returncode == 0:
        release = json.loads(lookup.stdout)
        if release["targetCommitish"] != sha:
            raise ValueError("Existing release points to another commit")
        if not release["isDraft"]:
            expected = {p.name for p in files}
            if {a["name"] for a in release["assets"]} != expected or any(a["size"] <= 0 for a in release["assets"]):
                raise ValueError("Published release has an unexpected asset set")
            print(f"Already published; preserving assets: {release['url']}")
            return release["url"]
    else:
        gh("release", "create", tag, "--draft", "--prerelease", "--target", sha,
           "--title", f"Wuff Todo {version} — test build {os.environ['GITHUB_RUN_ID']}",
           "--notes-file", str(output / "RELEASE-NOTES.md"), "--generate-notes", "--latest=false")
    # Failed uploads leave a draft. Rerun the failed job to replace draft assets.
    gh("release", "upload", tag, *(str(p) for p in files), "--clobber")
    release = json.loads(gh("release", "view", tag, "--json", "assets"))
    actual = {a["name"]: a["size"] for a in release["assets"]}
    if actual != {p.name: p.stat().st_size for p in files}:
        raise ValueError("Uploaded release asset set is incomplete or has incorrect sizes")
    gh("release", "edit", tag, "--draft=false", "--prerelease", "--latest=false")
    return gh("release", "view", tag, "--json", "url", "--jq", ".url").strip()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    sha = os.environ["GITHUB_SHA"]
    output = Path("native-release")
    tag, version = assemble(Path.cwd(), Path("native-artifacts"), output, sha,
                            os.environ["GITHUB_RUN_ID"], os.environ["GITHUB_REPOSITORY"])
    if args.publish:
        if os.environ["GITHUB_REF"] != "refs/heads/main" or os.environ["GITHUB_EVENT_NAME"] not in ("push", "workflow_dispatch"):
            raise ValueError("Only a main-branch push or manual run may publish")
        url = publish(output, tag, version, sha)
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
            summary.write(f"[Download native test release]({url})\n")
        print(url)
