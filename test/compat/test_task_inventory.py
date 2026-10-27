"""No network, no user data: Task930 inventory contract tests."""
import unittest
import sys
import tempfile
import subprocess
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.task_inventory import TASK_BRANCH, as_markdown, task_ids, local_missing_unit_tests


class TaskInventoryTest(unittest.TestCase):
    def test_task_number_is_not_a_completed_count(self):
        text = "feat(Task929) fix(task/514) docs(Task 927) unrelated #999"
        self.assertEqual(task_ids(text), {514, 927, 929})

    def test_task_branch_parser_excludes_irrelevant_numbers(self):
        self.assertEqual(task_ids("origin/task/516-hls", TASK_BRANCH), {516})
        self.assertEqual(task_ids("origin/backup/task492-verified", TASK_BRANCH), {492})
        self.assertEqual(task_ids("origin/feature/scene-ui01", TASK_BRANCH), set())

    def test_dashboard_distinguishes_ancestry_and_completion(self):
        report = {
            "develop_head": "a" * 40,
            "last_mentioned_task": 929,
            "next_candidate": 930,
            "commit_mentioned_numbers": 523,
            "remote_branches": 11,
            "remote_integrated_branches": 8,
            "remote_off_main_branches": 3,
            "remote_task_numbers_in_develop": 5,
            "remote_task_numbers_off_main": 2,
            "off_main": [{"name": "task/516-hls", "sha": "abcdef",
                          "date": "2026-10-15", "subject": "fix",
                          "integrated": False, "numbers": [516]}]
        }
        text = as_markdown(report)
        self.assertIn("番号最大（完了件数ではない） | 929", text)
        self.assertIn("Task番号は識別子", text)
        self.assertIn("祖先未統合・要照合ブランチ数", text)
        self.assertIn("https://github.com/ButaMonky/ZenzaWatch-Back-up/tree/task/516-hls", text)
        self.assertIn("次のTask番号の**候補**は " + chr(96) + "930" + chr(96), text)
        self.assertIn("未統合ブランチは既存developに代替修正があるか", text)

    def test_local_gap_probe_only_marks_tests_absent_from_develop(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp)
            def g(*args):
                subprocess.run(["git", "-C", str(repo), *args],
                               check=True, capture_output=True)
            g("init", "-b", "develop")
            (repo / "README.md").write_text("test", encoding="utf-8")
            g("add", "README.md")
            g("-c", "user.name=Test", "-c", "user.email=test@example.invalid",
              "commit", "-m", "initial")
            g("checkout", "-b", "task/777-example")
            (repo / "test" / "unit").mkdir(parents=True)
            (repo / "test" / "unit" / "NewTest.js").write_text("test", encoding="utf-8")
            g("add", "test/unit/NewTest.js")
            g("-c", "user.name=Test", "-c", "user.email=test@example.invalid",
              "commit", "-m", "test(Task777)")
            g("checkout", "develop")
            audit = local_missing_unit_tests(repo)
            self.assertEqual(audit["local_task_heads_not_ancestor"], 1)
            self.assertEqual(audit["branches_with_new_tests_absent_from_develop"], 1)
            self.assertEqual(audit["candidates"][0]["tests_not_in_develop"],
                             ["test/unit/NewTest.js"])


if __name__ == "__main__":
    unittest.main()
