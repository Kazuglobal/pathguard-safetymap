"""Diagnostic only. Reads completed extraction; never changes candidate flags."""
import argparse
import json
import shutil
import sqlite3
from collections import Counter, OrderedDict, defaultdict
from contextlib import closing
from pathlib import Path

from build_snapshot import digest, stream_features, validate_feature
from shapely.geometry import shape


def audit(args):
    source = Path(args.candidates)
    quality_path = Path(str(source) + '.quality.json')
    quality = json.loads(quality_path.read_text(encoding='utf-8'))
    output = Path(args.output)
    if output.exists():
        raise ValueError('Preserve existing diagnostic outputs')
    if shutil.disk_usage(output.parent).free < 5 * 1024**3:
        raise RuntimeError('Less than 5 GiB free')
    boundary_path = Path(args.boundaries).resolve()
    counts = Counter()
    findings = Counter()
    samples = defaultdict(list)
    index_path = output.with_suffix('.identities.sqlite')
    if index_path.exists():
        raise ValueError('Preserve existing diagnostic identity index')
    with closing(sqlite3.connect(index_path)) as ids, closing(sqlite3.connect(boundary_path.as_uri() + '?mode=ro', uri=True)) as boundaries:
        boundaries.execute('PRAGMA query_only=ON')
        boundaries.execute('PRAGMA cache_size=-8192')
        ids.execute('PRAGMA cache_size=-8192')
        ids.execute('CREATE TABLE identities(id TEXT PRIMARY KEY) WITHOUT ROWID')
        ids.execute('CREATE TABLE findings(feature_number INTEGER, identity TEXT, reason TEXT, PRIMARY KEY(feature_number,reason)) WITHOUT ROWID')

        cache = OrderedDict()
        cache_bytes = 0

        def area(code):
            nonlocal cache_bytes
            cached = cache.pop(code, None)
            if cached is not None:
                cache[code] = cached
                return cached[0]
            row = boundaries.execute("SELECT body FROM features WHERE kind='boundary' AND identity=?", (code,)).fetchone()
            if row is None:
                return None
            geometry = shape(json.loads(row[0])['geometry'])
            estimated_bytes = len(geometry.wkb) * 4
            if estimated_bytes > 32 * 1024**2:
                raise RuntimeError('Boundary exceeds geometry cache budget; subdivide and review')
            cache[code] = (geometry, estimated_bytes)
            cache_bytes += estimated_bytes
            while len(cache) > 16 or cache_bytes > 32 * 1024**2:
                _, evicted = cache.popitem(last=False)
                cache_bytes -= evicted[1]
            return geometry

        def note(reason, identity):
            ids.execute('INSERT INTO findings VALUES(?,?,?)', (feature_number, identity, reason))
            findings[reason] += 1
            if len(samples[reason]) < 10:
                samples[reason].append(identity)

        for feature in stream_features(source):
            feature_number = counts['features'] + 1
            validate_feature(feature)
            props = feature['properties']
            identity = props['id']
            try:
                ids.execute('INSERT INTO identities VALUES(?)', (identity,))
            except sqlite3.IntegrityError:
                note('duplicate_identity', identity)
            category = 'ambiguityFeatures' if props.get('ambiguityOnly') else 'intersections' if props['kind'] == 'intersection' else 'roadSections'
            counts[category] += 1
            counts['features'] += 1
            if props['reviewed']:
                counts['reviewed'] += 1
            geometry = shape(feature['geometry'])
            if geometry.is_empty or not geometry.is_valid:
                note('empty_or_invalid_geometry', identity)
            if geometry.geom_type == 'LineString':
                if geometry.length == 0:
                    note('zero_length_line', identity)
                if not geometry.is_simple:
                    note('non_simple_line_requires_review', identity)
                if geometry.is_ring:
                    note('closed_line_requires_review', identity)
            if not props.get('ambiguityOnly'):
                boundary = area(props['municipality'])
                if boundary is None:
                    note('missing_declared_boundary', identity)
                elif not boundary.covers(geometry):
                    note('extends_beyond_declared_current_boundary', identity)
            if counts['features'] % 5000 == 0:
                ids.commit()
                if shutil.disk_usage(output.parent).free < 5 * 1024**3:
                    raise RuntimeError('Less than 5 GiB free; preserve work')
        ids.commit()
        persisted_findings = dict(ids.execute('SELECT reason,COUNT(*) FROM findings GROUP BY reason'))
        if persisted_findings != dict(findings):
            raise ValueError('Persisted finding count differs from diagnosis')
    for category in ('intersections', 'roadSections', 'ambiguityFeatures'):
        if counts[category] != quality[category]:
            raise ValueError('Extraction category count differs: ' + category)
    if counts['reviewed'] != quality['reviewedLocations'] or counts['reviewed'] != 0:
        raise ValueError('Diagnostic expects unreviewed extraction')
    report = {'counts': dict(counts), 'findings': dict(findings), 'samples': dict(samples),
              'findingsIndex': {'path': str(index_path), 'sha256': digest(index_path),
                                'rows': sum(findings.values()), 'containsAllFindings': True,
                                'identityReference': 'feature_number is the one-based input feature position; identity is the unchanged source ID'},
              'inputs': {'candidatesSha256': digest(source), 'qualitySha256': digest(quality_path), 'boundaryIndexSha256': digest(boundary_path), 'auditScriptSha256': digest(__file__)},
              'method': 'Streaming structural/geometry diagnostic and full-geometry containment in the declared current municipality. Input and review flags unchanged.',
              'limitations': ['Structural validity does not prove a physical intersection or correct assignment.',
                              'Closed or non-simple lines can be legitimate; inspect rather than delete.',
                              'Cross-boundary sections require scope review, not nearest-boundary correction.',
                              'A structural diagnostic does not certify nationwide coverage or historical jurisdiction.'],
              'completed': True, 'reviewed': False, 'published': False}
    with output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
    print(json.dumps({'counts': report['counts'], 'findings': report['findings'], 'published': False}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for name in ('candidates', 'boundaries', 'output'):
        parser.add_argument('--' + name, required=True)
    audit(parser.parse_args())
