import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

import {
  ACCOUNT_DELETION_CONFIRMATION,
  collectAccountMediaKeys,
  deleteAccountRows,
} from '@/lib/account-deletion'
import { getActor } from '@/lib/auth/actor'
import { getDb } from '@/lib/db/client'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

interface MediaBucket {
  delete(keys: string | string[]): Promise<void>
}

/** R2 は1回に1000件まで消せる */
const R2_DELETE_BATCH = 1_000

async function deleteObjects(bucket: MediaBucket, keys: readonly string[]) {
  for (let index = 0; index < keys.length; index += R2_DELETE_BATCH) {
    await bucket.delete(keys.slice(index, index + R2_DELETE_BATCH))
  }
}

/**
 * 退会(UIUX改装 項目40)。本人のデータ・写真・アカウントをすべて消す。
 * 写真 → D1 → Supabase の順に消す(途中で失敗しても、流し直せば残りを消せる)。
 */
export async function DELETE(request: Request) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '確認の文字を入力してください' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || (body as { confirm?: unknown }).confirm !== ACCOUNT_DELETION_CONFIRMATION) {
    return NextResponse.json({ error: `確認のため「${ACCOUNT_DELETION_CONFIRMATION}」と入力してください` }, { status: 400 })
  }

  try {
    const db = getDb()
    const media = await collectAccountMediaKeys(db, actor.id)
    const { env } = getCloudflareContext()
    const buckets = env as unknown as { MEDIA_PRIVATE: MediaBucket; MEDIA_PUBLIC: MediaBucket }
    await deleteObjects(buckets.MEDIA_PRIVATE, media.privateKeys)
    await deleteObjects(buckets.MEDIA_PUBLIC, media.publicKeys)
    await deleteAccountRows(db, actor.id)
    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(actor.id)
    if (error) throw new Error(`supabase ${error.status ?? 'unknown'}`)
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('[api/account] delete failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: '退会の処理を最後まで終えられませんでした。もう一度お試しください(残っているものだけを消します)。' }, { status: 500 })
  }
}
