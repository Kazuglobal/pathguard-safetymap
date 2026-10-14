// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { parseAccidentQuery, type SnapshotMetadata } from '@/lib/accidents/query'
vi.mock('@opennextjs/cloudflare',()=>({getCloudflareContext:()=>({env:{}})}))
import { rankings, location, type RankingDatabase } from '@/lib/accidents/server'
function fixture(exceptions: SnapshotMetadata['regionalCoverageExceptions'] = [], municipality = '12217', partial = false): RankingDatabase {
  const db=new Database(':memory:');db.exec(readFileSync('lib/db/traffic-migrations/0002_accident_rankings.sql','utf8'))
  if(partial)db.exec(readFileSync('lib/db/traffic-migrations/0003_accident_regional_uncertainty.sql','utf8'))
  const metadata={version:'test-only',updatedAt:'2026-10-10',years:[2023,2024],method:'test fixture',sources:[],regionalCoverageExceptions:exceptions,...(partial?{regionalUncertaintyMethod:'distinct-original-municipality-v1'}:{})}
  db.prepare('INSERT INTO accident_snapshots VALUES(?,?,?,?)').run('test-only',1,metadata.updatedAt,JSON.stringify(metadata))
  db.exec("INSERT INTO accident_areas VALUES('test-only','12','','千葉県'),('test-only','12217','12','柏市'),('test-only','22','','静岡県'),('test-only','22138','22','中央区')")
  for(const [id,count,mask] of [['a',12,1],['b',12,3],['c',9,2]] as const){
    db.prepare('INSERT INTO accident_locations VALUES(?,?,?,?,?,?,?,?,?)').run('test-only',id,`試験地点${id}`,'intersection',municipality.slice(0,2),municipality,35.8,139.9,'{}')
    db.prepare('INSERT INTO accident_location_counts VALUES(?,?,?,?,?,?,?,?)').run('test-only',id,2024,7,mask,0,'車両どうし',count)
  }
  db.exec("INSERT INTO accident_quality_counts VALUES('test-only','12','12217',2024,7,1,0,12,2,1),('test-only','12','12217',2024,7,3,0,12,0,0),('test-only','12','12217',2024,7,2,0,9,0,0)")
  db.exec("INSERT INTO accident_quality_counts VALUES('test-only','22','22131',2023,7,0,0,0,5,0)")
  if(partial)db.exec("INSERT INTO accident_regional_uncertainty_counts VALUES('test-only','12','12217',2024,7,1,0,4,1),('test-only','12','',2024,7,1,0,3,2),('test-only','12','12217',2023,7,1,0,6,0)")
  return {prepare(sql){const statement=db.prepare(sql);let values:(string|number)[]=[];return {bind(...v){values=v;return this},async first<T>(){return (statement.get(...values)??null) as T|null},async all<T>(){return {results:statement.all(...values) as T[]}}}}}
}
const query=(value='')=>parseAccidentQuery(new URLSearchParams(value))
describe('public aggregate rankings',()=>{
  it('shows verified counts with possible inbound and prefecture-wide uncertainty',async()=>{
    const db=fixture([{prefecture:'12',municipality:'12217',year:2024,reason:'historical_region_check'}],'12217',true)
    const result=await rankings(db,query('prefecture=12&municipality=12217&from=2024&to=2024&participant=bicycle'))
    expect(result.status).toBe('ready');expect(result.items.map(x=>x.id)).toEqual(['a','b'])
    expect(result.coverage).toEqual({status:'partial',possibleUncertain:7,possibleExcluded:3})
    expect(result.quality).toEqual({assigned:24,uncertain:7,excluded:3})
    expect((await rankings(db,query('from=2024&to=2024&participant=bicycle'))).quality).toEqual({assigned:24,uncertain:2,excluded:1})
    const detail=await location(db,'a',query('from=2024&to=2024&participant=bicycle'))
    expect(detail?.status).toBe('ready');expect(detail?.coverage).toEqual(result.coverage)
  })
  it('keeps unknown-place warnings for road-only filters and does not claim a zero',async()=>{
    const db=fixture([],'12217',true)
    const result=await rankings(db,query('prefecture=12&municipality=12217&from=2024&to=2024&kind=road'))
    expect(result.status).toBe('preparing');expect(result.coverage?.possibleUncertain).toBe(7)
    expect((await rankings(db,query('prefecture=12&municipality=12217&from=2023&to=2023'))).status).toBe('preparing')
    expect((await location(db,'a',query('from=2023&to=2023')))?.status).toBe('preparing')
    expect((await rankings(db,query('prefecture=12&municipality=12217&severity=fatal'))).status).toBe('ready')
  })
  const historicalExceptions = [{prefecture:'22',year:2023,reason:'historical_region_check' as const}]
  it('does not turn unresolved old-code records into a current-city zero',async()=>{
    const db=fixture(historicalExceptions)
    const r=await rankings(db,query('prefecture=22&municipality=22138&from=2023&to=2023'))
    expect(r.status).toBe('preparing');expect(r.preparingReason).toBe('regional_correspondence');expect(r.items).toEqual([])
    expect((await rankings(db,query('prefecture=22&municipality=22138'))).status).toBe('preparing')
    expect((await rankings(db,query('prefecture=22&municipality=22138&from=2024&to=2024'))).status).toBe('ready')
    expect((await rankings(db,query('prefecture=12&municipality=12217&from=2023&to=2023'))).status).toBe('ready')
    const pref=await rankings(db,query('prefecture=22&from=2023&to=2023'))
    expect(pref.status).toBe('ready');expect(pref.quality.uncertain).toBe(5)
  })
  it('gates direct detail links using the location region and requested years',async()=>{
    const db=fixture(historicalExceptions,'22138')
    expect((await location(db,'a',query('from=2023&to=2023')))?.status).toBe('preparing')
    expect((await location(db,'a',query('from=2024&to=2024')))?.status).toBe('ready')
  })
  it('limits known-code correspondence exceptions to affected cities',async()=>{
    const db=fixture([{prefecture:'12',municipality:'12217',year:2023,reason:'historical_region_check'}])
    expect((await rankings(db,query('prefecture=12&municipality=12217&from=2023&to=2023'))).status).toBe('preparing')
    expect((await rankings(db,query('prefecture=22&municipality=22138&from=2023&to=2023'))).status).toBe('ready')
    expect((await rankings(db,query('prefecture=12&municipality=12217&from=2024&to=2024'))).status).toBe('ready')
  })
  it('uses competition ranks and deterministic tie ordering',async()=>{const r=await rankings(fixture(),query());expect(r.items.map(i=>[i.id,i.rank])).toEqual([['a',1],['b',1],['c',3]])})
  it('pins later pages and ranks before pagination',async()=>{const db=fixture();const first=await rankings(db,query('limit=1'));expect(first.nextOffset).toBe(1);const second=await rankings(db,query('limit=1&offset=1&version=test-only'));expect(second.items[0].rank).toBe(1);expect(second.items[0].id).toBe('b')})
  it('counts one accident even if both categories apply',async()=>{const r=await rankings(fixture(),query('participant=bicycle'));expect(r.items.map(i=>i.id)).toEqual(['a','b']);expect(r.quality).toEqual({assigned:24,uncertain:2,excluded:1})})
  it('returns a genuine zero instead of preparing for an empty filter',async()=>{const r=await rankings(fixture(),query('severity=fatal'));expect(r.status).toBe('ready');expect(r.items).toEqual([])})
  it('does not expose a missing historical version',async()=>{expect((await rankings(fixture(),query('version=missing'))).status).toBe('unavailable')})
  it('distinguishes unrecorded areas from a recorded zero',async()=>{expect((await rankings(fixture(),query('prefecture=99'))).status).toBe('unavailable');expect((await rankings(fixture(),query('prefecture=12&municipality=13201'))).status).toBe('unavailable')})
  it('rejects uncovered years',async()=>{await expect(rankings(fixture(),query('from=2025'))).rejects.toThrow()})
  it('filters detail with the same criteria',async()=>{const r=await location(fixture(),'a',query('participant=pedestrian'));expect(r?.counts).toEqual([])})
  it('rejects SQL text, oversized pages, reversed dates and unpinned pagination',()=>{for(const value of ['prefecture=12%27','limit=1000','from=2024&to=2020','offset=10','municipality=12217'])expect(()=>query(value)).toThrow()})
  it('only treats the missing new table as preparing',async()=>{const db={prepare(){throw new Error('no such table: accident_snapshots')}} as unknown as RankingDatabase;expect((await rankings(db,query())).status).toBe('preparing');const failed={prepare(){throw new Error('connection failed')}} as unknown as RankingDatabase;await expect(rankings(failed,query())).rejects.toThrow('connection failed')})
})
