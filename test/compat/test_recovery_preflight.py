"""Offline tests: no network access or modification of a real repository."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "tools/compat/recovery_preflight.py"


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(repo), *args],
                                   text=True).strip()


class RecoveryPreflightTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name) / "repo"
        self.repo.mkdir()
        git(self.repo, "init", "-q", "-b", "develop")
        git(self.repo, "config", "core.autocrlf", "false")
        git(self.repo, "config", "user.name", "Fixture")
        git(self.repo, "config", "user.email", "fixture@example.invalid")
        git(self.repo, "remote", "add", "origin",
            "https://ButaMonky@github.com/ButaMonky/ZenzaWatch.git")
        (self.repo / "dist").mkdir()
        self.data = b"// offline synthetic release; no secrets\n"
        (self.repo / "dist/ZenzaWatch-dev.user.js").write_bytes(self.data)
        git(self.repo, "add", "dist/ZenzaWatch-dev.user.js")
        git(self.repo, "commit", "-qm", "fixture release")
        self.rev = git(self.repo, "rev-parse", "HEAD")
        self.digest = hashlib.sha256(self.data).hexdigest()

    def check(self, extra=None, expected=None):
        command = [sys.executable, str(SCRIPT), "--repo", str(self.repo),
                   "--known-good", self.rev]
        if expected is not False:
            command += ["--expected-sha256",
                        self.digest if expected is None else expected]
        if extra:
            command += extra
        done = subprocess.run(command, capture_output=True, text=True)
        return done.returncode, json.loads(done.stdout)

    def test_clean_explicit_matching_release_is_ready(self):
        code, out = self.check()
        self.assertEqual(code, 0)
        self.assertEqual(out["status"], "READY")
        self.assertEqual(out["artifact_sha256"], self.digest)
        self.assertEqual(out["issues"], [])

    def test_unverified_digest_never_claims_ready(self):
        code, out = self.check(expected=False)
        self.assertEqual((code, out["status"]), (3, "VERIFY"))
        self.assertIn("TRUSTED_DIGEST_REQUIRED", out["issues"])

    def test_digest_mismatch_fails_closed(self):
        code, out = self.check(expected="f" * 64)
        self.assertEqual(code, 2)
        self.assertIn("TRUSTED_DIGEST_MISMATCH", out["issues"])

    def test_unexpected_origin_fails(self):
        git(self.repo, "remote", "set-url", "origin",
            "https://github.com/someone/not-the-release.git")
        code, out = self.check()
        self.assertEqual(code, 2)
        self.assertIn("UNEXPECTED_PUBLICATION_REMOTE", out["issues"])

    def test_modified_worktree_fails(self):
        (self.repo / "dist/ZenzaWatch-dev.user.js").write_bytes(b"dirty")
        code, out = self.check()
        self.assertEqual(code, 2)
        self.assertIn("DIRTY_WORKTREE", out["issues"])

    def test_untracked_worktree_fails(self):
        (self.repo / "accidental.txt").write_text("untracked")
        code, out = self.check()
        self.assertEqual(code, 2)
        self.assertIn("DIRTY_WORKTREE", out["issues"])

    def test_full_commit_identifier_required(self):
        code, out = self.check(["--known-good", self.rev[:7]])
        self.assertEqual(code, 2)
        self.assertIn("KNOWN_GOOD_MUST_BE_FULL_SHA", out["issues"])

    def test_disallow_repo_path_traversal(self):
        code, out = self.check(["--artifact", "dist/../private.txt"])
        self.assertEqual(code, 2)
        self.assertIn("ARTIFACT_PATH_NOT_ALLOWED", out["issues"])

    def test_missing_artifact_never_claims_ready(self):
        code, out = self.check(["--artifact", "dist/absent.user.js"])
        self.assertEqual(code, 2)
        self.assertIn("KNOWN_GOOD_ARTIFACT_NOT_FOUND", out["issues"])

    def test_malformed_remote_fails_closed(self):
        git(self.repo, "remote", "set-url", "origin", "https://[bad-host/path")
        code, out = self.check()
        self.assertEqual(code, 2)
        self.assertIn("UNEXPECTED_PUBLICATION_REMOTE", out["issues"])

    def test_missing_repository_fails_closed(self):
        code, out = self.check(["--repo", self.tmp.name])
        self.assertEqual(code, 2)
        self.assertIn("NOT_A_GIT_WORKTREE", out["issues"])

    def test_unauthorized_credential_in_remote_never_displayed(self):
        git(self.repo, "remote", "set-url", "origin",
            "https://user:pretend-secret@github.com/ButaMonky/ZenzaWatch.git")
        code, out = self.check()
        self.assertEqual(code, 2)
        self.assertIn("UNEXPECTED_PUBLICATION_REMOTE", out["issues"])
        self.assertNotIn("pretend-secret", json.dumps(out))


if __name__ == "__main__":
    unittest.main()
