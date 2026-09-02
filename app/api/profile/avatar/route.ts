import { getCloudflareContext } from '@opennextjs/cloudflare'

import { getActor } from '@/lib/auth/actor'
import { getProfile, upsertOwnProfile } from '@/lib/db/repos/profiles.repo'
import { publicMediaUrl } from '@/lib/media/url'

export const runtime = 'nodejs'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
interface ImagesBinding {
  info(stream: ReadableStream<Uint8Array>): Promise<unknown>
  input(stream: ReadableStream<Uint8Array>): { output(options: { format: 'image/webp'; quality: number }): Promise<{ image(): ReadableStream<Uint8Array> }> }
}
interface Bucket {
  put(key: string, value: ReadableStream<Uint8Array>, options: { httpMetadata: { contentType: string; cacheControl: string } }): Promise<unknown>
  delete(key: string): Promise<void>
}

export async function POST(request: Request) {
  const actor = await getActor()
  if (actor.kind !== 'user') return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size <= 0 || file.size > 5 * 1024 * 1024 || !ALLOWED.has(file.type)) {
      return Response.json({ error: 'JPEG、PNG、GIF、WebPの5MB以下の画像を選択してください' }, { status: 400 })
    }
    const { env } = getCloudflareContext()
    const bindings = env as unknown as { IMAGES: ImagesBinding; MEDIA_PUBLIC: Bucket }
    await bindings.IMAGES.info(file.stream())
    const transformed = await bindings.IMAGES.input(file.stream()).output({ format: 'image/webp', quality: 85 })
    const key = `avatars/${actor.id}/${crypto.randomUUID()}.webp`
    await bindings.MEDIA_PUBLIC.put(key, transformed.image(), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
    })
    const old = await getProfile(actor, actor.id)
    try {
      await upsertOwnProfile(actor, actor.email ?? '', { avatarKey: key })
    } catch (error) {
      await bindings.MEDIA_PUBLIC.delete(key).catch(() => undefined)
      throw error
    }
    if (old?.avatarKey && old.avatarKey !== key) await bindings.MEDIA_PUBLIC.delete(old.avatarKey).catch(() => undefined)
    return Response.json({ avatar_url: publicMediaUrl(key) })
  } catch (error) {
    console.error('[api/profile/avatar] failed', error instanceof Error ? error.message : 'unknown')
    return Response.json({ error: 'アバターの更新に失敗しました' }, { status: 500 })
  }
}
