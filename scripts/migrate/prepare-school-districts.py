"""Prepare repeatable D1 imports from MLIT A27 ZIP + GSI muni.js (stdlib only).

python scripts/migrate/prepare-school-districts.py --archive tmp/school-districts/A27-23_GML.zip \
  --municipalities tmp/school-districts/muni.js --terms tmp/school-districts/terms.xlsx \
  --output tmp/school-districts/sql

Only unrestricted open-data municipalities are published. The review manifest lists
excluded municipalities and their source conditions. Municipal updates use normalized
GeoJSON properties: municipalityCode, schoolCode, prefecture, city, name, sourceUrl, dataYear.
"""
import argparse
import hashlib
import io
import json
import math
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

SOURCE = 'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A27-2023.html'


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def terms_by_code(path):
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(path) as archive:
        strings = [''.join(node.itertext()) for node in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', ns)]
        result = {}
        for row in ET.fromstring(archive.read('xl/worksheets/sheet1.xml')).findall('.//s:row', ns)[1:]:
            values = {}
            for cell in row.findall('s:c', ns):
                node = cell.find('s:v', ns)
                value = node.text if node is not None else ''
                values[re.sub(r'\d', '', cell.attrib['r'])] = strings[int(value)] if cell.attrib.get('t') == 's' else value
            code = values.get('B', '').zfill(5)
            result[code] = values
        return result


def validate_polygon(rings):
    if not rings or any(len(ring) < 4 or ring[0] != ring[-1] for ring in rings):
        raise ValueError('Invalid polygon ring')
    for ring in rings:
        for point in ring:
            if len(point) != 2 or not all(isinstance(n, (float, int)) and math.isfinite(n) for n in point) or not (120 <= point[0] <= 155 and 20 <= point[1] <= 46):
                raise ValueError('Invalid Japan longitude/latitude')


def write_import(features, output, snapshot_codes):
    districts = {}
    boundaries = []
    for feature in features:
        props = feature['properties']
        required = ['municipalityCode', 'schoolCode', 'prefecture', 'city', 'name', 'sourceUrl', 'dataYear']
        if not all(props.get(key) for key in required) or not re.fullmatch(r'\d{5}', props['municipalityCode']):
            raise ValueError('Missing district identity or provenance')
        if not props['sourceUrl'].startswith('https://'):
            raise ValueError('Source must use HTTPS')
        district_id = props['municipalityCode'] + ':' + props['schoolCode']
        if props['municipalityCode'] not in snapshot_codes:
            raise ValueError('Feature outside declared municipal snapshot')
        if district_id in districts and districts[district_id] != props:
            raise ValueError('Conflicting school metadata: ' + district_id)
        districts[district_id] = props
        geom = feature['geometry']
        if geom['type'] not in ('Polygon', 'MultiPolygon'):
            raise ValueError('Expected Polygon or MultiPolygon')
        polygons = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
        for rings in polygons:
            validate_polygon(rings)
            geometry = json.dumps({'type': 'Polygon', 'coordinates': rings}, separators=(',', ':'))
            if len(geometry.encode()) > 1_900_000:
                raise ValueError('Boundary exceeds D1 row limit: ' + district_id)
            points = [point for ring in rings for point in ring]
            bounds = [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)]
            boundary_id = district_id + ':' + hashlib.sha256(geometry.encode()).hexdigest()[:24]
            boundaries.append((boundary_id, district_id, geometry, bounds))
    lines = ['PRAGMA foreign_keys=ON;', 'CREATE TABLE IF NOT EXISTS _school_geometry_chunks (seq INTEGER PRIMARY KEY, content TEXT NOT NULL);']
    # Every imported municipality is a complete snapshot. Removed schools disappear;
    # affected associations are deliberately cleared until the backfill is run.
    for code in sorted(snapshot_codes):
        if not re.fullmatch(r'\d{5}', code):
            raise ValueError('Invalid snapshot municipality code')
        lines.append('DELETE FROM school_districts WHERE municipality_code=' + quote(code) + ';')
    for district_id, p in sorted(districts.items()):
        values = [district_id, p['municipalityCode'], p['schoolCode'], p['prefecture'], p['city'], p['name'], p['sourceUrl']]
        lines.append('INSERT INTO school_districts(id,municipality_code,school_code,prefecture,city,name,source_url,data_year) VALUES(' + ','.join(map(quote, values)) + ',' + str(int(p['dataYear'])) + ');')
    seen = set()
    for boundary_id, district_id, geometry, bounds in boundaries:
        if boundary_id in seen:
            continue
        seen.add(boundary_id)
        lines.append('DELETE FROM _school_geometry_chunks;')
        for seq, offset in enumerate(range(0, len(geometry), 30000)):
            lines.append('INSERT INTO _school_geometry_chunks VALUES(' + str(seq) + ',' + quote(geometry[offset:offset + 30000]) + ');')
        lines.append('INSERT INTO school_district_boundaries VALUES(' + quote(boundary_id) + ',' + quote(district_id) + ',(SELECT group_concat(content,\'\') FROM (SELECT content FROM _school_geometry_chunks ORDER BY seq)),' + ','.join(map(str, bounds)) + ');')
    lines.append('DROP TABLE _school_geometry_chunks;')
    output.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return len(districts), len(seen)


def read_feature_collection(path, parser):
    try:
        data = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    except FileNotFoundError:
        parser.error('GeoJSON input file not found: ' + str(path) + '. Prepare the real input first; use --archive with --export-geojson to export public MLIT data.')
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        parser.error('Cannot read GeoJSON input: ' + str(error))
    if not isinstance(data, dict) or data.get('type') != 'FeatureCollection' or not isinstance(data.get('features'), list):
        parser.error('GeoJSON input must be a FeatureCollection with a features array')
    return data['features']


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive')
    parser.add_argument('--municipalities')
    parser.add_argument('--terms')
    parser.add_argument('--geojson', help='Complete municipal update in normalized GeoJSON format')
    parser.add_argument('--export-geojson', help='Also export normalized MLIT GeoJSON; requires --municipality-codes and the three national input files')
    parser.add_argument('--municipality-codes', help='Comma-separated complete snapshot codes; required for municipal updates, including empty snapshots')
    parser.add_argument('--output', required=True)
    args = parser.parse_args(argv)
    codes = {code.strip() for code in args.municipality_codes.split(',')} if args.municipality_codes else None
    if codes is not None and any(not re.fullmatch(r'\d{5}', code) for code in codes):
        parser.error('--municipality-codes must contain five-digit codes separated by commas')
    if args.geojson and args.export_geojson:
        parser.error('--geojson and --export-geojson cannot be used together')
    if args.export_geojson and not codes:
        parser.error('--export-geojson requires --municipality-codes')
    output = Path(args.output)
    manifest = {'sourceUrl': SOURCE, 'dataYear': 2023, 'districts': 0, 'boundaries': 0, 'excluded': [], 'files': []}
    if args.geojson:
        if not codes:
            parser.error('--municipality-codes is required with --geojson')
        features = read_feature_collection(args.geojson, parser)
        output.mkdir(parents=True, exist_ok=True)
        counts = write_import(features, output / 'municipal-update.sql', codes)
        municipal_manifest = {'districts': counts[0], 'boundaries': counts[1], 'municipalityCodes': sorted(codes), 'files': ['municipal-update.sql'], 'sourceUrls': sorted({feature['properties']['sourceUrl'] for feature in features}), 'dataYears': sorted({feature['properties']['dataYear'] for feature in features})}
        (output / 'manifest.json').write_text(json.dumps(municipal_manifest, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'districts': counts[0], 'boundaries': counts[1]}))
        return
    if not all([args.archive, args.municipalities, args.terms]):
        parser.error('--archive, --municipalities and --terms are required together')
    for path in [args.archive, args.municipalities, args.terms]:
        if not Path(path).is_file():
            parser.error('Required input file not found: ' + path)
    output.mkdir(parents=True, exist_ok=True)
    muni = {}
    text = Path(args.municipalities).read_text(encoding='utf-8-sig')
    for code, value in re.findall(r'GSI\.MUNI_ARRAY\["(\d+)"\]\s*=\s*[\'"]([^\'"]+)', text):
        parts = value.split(',')
        muni[code.zfill(5)] = (parts[1], parts[3].replace('\u3000', ''))
    terms = terms_by_code(args.terms)
    municipal_features = []
    with zipfile.ZipFile(args.archive) as national:
        for entry in sorted(national.namelist()):
            if not re.fullmatch(r'A27-23_\d{2}_GML.zip', entry):
                continue
            if codes and not any(code.startswith(entry[7:9]) for code in codes):
                continue
            with zipfile.ZipFile(io.BytesIO(national.read(entry))) as prefecture_zip:
                filename = next(name for name in prefecture_zip.namelist() if name.endswith('.geojson'))
                original = json.loads(prefecture_zip.read(filename))['features']
            features = []
            for feature in original:
                p = feature['properties']
                code = str(p['A27_001']).zfill(5)
                if codes and code not in codes:
                    continue
                # Conditions are keyed by parent city for designated-city wards.
                policy = terms.get(code) or terms.get(code[:3] + '00')
                if not policy or not policy.get('E', '').startswith('オープンデータ公開') or policy.get('F') != '2.なし':
                    manifest['excluded'].append({'municipalityCode': code, 'reason': 'source_terms', 'conditions': policy})
                    continue
                if code not in muni or not p.get('A27_003') or p['A27_003'] == '-':
                    manifest['excluded'].append({'municipalityCode': code, 'name': p.get('A27_004'), 'reason': 'missing_identity'})
                    continue
                pref, city = muni[code]
                feature['properties'] = {'municipalityCode': code, 'schoolCode': p['A27_003'], 'prefecture': pref, 'city': city, 'name': p['A27_004'], 'sourceUrl': SOURCE, 'dataYear': 2023}
                features.append(feature)
            if codes:
                municipal_features.extend(features)
                continue
            name = entry.replace('_GML.zip', '.sql')
            snapshot_codes = {str(feature['properties']['A27_001']).zfill(5) for feature in original if 'A27_001' in feature['properties']}
            snapshot_codes.update(feature['properties']['municipalityCode'] for feature in features)
            prefecture_code = re.fullmatch(r'A27-23_(\d{2})_GML.zip', entry).group(1)
            snapshot_codes.update(code for code in muni if code.startswith(prefecture_code))
            counts = write_import(features, output / name, snapshot_codes)
            manifest['districts'] += counts[0]
            manifest['boundaries'] += counts[1]
            manifest['files'].append(name)
    if codes:
        if not municipal_features:
            parser.error('No publishable school districts found for ' + ','.join(sorted(codes)) + '; check municipality codes and source usage conditions')
        counts = write_import(municipal_features, output / 'municipal-update.sql', codes)
        manifest.update({'districts': counts[0], 'boundaries': counts[1], 'files': ['municipal-update.sql'], 'municipalityCodes': sorted(codes)})
        if args.export_geojson:
            exported = Path(args.export_geojson)
            exported.parent.mkdir(parents=True, exist_ok=True)
            exported.write_text(json.dumps({'type': 'FeatureCollection', 'features': municipal_features}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    manifest['excluded'] = list({json.dumps(item, sort_keys=True, ensure_ascii=False): item for item in manifest['excluded']}.values())
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({key: value for key, value in manifest.items() if key not in ('excluded', 'files')}))
    print('excluded records:', len(manifest['excluded']))


if __name__ == '__main__':
    main()
