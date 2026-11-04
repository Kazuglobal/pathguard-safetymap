"""Upload a built hazard grid to the HAZARD_GRID R2 bucket, additively.

Default is a local check of every object against objects.json (size, MD5).
Remote writes require --remote. The bucket is taken from the HAZARD_GRID
binding in wrangler.server.jsonc; nothing is inferred from the environment.
Uses the authenticated project-local Wrangler credential in memory; never
prints, saves or passes a credential on the command line. Objects are only
added or replaced with identical keys; nothing is deleted. Progress is kept in
upload-receipt.ndjson so an interrupted upload resumes without re-sending.

  python scripts/migrate/upload-hazard-grid.py --grid artifacts/migration/hazards/grid
  python scripts/migrate/upload-hazard-grid.py --grid artifacts/migration/hazards/grid --remote
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import random
import subprocess
import threading
import time
import urllib.error
from urllib.parse import quote
import urllib.request

BINDING = 'HAZARD_GRID'
MANIFEST_KEY_SUFFIX = 'manifest.json'
WORKERS = 8
VERIFY_SAMPLE = 200


def load_objects(grid: Path) -> tuple[dict, list[dict]]:
    manifest = json.loads((grid / 'manifest.json').read_text(encoding='utf-8'))
    objects = json.loads((grid / 'objects.json').read_text(encoding='utf-8'))
    if len(objects) != manifest['objectCount']:
        raise ValueError('objects.json does not match manifest objectCount')
    if len({o['key'] for o in objects}) != len(objects):
        raise ValueError('Duplicate object key')
    prefix = manifest['keyPrefix'] + '/'
    for entry in objects:
        if not entry['key'].startswith(prefix) or '..' in entry['key']:
            raise ValueError('Object key outside the grid prefix')
    return manifest, objects


def verify_local(grid: Path, objects: list[dict]) -> None:
    for entry in objects:
        body = (grid / 'objects' / entry['key']).read_bytes()
        if len(body) != entry['bytes'] or hashlib.md5(body).hexdigest() != entry['md5']:
            raise ValueError('Local object differs from objects.json: ' + entry['key'])


def target_bucket() -> tuple[str, str]:
    settings = json.loads(Path('wrangler.server.jsonc').read_text(encoding='utf-8'))
    binding = next((b for b in settings['r2_buckets'] if b['binding'] == BINDING), None)
    if binding is None:
        raise ValueError('wrangler.server.jsonc has no HAZARD_GRID binding')
    return settings['vars']['CLOUDFLARE_ACCOUNT_ID'], binding['bucket_name']


def wrangler_token(node: str) -> str:
    auth = subprocess.run([node, 'node_modules/wrangler/bin/wrangler.js', 'auth', 'token', '--json'],
                          capture_output=True, text=True, check=False)
    if auth.returncode:
        raise ValueError('Wrangler authentication unavailable; raw output suppressed')
    try:
        return json.loads(auth.stdout)['token']
    except (ValueError, KeyError):
        raise ValueError('Unexpected Wrangler credential response; raw output suppressed') from None


class R2Client:
    def __init__(self, account: str, bucket: str, token: str):
        self.base = f'https://api.cloudflare.com/client/v4/accounts/{account}/r2/buckets/{bucket}/objects/'
        self.token = token

    def request(self, method: str, key: str, body: bytes | None = None) -> bytes:
        for attempt in range(6):
            headers = {'Authorization': 'Bearer ' + self.token}
            if body is not None:
                headers['Content-Type'] = 'application/json'
            req = urllib.request.Request(self.base + quote(key, safe=''), data=body, method=method, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=120) as response:
                    return response.read()
            except urllib.error.HTTPError as error:
                if error.code in (429, 500, 502, 503, 504) and attempt < 5:
                    time.sleep(2 ** attempt)
                    continue
                raise ValueError(f'R2 {method} failed (HTTP {error.code}); response suppressed') from None
            except (TimeoutError, urllib.error.URLError):
                if attempt < 5:
                    time.sleep(2 ** attempt)
                    continue
                raise ValueError(f'R2 {method} failed after retries; response suppressed') from None
        raise ValueError('R2 retries exhausted')


def read_receipt(path: Path) -> dict[str, str]:
    done = {}
    if path.exists():
        for line in path.read_text(encoding='utf-8').splitlines():
            if line.strip():
                row = json.loads(line)
                done[row['key']] = row['md5']
    return done


def upload(grid: Path, manifest: dict, objects: list[dict], client: R2Client) -> dict:
    receipt_path = grid / 'upload-receipt.ndjson'
    done = read_receipt(receipt_path)
    pending = [o for o in objects if done.get(o['key']) != o['md5']]
    print(json.dumps(dict(event='upload_start', objects=len(objects), pending=len(pending))), flush=True)
    lock = threading.Lock()
    counter = {'sent': 0}

    def send(entry: dict) -> None:
        client.request('PUT', entry['key'], (grid / 'objects' / entry['key']).read_bytes())
        with lock:
            with receipt_path.open('a', encoding='utf-8') as target:
                target.write(json.dumps(dict(key=entry['key'], md5=entry['md5'])) + '\n')
            counter['sent'] += 1
            if counter['sent'] % 1000 == 0:
                print(json.dumps(dict(event='uploading', sent=counter['sent'], pending=len(pending))), flush=True)

    with ThreadPoolExecutor(WORKERS) as pool:
        list(pool.map(send, pending))

    # Read back a random sample plus the largest objects through the same API.
    sample = random.Random(0).sample(objects, min(VERIFY_SAMPLE, len(objects)))
    sample += sorted(objects, key=lambda o: o['bytes'])[-5:]
    for entry in sample:
        if hashlib.md5(client.request('GET', entry['key'])).hexdigest() != entry['md5']:
            raise ValueError('Uploaded object differs from the local grid: ' + entry['key'])
    # The manifest goes last so its presence means every object above is in place.
    manifest_key = manifest['keyPrefix'] + '/' + MANIFEST_KEY_SUFFIX
    client.request('PUT', manifest_key, (grid / 'manifest.json').read_bytes())
    return dict(event='uploaded', objects=len(objects), sent=counter['sent'], verifiedSample=len(sample),
                manifestKey=manifest_key)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--grid', type=Path, required=True)
    parser.add_argument('--remote', action='store_true')
    parser.add_argument('--node', default='node')
    args = parser.parse_args()
    manifest, objects = load_objects(args.grid)
    verify_local(args.grid, objects)
    account, bucket = target_bucket()
    summary = dict(objects=len(objects), totalBytes=manifest['totalBytes'], bucket=bucket,
                   sources=len(manifest['sources']))
    if not args.remote:
        print(json.dumps(dict(event='verified', remote=False, **summary)), flush=True)
        return
    client = R2Client(account, bucket, wrangler_token(args.node))
    result = upload(args.grid, manifest, objects, client)
    (args.grid / 'upload-result.json').write_text(json.dumps(dict(**result, **summary), indent=2), encoding='utf-8')
    print(json.dumps(dict(**result, bucket=bucket)), flush=True)


if __name__ == '__main__':
    main()
