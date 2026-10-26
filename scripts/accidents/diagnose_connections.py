"""Read-only source connection audit; never approves geometry or publication."""
import argparse
import hashlib
import json
import re
import shutil
import sqlite3
from contextlib import closing
from pathlib import Path

from build_snapshot import digest, stream_features, validate_feature
from recover_connections import section_references


def require(condition, message):
    if not condition:
        raise ValueError(message)


def require_space(directory):
    if shutil.disk_usage(directory).free < 5 * 1024**3:
        raise RuntimeError('Capacity reserve exhausted; preserve all inputs and evidence')


def audit(args):
    topology = Path(args.topology).resolve()
    original = Path(args.source_topology or args.topology).resolve()
    candidates = Path(args.candidates)
    quality_path = Path(str(candidates) + '.quality.json')
    output = Path(args.output)
    index = output.with_suffix('.connections.sqlite')
    require(not output.exists() and not index.exists(), 'Preserve existing connection evidence')
    quality = json.loads(quality_path.read_text(encoding='utf-8'))
    require(quality['reviewedLocations'] == 0 and quality['completeCoverageReviewed'] is False,
            'This audit requires unreviewed completed extraction')
    require_space(output.parent)
    paths = {'topology': topology, 'sourceTopology': original, 'candidates': candidates, 'quality': quality_path}
    inputs = {key: digest(path) for key, path in paths.items()}
    counts = dict(features=0, intersections=0, roadSections=0, ambiguityFeatures=0)
    source_counts = dict(junctions=0, sections=0, ambiguityWays=0)
    with closing(sqlite3.connect(topology.as_uri() + '?mode=ro', uri=True)) as db, closing(sqlite3.connect(index)) as evidence:
        db.execute('PRAGMA cache_size=-8192')
        db.execute('PRAGMA temp_store=FILE')
        if original != topology:
            db.execute('ATTACH DATABASE ? AS original', (original.as_uri() + '?mode=ro',))
            for table in ('nodes', 'edges', 'ambiguity_ways', 'extraction_metadata'):
                db.execute('CREATE TEMP VIEW ' + table + ' AS SELECT * FROM original.' + table)
        db.execute('PRAGMA query_only=ON')
        metadata = dict(db.execute('SELECT key,value FROM extraction_metadata'))
        require(json.loads(metadata['roadSourceSha256']) == quality['roadSourceSha256'], 'Source provenance differs')
        evidence.execute('PRAGMA cache_size=-8192')
        evidence.executescript('''CREATE TABLE seeds(section TEXT PRIMARY KEY,seed TEXT,pieces INTEGER,used INTEGER DEFAULT 0) WITHOUT ROWID;
            CREATE TABLE connections(id TEXT PRIMARY KEY,kind TEXT,grade TEXT,source_nodes TEXT,geometry_sha256 TEXT) WITHOUT ROWID;''')
        # GROUP BY can sort millions of pieces before yielding its first row.
        db.set_progress_handler(lambda: int(shutil.disk_usage(output.parent).free < 5 * 1024**3), 100000)
        try:
            for number, (section, seed, pieces) in enumerate(db.execute('SELECT section,MIN(id),COUNT(*) FROM pieces GROUP BY section'), 1):
                require(bool(section and seed and pieces > 0), 'Incomplete source section assignments')
                evidence.execute('INSERT INTO seeds(section,seed,pieces) VALUES(?,?,?)', (section, seed, pieces))
                if number % 5000 == 0:
                    evidence.commit()
                    require_space(output.parent)
        except sqlite3.OperationalError:
            require_space(output.parent)
            raise
        finally:
            db.set_progress_handler(None, 0)
        evidence.commit()
        require_space(output.parent)
        for feature in stream_features(candidates):
            validate_feature(feature)
            p = feature['properties']
            require(p['reviewed'] is False, 'Candidate flags must remain unreviewed')
            identity = p['id']
            category = 'ambiguityFeatures' if p.get('ambiguityOnly') else 'intersections' if p['kind'] == 'intersection' else 'roadSections'
            counts['features'] += 1
            counts[category] += 1
            nodes = None
            if identity.startswith('osm-ambiguity-'):
                source_counts['ambiguityWays'] += 1
                require(p.get('ambiguityOnly') is True, 'Source ambiguity must be retained')
                match = re.fullmatch(r'osm-ambiguity-([1-9][0-9]*)', identity)
                require(match is not None, 'Invalid source ambiguity identity')
                row = db.execute('SELECT grade,geometry FROM ambiguity_ways WHERE id=?', (int(match[1]),)).fetchone()
                require(row is not None and feature['geometry'] == json.loads(row[1]), 'Ambiguity geometry differs from source')
                grade = row[0]
            elif p['kind'] == 'intersection':
                source_counts['junctions'] += 1
                match = re.fullmatch(r'osm-node-([1-9][0-9]*)-([a-f0-9]{12})', identity)
                require(match is not None, 'Invalid source intersection identity')
                node, suffix = match.groups()
                grades = [r[0] for r in db.execute('SELECT grade FROM junctions WHERE node=?', (int(node),))
                          if hashlib.sha256(r[0].encode()).hexdigest()[:12] == suffix]
                require(len(grades) == 1 and p.get('osmNodeId') == node, 'Intersection source node differs')
                grade = grades[0]
                row = db.execute('SELECT x,y FROM nodes WHERE id=?', (int(node),)).fetchone()
                require(row is not None and feature['geometry']['coordinates'] == list(row), 'Intersection coordinates differ')
                nodes = [node]
            else:
                source_counts['sections'] += 1
                seed = evidence.execute('SELECT seed,pieces,used FROM seeds WHERE section=?', (identity,)).fetchone()
                require(seed is not None and seed[2] == 0, 'Missing or repeated source section')
                grade, refs = section_references(db, seed[0], identity, seed[1])
                coords = []
                for node in refs:
                    row = db.execute('SELECT x,y FROM nodes WHERE id=?', (node,)).fetchone()
                    require(row is not None, 'Missing source coordinate')
                    coords.append(list(row))
                require(feature['geometry']['coordinates'] == coords, 'Road coordinates differ from source')
                nodes = [str(refs[0]), str(refs[-1])]
                if not p.get('ambiguityOnly'):
                    require(p.get('endpointNodeIds') == nodes, 'Road endpoint source nodes differ')
                evidence.execute('UPDATE seeds SET used=1 WHERE section=?', (identity,))
            require(p['layer'] == '_'.join(json.loads(grade)), 'Source grade differs')
            geometry_hash = hashlib.sha256(json.dumps(feature['geometry'], sort_keys=True, separators=(',', ':')).encode()).hexdigest()
            evidence.execute('INSERT INTO connections VALUES(?,?,?,?,?)', (identity, p['kind'], grade, json.dumps(nodes), geometry_hash))
            if counts['features'] % 5000 == 0:
                evidence.commit()
                require_space(output.parent)
        evidence.commit()
        require(evidence.execute('SELECT COUNT(*) FROM seeds WHERE used=0').fetchone()[0] == 0, 'Unconsumed source sections')
        require(source_counts['junctions'] == db.execute('SELECT COUNT(*) FROM junctions').fetchone()[0], 'Source junction total differs')
        require(source_counts['ambiguityWays'] == db.execute('SELECT COUNT(*) FROM ambiguity_ways').fetchone()[0], 'Source ambiguity total differs')
        require(evidence.execute('SELECT COALESCE(SUM(pieces),0) FROM seeds').fetchone()[0] == quality['sourceRoadPieces'], 'Source piece total differs')
        require(evidence.execute('SELECT COUNT(*) FROM connections').fetchone()[0] == counts['features'], 'Evidence total differs')
    for category in ('intersections', 'roadSections', 'ambiguityFeatures'):
        require(counts[category] == quality[category], 'Extraction category total differs: ' + category)
    require(all(digest(path) == inputs[key] for key, path in paths.items()), 'Audit input changed during execution')
    report = {'counts': counts, 'sourceCounts': source_counts, 'sourceRoadPieces': quality['sourceRoadPieces'], 'inputHashes': inputs,
              'connectionIndex': {'path': str(index), 'sha256': digest(index), 'rows': counts['features']},
              'auditScriptSha256': digest(__file__), 'connectionCodeSha256': digest(Path(__file__).with_name('recover_connections.py')),
              'limitations': ['Source-node agreement does not approve physical intersections, historical roads or publication.'],
              'completed': True, 'reviewed': False, 'published': False}
    with output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--topology', required=True)
    parser.add_argument('--source-topology')
    parser.add_argument('--candidates', required=True)
    parser.add_argument('--output', required=True)
    print(json.dumps(audit(parser.parse_args())), flush=True)
