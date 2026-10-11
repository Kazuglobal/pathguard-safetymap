"""Offline child process: native PBF node cache, shared-node road ingestion only.

The parent supervises disk space throughout the native node-cache phase.
"""
import argparse
import json
import sqlite3
from pathlib import Path
import osmium
from prepare_locations import DiskTopology, ROADS, VEHICLE_BASELINE

def ingest(args):
    topology=DiskTopology.__new__(DiskTopology)
    topology.directory=Path(args.work)
    database=(topology.directory/'topology.sqlite').resolve()
    topology.db=sqlite3.connect(database.as_uri()+'?mode=rw',uri=True)
    topology.db.execute('PRAGMA cache_size=-8192')
    topology.ways=0
    try:
        if topology.db.execute('SELECT COUNT(*) FROM ways').fetchone()[0]:raise ValueError('PBF child requires a new empty topology')
        scope=json.loads(topology.db.execute("SELECT value FROM extraction_metadata WHERE key='highwayScope'").fetchone()[0])
        topology.road_scope=VEHICLE_BASELINE if getattr(args,'vehicle_road_baseline',False) else ROADS
        if scope!=sorted(topology.road_scope):raise ValueError('Parent and child highway scopes differ; use a new extraction')
        class Handler(osmium.SimpleHandler):
            def way(self,way):
                if way.tags.get('highway') not in topology.road_scope:return
                topology.add_way(way.id,[node.ref for node in way.nodes],[[node.lon,node.lat] for node in way.nodes],dict(way.tags),args.bounds)
        Handler().apply_file(args.osm,locations=True,idx='sparse_file_array,'+str((topology.directory/'node-locations.cache').resolve()))
        topology.db.commit()
    finally:topology.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--osm',required=True);parser.add_argument('--work',required=True)
    parser.add_argument('--bounds',type=float,nargs=4)
    parser.add_argument('--vehicle-road-baseline',action='store_true')
    ingest(parser.parse_args())
