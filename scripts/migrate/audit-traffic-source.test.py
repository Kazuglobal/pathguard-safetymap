"""Independent source-audit regressions. No production credentials or network."""
import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('source_audit', Path(__file__).with_name('audit-traffic-source.py'))
source_audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source_audit)


class SourceAuditTests(unittest.TestCase):
    def test_coordinate_minutes_must_be_valid(self):
        with self.assertRaises(ValueError):
            source_audit.dms('356000000', 2)

    def test_timezone_equivalence_and_real_field_mismatch(self):
        row = dict(severity_code=1, fatalities=1, injuries=0, lat=35, lng=139, occurred_at='2024-01-01T00:00:00+09:00')
        db = dict(row, occurred_at='2023-12-31T15:00:00+00:00')
        self.assertEqual(source_audit.differences(db, row), {})
        self.assertIn('severity_code', source_audit.differences(dict(db, severity_code=2), row))

    def test_same_number_in_another_year_requires_all_fields_to_match(self):
        row = {
            '都道府県コード': '44', '警察署等コード': '109', '本票番号': '0424',
            '事故内容': '1', '死者数': '001', '負傷者数': '001',
            '発生日時　　年': '2024', '発生日時　　月': '06', '発生日時　　日': '13',
            '発生日時　　時': '17', '発生日時　　分': '51',
            '地点　緯度（北緯）': '350000000', '地点　経度（東経）': '1390000000',
        }
        db = dict(id=1, source_year=2024, prefecture_code=44, police_station_code='109', record_number='0424',
                  severity_code=1, fatalities=1, injuries=1, lat=35, lng=139, occurred_at='2024-06-13T08:51:00+00:00')
        with tempfile.TemporaryDirectory() as directory:
            files = {}
            for year, raw in [(2024, dict(row, **{'事故内容': '2', '死者数': '000'})), (2025, row)]:
                files[year] = Path(directory) / f'{year}.csv'
                with files[year].open('w', encoding='cp932', newline='') as stream:
                    writer = csv.DictWriter(stream, fieldnames=row.keys())
                    writer.writeheader()
                    writer.writerow(raw)
            report = source_audit.audit([db], files)
            self.assertEqual(report['matched_rows'], 1)
            self.assertEqual(report['source_year_aliases'], [{'id': 1, 'database_year': 2024, 'source_file_year': 2025}])
            changed = source_audit.audit([dict(db, lat=35.01)], files)
            self.assertEqual(changed['matched_rows'], 0)
            self.assertEqual(changed['source_year_aliases'], [])
            self.assertEqual(len(changed['mismatches']), 1)


if __name__ == '__main__':
    unittest.main()
