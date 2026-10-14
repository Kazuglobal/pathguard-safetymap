"""Preview-only target, immutable input and fail-closed remote count tests."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('stage', ROOT / 'scripts/accidents/stage_verified_preview.py')
stage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(stage)


class VerifiedPreviewStageTests(unittest.TestCase):
    def test_production_uuid_rejected(self):
        config = {'account_id': '64a7afb6120cc316b618480f4a17cc21', 'd1_databases': [
            {'binding': 'TRAFFIC_DB', 'database_id': '84db49b6-e9f4-4886-8319-2b7d32d59438',
             'database_name': 'pathguardian-traffic-preview'}]}
        with self.assertRaisesRegex(ValueError, 'target mismatch'):
            stage.validate_target(config)

    def test_preview_config_accepted(self):
        import json
        stage.validate_target(json.loads((ROOT / 'wrangler.preview-resources.json').read_text('utf8')))

    def test_changed_manifest_rejected_before_archive_or_write(self):
        with self.assertRaisesRegex(ValueError, 'Manifest hash mismatch'):
            stage.unpack_verified(b'{}', pathlib.Path('does-not-exist'), pathlib.Path('never-created'))

    def test_partial_remote_counts_fail_closed(self):
        with patch.object(stage, 'query', return_value=[{'n': 0}]) as query:
            with self.assertRaisesRegex(ValueError, 'Incomplete version'):
                stage.verify_remote({})
            self.assertEqual(query.call_count, 1)

    def test_failed_d1_response_rejected(self):
        with patch.object(stage, 'command_json', return_value=[{'success': False, 'results': []}]):
            with self.assertRaisesRegex(ValueError, 'D1 execution failed'):
                stage.d1('--command', 'SELECT 1')

    def test_existing_unpublished_version_is_not_appended_or_activated(self):
        with patch.object(stage, 'd1') as execute, patch.object(stage, 'query', return_value=[{'published': 0}]), patch.object(stage, 'verify_remote') as verify:
            with self.assertRaisesRegex(ValueError, 'Existing unpublished'):
                stage.import_remote({'sqlFiles': [{}, {'name': 'data.sql'}]}, pathlib.Path('sql'), {})
            self.assertEqual(execute.call_args_list[0].args, ('--file', str(pathlib.Path('sql/0000-schema.sql'))))
            self.assertEqual(execute.call_count, 1)
            verify.assert_not_called()

    def test_failed_verification_never_activates(self):
        with patch.object(stage, 'd1') as execute, patch.object(stage, 'query', return_value=[{'published': 1}]), patch.object(stage, 'verify_remote', side_effect=ValueError('Mismatch')):
            with self.assertRaisesRegex(ValueError, 'Mismatch'):
                stage.import_remote({'sqlFiles': [{}]}, pathlib.Path('sql'), {})
            self.assertEqual(execute.call_count, 1)
            self.assertFalse(any('UPDATE' in str(call) for call in execute.call_args_list))


if __name__ == '__main__':
    unittest.main()
