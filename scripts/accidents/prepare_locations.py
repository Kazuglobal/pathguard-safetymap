"""Build candidate geometry from OSM node/way JSON + normalized MLIT boundaries.
All candidates start UNREVIEWED. Coordinates that cross without sharing a node never connect.
"""
import argparse
import json
import sqlite3
from collections import defaultdict
from pathlib import Path
from build_snapshot import contains

ROADS={'motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','living_street','service'}
def prepare(osm,areas):
    nodes={e['id']:e for e in osm['elements'] if e['type']=='node'}
    ways=[e for e in osm['elements'] if e['type']=='way' and e.get('tags',{}).get('highway') in ROADS]
    adjacent=defaultdict(set)
    for way in ways:
        tags=way['tags'];layer=str(tags.get('layer','0'));grade=(layer,tags.get('bridge','no'),tags.get('tunnel','no'))
        for a,b in zip(way['nodes'],way['nodes'][1:]):
            if a not in nodes or b not in nodes:raise ValueError('Incomplete OSM nodes')
            adjacent[(a,grade)].add(b);adjacent[(b,grade)].add(a)
    junctions={key for key,value in adjacent.items() if len(value)>=3}
    index=sqlite3.connect(':memory:')
    index.execute('CREATE VIRTUAL TABLE boundaries USING rtree(idx,minx,maxx,miny,maxy)')
    for i,f in enumerate(areas['features']):
        g=f['geometry'];polygons=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
        coords=[point for polygon in polygons for ring in polygon for point in ring]
        index.execute('INSERT INTO boundaries VALUES(?,?,?,?,?)',(i,min(p[0] for p in coords),max(p[0] for p in coords),min(p[1] for p in coords),max(p[1] for p in coords)))
    features=[]
    def add(id,kind,geometry,grade,name):
        point=geometry['coordinates'] if kind=='intersection' else geometry['coordinates'][len(geometry['coordinates'])//2]
        matches=[areas['features'][i]['properties'] for (i,) in index.execute('SELECT idx FROM boundaries WHERE minx<=? AND maxx>=? AND miny<=? AND maxy>=?',(point[0],point[0],point[1],point[1])) if contains(point,areas['features'][i]['geometry'])]
        if len(matches)!=1:return
        p=matches[0]
        features.append({'type':'Feature','geometry':geometry,'properties':{'id':id,'kind':kind,'layer':'_'.join(grade),'reviewed':False,'name':name,'address':p['municipalityName'],'prefecture':p['prefecture'],'municipality':p['municipality']}})
    for node,grade in sorted(junctions):
        n=nodes[node];add(f'osm-node-{node}-'+ '-'.join(grade),'intersection',{'type':'Point','coordinates':[n['lon'],n['lat']]},grade,n.get('tags',{}).get('name',''))
    for way in ways:
        tags=way['tags'];grade=(str(tags.get('layer','0')),tags.get('bridge','no'),tags.get('tunnel','no'));segment=[way['nodes'][0]]
        for node in way['nodes'][1:]:
            segment.append(node)
            if (node,grade) in junctions or node==way['nodes'][-1]:
                add(f"osm-way-{way['id']}-{segment[0]}-{node}",'road',{'type':'LineString','coordinates':[[nodes[n]['lon'],nodes[n]['lat']] for n in segment]},grade,tags.get('name',''))
                segment=[node]
    index.close()
    return {'type':'FeatureCollection','features':features}
if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ('osm','areas','output'):parser.add_argument('--'+name,required=True)
    args=parser.parse_args();result=prepare(json.loads(Path(args.osm).read_text(encoding='utf-8')),json.loads(Path(args.areas).read_text(encoding='utf-8')))
    with open(args.output,'x',encoding='utf-8') as f:json.dump(result,f,ensure_ascii=False)
