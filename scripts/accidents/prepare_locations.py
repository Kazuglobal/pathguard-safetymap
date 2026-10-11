"""Build candidate geometry from OSM node/way JSON + normalized MLIT boundaries.
All candidates start UNREVIEWED. Coordinates that cross without sharing a node never connect.
"""
import argparse
import json
import sqlite3
import hashlib
import shutil
import subprocess
import sys
import time
from collections import deque
from pathlib import Path
from build_snapshot import SpatialStore

ROADS={'motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','living_street','service'}
def require_space(directory):
    if shutil.disk_usage(directory).free<5*1024**3:raise RuntimeError('Less than 5 GiB free; preserve working files and use a larger disk')

def ingest_pbf(topology,args):
    """Supervise the native cache without a costly Python callback for every node."""
    if shutil.disk_usage(args.work).free<Path(args.osm).stat().st_size*3+5*1024**3:
        raise RuntimeError('Insufficient free space for the node cache and safety reserve')
    command=[sys.executable,str(Path(__file__).with_name('ingest_pbf.py')),'--osm',str(Path(args.osm).resolve()),'--work',str(topology.directory.resolve())]
    if args.bounds:command+=['--bounds',*[str(value) for value in args.bounds]]
    topology.db.close()
    try:
        with (topology.directory/'ingest.log').open('x',encoding='utf-8') as log:
            child=subprocess.Popen(command,stdout=log,stderr=subprocess.STDOUT)
            try:
                while child.poll() is None:
                    require_space(topology.directory)
                    time.sleep(1)
                if child.returncode:raise RuntimeError('PBF ingestion failed; see the retained ingest.log')
            finally:
                if child.poll() is None:
                    child.terminate()
                    try:child.wait(timeout=10)
                    except subprocess.TimeoutExpired:child.kill();child.wait()
    finally:
        topology.db=sqlite3.connect(topology.directory/'topology.sqlite')
        topology.db.execute('PRAGMA cache_size=-8192')
    topology.ways=topology.db.execute('SELECT COUNT(*) FROM ways').fetchone()[0]
class DiskTopology:
    """Retain shared-node topology on disk, including ways crossing pilot bounds."""
    def __init__(self, directory):
        self.directory=Path(directory)
        self.directory.mkdir(parents=True,exist_ok=True)
        require_space(self.directory)
        if (self.directory/'topology.sqlite').exists():raise ValueError('Use a new working directory')
        self.db=sqlite3.connect(self.directory/'topology.sqlite')
        self.db.execute('PRAGMA cache_size=-8192')
        self.db.executescript('''CREATE TABLE nodes(id INTEGER PRIMARY KEY,x REAL,y REAL);
            CREATE TABLE ways(id INTEGER PRIMARY KEY,grade TEXT,name TEXT,refs TEXT);
            CREATE TABLE edges(node INTEGER,grade TEXT,neighbor INTEGER,PRIMARY KEY(node,grade,neighbor)) WITHOUT ROWID;''')
        self.ways=0

    def add_way(self, identity, references, coordinates, tags, bounds=None):
        if tags.get('highway') not in ROADS:return
        if len(references)<2 or len(references)!=len(coordinates):raise ValueError('Incomplete OSM way')
        if bounds:
            west,south,east,north=bounds
            if max(p[0] for p in coordinates)<west or min(p[0] for p in coordinates)>east or max(p[1] for p in coordinates)<south or min(p[1] for p in coordinates)>north:return
        grade=json.dumps([str(tags.get('layer','0')),tags.get('bridge','no'),tags.get('tunnel','no')],separators=(',',':'))
        for node,(x,y) in zip(references,coordinates):
            self.db.execute('INSERT OR IGNORE INTO nodes VALUES(?,?,?)',(node,x,y))
        self.db.execute('INSERT INTO ways VALUES(?,?,?,?)',(identity,grade,tags.get('name',''),json.dumps(references)))
        for a,b in zip(references,references[1:]):
            if a==b:continue
            self.db.executemany('INSERT OR IGNORE INTO edges VALUES(?,?,?)',[(a,grade,b),(b,grade,a)])
        self.ways+=1
        if self.ways%5000==0:
            self.db.commit()
            require_space(self.directory)

    def road_sections(self):
        """Join OSM way seams only at the same shared node/grade with two pieces."""
        self.db.executescript('''CREATE TABLE pieces(id TEXT PRIMARY KEY,start INTEGER,finish INTEGER,grade TEXT,name TEXT,refs TEXT,section TEXT);
            CREATE INDEX pieces_start ON pieces(grade,start);
            CREATE INDEX pieces_finish ON pieces(grade,finish);''')
        piece_count=0
        for identity,grade,name,refs in self.db.execute('SELECT id,grade,name,refs FROM ways ORDER BY id'):
            references=json.loads(refs);segment=[references[0]];piece=0
            for position,node in enumerate(references[1:],start=1):
                segment.append(node)
                if position==len(references)-1 or self.db.execute('SELECT 1 FROM junctions WHERE node=? AND grade=?',(node,grade)).fetchone():
                    self.db.execute('INSERT INTO pieces VALUES(?,?,?,?,?,?,NULL)',(f'osm-way-{identity}-{piece}',segment[0],segment[-1],grade,name,json.dumps(segment)))
                    piece+=1;segment=[node]
                    piece_count+=1
                    if piece_count%5000==0:self.db.commit();require_space(self.directory)
        self.db.commit()
        for seed,grade,name,refs in self.db.execute('SELECT id,grade,name,refs FROM pieces ORDER BY id'):
            if self.db.execute('SELECT section FROM pieces WHERE id=?',(seed,)).fetchone()[0]:continue
            section='osm-road-'+hashlib.sha256(seed.encode()).hexdigest()[:24]
            chunks=deque([json.loads(refs)]);node_count=len(chunks[0]);names={name} if name else set()
            self.db.execute('UPDATE pieces SET section=? WHERE id=?',(section,seed))
            for left in (True,False):
                current=seed
                while True:
                    node=chunks[0][0] if left else chunks[-1][-1]
                    if self.db.execute('SELECT 1 FROM junctions WHERE node=? AND grade=?',(node,grade)).fetchone():break
                    if len(self.db.execute('SELECT neighbor FROM edges WHERE node=? AND grade=? LIMIT 3',(node,grade)).fetchall())!=2:break
                    # UNION uses both endpoint indexes and deduplicates closed pieces.
                    adjacent=self.db.execute('SELECT id,name,refs,section FROM pieces WHERE grade=? AND start=? UNION SELECT id,name,refs,section FROM pieces WHERE grade=? AND finish=?',(grade,node,grade,node)).fetchall()
                    if len(adjacent)!=2:break
                    other=next((p for p in adjacent if p[0]!=current),None)
                    if other is None or other[3]:break
                    extra=json.loads(other[2])
                    if left:
                        if extra[-1]!=node:extra.reverse()
                        chunks.appendleft(extra[:-1])
                    else:
                        if extra[0]!=node:extra.reverse()
                        chunks.append(extra[1:])
                    node_count+=len(extra)-1
                    if node_count>100000:raise ValueError('Road section exceeds bounded geometry budget; review the topology')
                    if other[1]:names.add(other[1])
                    self.db.execute('UPDATE pieces SET section=? WHERE id=?',(section,other[0]));current=other[0]
            yield section,grade,next(iter(names)) if len(names)==1 else '',[node for chunk in chunks for node in chunk]
        self.db.commit()

    def emit(self, areas, output):
        self.db.commit()
        self.db.executescript('''CREATE TABLE junctions(node INTEGER,grade TEXT,PRIMARY KEY(node,grade)) WITHOUT ROWID;
            INSERT INTO junctions SELECT node,grade FROM edges GROUP BY node,grade HAVING COUNT(*)>=3;''')
        spatial=SpatialStore(self.directory/'boundaries.sqlite')
        report={'ways':self.ways,'intersections':0,'roadSections':0,'outsideOrAmbiguousBoundary':0,'reviewedLocations':0,'completeCoverageReviewed':False}
        try:
            spatial.ingest(areas,'boundary')
            require_space(Path(output).resolve().parent)
            with open(output,'x',encoding='utf-8') as stream:
                stream.write('{"type":"FeatureCollection","features":[');first=True
                def emit_feature(identity,kind,geometry,grade,name):
                    nonlocal first
                    center=geometry['coordinates'] if kind=='intersection' else geometry['coordinates'][len(geometry['coordinates'])//2]
                    matches=list(spatial.matching_boundaries(center))
                    if len(matches)!=1:
                        report['outsideOrAmbiguousBoundary']+=1;return
                    props=matches[0]['properties']
                    feature={'type':'Feature','geometry':geometry,'properties':{'id':identity,'kind':kind,'layer':'_'.join(json.loads(grade)),'reviewed':False,'name':name,'address':props['municipalityName'],'prefecture':props['prefecture'],'municipality':props['municipality']}}
                    if not first:stream.write(',')
                    json.dump(feature,stream,ensure_ascii=False);first=False
                    report['intersections' if kind=='intersection' else 'roadSections']+=1
                    if (report['intersections']+report['roadSections'])%10000==0:
                        self.db.commit()
                        require_space(self.directory);require_space(Path(output).resolve().parent)
                for node,grade,x,y in self.db.execute('SELECT j.node,j.grade,n.x,n.y FROM junctions j JOIN nodes n ON n.id=j.node ORDER BY j.node,j.grade'):
                    suffix=hashlib.sha256(grade.encode()).hexdigest()[:12]
                    emit_feature(f'osm-node-{node}-{suffix}','intersection',{'type':'Point','coordinates':[x,y]},grade,'')
                for identity,grade,name,references in self.road_sections():
                    coordinates=[list(self.db.execute('SELECT x,y FROM nodes WHERE id=?',(node,)).fetchone()) for node in references]
                    emit_feature(identity,'road',{'type':'LineString','coordinates':coordinates},grade,name)
                report['sourceRoadPieces']=self.db.execute('SELECT COUNT(*) FROM pieces').fetchone()[0]
                stream.write(']}')
            Path(str(output)+'.quality.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
            return report
        finally:spatial.close()

    def close(self):self.db.close()

def prepare_file(args):
    """The CLI never materializes national nodes, ways, adjacency sets or outputs."""
    topology=DiskTopology(args.work)
    try:
        if args.bounds and (len(args.bounds)!=4 or not (122<=args.bounds[0]<args.bounds[2]<=154 and 20<=args.bounds[1]<args.bounds[3]<=46)):
            raise ValueError('Invalid pilot bounds')
        if Path(args.osm).suffix=='.pbf':
            ingest_pbf(topology,args)
        else:
            import ijson
            nodes=0
            with open(args.osm,'rb') as stream:
                for element in ijson.items(stream,'elements.item',use_float=True):
                    if element['type']=='node':
                        topology.db.execute('INSERT INTO nodes VALUES(?,?,?)',(element['id'],element['lon'],element['lat']))
                        nodes+=1
                        if nodes%100000==0:
                            topology.db.commit();require_space(topology.directory)
            topology.db.commit()
            with open(args.osm,'rb') as stream:
                for element in ijson.items(stream,'elements.item',use_float=True):
                    if element['type']!='way' or element.get('tags',{}).get('highway') not in ROADS:continue
                    coordinates=[]
                    for node in element['nodes']:
                        point=topology.db.execute('SELECT x,y FROM nodes WHERE id=?',(node,)).fetchone()
                        if point is None:raise ValueError('Incomplete OSM nodes')
                        coordinates.append(point)
                    topology.add_way(element['id'],element['nodes'],coordinates,element['tags'],args.bounds)
        return topology.emit(args.areas,args.output)
    finally:topology.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ('osm','areas','output','work'):parser.add_argument('--'+name,required=True)
    parser.add_argument('--bounds',type=float,nargs=4,metavar=('WEST','SOUTH','EAST','NORTH'),help='Pilot extraction only; never considered complete national coverage')
    print(json.dumps(prepare_file(parser.parse_args())))
