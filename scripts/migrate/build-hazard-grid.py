"""Build the R2 hazard grid from verified prepared sources; local files only.

Each prepared polygon (zones and survey coverage) is cut exactly at fixed
latitude/longitude cell edges. One JSON object per hazard type and cell holds
every source that touches that cell, so a point lookup reads one small object
instead of scanning D1 rows west of the point (#277). Pieces keep the original
zone ID; the union of a zone's pieces is the prepared polygon. No
simplification, rounding, or invented coverage.

Usage:
  python scripts/migrate/build-hazard-grid.py --out artifacts/migration/hazards/grid
  python scripts/migrate/build-hazard-grid.py --out ... --only A31b-25_20_6140_GEOJSON

The output directory must not already exist; rebuilding never overwrites.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import shutil
import time

import numpy as np
import shapely
from shapely.geometry import box, mapping, shape

CELLS_PER_DEGREE = 100
SCHEMA_VERSION = 1
KEY_PREFIX = f'hazard-grid/v{SCHEMA_VERSION}'
FLUSH_BYTES = 48_000_000
MAX_OBJECT_BYTES = 8_000_000
JAPAN = (122, 20, 154, 46)

_importer_spec = importlib.util.spec_from_file_location(
    'import_official_hazards', Path(__file__).with_name('import-official-hazards.py'))
importer = importlib.util.module_from_spec(_importer_spec)
_importer_spec.loader.exec_module(importer)


def compact(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def cell_range(low: float, high: float) -> range:
    return range(math.floor(low * CELLS_PER_DEGREE), math.floor(high * CELLS_PER_DEGREE) + 1)


def cell_box(iy: int, ix: int):
    k = CELLS_PER_DEGREE
    return box(ix / k, iy / k, (ix + 1) / k, (iy + 1) / k)


def object_key(hazard_type: str, iy: int, ix: int) -> str:
    return f'{KEY_PREFIX}/{hazard_type}/{iy}/{ix}.json'


def polygon_parts(geometry):
    if geometry.is_empty:
        return
    if geometry.geom_type == 'Polygon':
        yield geometry
    elif geometry.geom_type in ('MultiPolygon', 'GeometryCollection'):
        for part in geometry.geoms:
            yield from polygon_parts(part)
    # Lines and points left on a shared cell edge have zero area; omit them.


def clip_to_cells(geometry):
    """Yield (iy, ix, polygon) for each non-empty piece of geometry per cell."""
    w, s, e, n = geometry.bounds
    cells = [(iy, ix) for iy in cell_range(s, n) for ix in cell_range(w, e)]
    if len(cells) == 1:
        yield cells[0][0], cells[0][1], geometry
        return
    boxes = np.array([cell_box(iy, ix) for iy, ix in cells], dtype=object)
    for (iy, ix), piece in zip(cells, shapely.intersection(geometry, boxes)):
        for part in polygon_parts(piece):
            if not part.is_valid:
                raise ValueError('Cell clipping produced an invalid polygon')
            yield iy, ix, part


class CellWriter:
    """Append cell fragments to per-cell NDJSON files with bounded memory."""

    def __init__(self, root: Path):
        self.root = root
        self.buffer: dict[tuple[str, int, int], list[str]] = {}
        self.size = 0

    def add(self, hazard_type: str, iy: int, ix: int, kind: str, record: dict) -> None:
        line = compact(dict(kind=kind, **record))
        self.buffer.setdefault((hazard_type, iy, ix), []).append(line)
        self.size += len(line)
        if self.size >= FLUSH_BYTES:
            self.flush()

    def flush(self) -> None:
        for (hazard_type, iy, ix), lines in self.buffer.items():
            path = self.root / hazard_type / str(iy) / f'{ix}.ndjson'
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open('a', encoding='utf-8', newline='\n') as target:
                target.write('\n'.join(lines) + '\n')
        self.buffer = {}
        self.size = 0


def zone_record(row: dict, geometry) -> dict:
    return dict(id=row['id'], group=row['zone_group_id'], source=row['source_layer'],
                risk=row['risk_level'], depthMin=row['depth_min_m'], depthMax=row['depth_max_m'],
                context=row['area_context'], geometry=mapping(geometry))


def coverage_record(row: dict, geometry, built_at: str) -> dict:
    return dict(id=row['id'], source=row['source_layer'], region=row['region_label'],
                label=row['source'], importedAt=built_at, geometry=mapping(geometry))


def add_source(directory: Path, writer: CellWriter, built_at: str) -> dict:
    receipt, coverage = importer.verify(directory)
    started = time.monotonic()
    hazard_type = receipt['source']['kind']
    source_area = 0.0
    grid_area = 0.0
    pieces = 0
    with (directory / 'zones.ndjson').open(encoding='utf-8') as source:
        for line in source:
            row = json.loads(line)
            geometry = shape(row['geojson'])
            source_area += geometry.area
            for iy, ix, part in clip_to_cells(geometry):
                writer.add(hazard_type, iy, ix, 'zone', zone_record(row, part))
                grid_area += part.area
                pieces += 1
    if not math.isclose(grid_area, source_area, rel_tol=1e-7, abs_tol=1e-12):
        raise ValueError(f'Grid clipping changed zone area for {directory.name}')
    coverage_area = 0.0
    coverage_grid_area = 0.0
    for row in coverage:
        geometry = shape(row['geojson'])
        coverage_area += geometry.area
        for iy, ix, part in clip_to_cells(geometry):
            writer.add(hazard_type, iy, ix, 'coverage', coverage_record(row, part, built_at))
            coverage_grid_area += part.area
    if not math.isclose(coverage_grid_area, coverage_area, rel_tol=1e-7, abs_tol=1e-12):
        raise ValueError(f'Grid clipping changed coverage area for {directory.name}')
    summary = dict(id=receipt['source']['id'], kind=hazard_type, archiveSha256=receipt['archiveSha256'],
                   ndjsonSha256=receipt['ndjsonSha256'], polygons=receipt['polygons'],
                   coverageRows=receipt['coverageRows'], gridPieces=pieces, zoneArea=source_area,
                   coverageArea=coverage_area, seconds=round(time.monotonic() - started, 1))
    print(compact(dict(event='source', **{k: summary[k] for k in ('id', 'polygons', 'gridPieces', 'seconds')})),
          flush=True)
    return summary


def finalize_cells(fragments: Path, out: Path) -> list[dict]:
    objects = []
    for path in sorted(fragments.rglob('*.ndjson')):
        hazard_type = path.parent.parent.name
        iy, ix = int(path.parent.name), int(path.stem)
        zones, coverage = [], []
        with path.open(encoding='utf-8') as source:
            for line in source:
                record = json.loads(line)
                (zones if record.pop('kind') == 'zone' else coverage).append(record)
        # Stable sort: pieces of one zone keep their deterministic build order.
        zones.sort(key=lambda z: z['id'])
        coverage.sort(key=lambda c: c['id'])
        body = compact(dict(schemaVersion=SCHEMA_VERSION, hazardType=hazard_type,
                            cellsPerDegree=CELLS_PER_DEGREE, cell=[iy, ix],
                            zones=zones, coverage=coverage)).encode('utf-8')
        if len(body) > MAX_OBJECT_BYTES:
            raise ValueError(f'Cell object exceeds {MAX_OBJECT_BYTES} bytes: {hazard_type}/{iy}/{ix}')
        key = object_key(hazard_type, iy, ix)
        target = out / key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        path.unlink()  # fragment written by this run; the final object replaces it
        objects.append(dict(key=key, bytes=len(body), md5=hashlib.md5(body).hexdigest(),
                            zones=len(zones), coverage=len(coverage)))
    return objects


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--prepared', type=Path, default=Path('artifacts/migration/hazards/prepared'))
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--only', action='append', help='Limit to these prepared source IDs (testing)')
    args = parser.parse_args()
    if args.out.exists():
        raise ValueError('Output directory already exists; choose a new directory')
    directories = sorted(p for p in args.prepared.iterdir() if (p / 'receipt.json').exists())
    if args.only:
        directories = [p for p in directories if p.name in set(args.only)]
    if not directories:
        raise ValueError('No prepared sources found')
    if shutil.disk_usage(args.prepared).free < 25_000_000_000:
        raise ValueError('Less than 25GB disk available; stop before building the grid')
    built_at = datetime.now(timezone.utc).isoformat()
    fragments = args.out / 'fragments'
    writer = CellWriter(fragments)
    sources = []
    for directory in directories:
        sources.append(add_source(directory, writer, built_at))
    writer.flush()
    objects = finalize_cells(fragments, args.out / 'objects')
    manifest = dict(schemaVersion=SCHEMA_VERSION, keyPrefix=KEY_PREFIX, cellsPerDegree=CELLS_PER_DEGREE,
                    builtAt=built_at, sources=sources, objectCount=len(objects),
                    totalBytes=sum(o['bytes'] for o in objects),
                    maxObjectBytes=max(o['bytes'] for o in objects))
    (args.out / 'objects.json').write_text(compact(objects), encoding='utf-8')
    (args.out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(compact(dict(event='built', sources=len(sources), objects=len(objects),
                       totalBytes=manifest['totalBytes'], maxObjectBytes=manifest['maxObjectBytes'])), flush=True)


if __name__ == '__main__':
    main()
