import { handler } from '../../.open-next/server-functions/mapData/handler.mjs'
import { createServerWorker } from './server-runtime'

type MapDataEnv = CloudflareEnv & {
  TRAFFIC_DB: D1Database
  CRON_SECRET?: string
}

export default createServerWorker<MapDataEnv>(handler, async (request, env) => {
  const url = new URL(request.url)
  if (url.pathname !== '/api/traffic-accidents/__health') return null

  const authorization = request.headers.get('authorization')
  if (!env.CRON_SECRET || authorization !== `Bearer ${env.CRON_SECRET}`) {
    return new Response(null, { status: 404 })
  }

  const result = await env.TRAFFIC_DB.prepare(
    'SELECT count(*) AS count FROM traffic_accidents',
  ).first<{ count: number }>()

  return Response.json({ ok: result?.count === 1_869_032, count: result?.count ?? null })
})
