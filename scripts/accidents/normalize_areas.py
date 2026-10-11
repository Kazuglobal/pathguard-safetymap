"""Offline N03 administrative polygons: JGD2011 to WGS84, one feature per JIS code."""
import argparse
import json
import re
import sqlite3
from contextlib import closing
from pathlib import Path
import shapely
from shapely.geometry import shape
from shapely.ops import unary_union
from pyproj import Transformer
from build_snapshot import digest, stream_features

def normalize(args):
    source=Path(args.input);target=Path(args.output);staging=Path(args.work)
    if target.exists() or staging.exists():raise ValueError('Use new output and staging paths')
    if digest(source)!=args.input_sha256:raise ValueError('Input hash differs from reviewed source')
    with closing(sqlite3.connect(staging)) as db:
        db.execute('PRAGMA cache_size=-8192')
        db.executescript('CREATE TABLE pieces(code TEXT,props TEXT,geometry TEXT);CREATE INDEX by_code ON pieces(code);')
        count=0
        for feature in stream_features(source):
            p=feature['properties'];code=p['N03_007']
            if not isinstance(code,str) or not re.fullmatch(r'\d{5}',code):raise ValueError('Invalid municipal code')
            props={'prefecture':code[:2],'prefectureName':p['N03_001'],'municipality':code,'municipalityName':p['N03_004']+(' / '+p['N03_005'] if p.get('N03_005') else '')}
            db.execute('INSERT INTO pieces VALUES(?,?,?)',(code,json.dumps(props,ensure_ascii=False),json.dumps(feature['geometry'],separators=(',',':'))))
            count+=1
            if count%10000==0:db.commit()
        db.commit()
        converter=Transformer.from_crs('EPSG:6668','EPSG:4326',always_xy=True)
        regions=holes=0
        with target.open('x',encoding='utf-8') as output:
            output.write('{"type":"FeatureCollection","features":[')
            for (code,) in db.execute('SELECT DISTINCT code FROM pieces ORDER BY code'):
                rows=list(db.execute('SELECT props,geometry FROM pieces WHERE code=?',(code,)))
                if len({row[0] for row in rows})!=1:raise ValueError('Conflicting municipality names')
                geometries=[shape(json.loads(row[1])) for row in rows]
                if any(not g.is_valid or g.is_empty or g.geom_type not in ('Polygon','MultiPolygon') for g in geometries):raise ValueError('Invalid source polygon')
                merged=unary_union(geometries)
                if not merged.is_valid or abs(sum(g.area for g in geometries)-merged.area)>max(1e-10,merged.area*1e-8):raise ValueError('Overlapping or invalid polygon pieces')
                result=shapely.transform(merged,converter.transform,interleaved=False)
                if not result.is_valid or result.is_empty or result.geom_type not in ('Polygon','MultiPolygon'):raise ValueError('Invalid transformed polygon')
                holes+=len(result.interiors) if result.geom_type=='Polygon' else sum(len(g.interiors) for g in result.geoms)
                if regions:output.write(',')
                output.write('{"type":"Feature","properties":'+rows[0][0]+',"geometry":'+shapely.to_geojson(result)+'}')
                regions+=1
            output.write(']}')
        if regions!=args.expected_regions:raise ValueError('Municipality coverage differs from reviewed source')
    report={'inputPieces':count,'regions':regions,'outputHoles':holes,'sourceCrs':'EPSG:6668','outputCrs':'EPSG:4326','transformAccuracyMeters':converter.accuracy,'inputSha256':args.input_sha256,'outputSha256':digest(target),'completeCoverageReviewed':False}
    Path(str(target)+'.quality.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ('input','output','work','input-sha256'):parser.add_argument('--'+name,required=True)
    parser.add_argument('--expected-regions',required=True,type=int)
    print(json.dumps(normalize(parser.parse_args())))
