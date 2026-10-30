import importlib.util
from pathlib import Path
import unittest
from shapely.geometry import Point, Polygon
from shapely import union_all

spec=importlib.util.spec_from_file_location('prepare_hazards',Path(__file__).resolve().parents[2]/'scripts/migrate/prepare-official-hazards.py')
hazards=importlib.util.module_from_spec(spec); spec.loader.exec_module(hazards)
import_spec=importlib.util.spec_from_file_location('import_hazards',Path(__file__).resolve().parents[2]/'scripts/migrate/import-official-hazards.py')
importer=importlib.util.module_from_spec(import_spec); import_spec.loader.exec_module(importer)

class OfficialHazardsTests(unittest.TestCase):
    def test_actual_prefectural_depth_labels(self):
        self.assertEqual(hazards.tsunami_depth('0.3m以上 ～ 0.5m未満'),(.3,.5))
        self.assertEqual(hazards.tsunami_depth('0.3m未満'),(0,.3))
        self.assertEqual(hazards.tsunami_depth('20m以上'),(20,None))
        with self.assertRaises(ValueError): hazards.tsunami_depth('不明')

    def test_flood_preserves_deep_interval(self):
        self.assertEqual(hazards.DEPTHS[5],(10,20))
        self.assertEqual(hazards.DEPTHS[6],(20,None))

    def test_subdivision_preserves_footprint_and_hole(self):
        from math import cos,sin,pi
        ring=[(139+.01*cos(i*2*pi/5000),35+.01*sin(i*2*pi/5000)) for i in range(5000)]
        hole=[(138.999,34.999),(139.001,34.999),(139.001,35.001),(138.999,35.001)]
        original=Polygon(ring,[hole]); rebuilt=union_all(list(hazards.subdivide(original)))
        self.assertLess(original.symmetric_difference(rebuilt).area,1e-12)
        self.assertFalse(rebuilt.covers(Point(139,35)))

    def test_sources_reject_untrusted_host(self):
        with self.assertRaises(ValueError): hazards.checked_url('https://example.com/source.zip')
        with self.assertRaises(ValueError): hazards.checked_url('http://nlftp.mlit.go.jp/source.zip')

    def test_resume_rejects_changed_classification_even_with_same_id(self):
        import json
        row={column:None for column in importer.ZONE_COLUMNS}
        row.update(id='same',risk_level=3,properties={'source_sha256':'same-archive'},geojson={'type':'Polygon','coordinates':[]})
        existing=dict(row,properties=json.dumps(row['properties']),geojson=json.dumps(row['geojson']))
        importer.verify_existing_zones([existing],{'same':row})
        existing['risk_level']=4
        with self.assertRaisesRegex(ValueError,'differs'): importer.verify_existing_zones([existing],{'same':row})

    def test_resume_rejects_different_coverage_content(self):
        row={column:None for column in importer.COVER_COLUMNS}
        row.update(id='same',source='official',geojson={'type':'Polygon','coordinates':[]})
        importer.verify_existing_coverage([dict(row,imported_at='new-date')],[row])
        with self.assertRaisesRegex(ValueError,'differs'):
            importer.verify_existing_coverage([dict(row,source='different')],[row])

if __name__=='__main__': unittest.main()
