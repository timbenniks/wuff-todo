"""Release boundary tests use disposable packages and a mocked GitHub CLI."""

import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("native_release", Path(__file__).parents[1] / "scripts/native_release.py")
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)
SHA = "a" * 40


class NativeReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        native = self.root / "apps/native"
        (native / "src-tauri").mkdir(parents=True)
        (native / "package.json").write_text('{"version":"0.1.1"}')
        (native / "src-tauri/tauri.conf.json").write_text('{"version":"0.1.1"}')
        (native / "src-tauri/Cargo.toml").write_text('[package]\nversion="0.1.1"\n')
        (native / "src-tauri/Cargo.lock").write_text('[[package]]\nname="wuff-native"\nversion="0.1.1"\n')
        self.artifacts = self.root / "artifacts"
        self.output = self.root / "output"
        for platform, (pattern, _) in release.PLATFORMS.items():
            folder = self.artifacts / f"{platform}-{SHA}"
            folder.mkdir(parents=True)
            (folder / f"package.{pattern.split('.')[-1]}").write_bytes(platform.encode())

    def assemble(self):
        return release.assemble(self.root, self.artifacts, self.output, SHA, "123", "example/private")

    def test_complete_packages_have_source_names_and_correct_checksums(self):
        tag, version = self.assemble()
        self.assertEqual((tag, version), ("native-v0.1.1-build.123", "0.1.1"))
        lines = (self.output / "SHA256SUMS.txt").read_text().splitlines()
        self.assertEqual(len(lines), 4)
        for line in lines:
            digest, name = line.split("  ")
            self.assertIn(SHA[:12], name)
            self.assertEqual(hashlib.sha256((self.output / name).read_bytes()).hexdigest(), digest)
        self.assertIn("cannot install on an iPhone", (self.output / "RELEASE-NOTES.md").read_text())

    def test_missing_or_wrong_commit_artifact_rejected_before_output(self):
        folder = self.artifacts / f"android-debug-{SHA}"
        folder.rename(folder.with_name("android-debug-" + "b" * 40))
        with self.assertRaisesRegex(ValueError, "android-debug"):
            self.assemble()
        self.assertFalse(self.output.exists())

    def test_ambiguous_package_rejected(self):
        (self.artifacts / f"android-debug-{SHA}" / "other.apk").write_bytes(b"extra")
        with self.assertRaisesRegex(ValueError, "exactly one"):
            self.assemble()

    def test_version_drift_rejected(self):
        (self.root / "apps/native/src-tauri/tauri.conf.json").write_text('{"version":"0.1.2"}')
        with self.assertRaisesRegex(ValueError, "versions disagree"):
            self.assemble()

    def test_published_release_retry_never_uploads_or_edits(self):
        tag, version = self.assemble()
        existing = {"targetCommitish": SHA, "isDraft": False, "url": "https://example.test/release", "assets": [
            {"name": p.name, "size": p.stat().st_size}
            for p in self.output.iterdir() if p.name != "RELEASE-NOTES.md"
        ]}
        with patch.object(release.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, json.dumps(existing))), patch.object(release, "gh") as gh:
            self.assertEqual(release.publish(self.output, tag, version, SHA), existing["url"])
            gh.assert_not_called()

    def test_upload_failure_leaves_draft_unpublished(self):
        tag, version = self.assemble()
        existing = {"targetCommitish": SHA, "isDraft": True}
        with patch.object(release.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, json.dumps(existing))), patch.object(release, "gh", side_effect=RuntimeError("upload interrupted")) as gh:
            with self.assertRaisesRegex(RuntimeError, "upload interrupted"):
                release.publish(self.output, tag, version, SHA)
            self.assertEqual(gh.call_count, 1)
            self.assertEqual(gh.call_args.args[:2], ("release", "upload"))

    def test_incomplete_upload_set_cannot_publish(self):
        tag, version = self.assemble()
        existing = {"targetCommitish": SHA, "isDraft": True}
        with patch.object(release.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, json.dumps(existing))), patch.object(release, "gh", side_effect=["", '{"assets":[]}']) as gh:
            with self.assertRaisesRegex(ValueError, "incomplete"):
                release.publish(self.output, tag, version, SHA)
            self.assertFalse(any(call.args[:2] == ("release", "edit") for call in gh.call_args_list))


if __name__ == "__main__":
    unittest.main()
