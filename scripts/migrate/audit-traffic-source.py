"""Read-only audit of a Wrangler D1 JSON export against official NPA CSV files.

No database credentials or mutations. Parse source fields independently of the importer.
Example: python scripts/migrate/audit-traffic-source.py --d1-json=export.json
  --csv-dir=data/accidents --extra-csv=2025:path/to/honhyo_2025.csv --out=report.json
"""
import argparse
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path


def dms(value, degree_digits):
    if len(value) != degree_digits + 7 or not value.isdigit():
        raise ValueError('invalid source coordinates')
    minutes = int(value[degree_digits:degree_digits + 2])
    seconds = int(value[degree_digits + 2:]) / 1000
    if minutes >= 60 or seconds >= 60:
        raise ValueError('invalid source coordinates')
    return int(value[:degree_digits]) + minutes / 60 + seconds / 3600


def source_record(row, file_year):
    jst = dt.timezone(dt.timedelta(hours=9))
    occurred = dt.datetime(*(int(row[f'発生日時　　{part}']) for part in ('年', '月', '日', '時', '分')), tzinfo=jst)
    return {
        'source_file_year': file_year,
        'prefecture_code': int(row['都道府県コード']),
        'police_station_code': row['警察署等コード'],
        'record_number': row['本票番号'],
        'occurred_at': occurred.isoformat(),
        'lat': dms(row['地点　緯度（北緯）'], 2),
        'lng': dms(row['地点　経度（東経）'], 3),
        'severity_code': int(row['事故内容']),
        'fatalities': int(row['死者数']),
        'injuries': int(row['負傷者数']),
    }


def differences(db, source):
    result = {}
    for field in ('severity_code', 'fatalities', 'injuries'):
        if db[field] != source[field]:
            result[field] = {'database': db[field], 'source': source[field]}
    for field in ('lat', 'lng'):
        if abs(db[field] - source[field]) > 1e-8:
            result[field] = {'database': db[field], 'source': source[field]}
    if dt.datetime.fromisoformat(db['occurred_at'].replace('Z', '+00:00')) != dt.datetime.fromisoformat(source['occurred_at']):
        result['occurred_at'] = {'database': db['occurred_at'], 'source': source['occurred_at']}
    return result


def audit(db_rows, files):
    sources = {}
    hashes = {}
    pref_codes = {row['prefecture_code'] for row in db_rows}
    row_keys = {(row['prefecture_code'], int(row['police_station_code']), int(row['record_number'])) for row in db_rows}
    for year, path in files.items():
        with path.open('rb') as stream:
            hashes[str(year)] = hashlib.file_digest(stream, 'sha256').hexdigest()
        with path.open(encoding='cp932', newline='') as stream:
            for raw in csv.DictReader(stream):
                row = {key.strip(): value.strip() for key, value in raw.items() if key}
                prefecture = int(row.get('都道府県コード', '-1'))
                if prefecture not in pref_codes:
                    continue
                identity = (prefecture, int(row['警察署等コード']), int(row['本票番号']))
                if row.get('事故内容') != '1' and identity not in row_keys:
                    continue
                record = source_record(row, year)
                key = (year, record['prefecture_code'], int(record['police_station_code']), int(record['record_number']))
                if key in sources:
                    raise ValueError(f'duplicate key in source CSV: {key}')
                sources[key] = record
    mismatches = []
    missing = []
    matched = 0
    per_year = {}
    year_aliases = []
    for row in db_rows:
        year = row['source_year']
        if year not in files:
            raise ValueError(f'missing source file for year {year}')
        key = (year, row['prefecture_code'], int(row['police_station_code']), int(row['record_number']))
        source = sources.get(key)
        per_year[str(year)] = per_year.get(str(year), 0) + 1
        if source is None or differences(row, source):
            candidates = [(source_key, candidate) for source_key, candidate in sources.items()
                          if source_key[1:] == key[1:] and not differences(row, candidate)]
            if len(candidates) == 1:
                source_key, source = candidates[0]
                year_aliases.append({'id': row['id'], 'database_year': year, 'source_file_year': source_key[0]})
        if source is None:
            missing.append({'id': row['id'], 'key': key})
            continue
        diff = differences(row, source)
        if diff:
            mismatches.append({'id': row['id'], 'key': key, 'differences': diff})
        else:
            matched += 1
    return {'audited_rows': len(db_rows), 'matched_rows': matched, 'rows_by_year': per_year, 'mismatches': mismatches, 'missing_source_keys': missing, 'source_year_aliases': year_aliases, 'source_sha256': hashes}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--d1-json', type=Path, required=True)
    parser.add_argument('--csv-dir', type=Path, required=True)
    parser.add_argument('--extra-csv', action='append', default=[], help='year:path')
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    exported = json.loads(args.d1_json.read_text(encoding='utf-8-sig'))
    if not exported or any(not result.get('success') for result in exported):
        raise ValueError('D1 export did not succeed')
    rows = [row for result in exported for row in result['results']]
    if not rows:
        raise ValueError('empty D1 export')
    files = {year: args.csv_dir / str(year) / f'honhyo_{year}.csv' for year in {row['source_year'] for row in rows}}
    for item in args.extra_csv:
        year, path = item.split(':', 1)
        files[int(year)] = Path(path)
    report = audit(rows, files)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in report.items() if key not in ('mismatches', 'missing_source_keys')} | {'mismatch_count': len(report['mismatches']), 'missing_count': len(report['missing_source_keys'])}))
    return 1 if report['mismatches'] or report['missing_source_keys'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
