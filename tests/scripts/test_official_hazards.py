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
        self.assertEqual(hazards.tsunami_depth('～0.3m'),(0,.3))
        self.assertEqual(hazards.tsunami_depth('5m～'),(5,None))
        self.assertEqual(hazards.tsunami_depth('0.3～0.5m'),(.3,.5))
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

    def _prepare_flood(self, folder, rings):
        import json,zipfile
        root=Path(folder); (root/'raw').mkdir()
        entry=dict(id='A31b-25_20_5339_GEOJSON',kind='flood',year=25,region='5339',filename='t.zip',
                   size='0MB',url='https://nlftp.mlit.go.jp/x.zip',page='https://nlftp.mlit.go.jp/p.html',license='CC-BY-4.0')
        features=[dict(type='Feature',properties={'A31b_201':2},geometry=dict(type='Polygon',coordinates=[ring])) for ring in rings]
        body=json.dumps(dict(type='FeatureCollection',crs={'type':'name','properties':{'name':'urn:ogc:def:crs:EPSG::6668'}},features=features))
        with zipfile.ZipFile(root/'raw'/'t.zip','w') as z: z.writestr('A31b-20-25_20_5339.geojson',body)
        hazards.prepare(entry,root)
        return json.loads((root/'prepared'/entry['id']/'receipt.json').read_text(encoding='utf-8'))

    def test_zero_area_source_ring_is_dropped_and_counted(self):
        import tempfile
        valid=[[139,35],[139.001,35],[139.001,35.001],[139,35.001],[139,35]]
        degenerate=[[139.01,35.01],[139.02,35.01],[139.01,35.01],[139.01,35.01]]
        with tempfile.TemporaryDirectory() as folder:
            receipt=self._prepare_flood(folder,[valid,degenerate])
        self.assertEqual(receipt['degenerateFeaturesDropped'],1)
        self.assertEqual(receipt['sourceFeatures'],1)

    def test_area_changing_repair_still_stops(self):
        import tempfile
        bowtie=[[139,35],[139.001,35.001],[139.001,35],[139,35.001],[139,35]]
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError,'changes area'): self._prepare_flood(folder,[bowtie])

grid_spec=importlib.util.spec_from_file_location('build_hazard_grid',Path(__file__).resolve().parents[2]/'scripts/migrate/build-hazard-grid.py')
grid=importlib.util.module_from_spec(grid_spec); grid_spec.loader.exec_module(grid)
upload_spec=importlib.util.spec_from_file_location('upload_hazard_grid',Path(__file__).resolve().parents[2]/'scripts/migrate/upload-hazard-grid.py')
uploader=importlib.util.module_from_spec(upload_spec); upload_spec.loader.exec_module(uploader)

class HazardGridTests(unittest.TestCase):
    def test_cell_pieces_rebuild_the_polygon_exactly(self):
        from shapely.geometry import box
        original=Polygon([(139.005,35.005),(139.025,35.005),(139.025,35.018),(139.005,35.018)],
                         [[(139.009,35.009),(139.012,35.009),(139.012,35.012),(139.009,35.012)]])
        pieces=list(grid.clip_to_cells(original))
        self.assertEqual({(y,x) for y,x,_ in pieces},{(y,x) for y in (3500,3501) for x in (13900,13901,13902)})
        for y,x,part in pieces:
            self.assertTrue(part.is_valid)
            self.assertTrue(grid.cell_box(y,x).buffer(1e-12).covers(part))
        rebuilt=union_all([part for _,_,part in pieces])
        self.assertLess(original.symmetric_difference(rebuilt).area,1e-14)
        self.assertFalse(rebuilt.covers(Point(139.0105,35.0105)))

    def test_single_cell_polygon_is_kept_unchanged(self):
        inner=Polygon([(139.001,35.001),(139.002,35.001),(139.002,35.002)])
        self.assertEqual([(y,x,part.wkt) for y,x,part in grid.clip_to_cells(inner)],[(3500,13900,inner.wkt)])

    def test_cell_layout_matches_the_runtime_reader(self):
        import re
        runtime=(Path(__file__).resolve().parents[2]/'lib/hazard-grid.ts').read_text(encoding='utf-8')
        self.assertEqual(int(re.search(r'HAZARD_GRID_CELLS_PER_DEGREE = (\d+)',runtime)[1]),grid.CELLS_PER_DEGREE)
        self.assertEqual(int(re.search(r'HAZARD_GRID_SCHEMA_VERSION = (\d+)',runtime)[1]),grid.SCHEMA_VERSION)
        self.assertEqual(grid.object_key('tsunami',3964,14195),'hazard-grid/v1/tsunami/3964/14195.json')

    def test_upload_rejects_keys_outside_the_grid_prefix(self):
        import json,tempfile
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            (root/'manifest.json').write_text(json.dumps(dict(keyPrefix='hazard-grid/v1',objectCount=1)),encoding='utf-8')
            (root/'objects.json').write_text(json.dumps([dict(key='hazard-grid/v1/../media/x.json',bytes=0,md5='')]),encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'outside'): uploader.load_objects(root)

    def test_upload_refuses_partial_or_shrinking_grids(self):
        new=dict(complete=True,cellsPerDegree=100,sources=[dict(id='a'),dict(id='b')])
        uploader.check_publishable(new,dict(cellsPerDegree=100,sources=[dict(id='a')]))
        with self.assertRaisesRegex(ValueError,'subset'): uploader.check_publishable(dict(new,complete=False),None)
        with self.assertRaisesRegex(ValueError,'lacks'):
            uploader.check_publishable(new,dict(cellsPerDegree=100,sources=[dict(id='a'),dict(id='c')]))
        with self.assertRaisesRegex(ValueError,'cell size'):
            uploader.check_publishable(new,dict(cellsPerDegree=50,sources=[]))

if __name__=='__main__': unittest.main()
