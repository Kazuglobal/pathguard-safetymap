"""Import a verified prepared source into existing D1 hazard tables, additively.

Default is local verification only. Remote writes require --remote --database
pathguardian. Uses the authenticated project-local Wrangler credential in memory;
never prints, saves or passes a credential on the command line. No DELETE, schema
change, Worker deployment, or production secret mutation is performed.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request
from shapely.geometry import shape

ZONE_COLUMNS = ('id','zone_group_id','hazard_type','source_layer','risk_level','depth_min_m','depth_max_m',
                'area_context','properties','geojson','bbox_min_lng','bbox_min_lat','bbox_max_lng','bbox_max_lat')
COVER_COLUMNS = ('id','coverage_group_id','hazard_type','region_label','source','source_layer','geojson',
                 'bbox_min_lng','bbox_min_lat','bbox_max_lng','bbox_max_lat','imported_features','imported_at')

def validate_geometry(row):
    geometry=shape(row['geojson'])
    if geometry.is_empty or not geometry.is_valid or geometry.geom_type!='Polygon':
        raise ValueError('Invalid prepared geometry')
    bounds=[row[c] for c in ('bbox_min_lng','bbox_min_lat','bbox_max_lng','bbox_max_lat')]
    if list(geometry.bounds)!=bounds or not all(math.isfinite(x) for x in bounds):
        raise ValueError('Prepared bounds mismatch')
    if not (-180<=bounds[0]<=bounds[2]<=180 and -90<=bounds[1]<=bounds[3]<=90):
        raise ValueError('Prepared coordinates out of range')

def verify_existing_coverage(existing, expected):
    expected_by_id={row['id']:row for row in expected}
    for row in existing:
        original=expected_by_id.get(row['id'])
        if original is None: raise ValueError('Target coverage belongs to a different artifact')
        for column in COVER_COLUMNS:
            if column=='imported_at': continue
            value=row[column]
            if column=='geojson' and isinstance(value,str): value=json.loads(value)
            if value!=original[column]: raise ValueError('Target coverage differs from prepared artifact')

def verify_existing_zones(existing, expected_by_id):
    for row in existing:
        original=expected_by_id.get(row['id'])
        if original is None: raise ValueError('Target zone belongs to a different prepared artifact')
        for column in ZONE_COLUMNS:
            value=row[column]
            if column in ('geojson','properties') and isinstance(value,str): value=json.loads(value)
            if value!=original[column]: raise ValueError('Target zone differs from prepared artifact')

def statement(table, columns, row):
    params=[json.dumps(row[c],ensure_ascii=False,separators=(',',':'),allow_nan=False)
            if isinstance(row[c],(dict,list)) else row[c] for c in columns]
    return dict(sql=f"INSERT INTO {table} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)}) ON CONFLICT(id) DO NOTHING",params=params)

def verify(directory):
    receipt=json.loads((directory/'receipt.json').read_text(encoding='utf-8'))
    with (directory/'zones.ndjson').open('rb') as f:
        digest=hashlib.file_digest(f,'sha256').hexdigest()
    if digest!=receipt['ndjsonSha256']: raise ValueError('Prepared artifact hash mismatch')
    count=0; ids=set()
    with (directory/'zones.ndjson').open(encoding='utf-8') as f:
        for line in f:
            row=json.loads(line)
            if row['source_layer']!=receipt['source']['id'] or row['hazard_type']!=receipt['source']['kind']:
                raise ValueError('Prepared source identity mismatch')
            if row['id'] in ids: raise ValueError('Duplicate prepared zone ID')
            ids.add(row['id']); validate_geometry(row)
            if row['properties'].get('source_sha256')!=receipt['archiveSha256']:
                raise ValueError('Prepared archive identity mismatch')
            low,high=row['depth_min_m'],row['depth_max_m']
            if any(x is not None and (not math.isfinite(x) or x<0) for x in (low,high)) or (low is not None and high is not None and low>high):
                raise ValueError('Invalid prepared depth interval')
            statement('hazard_zones',ZONE_COLUMNS,row); count+=1
    if count!=receipt['polygons']: raise ValueError('Prepared polygon count mismatch')
    with (directory/'coverage.json').open('rb') as f:
        coverage_hash=hashlib.file_digest(f,'sha256').hexdigest()
    if coverage_hash!=receipt.get('coverageSha256'): raise ValueError('Coverage artifact hash mismatch')
    coverage=json.loads((directory/'coverage.json').read_text(encoding='utf-8'))
    if len(coverage)!=receipt['coverageRows']: raise ValueError('Coverage count mismatch')
    for row in coverage:
        if row['source_layer']!=receipt['source']['id'] or row['hazard_type']!=receipt['source']['kind']:
            raise ValueError('Coverage source identity mismatch')
        validate_geometry(row)
    if len({row['id'] for row in coverage})!=len(coverage): raise ValueError('Duplicate coverage ID')
    return receipt,coverage

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--directory',type=Path,required=True)
    p.add_argument('--remote',action='store_true'); p.add_argument('--database',choices=['pathguardian'])
    p.add_argument('--node',default='node')
    args=p.parse_args(); receipt,coverage=verify(args.directory)
    if not args.remote:
        print(json.dumps(dict(verified=True,source=receipt['source']['id'],polygons=receipt['polygons'],remote=False))); return
    if args.database!='pathguardian': raise ValueError('Explicit --database pathguardian is required for remote writes')
    config=Path('wrangler.server.jsonc').read_text(encoding='utf-8')
    # The checked-in server template is strict JSON. Select only the exact
    # named binding; do not infer a target from environment/default credentials.
    settings=json.loads(config)
    binding=next(x for x in settings['d1_databases'] if x['database_name']==args.database)
    account=settings['vars']['CLOUDFLARE_ACCOUNT_ID']; database=binding['database_id']
    auth=subprocess.run([args.node,'node_modules/wrangler/bin/wrangler.js','auth','token','--json'],
                        capture_output=True,text=True,check=False)
    if auth.returncode: raise ValueError('Wrangler authentication unavailable; raw output suppressed')
    try: token=json.loads(auth.stdout)['token']
    except (ValueError,KeyError): raise ValueError('Unexpected Wrangler credential response; raw output suppressed') from None
    endpoint=f'https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{database}/query'
    totals=dict(rows_read=0,rows_written=0,requests=0)
    def execute(statements):
        data=json.dumps({'batch':statements},ensure_ascii=False,allow_nan=False).encode('utf-8')
        for attempt in range(5):
            req=urllib.request.Request(endpoint,data=data,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
            try:
                with urllib.request.urlopen(req,timeout=90) as r: payload=json.load(r)
            except urllib.error.HTTPError as ex:
                if ex.code in (429,500,502,503,504) and attempt<4:
                    time.sleep(2**attempt); continue
                raise ValueError(f'D1 request failed (HTTP {ex.code}); response suppressed') from None
            except (TimeoutError,urllib.error.URLError):
                if attempt<4: time.sleep(2**attempt); continue
                raise ValueError('D1 request failed after retries; response suppressed') from None
            if not payload.get('success') or any(not x.get('success') for x in payload.get('result',[])):
                raise ValueError('D1 returned unsuccessful query; raw response suppressed')
            for result in payload['result']:
                for key in ('rows_read','rows_written'): totals[key]+=result.get('meta',{}).get(key,0)
            totals['requests']+=1
            return payload['result']
        raise ValueError('D1 retries exhausted')
    layer=receipt['source']['id']
    expected_rows={}; existing_ids=set()
    with (args.directory/'zones.ndjson').open(encoding='utf-8') as f:
        for line in f:
            row=json.loads(line); expected_rows[row['id']]=row
    # A matching archive can be reprocessed by a different preparation version.
    # Verify the exact ID set before writes so resume cannot mix those artifacts.
    last_id=''
    while True:
        page=execute([dict(sql='SELECT * FROM hazard_zones WHERE source_layer=? AND id>? ORDER BY id LIMIT 500',params=[layer,last_id])])[0]['results']
        verify_existing_zones(page,expected_rows)
        if not page: break
        existing_ids.update(x['id'] for x in page)
        last_id=page[-1]['id']
    versions=execute([dict(sql="SELECT json_extract(properties,'$.source_sha256') AS sha,count(*) AS n FROM hazard_zones WHERE source_layer=? GROUP BY sha",params=[layer])])[0]['results']
    if any(x['sha']!=receipt['archiveSha256'] for x in versions):
        raise ValueError('Target contains a different source archive; refusing all writes')
    existing=sum(x['n'] for x in versions)
    if existing>receipt['polygons']: raise ValueError('Target has unexpected existing rows; refusing to replace data')
    last_id=''
    while True:
        page=execute([dict(sql='SELECT * FROM hazard_zone_coverage WHERE source_layer=? AND id>? ORDER BY id LIMIT 100',params=[layer,last_id])])[0]['results']
        verify_existing_coverage(page,coverage)
        if not page: break
        last_id=page[-1]['id']
    del expected_rows
    batch=[]; batch_bytes=0; written=0
    def flush():
        nonlocal batch,batch_bytes,written
        if not batch: return
        execute(batch); written+=len(batch); batch=[]; batch_bytes=0
        if written%500==0: print(json.dumps(dict(event='importing',source=layer,processed=written,total=receipt['polygons'])),flush=True)
    with (args.directory/'zones.ndjson').open(encoding='utf-8') as f:
        for line in f:
            row=json.loads(line)
            if row['id'] in existing_ids: continue
            item=statement('hazard_zones',ZONE_COLUMNS,row)
            size=len(json.dumps(item,ensure_ascii=False).encode())
            if batch and (len(batch)>=50 or batch_bytes+size>500_000): flush()
            batch.append(item); batch_bytes+=size
        flush()
    actual=execute([dict(sql='SELECT count(*) AS n FROM hazard_zones WHERE source_layer=?',params=[layer])])[0]['results'][0]['n']
    if actual!=receipt['polygons']: raise ValueError('Remote polygon count mismatch; coverage was not published')
    now=datetime.now(timezone.utc).isoformat(); batch=[]; batch_bytes=0
    for row in coverage:
        if row['source_layer']!=layer: raise ValueError('Coverage source identity mismatch')
        row['imported_at']=now
        item=statement('hazard_zone_coverage',COVER_COLUMNS,row)
        size=len(json.dumps(item,ensure_ascii=False).encode())
        if batch and (len(batch)>=50 or batch_bytes+size>500_000): flush()
        batch.append(item); batch_bytes+=size
    flush()
    final=execute([dict(sql='SELECT count(*) AS n FROM hazard_zone_coverage WHERE source_layer=?',params=[layer])])[0]['results'][0]['n']
    if final!=len(coverage): raise ValueError('Remote coverage count mismatch')
    result=dict(source=layer,database=args.database,polygons=actual,coverageRows=final,verifiedAt=now,**totals)
    (args.directory/'import-receipt.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result),flush=True)

if __name__=='__main__': main()
