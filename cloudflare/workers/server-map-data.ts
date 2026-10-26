import { handler } from '../../.open-next/server-functions/mapData/handler.mjs'
import { createServerWorker } from './server-runtime'

/**
 * 本番 D1 の traffic_accidents 件数として正しい値。取り込み途中・二重取り込みを検知するため完全一致で見る。
 * 2019〜2024年 = 1,869,032 件、2025年（287,020 件）を追加後 = 2,156,052 件。
 * 2025年分の取り込みとデプロイの順番に関係なく通るよう、両方を受け付ける（取り込み後は旧値を消してよい）。
 */
const EXPECTED_TRAFFIC_ACCIDENT_COUNTS: readonly number[] = [1_869_032, 2_156_052]

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

  const count = result?.count ?? null
  return Response.json({ ok: count != null && EXPECTED_TRAFFIC_ACCIDENT_COUNTS.includes(count), count })
})
