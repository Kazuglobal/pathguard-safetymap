import importlib.util
import unittest
import csv
import json
import sqlite3
import tempfile
import sys
from unittest.mock import MagicMock, patch
from types import SimpleNamespace
from pathlib import Path
MODULE=Path(__file__).resolve().parents[2]/'scripts/accidents/build_snapshot.py'
spec=importlib.util.spec_from_file_location('snapshot',MODULE);snapshot=importlib.util.module_from_spec(spec);spec.loader.exec_module(snapshot)
CODEBOOK={'bicycle':['51','52'],'pedestrian':['61'],'classes':snapshot.CLASSES,'pedestrianClasses':['01']}
def junction(id,x=139.9,layer=0):
    return {'geometry':{'type':'Point','coordinates':[x,35.8]},'properties':{'id':id,'kind':'intersection','reviewed':True,'layer':layer}}
class SpatialAssignmentTest(unittest.TestCase):
    def test_unresolved_passage_blocks_road_and_intersection_assignment(self):
        passage={'geometry':{'type':'LineString','coordinates':[[139.9,35.7999],[139.9,35.8001]]},'properties':{'id':'steps','kind':'road','reviewed':False,'ambiguityOnly':True,'layer':0,'prefecture':'','municipality':''}}
        snapshot.validate_feature(passage)
        self.assertIsNone(snapshot.assign((139.9,35.8),[junction('a'),passage]))
        road=junction('road');road['properties']['kind']='road';road['geometry']=passage['geometry']
        self.assertIsNone(snapshot.assign((139.9,35.8),[road,passage]))
        passage['properties']['layer']=1
        self.assertIsNone(snapshot.assign((139.9,35.8),[junction('a'),passage]))
        passage['properties']['reviewed']=True
        self.assertRaises(ValueError,snapshot.validate_feature,passage)

    def test_road_area_blocks_inside_even_when_its_edges_are_far_away(self):
        area={'geometry':{'type':'Polygon','coordinates':[[[139.89,35.79],[139.91,35.79],[139.91,35.81],[139.89,35.81],[139.89,35.79]]]},'properties':{'id':'plaza','kind':'road','reviewed':False,'ambiguityOnly':True,'layer':0,'prefecture':'','municipality':''}}
        snapshot.validate_feature(area)
        self.assertEqual(snapshot.distance((139.9,35.8),area['geometry']),0)
        self.assertIsNone(snapshot.assign((139.9,35.8),[junction('a'),area]))
        artifact_root=MODULE.parents[2]/'artifacts';artifact_root.mkdir(exist_ok=True)
        root=Path(tempfile.mkdtemp(prefix='ambiguity-area-',dir=artifact_root))
        path=root/'area.json';path.write_text(json.dumps({'features':[area]}),encoding='utf-8')
        store=snapshot.SpatialStore(root/'index.sqlite')
        try:
            self.assertEqual(store.ingest(path,'candidate'),1)
            self.assertEqual(len(list(store.nearby((139.9,35.8),'candidate',.001))),1)
        finally:store.close()
    def test_malformed_ambiguity_areas_are_rejected(self):
        for ring in ([[139.89,35.79],[139.91,35.79],[139.91,35.81],[139.89,35.81]],[[139.89,35.79],[139.91,35.81],[139.91,35.79],[139.89,35.81],[139.89,35.79]]):
            area={'geometry':{'type':'Polygon','coordinates':[ring]},'properties':{'id':'bad-area','kind':'road','reviewed':False,'ambiguityOnly':True,'layer':0,'prefecture':'','municipality':''}}
            self.assertRaises(ValueError,snapshot.validate_feature,area)
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
        row={'source_year':'2024','source_prefecture_code':'44','prefecture_code':'12','police_station_code':'001','record_number':'1','party_a_type_code':'51','party_b_type_code':'52','occurred_at':'2024-10-01T07:00:00+09:00','fatalities':'0','accident_type_code':'21'}
        row['municipality_code']='12217'
        key,dimensions=snapshot.normalized(row,CODEBOOK);self.assertEqual(dimensions[2],1)
        row['source_year']='2023';self.assertRaises(ValueError,snapshot.normalized,row,CODEBOOK)
    def test_hokkaido_jurisdictions_preserve_record_identity(self):
        row={'source_year':'2024','source_prefecture_code':'10','prefecture_code':'01','municipality_code':'01101','police_station_code':'001','record_number':'1','party_a_type_code':'51','party_b_type_code':'51','occurred_at':'2024-10-01T07:00:00+09:00','fatalities':'0','accident_type_code':'21'}
        first,_=snapshot.normalized(row,CODEBOOK)
        second,_=snapshot.normalized(dict(row,source_prefecture_code='11'),CODEBOOK)
        self.assertNotEqual(first,second)
        self.assertEqual(first,snapshot.normalized(row,CODEBOOK)[0])
        row.pop('source_prefecture_code');self.assertRaises(KeyError,snapshot.normalized,row,CODEBOOK)
    def test_source_year_and_occurrence_year_are_distinct(self):
        row={'source_year':'2025','source_prefecture_code':'44','prefecture_code':'12','municipality_code':'12217','police_station_code':'001','record_number':'1','party_a_type_code':'51','party_b_type_code':'51','occurred_at':'2024-10-01T07:00:00+09:00','fatalities':'0','accident_type_code':'21'}
        key,dim=snapshot.normalized(row,CODEBOOK)
        self.assertEqual(key[0],2025);self.assertEqual(dim[0],2024)
        self.assertNotEqual(key,snapshot.normalized(dict(row,source_year='2024'),CODEBOOK)[0])
        self.assertRaises(ValueError,snapshot.normalized,dict(row,occurred_at='2024-10-01T07:00:00Z'),CODEBOOK)
        self.assertEqual(snapshot.normalized(dict(row,occurred_at=''),CODEBOOK)[1][0],-1)
    def test_polygon_hole_is_excluded(self):
        shape={'type':'Polygon','coordinates':[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[3,1],[3,3],[1,3],[1,1]]]}
        self.assertTrue(snapshot.contains((.5,.5),shape));self.assertFalse(snapshot.contains((2,2),shape))
class SnapshotBuildTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        (MODULE.parents[2]/'artifacts').mkdir(exist_ok=True)

    def test_road_sections_join_only_shared_same_grade_nodes_and_handle_loops(self):
        sys.path.insert(0,str(MODULE.parent))
        import prepare_locations
        root=Path(tempfile.mkdtemp(prefix='road-sections-',dir=MODULE.parents[2]/'artifacts'))
        topology=prepare_locations.DiskTopology(root)
        points={1:[139.9,35.8],2:[139.91,35.8],3:[139.92,35.8],4:[139.91,35.8],5:[139.91,35.81],6:[139.93,35.8],7:[139.95,35.8],8:[139.96,35.81],9:[139.96,35.8],10:[139.97,35.8],11:[139.98,35.8]}
        try:
            for identity,refs,extra in [(10,[1,2],{}),(11,[2,3],{}),(12,[4,5],{}),(13,[3,6],{'layer':'1','bridge':'yes'}),(14,[7,8,9],{}),(15,[9,7],{}),(16,[10,11],{}),(17,[10,11],{})]:
                topology.add_way(identity,refs,[points[node] for node in refs],{'highway':'residential','name':'試験道路',**extra})
            topology.db.execute('CREATE TABLE junctions(node INTEGER,grade TEXT,PRIMARY KEY(node,grade))')
            sections=list(topology.road_sections())
            self.assertEqual(len(sections),6)
            self.assertTrue(any(refs==[1,2,3] for _,_,_,refs in sections))
            self.assertTrue(any(refs==[4,5] for _,_,_,refs in sections))
            self.assertTrue(any(refs==[3,6] for _,_,_,refs in sections))
            self.assertTrue(any(refs[0]==refs[-1] and set(refs)=={7,8,9} for _,_,_,refs in sections))
            self.assertEqual(sum(refs==[10,11] for _,_,_,refs in sections),2)
            self.assertEqual(topology.db.execute('SELECT COUNT(*) FROM pieces WHERE section IS NOT NULL').fetchone()[0],8)
        finally:topology.close()

    def test_pbf_child_failure_and_space_guard_never_emit_candidates(self):
        sys.path.insert(0,str(MODULE.parent))
        import prepare_locations
        root=Path(tempfile.mkdtemp(prefix='pbf-failures-',dir=MODULE.parents[2]/'artifacts'))
        source=root/'dummy.pbf';source.write_bytes(b'unread-test-placeholder')
        for reason in ('failure','space'):
            child=MagicMock();child.poll.return_value=7 if reason=='failure' else None;child.returncode=7
            args=SimpleNamespace(osm=source,areas=root/'unused.geojson',work=root/reason,output=root/(reason+'.geojson'),bounds=None)
            original_guard=prepare_locations.require_space
            def guard(directory):
                if reason=='space' and (Path(directory)/'ingest.log').exists():raise RuntimeError('Simulated insufficient disk space')
                original_guard(directory)
            with patch.object(prepare_locations.subprocess,'Popen',return_value=child),patch.object(prepare_locations,'require_space',side_effect=guard):
                self.assertRaises(RuntimeError,prepare_locations.prepare_file,args)
            self.assertFalse(args.output.exists())
            self.assertTrue((Path(args.work)/'ingest.log').exists())
            with sqlite3.connect(Path(args.work)/'topology.sqlite') as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM ways').fetchone()[0],0)
            if reason=='space':child.terminate.assert_called_once();child.wait.assert_called_once()
            else:child.terminate.assert_not_called()

    def test_streamed_road_topology_preserves_shared_nodes_and_grade(self):
        sys.path.insert(0,str(MODULE.parent))
        import prepare_locations
        root=Path(tempfile.mkdtemp(prefix='road-topology-',dir=MODULE.parents[2]/'artifacts'))
        points={1:[139.9,35.8],2:[139.89,35.8],3:[139.91,35.8],4:[139.9,35.81],5:[139.9,35.8],6:[139.9,35.79],7:[139.9,35.82]}
        points.update({node:[139.9+node*.0001,35.805] for node in range(8,12)})
        points[12]=[139.9,35.815]
        elements=[{'type':'node','id':identity,'lon':point[0],'lat':point[1]} for identity,point in points.items()]
        elements += [{'type':'way','id':identity,'nodes':refs,'tags':{'highway':'residential',**tags}} for identity,refs,tags in [(10,[2,1,3],{}),(11,[1,4],{}),(12,[6,5,7],{}),(13,[1,7],{'bridge':'yes','layer':'1'})]]
        elements += [{'type':'way','id':20+node,'nodes':[1,node],'tags':{'highway':kind}} for node,kind in zip(range(8,12),('cycleway','pedestrian','footway','path'))]
        elements += [{'type':'way','id':identity,'nodes':refs,'tags':tags} for identity,refs,tags in [(40,[1,12],{'highway':'track'}),(41,[1,7],{'highway':'steps'}),(42,[1,4],{'highway':'experimental_path'}),(43,[1,2],{'highway':'construction'}),(44,[2,1,4,2],{'highway':'footway','area':'yes'})]]
        osm=root/'osm.json';osm.write_text(json.dumps({'elements':elements}),encoding='utf-8')
        area=root/'area.json';area.write_text(json.dumps({'features':[{'properties':{'prefecture':'12','prefectureName':'千葉県','municipality':'12217','municipalityName':'柏市'},'geometry':{'type':'Polygon','coordinates':[[[139.8,35.7],[140,35.7],[140,35.9],[139.8,35.9],[139.8,35.7]]]}}]}),encoding='utf-8')
        output=root/'locations.json'
        report=prepare_locations.prepare_file(SimpleNamespace(osm=osm,areas=area,work=root/'work',output=output,bounds=None))
        self.assertEqual(report['intersections'],1)
        self.assertEqual(report['ways'],9)
        self.assertEqual(report['ambiguityFeatures'],3)
        self.assertEqual(report['highwayScope'],sorted(snapshot.REQUIRED_HIGHWAYS))
        features=json.loads(output.read_text(encoding='utf-8'))['features']
        self.assertTrue(all(f['properties']['reviewed'] is False for f in features))
        self.assertEqual(len({f['properties']['id'] for f in features}),len(features))
        junctions=[f for f in features if f['properties']['kind']=='intersection']
        self.assertTrue(junctions[0]['properties']['id'].startswith('osm-node-1-'))
        self.assertFalse(report['completeCoverageReviewed'])
        # Native PBF and bounded extraction retain whole ways and the same shared-node graph.
        import osmium
        pbf=root/'roads.osm.pbf'
        with osmium.SimpleWriter(str(pbf)) as writer:
            for identity,point in points.items():writer.add_node(osmium.osm.mutable.Node(id=identity,location=point))
            for way in elements[len(points):]:writer.add_way(osmium.osm.mutable.Way(id=way['id'],nodes=way['nodes'],tags=way['tags']))
        bounded=root/'bounded.json'
        prepare_locations.prepare_file(SimpleNamespace(osm=pbf,areas=area,work=root/'pbf-work',output=bounded,bounds=[139.899,35.799,139.901,35.801]))
        self.assertEqual(features,json.loads(bounded.read_text(encoding='utf-8'))['features'])
        ambiguity=[f for f in features if f['properties'].get('ambiguityOnly')]
        self.assertEqual(len(ambiguity),3)
        self.assertTrue(any(f['geometry']['type']=='Polygon' for f in ambiguity))
        self.assertTrue(all(snapshot.validate_feature(f) for f in ambiguity))
        baseline=root/'baseline.json'
        prepare_locations.prepare_file(SimpleNamespace(osm=pbf,areas=area,work=root/'baseline-work',output=baseline,bounds=[139.899,35.799,139.901,35.801],vehicle_road_baseline=True))
        baseline_quality=json.loads(Path(str(baseline)+'.quality.json').read_text())
        self.assertEqual(baseline_quality['ways'],4)
        self.assertEqual(baseline_quality['highwayScope'],sorted(prepare_locations.VEHICLE_BASELINE))
        self.assertRaises(ValueError,snapshot.reviewed_highway_scope,baseline,{'highwayScope':baseline_quality['highwayScope'],'highwayScopeReviewed':True})

    def test_disk_boundary_index_holes_cache_and_duplicate_identity(self):
        output_root=MODULE.parents[2]/'artifacts';output_root.mkdir(exist_ok=True)
        root=Path(tempfile.mkdtemp(prefix='spatial-index-',dir=output_root))
        path=root/'areas.json'
        feature={'properties':{'municipality':'12217'},'geometry':{'type':'Polygon','coordinates':[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[3,1],[3,3],[1,3],[1,1]]]}}
        path.write_text(json.dumps({'features':[feature]}),encoding='utf-8')
        store=snapshot.SpatialStore(root/'spatial.sqlite')
        try:
            self.assertEqual(store.ingest(path,'boundary'),1)
            queries=[];store.db.set_trace_callback(queries.append)
            list(store.nearby((.5,.5),'boundary',identities_only=True))
            store.db.set_trace_callback(None)
            plan=store.db.execute('EXPLAIN QUERY PLAN '+queries[0]).fetchall()
            self.assertIn('SCAN b VIRTUAL TABLE',plan[0][3])
            self.assertIn('SEARCH f USING INTEGER PRIMARY KEY',plan[1][3])
            self.assertEqual(len(list(store.matching_boundaries((.5,.5)))),1)
            cached=next(iter(store.cache.values()))
            self.assertEqual(len(list(store.matching_boundaries((2,2)))),0)
            self.assertIs(next(iter(store.cache.values())),cached)
            self.assertEqual(len(list(store.matching_boundaries((5,5)))),0)
            self.assertRaises(ValueError,store.ingest,path,'boundary')
            self.assertLessEqual(store.cache_bytes,32*1024*1024)
        finally:store.close()

    def test_reconciliation_duplicates_and_unpublished_output(self):
        output_root=Path(__file__).resolve().parents[2]/'artifacts'
        output_root.mkdir(exist_ok=True)
        temp=tempfile.mkdtemp(prefix='accident-test-',dir=output_root)
        root=Path(temp);records=root/'records.csv';locations=root/'locations.json';areas=root/'areas.json';manifest=root/'manifest.json'
        row={'source_year':'2025','source_prefecture_code':'44','prefecture_code':'12','police_station_code':'001','record_number':'1','municipality_code':'12217','latitude':'35.8','longitude':'139.9','occurred_at':'2024-10-01T07:00:00+09:00','party_a_type_code':'51','party_b_type_code':'52','fatalities':'0','accident_type_code':'21'}
        with records.open('w',encoding='utf-8',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=row.keys());writer.writeheader();writer.writerow(row);writer.writerow(row)
            writer.writerow(dict(row,record_number='2',latitude='35.85'))
            writer.writerow(dict(row,record_number='3',latitude='0',longitude='0'))
            writer.writerow(dict(row,record_number='4',occurred_at='2017-10-01T07:00:00+09:00'))
            writer.writerow(dict(row,record_number='5',occurred_at=''))
            writer.writerow(dict(row,record_number='6',municipality_code='12218'))
        f=junction('a');f['properties'].update(prefecture='12',municipality='12217',name='試験地点',address='柏市')
        unused=junction('unused',140.5);unused['properties'].update(prefecture='12',municipality='12217',name='未使用地点',address='柏市')
        scope=sorted(snapshot.REQUIRED_HIGHWAYS)
        classification={'rankedHighways':scope,'ambiguityPolicy':snapshot.AMBIGUITY_POLICY,'excludedHighways':snapshot.ROAD_EXCLUSIONS}
        locations.write_text(json.dumps({'highwayScope':scope,'roadClassification':classification,'roadSourceSha256':'0'*64,'features':[f,unused]}),encoding='utf-8')
        areas.write_text(json.dumps({'features':[{'geometry':{'type':'Polygon','coordinates':[[[139.8,35.7],[140,35.7],[140,35.9],[139.8,35.9],[139.8,35.7]]]},'properties':{'prefecture':'12','prefectureName':'千葉県','municipality':'12217','municipalityName':'柏市'}}]}),encoding='utf-8')
        data={'version':'fixture-only','updatedAt':'2026-10-10','years':[2024],'sourceYears':[2025],'sources':[{'name':'試験用','url':'https://example.com','license':'test','retrievedAt':'2026-10-10'}],'codebooks':{'2025':CODEBOOK},'review':{'completeCoverage':True,'expectedUniqueRecords':6,'inputHashes':{k:snapshot.digest(p) for k,p in [('records',records),('locations',locations),('areas',areas)]}}}
        data['review'].update(highwayScope=scope,highwayScopeReviewed=True)
        data['review'].update(roadClassification=classification,roadClassificationReviewed=True,roadSourceSha256='0'*64)
        manifest.write_text(json.dumps(data),encoding='utf-8')
        args=SimpleNamespace(records=records,locations=locations,areas=areas,manifest=manifest,output=root/'result')
        snapshot.build(args)
        report=json.loads((root/'result/quality.json').read_text())
        self.assertEqual([report[k] for k in ['inputRows','uniqueRecords','duplicates','assigned','uncertain','excluded']],[7,6,1,1,2,3])
        self.assertEqual(report['administrativeCodeMismatch'],1)
        with sqlite3.connect(root/'result/snapshot.sqlite') as db:
            self.assertEqual(db.execute('SELECT published FROM accident_snapshots').fetchone()[0],0)
            self.assertEqual(db.execute('SELECT SUM(count) FROM accident_location_counts').fetchone()[0],1)
            self.assertEqual(db.execute('SELECT id FROM accident_locations').fetchall(),[('a',)])
            self.assertEqual(db.execute('SELECT SUM(assigned+uncertain+excluded) FROM accident_quality_counts').fetchone()[0],6)
            self.assertEqual(db.execute('SELECT year,participants FROM accident_location_counts').fetchone(),(2024,1))
            meta=json.loads(db.execute('SELECT metadata_json FROM accident_snapshots').fetchone()[0])
            self.assertEqual(meta['reconciliation']['outsidePeriod'],1)
            self.assertEqual(meta['reconciliation']['missingDate'],1)
            self.assertEqual(meta['highwayScope'],scope)
            self.assertEqual(meta['regionalCoverageExceptions'],[{'prefecture':'12','year':2024,'reason':'historical_region_check'},{'prefecture':'12','municipality':'12217','year':2024,'reason':'historical_region_check'}])
            # Quality stays under the original code; no silent administrative remapping.
            self.assertEqual(db.execute("SELECT uncertain FROM accident_quality_counts WHERE municipality='12218'").fetchone()[0],1)
        # Both codes can still exist while current geometry disagrees with source jurisdiction.
        area_data=json.loads(areas.read_text())
        other=json.loads(json.dumps(area_data['features'][0]));other['properties'].update(municipality='12218',municipalityName='別の市')
        other['geometry']['coordinates']=[[[140.1,35.7],[140.3,35.7],[140.3,35.9],[140.1,35.9],[140.1,35.7]]]
        area_data['features'].append(other);areas.write_text(json.dumps(area_data),encoding='utf-8')
        data['review']['inputHashes']['areas']=snapshot.digest(areas);manifest.write_text(json.dumps(data),encoding='utf-8')
        args.output=root/'existing-codes';snapshot.build(args)
        with sqlite3.connect(args.output/'snapshot.sqlite') as db:
            meta=json.loads(db.execute('SELECT metadata_json FROM accident_snapshots').fetchone()[0])
            self.assertEqual({e['municipality'] for e in meta['regionalCoverageExceptions']},{'12217','12218'})
        data['review']['completeCoverage']='true';manifest.write_text(json.dumps(data),encoding='utf-8')
        args.output=root/'invalid';self.assertRaises(ValueError,snapshot.build,args)
    def test_highway_scope_rejects_omissions_and_unreviewed_or_mismatched_scope(self):
        root=Path(tempfile.mkdtemp(prefix='highway-scope-',dir=MODULE.parents[2]/'artifacts'))
        locations=root/'locations.json';scope=sorted(snapshot.REQUIRED_HIGHWAYS)
        review={'highwayScope':scope,'highwayScopeReviewed':True}
        for omitted in scope:
            locations.write_text(json.dumps({'highwayScope':[v for v in scope if v!=omitted]}),encoding='utf-8')
            self.assertRaises(ValueError,snapshot.reviewed_highway_scope,locations,review)
        locations.write_text(json.dumps({'highwayScope':scope}),encoding='utf-8')
        for invalid in ({},dict(review,highwayScopeReviewed='true'),dict(review,highwayScope=scope[:-1])):
            self.assertRaises(ValueError,snapshot.reviewed_highway_scope,locations,invalid)
        self.assertEqual(snapshot.reviewed_highway_scope(locations,review),scope)
        classification={'rankedHighways':scope,'ambiguityPolicy':snapshot.AMBIGUITY_POLICY,'excludedHighways':snapshot.ROAD_EXCLUSIONS}
        source_hash='1'*64
        locations.write_text(json.dumps({'roadClassification':classification,'roadSourceSha256':source_hash}),encoding='utf-8')
        review={'roadClassification':classification,'roadSourceSha256':source_hash,'roadClassificationReviewed':True}
        self.assertEqual(snapshot.reviewed_road_classification(locations,review,scope),(classification,source_hash))
        for bad in ({},dict(review,roadSourceSha256='2'*64),dict(review,roadClassificationReviewed='true')):
            self.assertRaises(ValueError,snapshot.reviewed_road_classification,locations,bad,scope)
        locations.write_text(json.dumps({'roadClassification':dict(classification,ambiguityPolicy='omit_unknown'),'roadSourceSha256':source_hash}),encoding='utf-8')
        self.assertRaises(ValueError,snapshot.reviewed_road_classification,locations,review,scope)

    def test_dedicated_paths_share_junction_topology_without_connecting_bridges(self):
        sys.path.insert(0,str(MODULE.parent))
        import prepare_locations
        root=Path(tempfile.mkdtemp(prefix='dedicated-paths-',dir=MODULE.parents[2]/'artifacts'))
        topology=prepare_locations.DiskTopology(root)
        try:
            topology.add_way(1,[1,2,3],[[139.89,35.8],[139.9,35.8],[139.91,35.8]],{'highway':'residential'})
            for identity,kind in enumerate(('cycleway','pedestrian','footway','path'),4):
                topology.add_way(identity,[2,identity],[[139.9,35.8],[139.9,35.8+identity*.001]],{'highway':kind})
            topology.add_way(8,[2,8],[[139.9,35.8],[139.9,35.81]],{'highway':'footway','bridge':'yes','layer':'1'})
            degree=topology.db.execute('SELECT grade,COUNT(*) FROM edges WHERE node=2 GROUP BY grade').fetchall()
            self.assertEqual(sorted(n for _,n in degree),[1,6])
            self.assertEqual(topology.ways,6)
        finally:topology.close()
class SourceNormalizationTest(unittest.TestCase):
    def test_administrative_transform_preserves_hole_and_input_hash(self):
        sys.path.insert(0,str(MODULE.parent))
        import normalize_areas
        root=Path(tempfile.mkdtemp(prefix='area-normalize-',dir=MODULE.parents[2]/'artifacts'))
        source=root/'original.geojson'
        shape={'type':'Polygon','coordinates':[[[139.8,35.7],[140,35.7],[140,35.9],[139.8,35.9],[139.8,35.7]],[[139.85,35.75],[139.9,35.75],[139.9,35.8],[139.85,35.8],[139.85,35.75]]]}
        source.write_text(json.dumps({'features':[{'properties':{'N03_007':'12217','N03_001':'千葉県','N03_004':'柏市','N03_005':None},'geometry':shape}]}),encoding='utf-8')
        args=SimpleNamespace(input=source,output=root/'normalized.geojson',work=root/'staging.sqlite',input_sha256=snapshot.digest(source),expected_regions=1)
        report=normalize_areas.normalize(args)
        self.assertEqual((report['regions'],report['outputHoles']),(1,1))
        self.assertFalse(report['completeCoverageReviewed'])
        args.output=root/'bad.geojson';args.work=root/'bad.sqlite';args.input_sha256='0'*64
        self.assertRaises(ValueError,normalize_areas.normalize,args)
        self.assertFalse(args.output.exists())

    def test_reviewed_2025_definition_retains_earlier_occurrence_and_source_identity(self):
        module_path=MODULE.parent/'normalize_npa.py'
        spec=importlib.util.spec_from_file_location('normalizer',module_path)
        normalizer=importlib.util.module_from_spec(spec);spec.loader.exec_module(normalizer)
        definition=json.loads((MODULE.parent/'definitions/2025.json').read_text(encoding='utf-8'))
        self.assertEqual(set(definition['prefectureMap'].values()),{str(n).zfill(2) for n in range(1,48)})
        definition.pop('originalSha256')
        root=Path(tempfile.mkdtemp(prefix='npa-normalize-',dir=MODULE.parents[2]/'artifacts'))
        original=root/'original.csv';definition_path=root/'definition.json';result=root/'normalized.csv'
        values={'record_type':'1','prefecture':'44','station':'001','number':'0001','municipality':'217','latitude':'355915456','longitude':'1395915456','year':'2024','month':'10','day':'01','hour':'07','minute':'00','party_a':'51','party_b':'52','fatalities':'0','accident_class':'21'}
        with original.open('w',encoding='cp932',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=definition['columns'].values());writer.writeheader();writer.writerow({definition['columns'][k]:v for k,v in values.items()})
            writer.writerow({definition['columns'][k]:v for k,v in dict(values,number='0002',year='').items()})
            writer.writerow({definition['columns'][k]:v for k,v in dict(values,number='0003',year='2017').items()})
        definition_path.write_text(json.dumps(definition),encoding='utf-8')
        normalizer.normalize(SimpleNamespace(input=original,definition=definition_path,output=result,encoding='cp932'))
        with result.open(encoding='utf-8',newline='') as f:row,missing,earlier=list(csv.DictReader(f))
        self.assertEqual(snapshot.normalized(earlier,CODEBOOK)[1][0],2017)
        self.assertEqual(missing['occurred_at'],'')
        self.assertEqual(snapshot.normalized(missing,CODEBOOK)[1][0],-1)
        self.assertEqual(row['source_year'],'2025');self.assertTrue(row['occurred_at'].startswith('2024-10-01'))
        self.assertEqual((row['source_prefecture_code'],row['prefecture_code'],row['municipality_code']),('44','12','12217'))
        self.assertAlmostEqual(float(row['latitude']),35+59/60+15.456/3600)
        self.assertRaises(ValueError,normalizer.coordinate,'356015456','dms')
        self.assertEqual(normalizer.coordinate('0','dms'),0)
if __name__=='__main__':unittest.main()
