"""Production release gates using fake commands only; no remote operations."""
import importlib.util
import pathlib
import sys
import sqlite3
import io
from contextlib import closing
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/accidents'))
SPEC = importlib.util.spec_from_file_location('publish', ROOT / 'scripts/accidents/publish_verified_national.py')
publish = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publish)


class VerifiedProductionStageTests(unittest.TestCase):
    def test_source_guard_reports_only_known_categories(self):
        cases = [
            (b'Production deployment requires a clean checkout. confidential detail', 'clean checkout'),
            (b'Production source verification failed. confidential detail', 'Git access'),
            (b'this checkout is not the latest origin/main. confidential detail', 'latest main'),
            (b'Manual production deployment is disabled. confidential detail', 'workflow identity'),
            (b'confidential unknown error', 'unknown'),
        ]
        for stderr, category in cases:
            with self.subTest(category=category), patch.object(publish.subprocess, 'run') as run:
                run.return_value.returncode = 1
                run.return_value.stderr = stderr
                with self.assertRaises(ValueError) as error:
                    publish.assert_main_source()
                self.assertEqual(str(error.exception), f'Production source guard failed: {category}')

    def test_direct_real_values_must_match_exactly(self):
        expected = [(publish.pack.VERSION, 'one', 35.0, 139.0)]
        actual = [{'version': publish.pack.VERSION, 'id': 'one', 'latitude': 35.0, 'longitude': 139.00000000000003}]
        with patch.object(pathlib.Path, 'open', return_value=io.StringIO()):
            with self.assertRaisesRegex(ValueError, 'Direct D1 coordinate'):
                publish.confirm_direct_reals(expected, ['version', 'id', 'latitude', 'longitude'], lambda sql: actual, pathlib.Path('.'))

    def test_direct_real_exact_values_confirm_export_precision_difference(self):
        expected = [(publish.pack.VERSION, 'one', 35.0, 139.0)]
        actual = [{'version': publish.pack.VERSION, 'id': 'one', 'latitude': 35.0, 'longitude': 139.0}]
        with patch.object(pathlib.Path, 'open', return_value=io.StringIO()):
            self.assertEqual(publish.confirm_direct_reals(expected, ['version', 'id', 'latitude', 'longitude'], lambda sql: actual, pathlib.Path('.')), 1)
    def test_insufficient_capacity_stops_without_writing(self):
        info = {'uuid': publish.PRODUCTION_ID, 'name': 'pathguardian-traffic', 'database_size': 9_000_000_000}
        with patch.object(publish.pack, 'command_json', return_value=info):
            with self.assertRaisesRegex(ValueError, 'headroom'):
                publish.verify_capacity(pathlib.Path('not-created'))

    def test_export_uses_owned_transactions_and_preserves_multiline_text(self):
        with closing(sqlite3.connect(':memory:')) as db:
            db.execute('CREATE TABLE sample(value TEXT)')
            statements = []
            db.set_trace_callback(statements.append)
            publish.load_export(db, io.StringIO("BEGIN TRANSACTION;\nINSERT INTO sample VALUES('one\n-- literal');\nCOMMIT;\n"))
            self.assertEqual(db.execute('SELECT value FROM sample').fetchone()[0], 'one\n-- literal')
            self.assertEqual(sum(s == 'COMMIT' for s in statements), 1)

    def test_export_failure_rolls_back_only_current_batch(self):
        with closing(sqlite3.connect(':memory:')) as db:
            db.execute('CREATE TABLE sample(value INTEGER)')
            sql = ''.join(f'INSERT INTO sample VALUES({n});\n' for n in range(5001)) + 'INVALID SQL;\n'
            with self.assertRaises(sqlite3.OperationalError):
                publish.load_export(db, io.StringIO(sql))
            self.assertEqual(db.execute('SELECT COUNT(*) FROM sample').fetchone()[0], 5000)

    def test_coordinate_change_with_same_rows_is_rejected(self):
        with closing(sqlite3.connect(':memory:')) as left, closing(sqlite3.connect(':memory:')) as right:
            for db in (left, right):
                db.execute('CREATE TABLE accident_locations(version TEXT,id TEXT,latitude REAL,longitude REAL,PRIMARY KEY(version,id))')
                db.execute('INSERT INTO accident_locations VALUES(?,?,?,?)', (publish.pack.VERSION, 'one', 35.0, 139.0))
            right.execute('UPDATE accident_locations SET latitude=36.0')
            with self.assertRaisesRegex(ValueError, 'row contents differ'):
                publish.compare_table(left, right, 'accident_locations', 1)

    def test_dimension_swap_with_same_total_is_rejected(self):
        with closing(sqlite3.connect(':memory:')) as left, closing(sqlite3.connect(':memory:')) as right:
            for db in (left, right):
                db.execute('CREATE TABLE accident_location_counts(version TEXT,id TEXT,year INTEGER,count INTEGER,PRIMARY KEY(version,id,year))')
                db.executemany('INSERT INTO accident_location_counts VALUES(?,?,?,?)',
                    [(publish.pack.VERSION, 'one', 2024, 2), (publish.pack.VERSION, 'one', 2025, 3)])
            right.execute('UPDATE accident_location_counts SET count=5-count')
            with self.assertRaisesRegex(ValueError, 'row contents differ'):
                publish.compare_table(left, right, 'accident_location_counts', 2)

    def test_changed_public_offering_never_activates(self):
        response = {'id': publish.pack.RELEASE_ID, 'tag_name': publish.TAG, 'draft': False, 'assets': []}
        with patch.object(publish.pack, 'command_json', return_value=response), patch.object(publish, 'd1') as execute:
            with self.assertRaisesRegex(ValueError, 'offering asset changed'):
                publish.activate_after_offering({'draft': False}, {})
            execute.assert_not_called()

    def test_preview_target_is_rejected(self):
        config = {'vars': {'CLOUDFLARE_ACCOUNT_ID': '64a7afb6120cc316b618480f4a17cc21'},
                  'd1_databases': [{'binding': 'TRAFFIC_DB', 'database_id': publish.pack.PREVIEW_ID,
                                    'database_name': 'pathguardian-traffic'}]}
        with self.assertRaisesRegex(ValueError, 'target mismatch'):
            publish.validate_target(config)

    def test_committed_qa_gate(self):
        publish.verify_evidence()

    def test_source_guard_failure_stops_before_download_and_d1(self):
        with patch.object(publish, 'assert_main_source', side_effect=ValueError('Source guard')), patch.object(publish.pack, 'prepare_verified_pack') as download, patch.object(publish, 'd1') as execute:
            with self.assertRaisesRegex(ValueError, 'Source guard'):
                publish.main()
            download.assert_not_called()
            execute.assert_not_called()

    def test_existing_partial_version_is_not_appended(self):
        with patch.object(publish, 'd1') as execute, patch.object(publish, 'query', return_value=[{'published': 0}]), patch.object(publish.pack, 'verify_remote', side_effect=ValueError('Incomplete')):
            with self.assertRaisesRegex(ValueError, 'Incomplete'):
                publish.stage({'sqlFiles': [{}, {'name': 'data.sql'}]}, pathlib.Path('sql'), {})
            self.assertEqual(execute.call_count, 1)  # schema only; no data INSERT/UPDATE/DELETE

    def test_release_failure_never_activates(self):
        with patch.object(publish.subprocess, 'run') as run, patch.object(publish, 'd1') as execute:
            run.return_value.returncode = 1
            with self.assertRaisesRegex(ValueError, 'release publication failed'):
                publish.activate_after_offering({'draft': True}, {})
            execute.assert_not_called()

    def test_still_draft_never_activates(self):
        response = {'id': publish.pack.RELEASE_ID, 'tag_name': publish.TAG, 'draft': True}
        with patch.object(publish.pack, 'command_json', return_value=response), patch.object(publish, 'd1') as execute:
            with self.assertRaisesRegex(ValueError, 'offering unavailable'):
                publish.activate_after_offering({'draft': False}, {})
            execute.assert_not_called()


if __name__ == '__main__':
    unittest.main()
