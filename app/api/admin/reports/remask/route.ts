import { getCloudflareContext } from '@opennextjs/cloudflare'

import { verifyAdminRequest } from '@/lib/admin-auth'
import { getActor } from '@/lib/auth/actor'
import { replaceDangerReportImageWithMasked } from '@/lib/db/repos/danger-reports.repo'
import { MASKED_MEDIA_FILE_PREFIX, privateMediaUrl } from '@/lib/media/url'

export const runtime = 'nodejs'

/**
 * 管理者が、既存の(ぼかしていない)報告の写真をぼかし直して公開する(UIUX改装 項目57)。
 * 元の写真 → 管理者の端末でぼかす → ぼかした写真を保存 → 元の写真を消す、の順。
 * 審査をやり直さない(管理者が見て、ぼかした写真で置き換えるため)。
 */

const KEY_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/
const MAX_FILE_SIZE = 20 * 1024 * 1024

interface ImagesBindingLike {
  info(stream: ReadableStream<Uint8Array>): Promise<unknown>
  input(stream: ReadableStream<Uint8Array>): { output(options: { format: 'image/webp'; quality: number }): Promise<{ image(): ReadableStream<Uint8Array> }> }
}
interface MediaBucket {
  put(key: string, value: ReadableStream<Uint8Array>, options: { httpMetadata: { contentType: string; cacheControl: string } }): Promise<unknown>
  delete(keys: string | string[]): Promise<void>
}

function json(message: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ message, ...extra }, { status })
}

export async function POST(request: Request) {
  const admin = await verifyAdminRequest()
  if (!admin.authorized) return json(admin.error ?? '管理者権限が必要です', admin.status ?? 403)
  const actor = await getActor()
  if (actor.kind !== 'user' || !actor.isAdmin) return json('管理者権限が必要です', 403)

  let uploadedKey: string | null = null
  let bucket: MediaBucket | null = null
  try {
    const form = await request.formData()
    const file = form.get('file')
    const reportId = form.get('reportId')
    if (!(file instanceof File)) return json('写真がありません', 400)
    if (typeof reportId !== 'string' || !KEY_SEGMENT.test(reportId)) return json('reportId が不正です', 400)
    if (form.get('masked') !== '1' || !['image/webp', 'image/jpeg'].includes(file.type) || file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return json('端末でぼかした写真だけを送れます', 400)
    }

    const { env } = getCloudflareContext()
    const binding = env as unknown as { IMAGES: ImagesBindingLike; MEDIA_PRIVATE: MediaBucket }
    bucket = binding.MEDIA_PRIVATE
    try {
      await binding.IMAGES.info(file.stream())
    } catch {
      return json('壊れた画像またはサポートされていない画像です', 400)
    }
    const transformed = await binding.IMAGES.input(file.stream()).output({ format: 'image/webp', quality: 85 })

    const replaced = await replaceDangerReportImageWithMasked(actor, reportId, (report) => {
      if (!KEY_SEGMENT.test(report.userId)) throw new RangeError('invalid owner')
      uploadedKey = `danger-reports/${report.userId}/${report.id}/${MASKED_MEDIA_FILE_PREFIX}${crypto.randomUUID()}.webp`
      return uploadedKey
    }, async (key) => {
      await binding.MEDIA_PRIVATE.put(key, transformed.image(), {
        httpMetadata: { contentType: 'image/webp', cacheControl: 'private, max-age=31536000, immutable' },
      })
    })
    if (!replaced) return json('報告が見つかりません', 404)
    // 元の(ぼかしていない)写真は消す。消せなくても置き換えは終わっているので、失敗は記録に残す
    // (参照されなくなった写真は、R2 の掃除と、退会のときの本人のフォルダごとの削除で消える)
    if (replaced.previousKey && replaced.previousKey !== replaced.imageKey) {
      await bucket.delete(replaced.previousKey).catch(() => {
        console.error('[api/admin/reports/remask] failed to delete the unmasked original')
      })
    }
    return json('ぼかした写真に置き換えました', 200, { imageUrl: privateMediaUrl(replaced.imageKey) })
  } catch (error) {
    if (uploadedKey && bucket) await bucket.delete(uploadedKey).catch(() => undefined)
    if (error instanceof RangeError) return json('報告の写真を置き換えられませんでした', 400)
    console.error('[api/admin/reports/remask] failed', error instanceof Error ? error.message : 'unknown')
    return json('写真の置き換えに失敗しました', 500)
  }
}
