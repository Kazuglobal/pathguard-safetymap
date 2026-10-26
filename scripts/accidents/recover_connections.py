"""Reconstruct saved section references by source nodes, never by proximity."""
import hashlib
import json
from collections import deque


def section_references(db, seed, expected_section, expected_pieces):
    row = db.execute('SELECT grade,refs,section FROM pieces WHERE id=?', (seed,)).fetchone()
    if row is None or row[2] != expected_section:
        raise ValueError('Section seed is missing or assigned elsewhere')
    if expected_section != 'osm-road-' + hashlib.sha256(seed.encode()).hexdigest()[:24]:
        raise ValueError('Section identity differs from source seed')
    grade = row[0]
    references = json.loads(row[1])
    if len(references) < 2 or len(references) > 100000:
        raise ValueError('Source references exceed bounded geometry budget')
    chunks = deque([references])
    visited = {seed}
    node_count = len(references)
    for left in (True, False):
        current = seed
        while True:
            node = chunks[0][0] if left else chunks[-1][-1]
            if db.execute('SELECT 1 FROM junctions WHERE node=? AND grade=?', (node, grade)).fetchone():
                break
            neighbors = db.execute('SELECT neighbor FROM edges WHERE node=? AND grade=? LIMIT 3', (node, grade)).fetchall()
            if len(neighbors) != 2:
                break
            adjacent = db.execute('SELECT id,refs,section FROM pieces WHERE grade=? AND start=? UNION SELECT id,refs,section FROM pieces WHERE grade=? AND finish=?', (grade, node, grade, node)).fetchall()
            if len(adjacent) != 2:
                break
            other = next((piece for piece in adjacent if piece[0] != current), None)
            if other is None or other[0] in visited or other[2] != expected_section:
                break
            extra = json.loads(other[1])
            if len(extra) < 2 or node not in (extra[0], extra[-1]):
                raise ValueError('Piece endpoints do not share the source node')
            if left:
                if extra[-1] != node:
                    extra.reverse()
                chunks.appendleft(extra[:-1])
            else:
                if extra[0] != node:
                    extra.reverse()
                chunks.append(extra[1:])
            visited.add(other[0])
            current = other[0]
            node_count += len(extra) - 1
            if node_count > 100000:
                raise ValueError('Section exceeds bounded geometry budget')
    if len(visited) != expected_pieces:
        raise ValueError('Reconstruction did not consume every source piece in the section')
    return grade, [node for chunk in chunks for node in chunk]
