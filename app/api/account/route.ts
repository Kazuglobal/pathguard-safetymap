import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

import {
  ACCOUNT_DELETION_CONFIRMATION,
  collectAccountMediaKeys,
  deleteAccountRows,
} from '@/lib/account-deletion'
import { getActor } from '@/lib/auth/actor'
import { getDb } from '@/lib/db/client'
import { deleteR2Keys, type DeletableBucket } from '@/lib/media/r2-batch-delete'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

interface MediaBucket extends DeletableBucket {
  list(options: { prefix: string; cursor?: string }): Promise<{ objects: Array<{ key: string }>; truncated: boolean; cursor?: string }>
}

/** 本人のフォルダ(キーの頭)。消し損ねて D1 から参照されなくなった写真も、ここから消す */
const PRIVATE_MEDIA_PREFIXES = ['danger-reports', 'hunter-photos'] as const
const PUBLIC_MEDIA_PREFIXES = ['avatars'] as const
const USER_ID_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/

/** 「頭/利用者の id/」の下にある写真を、すべて消す */
async function deleteUserFolders(bucket: MediaBucket, prefixes: readonly string[], userId: string) {
  for (const prefix of prefixes) {
    let cursor: string | undefined
    do {
      const page = await bucket.list({ prefix: `${prefix}/${userId}/`, cursor })
      await deleteR2Keys(bucket, page.objects.map((object) => object.key))
      cursor = page.truncated ? page.cursor : undefined
    } while (cursor)
  }
}

/**
 * 退会(UIUX改装 項目40)。本人のデータ・写真・アカウントをすべて消す。
 * 写真 → D1 → Supabase の順に消す(途中で失敗しても、流し直せば残りを消せる)。
 * 写真は D1 から集めたキーに加えて、本人のフォルダの下をすべて消す(差し替えのときに消し損ねた、ぼかす前の写真も残さない)。
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
    if (!USER_ID_SEGMENT.test(actor.id)) throw new Error('invalid user id for media folders')
    await deleteR2Keys(buckets.MEDIA_PRIVATE, media.privateKeys)
    await deleteR2Keys(buckets.MEDIA_PUBLIC, media.publicKeys)
    await deleteUserFolders(buckets.MEDIA_PRIVATE, PRIVATE_MEDIA_PREFIXES, actor.id)
    await deleteUserFolders(buckets.MEDIA_PUBLIC, PUBLIC_MEDIA_PREFIXES, actor.id)
    await deleteAccountRows(db, actor.id)
    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(actor.id)
    if (error) throw new Error(`supabase ${error.status ?? 'unknown'}`)
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('[api/account] delete failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: '退会の処理を最後まで終えられませんでした。もう一度お試しください(残っているものだけを消します)。' }, { status: 500 })
  }
}
