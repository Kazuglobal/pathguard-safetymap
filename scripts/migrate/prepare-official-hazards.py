"""Download and normalize official MLIT inundation data; no remote DB writes.

Run --catalog, then --prepare SOURCE_ID or all. Data lives in the ignored
artifacts/migration directory. No simplification, no invented survey coverage.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import time
import urllib.request
from urllib.parse import urljoin, urlparse
import zipfile

import ijson
from pyproj import CRS, Transformer
from shapely import get_num_coordinates, make_valid, union_all
from shapely.geometry import box, mapping, shape
from shapely.ops import transform

FLOOD_PAGE = 'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A31b-2025.html'
TSUNAMI_PAGE = 'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A40-2024.html'
HELD = {'04': 'prefectural terms pending review', '12': 'prefectural explanation pending review',
        '24': 'prefectural terms pending review', '26': 'prior contact required',
        '32': 'prefectural terms pending review', '37': 'not distributed',
        '42': 'prior contact required', '44': 'prefectural terms pending review'}
DEPTHS = {1: (0, .5), 2: (.5, 3), 3: (3, 5), 4: (5, 10), 5: (10, 20), 6: (20, None)}
PREFECTURES = '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split()

def source_manifest(inventory):
    result={}
    for entry in inventory['sources']:
        flood=entry['kind']=='flood'
        region='1次メッシュ'+entry['region'] if flood else PREFECTURES[int(entry['region'])-1]+'（当該年度版の収録範囲）'
        result[entry['id']]=dict(region=region,
            name='国土数値情報・洪水浸水想定区域（想定最大規模）' if flood else '国土数値情報・津波浸水想定',
            dataYear=2000+entry['year'],url=entry['page'])
    return result

def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)

def digest(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def save(path, value):
    pending = path.with_suffix(path.suffix+'.pending')
    pending.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    pending.replace(path)

def checked_url(url):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname != 'nlftp.mlit.go.jp' or parsed.query:
        raise ValueError('Expected an HTTPS official MLIT source')
    return url

def downloads(page):
    with urllib.request.urlopen(checked_url(page), timeout=60) as r:
        checked_url(r.url)
        html = r.read().decode('utf-8')
    return [(size, name, checked_url(urljoin(page, relative))) for size, name, relative in
            re.findall(r"DownLd\('([^']+)','([^']+)','([^']+)'", html)]

def catalog(root):
    flood = {}
    for size, name, url in downloads(FLOOD_PAGE):
        m = re.fullmatch(r'A31b-(\d+)_20_(\d{4})_GEOJSON.zip', name)
        if m and (m[2] not in flood or int(m[1]) > flood[m[2]]['year']):
            flood[m[2]] = dict(id=name[:-4], kind='flood', year=int(m[1]), region=m[2],
                               filename=name, size=size, url=url, page=FLOOD_PAGE, license='CC-BY-4.0')
    tsunami = {}
    for size, name, url in downloads(TSUNAMI_PAGE):
        m = re.fullmatch(r'A40-(\d+)_(\d{2})_GML.zip', name)
        if m:
            tsunami.setdefault(m[2], []).append(dict(id=name[:-4], kind='tsunami', year=int(m[1]),
                region=m[2], filename=name, size=size, url=url, page=TSUNAMI_PAGE,
                license='MLIT current A40 page: commercial use and redistribution permitted'))
    entries = list(flood.values())
    for pref, values in tsunami.items():
        if pref in HELD: continue
        latest = max(x['year'] for x in values)
        # Never combine an older higher depth with a revised lower depth.
        # Latest pre-2023 editions may be geographically incomplete. Keep the
        # older territory unrecorded until its non-overlapping survey extent is
        # verified, rather than inventing precedence from hazard footprints.
        entries.extend([x for x in values if x['year']==latest])
    if len(flood)<47 or len(tsunami)<30:
        raise ValueError('Official source inventory changed; inspect before continuing')
    save(root/'catalog.json', dict(schemaVersion=1, sources=sorted(entries, key=lambda x:x['id']), held=HELD))
    print(compact(dict(event='catalog', flood=len(flood), tsunami=len(entries)-len(flood), held=HELD)), flush=True)

def download(entry, root):
    dest = root/'raw'/entry['filename']
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        if shutil.disk_usage(root).free<1_500_000_000:
            raise ValueError('Less than 1.5GB disk available; stop before download')
        pending = dest.with_suffix('.pending')
        with urllib.request.urlopen(checked_url(entry['url']), timeout=120) as source:
            checked_url(source.url)
            with pending.open('wb') as target:
                while chunk:=source.read(1024*1024): target.write(chunk)
        pending.replace(dest)
    with zipfile.ZipFile(dest) as z:
        if z.testzip() is not None: raise ValueError('Archive checksum failed')
    return dest

def polygon_parts(g):
    if g.is_empty: return
    if g.geom_type=='Polygon': yield g
    elif g.geom_type in ('MultiPolygon','GeometryCollection'):
        for p in g.geoms: yield from polygon_parts(p)
    # Exact clipping can create zero-area lines on shared edges; omit those.

def subdivide(g, level=0):
    for p in polygon_parts(g):
        if get_num_coordinates(p)<=3000:
            yield p
            continue
        if level>=24: raise ValueError('Cannot subdivide polygon within safety bounds')
        w,s,e,n = p.bounds
        if e-w>=n-s:
            m=(w+e)/2; clips=(box(w,s,m,n),box(m,s,e,n))
        else:
            m=(s+n)/2; clips=(box(w,s,e,m),box(w,m,e,n))
        for clip in clips: yield from subdivide(p.intersection(clip),level+1)

def tsunami_depth(value):
    text=str(value).replace('ｍ','m').replace('．','.')
    nums=[float(x) for x in re.findall(r'\d+(?:\.\d+)?',text)]
    if len(nums)==2 and nums[0]<nums[1] and 'm' in text: return tuple(nums)
    if len(nums)==1 and 'm' in text:
        if '未満' in text or '以下' in text: return (0,nums[0])
        if '以上' in text: return (nums[0],None)
    raise ValueError('Unknown official tsunami depth class: '+repr(text))

def risk(depth):
    low,high=depth
    if low>=10 or (high is not None and high>10): return 5
    if high is None: return 4 if low>=5 else 3 if low>=3 else 2 if low>=.5 else 1
    return 1 if high<=.5 else 2 if high<=3 else 3 if high<=5 else 4

def prepare(entry,root):
    directory=root/'prepared'/entry['id']; directory.mkdir(parents=True,exist_ok=True)
    if (directory/'receipt.json').exists():
        print(compact(dict(event='already_prepared',id=entry['id'])),flush=True); return
    started=time.monotonic(); src=download(entry,root); sha=digest(src)
    grouped={}; partial={}; counts={}; areas={}; samples=[]; repairs=0
    with zipfile.ZipFile(src) as z:
        names=[n for n in z.namelist() if n.lower().endswith('.geojson')]
        if entry['kind']=='flood': names=[n for n in names if re.search(r'(^|/)A31b-20-',n)]
        if len(names)!=1: raise ValueError('Expected exactly one applicable GeoJSON')
        with z.open(names[0]) as f: header=f.read(2048).decode('utf-8-sig')
        crs_match=re.search(r'EPSG::?(\d+)',header)
        if not crs_match: raise ValueError('Missing source CRS')
        source_crs=CRS.from_epsg(int(crs_match[1]))
        if not source_crs.is_geographic: raise ValueError('Expected geographic source CRS')
        converter=Transformer.from_crs(source_crs,4326,always_xy=True)
        with z.open(names[0]) as f:
            for feature in ijson.items(f,'features.item',use_float=True):
                p=feature['properties']
                if entry['kind']=='flood':
                    code=p.get('A31b_201')
                    if code not in DEPTHS: raise ValueError('Unknown maximum-scale depth code')
                    depth=DEPTHS[code]
                else:
                    if str(p.get('A40_002','')).zfill(2)!=entry['region']:
                        raise ValueError('Unexpected tsunami prefecture')
                    depth=tsunami_depth(p.get('A40_003'))
                g=transform(converter.transform,shape(feature['geometry']))
                if g.is_empty: raise ValueError('Empty source polygon')
                if not g.is_valid:
                    fixed=union_all(list(polygon_parts(make_valid(g))))
                    if fixed.is_empty or not fixed.is_valid or not math.isclose(fixed.area,g.area,rel_tol=1e-8,abs_tol=1e-14):
                        raise ValueError('Source repair changes area; manual source inspection required')
                    g=fixed; repairs+=1
                w,s,e,n=g.bounds
                if not all(math.isfinite(x) for x in g.bounds) or not (122<=w<=e<=154 and 20<=s<=n<=46):
                    raise ValueError('Geometry is outside Japan coordinate bounds')
                grouped.setdefault(depth,[]).append(g); counts[depth]=counts.get(depth,0)+1
                areas[depth]=areas.get(depth,0)+g.area
                if len(samples)<4:
                    point=g.representative_point(); samples.append(dict(longitude=point.x,latitude=point.y,depth=depth))
                if len(grouped[depth])>=2000:
                    partial.setdefault(depth,[]).append(union_all(grouped[depth])); grouped[depth]=[]
    output=directory/'zones.ndjson'; pending=output.with_suffix('.ndjson.pending')
    count=0; coverage=[]; checks=[]
    with pending.open('w',encoding='utf-8',newline='\n') as target:
        for depth in sorted(counts,key=lambda x:(x[0],x[1] or math.inf)):
            merged=union_all(partial.get(depth,[])+grouped.get(depth,[])); produced=0
            if merged.area>areas[depth]*(1+1e-8): raise ValueError('Dissolve increased hazard area')
            for part in subdivide(merged):
                geometry=mapping(part); encoded=compact(geometry)
                if len(encoded.encode())>200_000: raise ValueError('Prepared polygon exceeds request safety bound')
                identity=hashlib.sha256((entry['id']+sha+compact(depth)+encoded).encode()).hexdigest()
                row=dict(id='mlit:'+identity,zone_group_id=entry['id']+':'+compact(depth),hazard_type=entry['kind'],
                    source_layer=entry['id'],risk_level=risk(depth),depth_min_m=depth[0],depth_max_m=depth[1],
                    area_context='riverside' if entry['kind']=='flood' else 'coastal',geojson=geometry,
                    properties=dict(source='国土数値情報（国土交通省）',source_url=entry['page'],download_url=entry['url'],
                        source_sha256=sha,source_year=2000+entry['year'],region_label=entry['region'],
                        processing='area-preserving validity repair, same-depth dissolve and exact subdivision; no simplification'))
                row.update(zip(('bbox_min_lng','bbox_min_lat','bbox_max_lng','bbox_max_lat'),part.bounds))
                target.write(compact(row)+'\n'); produced+=part.area; count+=1
            if not math.isclose(produced,merged.area,rel_tol=1e-8,abs_tol=1e-12): raise ValueError('Subdivision changed hazard area')
            checks.append(dict(depth=depth,sourceFeatures=counts[depth],sourceArea=areas[depth],outputArea=produced))
            coverage.append(merged)
    pending.replace(output)
    if count==0: raise ValueError('No hazard polygons prepared')
    # A bounding rectangle is not evidence of survey coverage. Conservative
    # coverage uses the exact hazard footprint until survey extents are verified.
    cover=[]
    for index,part in enumerate(subdivide(union_all(coverage))):
        cover.append(dict(id=entry['id']+':coverage:'+str(index),coverage_group_id=entry['id'],
            hazard_type=entry['kind'],region_label=entry['region']+':'+str(index),
            source='国土数値情報（国土交通省） '+entry['page'],source_layer=entry['id'],geojson=mapping(part),
            imported_features=count,bbox_min_lng=part.bounds[0],bbox_min_lat=part.bounds[1],
            bbox_max_lng=part.bounds[2],bbox_max_lat=part.bounds[3]))
    save(directory/'coverage.json',cover)
    receipt=dict(source=entry,archiveSha256=sha,sourceCrs=source_crs.to_string(),outputCrs='EPSG:4326',
        sourceFeatures=sum(counts.values()),polygons=count,ndjsonBytes=output.stat().st_size,ndjsonSha256=digest(output),
        coverageRows=len(cover),coverageSha256=digest(directory/'coverage.json'),
        coveragePolicy='exact hazard footprint; outside not inferred',samples=samples,validityRepairs=repairs,
        areaChecks=checks,elapsedSeconds=round(time.monotonic()-started,2))
    save(directory/'receipt.json',receipt)
    print(compact(dict(event='prepared',id=entry['id'],polygons=count,bytes=receipt['ndjsonBytes'],seconds=receipt['elapsedSeconds'])),flush=True)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path('artifacts/migration/hazards'))
    p.add_argument('--catalog',action='store_true'); p.add_argument('--prepare')
    p.add_argument('--manifest',type=Path,help='Write verified catalog source metadata for the application')
    args=p.parse_args(); args.root.mkdir(parents=True,exist_ok=True)
    if args.catalog: catalog(args.root)
    if args.manifest:
        inventory=json.loads((args.root/'catalog.json').read_text(encoding='utf-8'))
        save(args.manifest,source_manifest(inventory))
    if args.prepare:
        inventory=json.loads((args.root/'catalog.json').read_text(encoding='utf-8'))
        selected=[x for x in inventory['sources'] if args.prepare in ('all',x['id'])]
        if not selected: raise ValueError('Source is absent from the permitted catalog')
        for entry in selected: prepare(entry,args.root)

if __name__=='__main__': main()
