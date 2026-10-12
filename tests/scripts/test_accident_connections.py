"""Exact source references, provenance, complete coverage and readonly recovery."""
import copy
import json
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/accidents'))
import diagnose_connections
import prepare_locations
from build_snapshot import digest


class ConnectionAuditTests(unittest.TestCase):
    def setUp(self):
        artifact_root = ROOT / 'artifacts'
        artifact_root.mkdir(exist_ok=True)
        self.root = Path(tempfile.mkdtemp(prefix='connection-audit-', dir=artifact_root))
        nodes = [{'type': 'node', 'id': i, 'lon': x, 'lat': y} for i, x, y in
                 [(1, 139.9, 35.8), (2, 139.901, 35.8), (3, 139.899, 35.8), (4, 139.9, 35.801), (5, 139.91, 35.81), (6, 139.911, 35.81)]]
        ways = [{'type': 'way', 'id': i, 'nodes': refs, 'tags': {'highway': kind}} for i, refs, kind in
                [(10, [1, 2], 'residential'), (11, [1, 3], 'residential'), (12, [1, 4], 'residential'), (13, [5, 6], 'steps')]]
        osm = self.root / 'osm.json'
        osm.write_text(json.dumps({'elements': nodes + ways}), encoding='utf-8')
        area = self.root / 'areas.json'
        area.write_text(json.dumps({'features': [{'type': 'Feature', 'geometry': {'type': 'Polygon', 'coordinates':
            [[[139.8, 35.7], [140, 35.7], [140, 35.9], [139.8, 35.9], [139.8, 35.7]]]}, 'properties':
            {'prefecture': '12', 'prefectureName': '千葉県', 'municipality': '12217', 'municipalityName': '柏市'}}]}), encoding='utf-8')
        self.candidates = self.root / 'candidates.geojson'
        self.topology = self.root / 'work/topology.sqlite'
        prepare_locations.prepare_file(SimpleNamespace(osm=osm, areas=area, work=self.root / 'work', output=self.candidates, bounds=None))
        self.collection = json.loads(self.candidates.read_text(encoding='utf-8'))

    def run_audit(self, name='audit', topology=None, source=None):
        return diagnose_connections.audit(SimpleNamespace(topology=topology or self.topology,
            source_topology=source, candidates=self.candidates, output=self.root / (name + '.json')))

    def replace_features(self, features):
        collection = copy.deepcopy(self.collection)
        collection['features'] = features
        self.candidates.write_text(json.dumps(collection), encoding='utf-8')

    def test_full_evidence_and_readonly_attached_source(self):
        inputs = {str(p): digest(p) for p in (self.topology, self.candidates)}
        report = self.run_audit()
        self.assertEqual(report['sourceCounts'], {'junctions': 1, 'sections': 3, 'ambiguityWays': 1})
        self.assertEqual(report['connectionIndex']['rows'], 5)
        self.assertFalse(report['reviewed'])
        self.assertFalse(report['published'])
        for p, sha in inputs.items():
            self.assertEqual(digest(p), sha)
        self.assertRaises(ValueError, self.run_audit)
        recovered = self.root / 'recovered.sqlite'
        with closing(sqlite3.connect(recovered, uri=True)) as db:
            db.execute('ATTACH DATABASE ? AS original', (self.topology.resolve().as_uri() + '?mode=ro',))
            for table in ('junctions', 'pieces'):
                db.execute('CREATE TABLE ' + table + ' AS SELECT * FROM original.' + table)
            db.commit()
        second = self.run_audit('attached', topology=recovered, source=self.topology)
        self.assertEqual(second['counts'], report['counts'])
        self.assertEqual(digest(self.topology), inputs[str(self.topology)])

    def test_same_coordinates_cannot_substitute_source_nodes(self):
        for kind, key, value in [('intersection', 'osmNodeId', '999'), ('road', 'endpointNodeIds', ['999', '998'])]:
            features = copy.deepcopy(self.collection['features'])
            next(f for f in features if f['properties']['kind'] == kind and not f['properties'].get('ambiguityOnly'))['properties'][key] = value
            self.replace_features(features)
            self.assertRaises(ValueError, self.run_audit, kind)
            self.assertFalse((self.root / (kind + '.json')).exists())

    def test_geometry_ambiguity_and_coverage_tampering_fail(self):
        for label in ('road', 'ambiguity', 'missing_junction'):
            features = copy.deepcopy(self.collection['features'])
            if label == 'missing_junction':
                features = [f for f in features if f['properties']['kind'] != 'intersection']
            else:
                target = next(f for f in features if f['properties']['kind'] == 'road' and
                              bool(f['properties'].get('ambiguityOnly')) == (label == 'ambiguity'))
                target['geometry']['coordinates'][0][0] += 0.00001
            self.replace_features(features)
            self.assertRaises(ValueError, self.run_audit, label)
            self.assertFalse((self.root / (label + '.json')).exists())

    def test_provenance_and_review_flags_cannot_be_approved_by_audit(self):
        quality_path = Path(str(self.candidates) + '.quality.json')
        original = json.loads(quality_path.read_text(encoding='utf-8'))
        for key, value in [('roadSourceSha256', 'f' * 64), ('sourceRoadPieces', 999), ('reviewedLocations', 1)]:
            quality = dict(original, **{key: value})
            quality_path.write_text(json.dumps(quality), encoding='utf-8')
            self.assertRaises(ValueError, self.run_audit, key)
            self.assertFalse((self.root / (key + '.json')).exists())
        quality_path.write_text(json.dumps(original), encoding='utf-8')
        features = copy.deepcopy(self.collection['features'])
        features[0]['properties']['reviewed'] = True
        self.replace_features(features)
        self.assertRaises(ValueError, self.run_audit, 'reviewed_feature')
        self.assertFalse((self.root / 'reviewed_feature.json').exists())

    def test_capacity_drop_preserves_source_and_partial_evidence(self):
        source_hash = digest(self.topology)
        with patch.object(diagnose_connections.shutil, 'disk_usage', side_effect=[
                SimpleNamespace(free=10 * 1024**3), SimpleNamespace(free=0)]):
            self.assertRaises(RuntimeError, self.run_audit, 'capacity')
        self.assertEqual(digest(self.topology), source_hash)
        self.assertFalse((self.root / 'capacity.json').exists())
        self.assertTrue((self.root / 'capacity.connections.sqlite').exists())


if __name__ == '__main__':
    unittest.main()
