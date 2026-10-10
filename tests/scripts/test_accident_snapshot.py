import importlib.util
import unittest
import csv
import json
import sqlite3
import tempfile
from types import SimpleNamespace
from pathlib import Path
MODULE=Path(__file__).resolve().parents[2]/'scripts/accidents/build_snapshot.py'
spec=importlib.util.spec_from_file_location('snapshot',MODULE);snapshot=importlib.util.module_from_spec(spec);spec.loader.exec_module(snapshot)
CODEBOOK={'bicycle':['51','52'],'pedestrian':['61'],'classes':snapshot.CLASSES,'pedestrianClasses':['01']}
def junction(id,x=139.9,layer=0):
    return {'geometry':{'type':'Point','coordinates':[x,35.8]},'properties':{'id':id,'kind':'intersection','reviewed':True,'layer':layer}}
class SpatialAssignmentTest(unittest.TestCase):
    def test_nearby_intersections_are_not_merged(self):
        self.assertIsNone(snapshot.assign((139.9,35.8),[junction('a'),junction('b',139.9001)]))
    def test_grade_separation_is_uncertain(self):
        self.assertIsNone(snapshot.assign((139.9,35.8),[junction('a'),junction('b',layer=1)]))
    def test_single_elevated_road_is_not_guessed(self):
        self.assertIsNone(snapshot.assign((139.9,35.8),[junction('bridge',layer=1)]))
    def test_radius_is_explicit(self):
        self.assertIsNone(snapshot.assign((139.9003,35.8),[junction('a')],10))
        self.assertEqual(snapshot.assign((139.9003,35.8),[junction('a')],30),'a')
    def test_unreviewed_geometry_is_not_assigned(self):
        f=junction('a');f['properties']['reviewed']=False
        self.assertIsNone(snapshot.assign((139.9,35.8),[f]))
    def test_bicycle_both_parties_is_one_flag(self):
        row={'source_year':'2024','prefecture_code':'12','police_station_code':'001','record_number':'1','party_a_type_code':'51','party_b_type_code':'52','occurred_at':'2024-10-01T07:00:00+09:00','fatalities':'0','accident_type_code':'21'}
        row['municipality_code']='12217'
        key,dimensions=snapshot.normalized(row,CODEBOOK);self.assertEqual(dimensions[2],1)
        row['source_year']='2023';self.assertRaises(ValueError,snapshot.normalized,row,CODEBOOK)
    def test_polygon_hole_is_excluded(self):
        shape={'type':'Polygon','coordinates':[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[3,1],[3,3],[1,3],[1,1]]]}
        self.assertTrue(snapshot.contains((.5,.5),shape));self.assertFalse(snapshot.contains((2,2),shape))
class SnapshotBuildTest(unittest.TestCase):
    def test_reconciliation_duplicates_and_unpublished_output(self):
        output_root=Path(__file__).resolve().parents[2]/'artifacts'
        output_root.mkdir(exist_ok=True)
        temp=tempfile.mkdtemp(prefix='accident-test-',dir=output_root)
        root=Path(temp);records=root/'records.csv';locations=root/'locations.json';areas=root/'areas.json';manifest=root/'manifest.json'
        row={'source_year':'2024','prefecture_code':'12','police_station_code':'001','record_number':'1','municipality_code':'12217','latitude':'35.8','longitude':'139.9','occurred_at':'2024-10-01T07:00:00+09:00','party_a_type_code':'51','party_b_type_code':'52','fatalities':'0','accident_type_code':'21'}
        with records.open('w',encoding='utf-8',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=row.keys());writer.writeheader();writer.writerow(row);writer.writerow(row)
            writer.writerow(dict(row,record_number='2',latitude='35.85'))
            writer.writerow(dict(row,record_number='3',latitude='0',longitude='0'))
        f=junction('a');f['properties'].update(prefecture='12',municipality='12217',name='試験地点',address='柏市')
        locations.write_text(json.dumps({'features':[f]}),encoding='utf-8')
        areas.write_text(json.dumps({'features':[{'geometry':{'type':'Polygon','coordinates':[[[139.8,35.7],[140,35.7],[140,35.9],[139.8,35.9],[139.8,35.7]]]},'properties':{'prefecture':'12','prefectureName':'千葉県','municipality':'12217','municipalityName':'柏市'}}]}),encoding='utf-8')
        data={'version':'fixture-only','updatedAt':'2026-10-10','years':[2024],'sources':[{'name':'試験用','url':'https://example.com','license':'test','retrievedAt':'2026-10-10'}],'codebooks':{'2024':CODEBOOK},'review':{'completeCoverage':True,'expectedUniqueRecords':3,'inputHashes':{k:snapshot.digest(p) for k,p in [('records',records),('locations',locations),('areas',areas)]}}}
        manifest.write_text(json.dumps(data),encoding='utf-8')
        args=SimpleNamespace(records=records,locations=locations,areas=areas,manifest=manifest,output=root/'result')
        snapshot.build(args)
        report=json.loads((root/'result/quality.json').read_text())
        self.assertEqual([report[k] for k in ['inputRows','uniqueRecords','duplicates','assigned','uncertain','excluded']],[4,3,1,1,1,1])
        with sqlite3.connect(root/'result/snapshot.sqlite') as db:
            self.assertEqual(db.execute('SELECT published FROM accident_snapshots').fetchone()[0],0)
            self.assertEqual(db.execute('SELECT SUM(count) FROM accident_location_counts').fetchone()[0],1)
            self.assertEqual(db.execute('SELECT SUM(assigned+uncertain+excluded) FROM accident_quality_counts').fetchone()[0],3)
        data['review']['completeCoverage']='true';manifest.write_text(json.dumps(data),encoding='utf-8')
        args.output=root/'invalid';self.assertRaises(ValueError,snapshot.build,args)
if __name__=='__main__':unittest.main()
