import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { RepositoryError } from './repository'
import { WorldLabsError } from './world-labs'

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) throw new RepositoryError(403, 'origin', 'この画面からもう一度操作してください。')
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new RepositoryError(403, 'origin', 'アクセスできません。')
}

export async function readRouteJson(request: Request, limit = 64_000): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new RepositoryError(415, 'content_type', 'JSONを指定してください。')
  const reader = request.body?.getReader()
  if (!reader) throw new RepositoryError(400, 'body', '入力を確認してください。')
  const chunks: Uint8Array[] = []; let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > limit) { await reader.cancel(); throw new RepositoryError(413, 'too_large', '写真の容量が大きすぎます。枚数を減らしてください。') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const joined = new Uint8Array(length); let offset = 0
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length }
  try { return JSON.parse(new TextDecoder().decode(joined)) } catch { throw new RepositoryError(400, 'json', '入力を確認してください。') }
}

export function routeError(error: unknown) {
  if (error instanceof RepositoryError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  if (error instanceof ZodError) return NextResponse.json({ error: '入力内容を確認してください。' }, { status: 400 })
  if (error instanceof WorldLabsError) return NextResponse.json({ error: error.code === 'insufficient_credits' ? '3D生成の利用残高が不足しています。' : '3D生成サービスに接続できません。時間をおいて確認してください。', code: error.code }, { status: 503 })
  console.error('[hunter/routes]', error instanceof Error ? error.name : 'unknown')
  return NextResponse.json({ error: 'コースの処理に失敗しました。再読み込みしてください。' }, { status: 503 })
}
