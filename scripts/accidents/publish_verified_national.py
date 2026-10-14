"""Latest-main Cloudflare Production workflow only: verified aggregate publication."""
import gzip
import hashlib
import json
import pathlib
import shutil
import sqlite3
import subprocess
import sys
from itertools import zip_longest
from contextlib import closing
import stage_verified_preview as pack

PRODUCTION_ID = '84db49b6-e9f4-4886-8319-2b7d32d59438'
TAG = 'pathguardian-accidents-national-current-rule-v1-20261014'
EVIDENCE = {
    'browser-qa.json': 'd5b1917351e65aa1e255d6029003f897893d4c5b3d26989165ba04b87ec3c083',
    'nationwide-http.json': 'b842e6fa035de57d734427ead519ab7f3c48fa011ea505d99acb3109d22e784d',
    'preview-stage.json': '2f0c3e45c48a66e8554d90f9ae9b97999ebfc21342efd42e3cf5b2d24da80b0e',
}
MACHINE_SHA = 'f3bb6f1875739f379323a972d63c40f02a4ca11b08daa4390de8ef8bbdd5ff93'


def assert_main_source():
    # Existing source guard checks the exact workflow, latest main and clean checkout.
    # Never provide synthetic GitHub environment variables to this process.
    result = subprocess.run(['node', '--input-type=module', '-e',
        "import {assertProductionSource} from './scripts/cloudflare/production-source-guard.mjs'; assertProductionSource({cwd:process.cwd()});"],
        cwd=pack.ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        categories = {
            'Manual production deployment is disabled.': 'workflow identity',
            'Production deployment requires a clean checkout.': 'clean checkout',
            'Production source verification failed.': 'Git access',
            'this checkout is not the latest origin/main.': 'latest main',
        }
        category = next((label for phrase, label in categories.items() if phrase.encode() in result.stderr), 'unknown')
        raise ValueError(f'Production source guard failed: {category}')


def validate_target(config):
    targets = [item for item in config.get('d1_databases', []) if item.get('binding') == 'TRAFFIC_DB']
    pack.require(config.get('vars', {}).get('CLOUDFLARE_ACCOUNT_ID') == '64a7afb6120cc316b618480f4a17cc21', 'Unexpected production account')
    pack.require(len(targets) == 1 and targets[0].get('database_id') == PRODUCTION_ID
        and targets[0].get('database_name') == 'pathguardian-traffic', 'Production target mismatch')


def verify_evidence():
    records = {}
    for name, expected in EVIDENCE.items():
        data = (pack.ROOT / 'docs/operations/data/national-release-v1' / name).read_bytes()
        pack.require(pack.sha(data) == expected, 'Release evidence hash mismatch')
        records[name] = json.loads(data.decode('utf-8-sig'))
    browser, nationwide, preview = (records[n] for n in EVIDENCE)
    pack.require(browser['completed'] is True and browser['version'] == pack.VERSION
        and browser['rapidFilterRetest']['ciConclusion'] == 'success', 'Browser QA incomplete')
    pack.require(nationwide['count'] == 47 and nationwide['allReady'] is True
        and nationwide['version'] == pack.VERSION, 'Nationwide HTTP QA incomplete')
    pack.require(preview['completed'] is True and preview['rows'] == pack.TABLE_ROWS
        and preview['manifestSha256'] == pack.MANIFEST_SHA and preview['archiveSha256'] == pack.ARCHIVE_SHA
        and preview['databaseId'] == pack.PREVIEW_ID, 'Preview import evidence mismatch')


def d1(*arguments):
    result = pack.command_json(['pnpm', 'exec', 'wrangler', 'd1', 'execute', 'pathguardian-traffic',
        '--remote', '--config', 'wrangler.server.jsonc', '--json', '--yes', *arguments])
    pack.require(isinstance(result, list) and result and all(item.get('success') is True for item in result), 'Production D1 execution failed')
    return result


def query(sql):
    return d1('--command', sql)[0]['results']


def verify_capacity(output, filename='capacity-before.json'):
    info = pack.command_json(['pnpm', 'exec', 'wrangler', 'd1', 'info', 'pathguardian-traffic',
        '--config', 'wrangler.server.jsonc', '--json'])
    pack.require(info.get('uuid') == PRODUCTION_ID and info.get('name') == 'pathguardian-traffic', 'Capacity target mismatch')
    size = info.get('database_size')
    # Conservative 1GB staging headroom and 1GB reserve below the paid 10GB limit.
    pack.require(type(size) is int and 0 <= size <= 8_000_000_000, 'Insufficient verified D1 headroom')
    pack.require(filename in ('capacity-before.json', 'capacity-after.json'), 'Invalid capacity receipt')
    with (output / filename).open('x', encoding='utf8') as stream:
        stream.write(json.dumps(info, indent=2) + '\n')


def verify_public_offering(output):
    release = pack.command_json(['gh', 'api', f'repos/{pack.REPOSITORY}/releases/{pack.RELEASE_ID}'])
    pack.require(release['id'] == pack.RELEASE_ID and release['tag_name'] == TAG, 'Release identity mismatch')
    expected = {'public.sqlite.gz': (639813007, MACHINE_SHA),
                'DATA-LICENSES.txt': (639811216, '13b29902ecf388097e6006723b601cb575aa6baaa31178989c15b5de2f72a16f')}
    for name, (asset_id, digest) in expected.items():
        asset = next((a for a in release['assets'] if a['name'] == name), None)
        pack.require(asset and asset['id'] == asset_id and asset.get('digest') == 'sha256:' + digest, 'Public offering asset mismatch')
        # Also verify actual contents, rather than relying only on API digest fields.
        with (output / name).open('xb') as stream:
            result = subprocess.run(['gh', 'api', f'repos/{pack.REPOSITORY}/releases/assets/{asset_id}',
                '-H', 'Accept: application/octet-stream'], cwd=pack.ROOT, stdout=stream, stderr=subprocess.PIPE)
        pack.require(result.returncode == 0 and pack.sha((output / name).read_bytes()) == digest, 'Public offering download mismatch')
    digest = hashlib.sha256()
    size = 0
    with gzip.open(output / 'public.sqlite.gz', 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024**2), b''):
            digest.update(chunk)
            size += len(chunk)
    pack.require(digest.hexdigest() == '1ed9f92e4ab64b29f1af66b2568884cc48a01464e60c38da28e44afe7c0be157'
        and size == 335863808, 'Machine readable database mismatch')
    return release


def compare_table(original, remote, table, expected_rows, confirm_reals=None):
    columns = original.execute(f'PRAGMA table_info({table})').fetchall()
    pack.require(columns == remote.execute(f'PRAGMA table_info({table})').fetchall(), 'Export schema mismatch')
    keys = [row[1] for row in sorted((row for row in columns if row[5]), key=lambda row: row[5])]
    sql = f"SELECT * FROM {table} WHERE version=? ORDER BY {','.join(keys)}"
    real_columns = {index for index, row in enumerate(columns) if row[2].upper() == 'REAL'}
    seen, differing_reals = 0, []
    for left, right in zip_longest(original.execute(sql, (pack.VERSION,)), remote.execute(sql, (pack.VERSION,))):
        pack.require(left is not None and right is not None, f'Export row count differs in {table}')
        if table == 'accident_snapshots':
            # The only allowed difference is activation of this exact immutable snapshot.
            pack.require(left[1] == 0 and right[1] in (0, 1), 'Invalid publication state')
            right = (right[0], 0, *right[2:])
        if left != right:
            different = {i for i, (a, b) in enumerate(zip(left, right)) if a != b}
            pack.require(confirm_reals is not None and different <= real_columns,
                f'Export row contents differ in {table}')
            differing_reals.append(left)
        seen += 1
    pack.require(seen == expected_rows, f'Export row count differs in {table}')
    if differing_reals:
        pack.require(table == 'accident_locations', 'Unsupported direct REAL verification table')
        confirm_reals(differing_reals, [row[1] for row in columns])
    return seen


def confirm_direct_reals(rows, columns, run_query, output):
    fields = ['version', 'id', 'latitude', 'longitude']
    positions = [columns.index(field) for field in fields]
    for offset in range(0, len(rows), 64):
        batch = rows[offset:offset + 64]
        ids = ','.join("'" + row[columns.index('id')].replace("'", "''") + "'" for row in batch)
        actual = run_query(f"SELECT version,id,latitude,longitude FROM accident_locations WHERE version='{pack.VERSION}' AND id IN ({ids}) ORDER BY id")
        with (output / f'direct-real-page-{offset // 64:04d}.json').open('x', encoding='utf8') as stream:
            stream.write(json.dumps(actual, indent=2) + '\n')
        expected = [tuple(row[index] for index in positions) for row in batch]
        pack.require([tuple(row[field] for field in fields) for row in actual] == expected,
            'Direct D1 coordinate values differ from immutable database')
    return len(rows)


def without_leading_comments(statement):
    remaining = statement.lstrip()
    while remaining.startswith('--'):
        remaining = remaining.partition('\n')[2].lstrip()
    return remaining


def load_export(remote, stream):
    # Own bounded transactions. Export BEGIN/COMMIT markers do not control these.
    remote.execute('BEGIN')
    statement, pending = '', 0
    try:
        for line in stream:
            statement += line
            pack.require(len(statement) <= 16 * 1024**2, 'Export statement too large')
            if not sqlite3.complete_statement(statement):
                continue
            command = without_leading_comments(statement)
            marker = ' '.join(command.strip().upper().rstrip(';').split())
            if marker not in ('BEGIN', 'BEGIN TRANSACTION', 'COMMIT', 'END', 'END TRANSACTION'):
                remote.execute(statement)  # exactly one statement; never implicit-commit executescript
                pending += 1
                if pending == 5000:
                    remote.commit()
                    remote.execute('BEGIN')
                    pending = 0
            statement = ''
        pack.require(not without_leading_comments(statement), 'Incomplete export statement')
        remote.commit()
    except Exception:
        if remote.in_transaction:
            remote.rollback()
        raise


def verify_all_export_rows(output, *, preview_check=False):
    # Read only these six public tables, never the original accident tables.
    exported = output / 'remote-public-tables.sql'
    config = 'wrangler.preview-resources.json' if preview_check else 'wrangler.server.jsonc'
    database = 'pathguardian-traffic-preview' if preview_check else 'pathguardian-traffic'
    validator = pack.validate_target if preview_check else validate_target
    validator(json.loads((pack.ROOT / config).read_text('utf8')))
    arguments = ['pnpm', 'exec', 'wrangler', 'd1', 'export', database,
        '--remote', '--config', config, '--no-schema', '--skip-confirmation', '--output', str(exported)]
    for table in pack.TABLE_ROWS:
        arguments.extend(['--table', table])
    result = subprocess.run(arguments, cwd=pack.ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    pack.require(result.returncode == 0 and exported.is_file(), 'Public table export failed')
    source_path = output / 'machine-readable.sqlite'
    with gzip.open(output / 'public.sqlite.gz', 'rb') as source, source_path.open('xb') as target:
        shutil.copyfileobj(source, target, 1024**2)
    remote_path = output / 'remote-public-tables.sqlite'
    pack.require(not remote_path.exists(), 'Preserve previous export verification')
    with closing(sqlite3.connect(remote_path)) as remote, closing(sqlite3.connect(source_path.resolve().as_uri() + '?mode=ro', uri=True)) as original:
        remote.executescript((output / 'sql/0000-schema.sql').read_text('utf8'))
        def authorize(action, first, second, database, trigger):
            if action in (sqlite3.SQLITE_INSERT, sqlite3.SQLITE_READ):
                return sqlite3.SQLITE_OK if first in pack.TABLE_ROWS else sqlite3.SQLITE_DENY
            if action in (sqlite3.SQLITE_SELECT, sqlite3.SQLITE_TRANSACTION):
                return sqlite3.SQLITE_OK
            if action == sqlite3.SQLITE_PRAGMA and first in ('foreign_keys', 'defer_foreign_keys'):
                return sqlite3.SQLITE_OK
            return sqlite3.SQLITE_DENY
        remote.set_authorizer(authorize)
        with exported.open('r', encoding='utf8') as stream:
            load_export(remote, stream)
        remote.set_authorizer(None)
        typed_query = pack.query if preview_check else query
        direct = {'rows': 0}
        def confirm(differing, columns):
            direct['rows'] += confirm_direct_reals(differing, columns, typed_query, output)
        rows = {table: compare_table(original, remote, table, count, confirm) for table, count in pack.TABLE_ROWS.items()}
    receipt = {'completed': True, 'version': pack.VERSION, 'allColumnsCompared': True, 'rows': rows,
        'directCoordinateRowsConfirmed': direct['rows'],
        'verificationMethod': 'Exact export row comparison; REAL-only export differences require exact direct D1 values. No tolerance.'}
    (output / 'full-row-verification.json').write_text(json.dumps(receipt, indent=2) + '\n', 'utf8')
    return receipt


def stage(manifest, folder, metadata):
    d1('--file', str(folder / '0000-schema.sql'))
    existing = query(f"SELECT published FROM accident_snapshots WHERE version='{pack.VERSION}'")
    if existing:
        # A complete unpublished version may result from a later release/deploy failure.
        # Verify it in full, but never append, repair or delete existing rows.
        pack.require(existing in ([{'published': 0}], [{'published': 1}]), 'Unexpected snapshot state')
    else:
        for entry in manifest['sqlFiles'][1:]:
            d1('--file', str(folder / entry['name']))
            print(json.dumps({'imported': entry['name'], 'published': False}), flush=True)
    return pack.verify_remote(metadata, query)


def activate_after_offering(release, metadata):
    if release['draft']:
        result = subprocess.run(['gh', 'release', 'edit', TAG, '--repo', pack.REPOSITORY,
            '--draft=false', '--latest=false'], cwd=pack.ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        pack.require(result.returncode == 0, 'Licence release publication failed; snapshot stays unpublished')
    public = pack.command_json(['gh', 'api', f'repos/{pack.REPOSITORY}/releases/{pack.RELEASE_ID}'])
    pack.require(public['id'] == pack.RELEASE_ID and public['tag_name'] == TAG and public['draft'] is False,
        'Public offering unavailable; snapshot stays unpublished')
    for name, asset_id, digest in [('public.sqlite.gz', 639813007, MACHINE_SHA),
        ('DATA-LICENSES.txt', 639811216, '13b29902ecf388097e6006723b601cb575aa6baaa31178989c15b5de2f72a16f')]:
        asset = next((a for a in public.get('assets', []) if a['name'] == name), None)
        pack.require(asset and asset['id'] == asset_id and asset.get('digest') == 'sha256:' + digest,
            'Published offering asset changed; snapshot stays unpublished')
    # Preserve the immutable methodology metadata; record approval separately in the receipt.
    d1('--command', f"UPDATE accident_snapshots SET published=1 WHERE version='{pack.VERSION}' AND published=0")
    pack.require(query(f"SELECT published FROM accident_snapshots WHERE version='{pack.VERSION}'") == [{'published': 1}], 'Snapshot activation failed')
    pack.verify_remote(metadata, query)


def main():
    assert_main_source()
    validate_target(json.loads((pack.ROOT / 'wrangler.server.jsonc').read_text('utf8')))
    verify_evidence()
    output = pack.ROOT / '.codex-artifacts/verified-production-stage'
    manifest, metadata = pack.prepare_verified_pack(output)
    release = verify_public_offering(output)
    assert_main_source()
    verify_capacity(output)
    rows = stage(manifest, output / 'sql', metadata)
    verify_all_export_rows(output)
    verify_capacity(output, 'capacity-after.json')
    assert_main_source()
    activate_after_offering(release, metadata)
    receipt = {'completed': True, 'version': pack.VERSION, 'databaseId': PRODUCTION_ID,
        'manifestSha256': pack.MANIFEST_SHA, 'archiveSha256': pack.ARCHIVE_SHA,
        'rows': rows, 'qaEvidence': EVIDENCE, 'browserQaApproved': True, 'releaseApproved': True,
        'publicOffering': f'https://github.com/{pack.REPOSITORY}/releases/tag/{TAG}', 'published': True}
    (output / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', 'utf8')
    print(json.dumps(receipt), flush=True)


if __name__ == '__main__':
    if sys.argv[1:] == ['--preview-check']:
        # Read-only preview exercise of the complete export/comparison procedure.
        pack.validate_target(json.loads((pack.ROOT / 'wrangler.preview-resources.json').read_text('utf8')))
        verify_evidence()
        output = pack.ROOT / 'artifacts/verified-preview-full-rows'
        pack.prepare_verified_pack(output)
        verify_public_offering(output)
        print(json.dumps(verify_all_export_rows(output, preview_check=True)), flush=True)
    else:
        pack.require(not sys.argv[1:], 'No arbitrary production target or mode is accepted')
        main()
