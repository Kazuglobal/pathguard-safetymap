import { parseAccidentQuery } from './query'
import { areas, location, rankingDatabase, rankings } from './server'
export async function accidentResponse(request: Request, kind: 'areas' | 'rankings' | 'locations', id?: string) {
  try {
    const q = parseAccidentQuery(new URL(request.url).searchParams)
    if (id && !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return Response.json({error:'場所を確認してください'},{status:400})
    const db = rankingDatabase()
    const result = kind === 'areas' ? await areas(db,q.version,q.prefecture) : id ? await location(db,id,q) : await rankings(db,q)
    if (result === null) return Response.json({error:'場所が見つかりませんでした'},{status:404})
    return Response.json(result,{ headers: { 'Cache-Control': result.status === 'ready' ? 'public, max-age=60' : 'no-store' } })
  } catch (error) {
    if (error instanceof RangeError || (error instanceof Error && /^(Invalid |A prefecture|A version)/.test(error.message))) return Response.json({error:'検索条件を確認してください'},{status:400})
    return Response.json({error:'読み込めませんでした'},{status:503,headers:{'Cache-Control':'no-store'}})
  }
}
