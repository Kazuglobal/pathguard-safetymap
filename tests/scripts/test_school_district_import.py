import importlib.util
import json
import sqlite3
import tempfile
import unittest
import io
import zipfile
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch
from pathlib import Path

spec = importlib.util.spec_from_file_location('district_import', 'scripts/migrate/prepare-school-districts.py')
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class SchoolDistrictImportTests(unittest.TestCase):
    def setUp(self):
        Path('tmp').mkdir(exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(dir='tmp')
        self.output = Path(self.directory.name) / 'import.sql'
        self.db = sqlite3.connect(':memory:')
        self.db.execute('CREATE TABLE local_safety_alerts(id TEXT PRIMARY KEY)')
        self.db.executescript(Path('lib/db/migrations/20261010090000_school_district_alerts.sql').read_text())
        self.feature = {'type': 'Feature', 'properties': {'municipalityCode': '13104', 'schoolCode': 'B113210400163', 'prefecture': '東京都', 'city': '新宿区', 'name': "第一'小学校", 'sourceUrl': 'https://example.lg.jp/', 'dataYear': 2023}, 'geometry': {'type': 'Polygon', 'coordinates': [[[139, 35], [139.02, 35], [139.02, 35.02], [139, 35.02], [139, 35]]]}}

    def tearDown(self):
        self.db.close()
        self.directory.cleanup()

    def apply(self, features):
        counts = importer.write_import(features, self.output, {'13104'})
        self.db.executescript(self.output.read_text(encoding='utf-8'))
        return counts

    def test_repeatable_import_preserves_geometry_and_unicode(self):
        self.assertEqual(self.apply([self.feature]), (1, 1))
        self.apply([self.feature])
        self.assertEqual(self.db.execute('SELECT count(*) FROM school_districts').fetchone()[0], 1)
        self.assertEqual(self.db.execute('SELECT name FROM school_districts').fetchone()[0], "第一'小学校")
        self.assertEqual(json.loads(self.db.execute('SELECT geometry FROM school_district_boundaries').fetchone()[0]), self.feature['geometry'])

    def test_empty_snapshot_removes_obsolete_schools_and_associations(self):
        self.apply([self.feature])
        self.db.execute("INSERT INTO local_safety_alerts VALUES('old')")
        self.db.execute("INSERT INTO local_alert_districts VALUES('old','13104:B113210400163')")
        self.db.commit()
        self.assertEqual(self.apply([]), (0, 0))
        for table in ['school_districts', 'school_district_boundaries', 'local_alert_districts']:
            self.assertEqual(self.db.execute('SELECT count(*) FROM ' + table).fetchone()[0], 0)

    def test_rejects_malformed_coordinates_and_wrong_snapshot_identity(self):
        with self.assertRaises(ValueError):
            importer.write_import([self.feature], self.output, {'99999'})
        self.feature['geometry']['coordinates'][0][0] = [0, 0]
        with self.assertRaises(ValueError):
            self.apply([self.feature])

    def test_missing_geojson_reports_input_error_without_creating_output(self):
        output = Path(self.directory.name) / 'not-created'
        missing = Path(self.directory.name) / 'missing.geojson'
        errors = io.StringIO()
        with redirect_stderr(errors), self.assertRaises(SystemExit) as failure:
            importer.main(['--geojson', str(missing), '--municipality-codes', '13104', '--output', str(output)])
        self.assertEqual(failure.exception.code, 2)
        self.assertIn(str(missing), errors.getvalue())
        self.assertNotIn('Traceback', errors.getvalue())
        self.assertFalse(output.exists())

    def test_exports_real_source_subset_as_normalized_geojson(self):
        folder = Path(self.directory.name)
        archive_path, municipalities, terms_path = folder / 'source.zip', folder / 'muni.js', folder / 'terms.xlsx'
        municipalities.write_text('GSI.MUNI_ARRAY["13104"] = "13,東京都,13104,新宿区";\nGSI.MUNI_ARRAY["13105"] = "13,東京都,13105,文京区";', encoding='utf-8')
        terms_path.write_bytes(b'test')
        original = []
        for code in ['13104', '13105']:
            original.append({'type': 'Feature', 'properties': {'A27_001': code, 'A27_003': 'B' + code, 'A27_004': '第一小学校'}, 'geometry': self.feature['geometry']})
        inner = io.BytesIO()
        with zipfile.ZipFile(inner, 'w') as archive:
            archive.writestr('A27-23_13.geojson', json.dumps({'type': 'FeatureCollection', 'features': original}))
        with zipfile.ZipFile(archive_path, 'w') as archive:
            archive.writestr('A27-23_13_GML.zip', inner.getvalue())
        exported = folder / 'municipal-update.geojson'
        output = folder / 'prepared'
        policies = {code: {'E': 'オープンデータ公開', 'F': '2.なし'} for code in ['13104', '13105']}
        with patch.object(importer, 'terms_by_code', return_value=policies), redirect_stdout(io.StringIO()):
            importer.main(['--archive', str(archive_path), '--municipalities', str(municipalities), '--terms', str(terms_path), '--municipality-codes', '13104', '--export-geojson', str(exported), '--output', str(output)])
        data = json.loads(exported.read_text(encoding='utf-8'))
        self.assertEqual(len(data['features']), 1)
        self.assertEqual(data['features'][0]['properties']['municipalityCode'], '13104')
        self.assertEqual(data['features'][0]['properties']['sourceUrl'], importer.SOURCE)
        self.assertEqual(data['features'][0]['properties']['dataYear'], 2023)
        sql = (output / 'municipal-update.sql').read_text(encoding='utf-8')
        self.assertIn("DELETE FROM school_districts WHERE municipality_code='13104'", sql)
        self.assertNotIn("municipality_code='13105'", sql)
        self.assertEqual(json.loads((output / 'manifest.json').read_text(encoding='utf-8'))['files'], ['municipal-update.sql'])


if __name__ == '__main__':
    unittest.main()
