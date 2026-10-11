"""Offline, streaming aggregation of normalized accident CSV against reviewed road geometry.

No network access, no production writes. Generates a NEW local SQLite database and D1 SQL.
Input contract and review gate are documented in docs/operations/accident-rankings.md.
"""
import argparse
import csv
import hashlib
import json
import math
import re
import sqlite3
from collections import OrderedDict
from contextlib import ExitStack, closing
from datetime import datetime
from pathlib import Path

RADII = (10, 20, 30, 50)
CLASSES = {'01': '歩行者と車両', '21': '車両どうし', '41': '車両のみ', '61': '列車が関係する事故'}
REQUIRED_HIGHWAYS = frozenset({'motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','living_street','service','cycleway','pedestrian','footway','path'})

def reviewed_highway_scope(locations, review):
    """Bind the reviewed extraction scope to the hashed geometry input."""
    import ijson
    with open(locations,'rb') as stream:
        scope=next(ijson.items(stream,'highwayScope'),None)
    if (not isinstance(scope,list) or not all(isinstance(v,str) for v in scope)
        or len(scope)!=len(set(scope)) or not REQUIRED_HIGHWAYS.issubset(scope)):
        raise ValueError('Road geometry lacks required bicycle/pedestrian highway coverage')
    if review.get('highwayScopeReviewed') is not True or review.get('highwayScope')!=scope:
        raise ValueError('Road highway scope has not been reviewed against geometry')
    return scope

def stream_features(path):
    """Large GeoJSON requires the streaming reader; fixtures may use the stdlib."""
    try:
        import ijson
    except ImportError:
        if Path(path).stat().st_size > 10 * 1024 * 1024:
            raise RuntimeError('Install scripts/accidents/requirements.txt for large GeoJSON inputs')
        yield from json.loads(Path(path).read_text(encoding='utf-8'))['features']
        return
    with open(path, 'rb') as stream:
        yield from ijson.items(stream, 'features.item', use_float=True)

class SpatialStore:
    """Offline disk index. Only nearby candidates and a bounded boundary cache live in RAM."""
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.execute('PRAGMA cache_size=-8192')
        self.db.execute('CREATE TABLE features(idx INTEGER PRIMARY KEY, kind TEXT, identity TEXT, body TEXT, UNIQUE(kind,identity))')
        self.db.execute('CREATE VIRTUAL TABLE boxes USING rtree(idx,minx,maxx,miny,maxy)')
        self.cache = OrderedDict()
        self.cache_bytes = 0

    def ingest(self, path, kind):
        count = 0
        for feature in stream_features(path):
            if kind == 'candidate': validate_feature(feature)
            geometry = feature['geometry']; props = feature['properties']
            if kind == 'boundary' and geometry['type'] not in ('Polygon', 'MultiPolygon'):
                raise ValueError('Invalid boundary geometry')
            if kind == 'boundary':
                polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
                coordinates = (p for polygon in polygons for ring in polygon for p in ring)
            else:
                coordinates = iter([geometry['coordinates']] if geometry['type'] == 'Point' else geometry['coordinates'])
            minx = miny = float('inf'); maxx = maxy = -float('inf')
            for x,y in coordinates:
                if not math.isfinite(x) or not math.isfinite(y): raise ValueError('Invalid spatial bounds')
                minx = min(minx,x); maxx = max(maxx,x); miny = min(miny,y); maxy = max(maxy,y)
            if not math.isfinite(minx): raise ValueError('Empty geometry')
            # Normalized boundaries must have one feature per municipality.
            identity = props['id'] if kind == 'candidate' else props['municipality']
            try:
                cursor = self.db.execute('INSERT INTO features(kind,identity,body) VALUES(?,?,?)', (kind,identity,json.dumps(feature,ensure_ascii=False)))
            except sqlite3.IntegrityError as error:
                raise ValueError('Duplicate spatial identity') from error
            self.db.execute('INSERT INTO boxes VALUES(?,?,?,?,?)', (cursor.lastrowid,minx,maxx,miny,maxy))
            count += 1
            if count % 5000 == 0: self.db.commit()
        self.db.commit()
        if not count: raise ValueError('No spatial features supplied')
        return count

    def nearby(self, point, kind, margin=0, identities_only=False):
        x,y = point
        columns='f.idx' if identities_only else 'f.idx,f.body'
        # Pin RTree first: the kind/identity index must not scan all national roads.
        return self.db.execute('SELECT '+columns+' FROM boxes b CROSS JOIN features f WHERE f.idx=b.idx AND f.kind=? AND b.minx<=? AND b.maxx>=? AND b.miny<=? AND b.maxy>=?', (kind,x+margin,x-margin,y+margin,y-margin))

    def matching_boundaries(self, point):
        for (idx,) in self.nearby(point, 'boundary', identities_only=True):
            cached = self.cache.pop(idx, None)
            if cached is not None: self.cache_bytes -= cached[2]
            if cached is None:
                body=self.db.execute('SELECT body FROM features WHERE idx=?',(idx,)).fetchone()[0]
                feature = json.loads(body)
                try:
                    from shapely.geometry import shape
                    from shapely.prepared import prep
                    geometry = shape(feature['geometry'])
                    if not geometry.is_valid: raise ValueError('Invalid administrative polygon')
                    prepared = prep(geometry)
                    estimated_bytes=len(geometry.wkb)*4+len(json.dumps(feature['properties']).encode('utf-8'))*8
                except ImportError:
                    if len(body) > 1024 * 1024:
                        raise RuntimeError('Install scripts/accidents/requirements.txt for large boundaries')
                    prepared = None
                    estimated_bytes=len(body.encode('utf-8'))*8
                if prepared is not None: feature={'properties':feature['properties']}
                # Native cache retains properties + GEOS geometry, not the parsed JSON rings.
                if estimated_bytes>32*1024*1024:
                    raise RuntimeError('Boundary exceeds geometry cache budget; subdivide and review before processing')
                cached = (feature, prepared, estimated_bytes)
            self.cache[idx] = cached; self.cache_bytes += cached[2]
            while self.cache and (len(self.cache) > 16 or self.cache_bytes > 32 * 1024 * 1024):
                _, evicted = self.cache.popitem(last=False); self.cache_bytes -= evicted[2]
            feature,prepared,_ = cached
            if prepared is not None:
                from shapely.geometry import Point
                inside = prepared.contains(Point(*point))
            else: inside = contains(point,feature['geometry'])
            if inside: yield feature

    def close(self):
        self.cache.clear()
        self.db.close()

def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()

def distance(point, geometry):
    """Local metric projection about query point, for short candidate distances only."""
    x, y = point
    def project(p):
        return ((p[0]-x)*111195*math.cos(math.radians(y)), (p[1]-y)*111195)
    coords = [geometry['coordinates']] if geometry['type'] == 'Point' else geometry['coordinates']
    projected = list(map(project, coords))
    if len(projected) == 1: return math.hypot(*projected[0])
    result = float('inf')
    for a,b in zip(projected,projected[1:]):
        dx,dy = b[0]-a[0], b[1]-a[1]
        t = max(0,min(1,-(a[0]*dx+a[1]*dy)/(dx*dx+dy*dy))) if dx or dy else 0
        result = min(result,math.hypot(a[0]+t*dx,a[1]+t*dy))
    return result

def in_ring(point, ring):
    x,y = point; inside = False
    for a,b in zip(ring,ring[1:]):
        if (a[1]>y)!=(b[1]>y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: inside = not inside
    return inside

def contains(point, geometry):
    polygons = [geometry['coordinates']] if geometry['type']=='Polygon' else geometry['coordinates']
    return any(in_ring(point,p[0]) and not any(in_ring(point,h) for h in p[1:]) for p in polygons)

def assign(point, candidates, radius=30):
    nearby = [(c,distance(point,c['geometry'])) for c in candidates]
    nearby = [(c,d) for c,d in nearby if d <= (radius if c['properties']['kind']=='intersection' else 20)]
    if not nearby: return None
    # Coordinates cannot resolve elevation. Never prefer an arbitrary upper/lower road.
    if len({str(c['properties']['layer']) for c,d in nearby}) > 1: return None
    if any(str(c['properties']['layer']) not in ('0','0_no_no') for c,d in nearby): return None
    junctions = [c for c,d in nearby if c['properties']['kind']=='intersection']
    chosen = junctions if junctions else [c for c,d in nearby]
    if len(chosen) != 1 or not chosen[0]['properties']['reviewed']: return None
    return chosen[0]['properties']['id']

def validate_feature(f):
    p=f['properties'];g=f['geometry']
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}',p['id']): raise ValueError('Invalid location ID')
    if p['kind'] not in ('intersection','road'): raise ValueError('Invalid location kind')
    if g['type'] != ('Point' if p['kind']=='intersection' else 'LineString'): raise ValueError('Invalid geometry')
    if not isinstance(p['reviewed'],bool) or 'layer' not in p: raise ValueError('Review/layer required')
    coordinates=[g['coordinates']] if g['type']=='Point' else g['coordinates']
    if not coordinates or any(len(c)!=2 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in c) or not (122<=c[0]<=154 and 20<=c[1]<=46) for c in coordinates):raise ValueError('Invalid location coordinates')
    if not re.fullmatch(r'\d{2}',p['prefecture']) or not re.fullmatch(r'\d{5}',p['municipality']): raise ValueError('Invalid area')
    return f

def normalized(row, codebook):
    year=int(row['source_year'])
    if year < 2018 or year > 2100: raise ValueError('Invalid source year')
    if not re.fullmatch(r'\d{2}',row['prefecture_code']): raise ValueError('Invalid source prefecture')
    if not re.fullmatch(r'\d{2}',row['source_prefecture_code']): raise ValueError('Original NPA prefecture required')
    if row['municipality_code'] and not re.fullmatch(r'\d{5}',row['municipality_code']): raise ValueError('Invalid municipality')
    if int(row['fatalities'] or 0)<0:raise ValueError('Invalid fatalities')
    # Preserve NPA jurisdiction (Hokkaido has five), even after mapping display areas to JIS.
    key=(year,row['source_prefecture_code'],row['police_station_code'],row['record_number'])
    if not all(str(v).strip() for v in key): raise ValueError('Missing record identity')
    mask=(1 if any(row[p] in codebook['bicycle'] for p in ('party_a_type_code','party_b_type_code')) else 0)
    if row['accident_type_code'].zfill(2) in codebook['pedestrianClasses'] or any(row[p] in codebook['pedestrian'] for p in ('party_a_type_code','party_b_type_code')): mask |= 2
    stamp=datetime.fromisoformat(row['occurred_at'].replace('Z','+00:00')) if row['occurred_at'] else None
    # Input timestamps must explicitly retain Japan's source clock; reject accidental UTC shifts.
    if stamp and (stamp.utcoffset() is None or stamp.utcoffset().total_seconds()!=32400 or stamp.year>year): raise ValueError('Invalid occurrence year / timezone')
    return key,(stamp.year if stamp else -1,stamp.hour if stamp else -1,mask,int(int(row['fatalities'] or 0)>0),codebook['classes'].get(row['accident_type_code'].zfill(2),'不明'))

def _build(args, resources):
    inputs={'records':digest(args.records),'locations':digest(args.locations),'areas':digest(args.areas)}
    manifest=json.loads(Path(args.manifest).read_text(encoding='utf-8'))
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}',manifest['version']): raise ValueError('Invalid version')
    if manifest['review']['inputHashes']!=inputs: raise ValueError('Review does not match inputs')
    if manifest['review']['completeCoverage'] is not True: raise ValueError('Partial data cannot be published as complete')
    highway_scope=reviewed_highway_scope(args.locations,manifest['review'])
    if not manifest['years'] or len(set(manifest['years']))!=len(manifest['years']):raise ValueError('Invalid years')
    if not manifest['sourceYears'] or any(not isinstance(y,int) or y<2018 or y>2100 for y in manifest['sourceYears']+manifest['years']):raise ValueError('Invalid source/occurrence coverage')
    if not manifest['sources']:raise ValueError('Source attribution required')
    for s in manifest['sources']:
        if not all(s.get(k) for k in ('name','url','license','retrievedAt')) or not s['url'].startswith('https://'): raise ValueError('Source attribution required')
    output=Path(args.output); output.mkdir(parents=True,exist_ok=True)
    if (output/'snapshot.sqlite').exists(): raise ValueError('Use a new output directory')
    db=resources.enter_context(closing(sqlite3.connect(output/'snapshot.sqlite')))
    db.execute('PRAGMA temp_store=FILE')
    db.execute('PRAGMA cache_size=-8192')
    spatial=resources.enter_context(closing(SpatialStore(output/'offline-spatial.sqlite')))
    spatial.ingest(args.locations,'candidate')
    spatial.ingest(args.areas,'boundary')
    migration=Path(__file__).resolve().parents[2]/'lib/db/traffic-migrations/0002_accident_rankings.sql'
    db.executescript(migration.read_text(encoding='utf-8'))
    db.execute('CREATE TEMP TABLE seen(year INTEGER,prefecture TEXT,station TEXT,number TEXT, fingerprint TEXT,PRIMARY KEY(year,prefecture,station,number))')
    report={'inputRows':0,'uniqueRecords':0,'duplicates':0,'invalidCoordinates':0,'missingDate':0,'outsidePeriod':0,'administrativeCodeMismatch':0,'assigned':0,'uncertain':0,'excluded':0,'radiusComparison':{r:{'assigned':0,'uncertain':0} for r in RADII},'byYear':{}}
    years=set();version=manifest['version']
    for year in manifest['sourceYears']:
        codebook=manifest['codebooks'][str(year)]
        if not all(k in codebook for k in ('bicycle','pedestrian','classes','pedestrianClasses')):raise ValueError('Incomplete year-specific codebook')
    datetime.fromisoformat(manifest['updatedAt'].replace('Z','+00:00'))
    # Location/area rows exist before count inserts; snapshot remains unpublished.
    meta={'version':version,'updatedAt':manifest['updatedAt'],'years':manifest['years'],'sourceYears':manifest['sourceYears'],'method':'指定した公開年度の原本に含まれる事故を発生年で集計。道路のつながりと立体構造を確認した交差点（30m以内）・道路区間が対象','sources':manifest['sources']}
    meta['highwayScope']=highway_scope
    db.execute('INSERT INTO accident_snapshots VALUES(?,?,?,?)',(version,0,manifest['updatedAt'],json.dumps(meta,ensure_ascii=False)))
    areas={}
    for (body,) in spatial.db.execute("SELECT body FROM features WHERE kind='boundary'"):
        f=json.loads(body)
        p=f['properties'];areas[p['prefecture']]=('',p['prefectureName']);areas[p['municipality']]=(p['prefecture'],p['municipalityName'])
    for code,(parent,name) in areas.items(): db.execute('INSERT INTO accident_areas VALUES(?,?,?,?)',(version,code,parent,name))
    with open(args.records,encoding='utf-8-sig',newline='') as stream:
        for row in csv.DictReader(stream):
            if int(row['source_year']) not in manifest['sourceYears']:raise ValueError('Unreviewed source year')
            report['inputRows']+=1;key,dim=normalized(row,manifest['codebooks'][row['source_year']])
            fingerprint=hashlib.sha256(json.dumps(row,sort_keys=True).encode()).hexdigest()
            old=db.execute('SELECT fingerprint FROM seen WHERE year=? AND prefecture=? AND station=? AND number=?',key).fetchone()
            if old:
                if old[0]!=fingerprint: raise ValueError('Conflicting duplicate record; review before proceeding')
                report['duplicates']+=1;continue
            db.execute('INSERT INTO seen VALUES(?,?,?,?,?)',(*key,fingerprint));report['uniqueRecords']+=1;years.add(key[0]);report['byYear'][dim[0]]=report['byYear'].get(dim[0],0)+1
            state='uncertain';location_id=None;pref=row['prefecture_code'];municipality=row['municipality_code']
            try: point=(float(row['longitude']),float(row['latitude']))
            except ValueError: point=(0,0)
            if dim[0]==-1:
                report['missingDate']+=1;state='excluded'
            elif dim[0] not in manifest['years']:
                report['outsidePeriod']+=1;state='excluded'
            elif not all(math.isfinite(p) for p in point) or not (122<=point[0]<=154 and 20<=point[1]<=46):
                report['invalidCoordinates']+=1;state='excluded'
            else:
                x,y=point
                matched=list(spatial.matching_boundaries(point))
                if len(matched)!=1: state='excluded'
                elif (matched[0]['properties']['prefecture'],matched[0]['properties']['municipality'])!=(pref,municipality):
                    # A current boundary cannot silently override the source jurisdiction.
                    report['administrativeCodeMismatch']+=1
                else:
                    region=matched[0]['properties'];pref=region['prefecture'];municipality=region['municipality']
                    possible=[json.loads(body) for _,body in spatial.nearby(point,'candidate',.001)]
                    for radius in RADII:
                        candidate_id=assign(point,possible,radius)
                        candidate=next((f for f in possible if f['properties']['id']==candidate_id),None)
                        same_area=candidate and (candidate['properties']['prefecture'],candidate['properties']['municipality'])==(pref,municipality)
                        report['radiusComparison'][radius]['assigned' if same_area else 'uncertain']+=1
                    location_id=assign(point,possible)
                    if location_id:
                        p=next(f['properties'] for f in possible if f['properties']['id']==location_id)
                        if (p['prefecture'],p['municipality'])!=(pref,municipality):location_id=None
                    if location_id:
                        state='assigned'
                        feature=next(f for f in possible if f['properties']['id']==location_id)
                        p=feature['properties'];g=feature['geometry']
                        center=g['coordinates'] if g['type']=='Point' else g['coordinates'][len(g['coordinates'])//2]
                        scope={'description':'道路との対応が確認できた事故だけを数えています。','radiusMeters':30 if p['kind']=='intersection' else None}
                        db.execute('INSERT OR IGNORE INTO accident_locations VALUES(?,?,?,?,?,?,?,?,?)',(version,p['id'],p.get('name') or p['address']+'付近',p['kind'],pref,municipality,center[1],center[0],json.dumps(scope,ensure_ascii=False)))
            report[state]+=1
            quality=[int(state==s) for s in ('assigned','uncertain','excluded')]
            db.execute('INSERT INTO accident_quality_counts VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(version,prefecture,municipality,year,hour,participants,fatal) DO UPDATE SET assigned=assigned+excluded.assigned,uncertain=uncertain+excluded.uncertain,excluded=excluded+excluded.excluded',(version,pref,municipality,*dim[:4],*quality))
            if location_id:db.execute('INSERT INTO accident_location_counts VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(version,location_id,year,hour,participants,fatal,accident_class) DO UPDATE SET count=count+1',(version,location_id,*dim))
    if report['uniqueRecords'] != manifest['review']['expectedUniqueRecords']:raise ValueError('Source total differs')
    if sorted(years)!=sorted(set(manifest['sourceYears'])):raise ValueError('Source year coverage differs')
    if sum(report[k] for k in ('assigned','uncertain','excluded'))!=report['uniqueRecords']:raise ValueError('Reconciliation failed')
    meta['reconciliation']={k:report[k] for k in ('uniqueRecords','assigned','uncertain','excluded','missingDate','outsidePeriod','invalidCoordinates','administrativeCodeMismatch')}
    db.execute('UPDATE accident_snapshots SET metadata_json=? WHERE version=?',(json.dumps(meta,ensure_ascii=False),version))
    db.commit()
    (output/'quality.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    # Version is immutable; no deletes/updates of existing production accident data.
    with (output/'stage.sql').open('w',encoding='utf-8') as stream:
        for table in ('accident_snapshots','accident_areas','accident_locations','accident_location_counts','accident_quality_counts'):
            for row in db.execute('SELECT * FROM '+table):
                values=','.join('NULL' if v is None else str(v) if isinstance(v,(int,float)) else "'"+v.replace("'","''")+"'" for v in row)
                stream.write('INSERT INTO '+table+' VALUES('+values+');\n')
    (output/'publish.sql').write_text("UPDATE accident_snapshots SET published=1 WHERE version='"+version+"';\n",encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))

def build(args):
    with ExitStack() as resources:
        return _build(args, resources)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ('records','locations','areas','manifest','output'):parser.add_argument('--'+name,required=True)
    build(parser.parse_args())
