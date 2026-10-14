"""Import one immutable aggregate release into the isolated preview D1 only."""
import hashlib
import json
import pathlib
import re
import sqlite3
import subprocess
import tarfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
VERSION = 'national-current-rule-v1-20261014'
REPOSITORY = 'Kazuglobal/pathguard-safetymap'
RELEASE_ID = 412514430
PREVIEW_ID = 'a5404251-54d6-48e0-9f9d-111c206f5ce6'
MANIFEST_SHA = '62cf6df35cd64651319fec287e4a12d7bad434dcb20ff1873e2fe1c32bc2db31'
ARCHIVE_SHA = '1df05f89526360e92c5171ee84dfa306fa3dfe0ea109ed5a938ba0bace583336'
TABLE_ROWS = {
    'accident_snapshots': 1, 'accident_areas': 1952,
    'accident_locations': 205695, 'accident_location_counts': 326803,
    'accident_quality_counts': 400493,
    'accident_regional_uncertainty_counts': 370972,
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def validate_target(config):
    require(config.get('account_id') == '64a7afb6120cc316b618480f4a17cc21', 'Unexpected account')
    targets = [item for item in config.get('d1_databases', []) if item.get('binding') == 'TRAFFIC_DB']
    require(len(targets) == 1 and targets[0].get('database_id') == PREVIEW_ID
            and targets[0].get('database_name') == 'pathguardian-traffic-preview', 'Preview target mismatch')


def unpack_verified(manifest_bytes, archive_path, destination):
    require(sha(manifest_bytes) == MANIFEST_SHA, 'Manifest hash mismatch')
    manifest = json.loads(manifest_bytes)
    require(manifest['version'] == VERSION and manifest['completed'] is True
            and manifest['published'] is False and manifest['publicTables'] == TABLE_ROWS, 'Manifest gates mismatch')
    require(sha(archive_path.read_bytes()) == ARCHIVE_SHA, 'Archive hash mismatch')
    files = manifest['sqlFiles']
    entries = {entry['name']: entry for entry in files}
    require(len(entries) == len(files) == 84, 'SQL file inventory mismatch')
    require(files[0]['name'] == '0000-schema.sql', 'Missing schema')
    allowed = set(entries) | {'manifest.json', 'DATA-LICENSES.txt'}
    payloads = {}
    with tarfile.open(archive_path, 'r|gz') as archive:
        for member in archive:
            require(member.isfile() and member.name in allowed and member.name not in payloads
                    and member.name == pathlib.PurePosixPath(member.name).name, 'Unsafe archive member')
            entry = entries.get(member.name)
            length = entry['bytes'] if entry else len(manifest_bytes) if member.name == 'manifest.json' else 1884
            require(member.size == length and 0 < length <= 4 * 1024**2, 'Invalid member size')
            with archive.extractfile(member) as stream:
                data = stream.read(length + 1)
            expected = entry['sha256'] if entry else MANIFEST_SHA if member.name == 'manifest.json' else manifest['licenseFile']['sha256']
            require(len(data) == length and sha(data) == expected, 'Member hash mismatch')
            payloads[member.name] = data
    require(set(payloads) == allowed, 'Incomplete archive')
    for name, key in [('0002_accident_rankings.sql', 'schema'), ('0003_accident_regional_uncertainty.sql', 'regionalSchema')]:
        require(sha((ROOT / 'lib/db/traffic-migrations' / name).read_bytes()) == manifest['inputHashes'][key], 'Repository schema changed')
    # Every member is verified before any file is written or any remote call occurs.
    destination.mkdir()
    for name, data in payloads.items():
        with (destination / name).open('xb') as stream:
            stream.write(data)
    return manifest


def parse_json_output(output):
    text = output.decode('utf-8-sig')
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Some CLI startup notices precede --json output. Only accept one complete
        # top-level JSON document at a line boundary and at the end of stdout.
        decoder = json.JSONDecoder()
        documents = []
        for match in re.finditer(r'(?m)^[ \t]*[\[{]', text):
            start = match.end() - 1
            try:
                document, end = decoder.raw_decode(text, start)
                if not text[end:].strip():
                    documents.append((document, start))
            except json.JSONDecodeError:
                continue
        require(len(documents) == 1, f'CLI returned no unambiguous final JSON response ({len(output)} bytes)')
        document, start = documents[0]
        prefix = text[:start]
        for match in re.finditer(r'(?m)^[ \t]*[\[{]', prefix):
            try:
                decoder.raw_decode(prefix, match.end() - 1)
            except json.JSONDecodeError:
                continue
            raise ValueError('CLI returned multiple JSON documents')
        return document


def command_json(arguments):
    result = subprocess.run(arguments, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    require(result.returncode == 0, 'Command failed; no database activation performed')
    return parse_json_output(result.stdout)


def d1(*arguments):
    result = command_json(['pnpm', 'exec', 'wrangler', 'd1', 'execute', 'pathguardian-traffic-preview',
                           '--remote', '--config', 'wrangler.preview-resources.json', '--json', '--yes', *arguments])
    require(isinstance(result, list) and result and all(item.get('success') is True for item in result), 'D1 execution failed')
    return result


def query(sql):
    return d1('--command', sql)[0]['results']


def verify_remote(expected_metadata):
    actual = {}
    for table, count in TABLE_ROWS.items():
        actual[table] = query(f"SELECT COUNT(*) AS n FROM {table} WHERE version='{VERSION}'")[0]['n']
        require(actual[table] == count, f'Incomplete version in {table}; preserve partial data')
    snapshot = query(f"SELECT published,metadata_json FROM accident_snapshots WHERE version='{VERSION}'")[0]
    require(json.loads(snapshot['metadata_json']) == expected_metadata, 'Snapshot metadata differs')
    quality = query(f"SELECT SUM(assigned) AS assigned,SUM(uncertain) AS uncertain,SUM(excluded) AS excluded FROM accident_quality_counts WHERE version='{VERSION}'")[0]
    require(quality == {'assigned': 329033, 'uncertain': 1842634, 'excluded': 10631}, 'Original reconciliation mismatch')
    require(query(f"SELECT SUM(count) AS n FROM accident_location_counts WHERE version='{VERSION}'")[0]['n'] == 329033, 'Location totals mismatch')
    require(query(f"SELECT COUNT(DISTINCT prefecture) AS n FROM accident_locations WHERE version='{VERSION}'")[0]['n'] == 47, 'Incomplete national coverage')
    require(not query('PRAGMA foreign_key_check'), 'Foreign key violation')
    return actual


def import_remote(manifest, sql_folder, expected_metadata):
    d1('--file', str(sql_folder / '0000-schema.sql'))
    existing = query(f"SELECT published FROM accident_snapshots WHERE version='{VERSION}'")
    if existing:
        # Only a completed, already activated version can be reused. Never repair or overwrite partial uploads.
        require(existing == [{'published': 1}], 'Existing unpublished version requires investigation; preserve all rows')
    else:
        for entry in manifest['sqlFiles'][1:]:
            d1('--file', str(sql_folder / entry['name']))
            print(json.dumps({'imported': entry['name'], 'published': False}), flush=True)
    rows = verify_remote(expected_metadata)
    # This UPDATE can target only the fixed preview database, after all verification gates.
    d1('--command', f"UPDATE accident_snapshots SET published=1 WHERE version='{VERSION}' AND published=0")
    require(query(f"SELECT published FROM accident_snapshots WHERE version='{VERSION}'") == [{'published': 1}], 'Preview activation failed')
    return rows


def main():
    validate_target(json.loads((ROOT / 'wrangler.preview-resources.json').read_text('utf8')))
    output = ROOT / 'artifacts/verified-preview-stage'
    require(not output.exists(), 'Preserve existing staging evidence; use a clean CI runner')
    output.mkdir(parents=True)
    release = command_json(['gh', 'api', f'repos/{REPOSITORY}/releases/{RELEASE_ID}'])
    require(release['id'] == RELEASE_ID and release['tag_name'] == 'pathguardian-accidents-national-current-rule-v1-20261014', 'Release mismatch')
    for name, asset_id in [('manifest.json', 639811217), ('stage-pack.tar.gz', 639811214)]:
        asset = next((item for item in release['assets'] if item['name'] == name), None)
        require(asset and asset['id'] == asset_id, 'Asset identity mismatch')
        with (output / name).open('xb') as stream:
            result = subprocess.run(['gh', 'api', f'repos/{REPOSITORY}/releases/assets/{asset_id}',
                                     '-H', 'Accept: application/octet-stream'], cwd=ROOT, stdout=stream, stderr=subprocess.PIPE)
        require(result.returncode == 0, 'Asset download failed')
    manifest = unpack_verified((output / 'manifest.json').read_bytes(), output / 'stage-pack.tar.gz', output / 'sql')
    with sqlite3.connect(':memory:') as local:
        local.executescript((output / 'sql/0000-schema.sql').read_text('utf8'))
        local.executescript((output / 'sql/0001-accident_snapshots.sql').read_text('utf8'))
        expected_metadata = json.loads(local.execute('SELECT metadata_json FROM accident_snapshots').fetchone()[0])
    rows = import_remote(manifest, output / 'sql', expected_metadata)
    receipt = {'completed': True, 'version': VERSION, 'databaseId': PREVIEW_ID, 'manifestSha256': MANIFEST_SHA,
               'archiveSha256': ARCHIVE_SHA, 'rows': rows, 'previewActivated': True, 'productionChanged': False}
    (output / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', 'utf8')
    print(json.dumps(receipt), flush=True)


if __name__ == '__main__':
    main()
