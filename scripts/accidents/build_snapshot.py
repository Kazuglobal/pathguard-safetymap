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
from datetime import datetime
from pathlib import Path

RADII = (10, 20, 30, 50)
CLASSES = {'01': '歩行者と車両', '21': '車両どうし', '41': '車両のみ', '61': '列車が関係する事故'}

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
    if row['municipality_code'] and not re.fullmatch(r'\d{5}',row['municipality_code']): raise ValueError('Invalid municipality')
    if int(row['fatalities'] or 0)<0:raise ValueError('Invalid fatalities')
    key=(year,row['prefecture_code'],row['police_station_code'],row['record_number'])
    if not all(str(v).strip() for v in key): raise ValueError('Missing record identity')
    mask=(1 if any(row[p] in codebook['bicycle'] for p in ('party_a_type_code','party_b_type_code')) else 0)
    if row['accident_type_code'].zfill(2) in codebook['pedestrianClasses'] or any(row[p] in codebook['pedestrian'] for p in ('party_a_type_code','party_b_type_code')): mask |= 2
    stamp=datetime.fromisoformat(row['occurred_at'].replace('Z','+00:00')) if row['occurred_at'] else None
    # Input timestamps must explicitly retain Japan's source clock; reject accidental UTC shifts.
    if stamp and (stamp.utcoffset() is None or stamp.utcoffset().total_seconds()!=32400 or stamp.year!=year): raise ValueError('Timestamp must be source year / +09:00')
    return key,(year,stamp.hour if stamp else -1,mask,int(int(row['fatalities'] or 0)>0),codebook['classes'].get(row['accident_type_code'].zfill(2),'不明'))

def build(args):
    inputs={'records':digest(args.records),'locations':digest(args.locations),'areas':digest(args.areas)}
    manifest=json.loads(Path(args.manifest).read_text(encoding='utf-8'))
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}',manifest['version']): raise ValueError('Invalid version')
    if manifest['review']['inputHashes']!=inputs: raise ValueError('Review does not match inputs')
    if manifest['review']['completeCoverage'] is not True: raise ValueError('Partial data cannot be published as complete')
    if not manifest['years'] or len(set(manifest['years']))!=len(manifest['years']):raise ValueError('Invalid years')
    if not manifest['sources']:raise ValueError('Source attribution required')
    for s in manifest['sources']:
        if not all(s.get(k) for k in ('name','url','license','retrievedAt')) or not s['url'].startswith('https://'): raise ValueError('Source attribution required')
    features=[validate_feature(f) for f in json.loads(Path(args.locations).read_text(encoding='utf-8'))['features']]
    if len({f['properties']['id'] for f in features}) != len(features):raise ValueError('Duplicate location identity')
    boundaries=json.loads(Path(args.areas).read_text(encoding='utf-8'))['features']
    output=Path(args.output); output.mkdir(parents=True,exist_ok=True)
    if (output/'snapshot.sqlite').exists(): raise ValueError('Use a new output directory')
    db=sqlite3.connect(output/'snapshot.sqlite')
    migration=Path(__file__).resolve().parents[2]/'lib/db/traffic-migrations/0002_accident_rankings.sql'
    db.executescript(migration.read_text(encoding='utf-8'))
    db.execute('CREATE TEMP TABLE seen(year INTEGER,prefecture TEXT,station TEXT,number TEXT, fingerprint TEXT,PRIMARY KEY(year,prefecture,station,number))')
    db.execute('CREATE VIRTUAL TABLE temp.candidates USING rtree(idx,minx,maxx,miny,maxy)')
    for i,f in enumerate(features):
        g=f['geometry'];coords=[g['coordinates']] if g['type']=='Point' else g['coordinates']
        db.execute('INSERT INTO candidates VALUES(?,?,?,?,?)',(i,min(p[0] for p in coords),max(p[0] for p in coords),min(p[1] for p in coords),max(p[1] for p in coords)))
    db.execute('CREATE VIRTUAL TABLE temp.boundaries USING rtree(idx,minx,maxx,miny,maxy)')
    for i,f in enumerate(boundaries):
        g=f['geometry']; polys=[g['coordinates']] if g['type']=='Polygon' else g['coordinates'];coords=[p for poly in polys for ring in poly for p in ring]
        db.execute('INSERT INTO boundaries VALUES(?,?,?,?,?)',(i,min(p[0] for p in coords),max(p[0] for p in coords),min(p[1] for p in coords),max(p[1] for p in coords)))
    report={'inputRows':0,'uniqueRecords':0,'duplicates':0,'invalidCoordinates':0,'assigned':0,'uncertain':0,'excluded':0,'radiusComparison':{r:{'assigned':0,'uncertain':0} for r in RADII},'byYear':{}}
    years=set();version=manifest['version']
    for year in manifest['years']:
        codebook=manifest['codebooks'][str(year)]
        if not all(k in codebook for k in ('bicycle','pedestrian','classes','pedestrianClasses')):raise ValueError('Incomplete year-specific codebook')
    datetime.fromisoformat(manifest['updatedAt'].replace('Z','+00:00'))
    # Location/area rows exist before count inserts; snapshot remains unpublished.
    meta={'version':version,'updatedAt':manifest['updatedAt'],'years':manifest['years'],'method':'道路のつながりと立体構造を確認した交差点（30m以内）・道路区間への集計','sources':manifest['sources']}
    db.execute('INSERT INTO accident_snapshots VALUES(?,?,?,?)',(version,0,manifest['updatedAt'],json.dumps(meta,ensure_ascii=False)))
    areas={}
    for f in boundaries:
        p=f['properties'];areas[p['prefecture']]=('',p['prefectureName']);areas[p['municipality']]=(p['prefecture'],p['municipalityName'])
    for code,(parent,name) in areas.items(): db.execute('INSERT INTO accident_areas VALUES(?,?,?,?)',(version,code,parent,name))
    for f in features:
        p=f['properties'];g=f['geometry'];point=g['coordinates'] if g['type']=='Point' else g['coordinates'][len(g['coordinates'])//2]
        scope={'description':'道路との対応が確認できた事故だけを数えています。','radiusMeters':30 if p['kind']=='intersection' else None}
        db.execute('INSERT INTO accident_locations VALUES(?,?,?,?,?,?,?,?,?)',(version,p['id'],p.get('name') or p['address']+'付近',p['kind'],p['prefecture'],p['municipality'],point[1],point[0],json.dumps(scope,ensure_ascii=False)))
    with open(args.records,encoding='utf-8-sig',newline='') as stream:
        for row in csv.DictReader(stream):
            report['inputRows']+=1;key,dim=normalized(row,manifest['codebooks'][row['source_year']])
            fingerprint=hashlib.sha256(json.dumps(row,sort_keys=True).encode()).hexdigest()
            old=db.execute('SELECT fingerprint FROM seen WHERE year=? AND prefecture=? AND station=? AND number=?',key).fetchone()
            if old:
                if old[0]!=fingerprint: raise ValueError('Conflicting duplicate record; review before proceeding')
                report['duplicates']+=1;continue
            db.execute('INSERT INTO seen VALUES(?,?,?,?,?)',(*key,fingerprint));report['uniqueRecords']+=1;years.add(dim[0]);report['byYear'][dim[0]]=report['byYear'].get(dim[0],0)+1
            state='uncertain';location_id=None;pref=row['prefecture_code'];municipality=row['municipality_code']
            try: point=(float(row['longitude']),float(row['latitude']))
            except ValueError: point=(0,0)
            if not all(math.isfinite(p) for p in point) or not (122<=point[0]<=154 and 20<=point[1]<=46):
                report['invalidCoordinates']+=1;state='excluded'
            else:
                x,y=point
                matched=[boundaries[i] for (i,) in db.execute('SELECT idx FROM boundaries WHERE minx<=? AND maxx>=? AND miny<=? AND maxy>=?',(x,x,y,y)) if contains(point,boundaries[i]['geometry'])]
                if len(matched)!=1: state='excluded'
                else:
                    region=matched[0]['properties'];pref=region['prefecture'];municipality=region['municipality']
                    possible=[features[i] for (i,) in db.execute('SELECT idx FROM candidates WHERE minx<=? AND maxx>=? AND miny<=? AND maxy>=?',(x+.001,x-.001,y+.001,y-.001))]
                    for radius in RADII:
                        candidate_id=assign(point,possible,radius)
                        candidate=next((f for f in possible if f['properties']['id']==candidate_id),None)
                        same_area=candidate and (candidate['properties']['prefecture'],candidate['properties']['municipality'])==(pref,municipality)
                        report['radiusComparison'][radius]['assigned' if same_area else 'uncertain']+=1
                    location_id=assign(point,possible)
                    if location_id:
                        p=next(f['properties'] for f in possible if f['properties']['id']==location_id)
                        if (p['prefecture'],p['municipality'])!=(pref,municipality):location_id=None
                    if location_id:state='assigned'
            report[state]+=1
            quality=[int(state==s) for s in ('assigned','uncertain','excluded')]
            db.execute('INSERT INTO accident_quality_counts VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(version,prefecture,municipality,year,hour,participants,fatal) DO UPDATE SET assigned=assigned+excluded.assigned,uncertain=uncertain+excluded.uncertain,excluded=excluded+excluded.excluded',(version,pref,municipality,*dim[:4],*quality))
            if location_id:db.execute('INSERT INTO accident_location_counts VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(version,location_id,year,hour,participants,fatal,accident_class) DO UPDATE SET count=count+1',(version,location_id,*dim))
    if report['uniqueRecords'] != manifest['review']['expectedUniqueRecords']:raise ValueError('Source total differs')
    if sorted(years)!=sorted(manifest['years']):raise ValueError('Year coverage differs')
    if sum(report[k] for k in ('assigned','uncertain','excluded'))!=report['uniqueRecords']:raise ValueError('Reconciliation failed')
    db.commit()
    (output/'quality.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    # Version is immutable; no deletes/updates of existing production accident data.
    with (output/'stage.sql').open('w',encoding='utf-8') as stream:
        for table in ('accident_snapshots','accident_areas','accident_locations','accident_location_counts','accident_quality_counts'):
            for row in db.execute('SELECT * FROM '+table):
                values=','.join('NULL' if v is None else str(v) if isinstance(v,(int,float)) else "'"+v.replace("'","''")+"'" for v in row)
                stream.write('INSERT INTO '+table+' VALUES('+values+');\n')
    (output/'publish.sql').write_text("UPDATE accident_snapshots SET published=1 WHERE version='"+version+"';\n",encoding='utf-8')
    db.close();print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ('records','locations','areas','manifest','output'):parser.add_argument('--'+name,required=True)
    build(parser.parse_args())
