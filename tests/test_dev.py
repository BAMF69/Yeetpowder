# Purpose: Guard the dev.py test command against colored CI summaries and false success.
# Usage: python -m unittest discover -s tests -p test_dev.py
import contextlib
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('dev', Path(__file__).resolve().parents[1] / 'tools/dev.py')
dev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dev)


class TestVitestStatus(unittest.TestCase):
    def status(self, rc, output):
        with patch.object(dev, 'ready', return_value=0), patch.object(dev, 'tool', return_value=(rc, output)), contextlib.redirect_stdout(io.StringIO()):
            return dev.cmd_test(None)

    def test_colored_success(self):
        self.assertEqual(self.status(0, 'Tests  \x1b[32m303 passed\x1b[39m (303)'), 0)

    def test_plain_success(self):
        self.assertEqual(self.status(0, 'Tests  303 passed (303)'), 0)

    def test_nonzero_exit_overrides_success_summary(self):
        self.assertEqual(self.status(1, 'Tests  303 passed (303)'), 1)

    def test_failed_tests(self):
        self.assertEqual(self.status(1, 'Tests  1 failed | 302 passed (303)'), 1)

    def test_colored_all_skipped(self):
        self.assertEqual(self.status(0, 'Tests  \x1b[33m303 skipped\x1b[39m (303)'), 2)

    def test_missing_summary(self):
        self.assertEqual(self.status(0, 'RUN v5.0.5'), 1)

    def test_no_test_files(self):
        self.assertEqual(self.status(1, 'No test files found'), 2)

    def test_timeout(self):
        self.assertEqual(self.status(124, 'Tests 303 passed'), 1)
