import { getCloudflareContext } from '@opennextjs/cloudflare'

import { getActor } from '@/lib/auth/actor'
import { AuthzError } from '@/lib/db/authz'
import {
  getDangerReportForImageUpdate,
  setDangerReportImages,
} from '@/lib/db/repos/danger-reports.repo'
import { privateMediaUrl } from '@/lib/media/url'
import { checkPaidApiRateLimit, rateLimitedResponse } from '@/lib/upstash-rate-limiter'

export const runtime = 'nodejs'

const MAX_REQUEST_SIZE = 25 * 1024 * 1024
const MAX_FILE_SIZE = 20 * 1024 * 1024
const MAX_PROCESSED_IMAGES = 20
const KEY_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', new Set(['jpg', 'jpeg'])],
  ['image/png', new Set(['png'])],
  ['image/webp', new Set(['webp'])],
])

type ImageType = 'processed' | 'original'

interface ImageTransformationResult {
  image(): ReadableStream<Uint8Array>
}
interface ImageTransformer {
  output(options: { format: 'image/webp'; quality: number }): Promise<ImageTransformationResult>
}
interface ImagesBindingLike {
  info(stream: ReadableStream<Uint8Array>): Promise<unknown>
  input(stream: ReadableStream<Uint8Array>): ImageTransformer
}
interface MediaBucket {
  put(
    key: string,
    value: ReadableStream<Uint8Array>,
    options: { httpMetadata: { contentType: string; cacheControl: string } },
  ): Promise<unknown>
  delete(keys: string | string[]): Promise<void>
}

function json(message: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ message, ...extra }, { status })
}

function parseImageType(value: FormDataEntryValue | null): ImageType {
  return value === 'original' ? 'original' : 'processed'
}

function parseReplaceIndex(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  if (!/^\d+$/.test(value.trim())) return Number.NaN
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN
}

function validateFile(file: File): string | null {
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return '画像サイズは20MB以下にしてください'
  const extensions = ALLOWED_IMAGE_TYPES.get(file.type)
  if (!extensions) return 'JPEG、PNG、WebP形式の画像のみ使用できます'
  const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  if (!extension || !extensions.has(extension)) return '画像の拡張子と形式が一致しません'
  return null
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE) {
    return json('リクエストサイズが大きすぎます', 413)
  }

  const actor = await getActor()
  if (actor.kind !== 'user') return json('認証が必要です', 401)

  let uploadedKey: string | null = null
  let bucket: MediaBucket | null = null
  try {
    const formData = await request.formData()
    const fileValue = formData.get('file')
    const reportIdValue = formData.get('reportId')
    const imageType = parseImageType(formData.get('imageType'))
    const replaceIndex = parseReplaceIndex(formData.get('replaceIndex'))
    if (!(fileValue instanceof File)) return json('file not provided', 400)
    if (typeof reportIdValue !== 'string' || !reportIdValue || reportIdValue.length > 128) {
      return json('reportId is invalid', 400)
    }
    if (!KEY_SEGMENT.test(reportIdValue)) return json('reportId is invalid', 400)
    if (Number.isNaN(replaceIndex)) return json('replaceIndex must be a non-negative integer', 400)
    const validationError = validateFile(fileValue)
    if (validationError) return json(validationError, 400)

    const report = await getDangerReportForImageUpdate(actor, reportIdValue)
    if (!report) return json('Report not found', 404)
    if (!KEY_SEGMENT.test(report.userId) || !KEY_SEGMENT.test(report.id)) {
      return json('Report contains an invalid media key segment', 500)
    }

    if (imageType === 'processed') {
      if (replaceIndex == null && report.processedImageKeys.length >= MAX_PROCESSED_IMAGES) {
        return json(`加工画像は${MAX_PROCESSED_IMAGES}枚までです`, 400)
      }
      if (replaceIndex != null && replaceIndex >= report.processedImageKeys.length) {
        return json('replaceIndex is out of range', 400)
      }
    }
    const rate = await checkPaidApiRateLimit('image-processing', actor.id)
    if (!rate.success) return rateLimitedResponse(rate.reset)
    const cloudflare = getCloudflareContext()
    const env = cloudflare.env as unknown as {
      IMAGES: ImagesBindingLike
      MEDIA_PRIVATE: MediaBucket
    }
    bucket = env.MEDIA_PRIVATE

    try {
      await env.IMAGES.info(fileValue.stream())
    } catch {
      return json('壊れた画像またはサポートされていない画像です', 400)
    }

    const transformed = await env.IMAGES.input(fileValue.stream())
      .output({ format: 'image/webp', quality: 85 })
    uploadedKey = `danger-reports/${report.userId}/${report.id}/${crypto.randomUUID()}.webp`
    await bucket.put(uploadedKey, transformed.image(), {
      httpMetadata: {
        contentType: 'image/webp',
        cacheControl: 'private, max-age=31536000, immutable',
      },
    })

    if (imageType === 'original') {
      const oldKey = report.imageKey
      await setDangerReportImages(actor, report.id, { imageKey: uploadedKey })
      if (oldKey && oldKey !== uploadedKey) await bucket.delete(oldKey).catch(() => undefined)
      return json('Original image uploaded and report updated successfully.', 200, {
        imageUrl: privateMediaUrl(uploadedKey),
      })
    }

    const updatedKeys = [...report.processedImageKeys]
    let oldKey: string | null = null
    if (replaceIndex == null) {
      if (updatedKeys.length >= MAX_PROCESSED_IMAGES) {
        await bucket.delete(uploadedKey)
        uploadedKey = null
        return json(`加工画像は${MAX_PROCESSED_IMAGES}枚までです`, 400)
      }
      updatedKeys.push(uploadedKey)
    } else {
      if (replaceIndex >= updatedKeys.length) {
        await bucket.delete(uploadedKey)
        uploadedKey = null
        return json('replaceIndex is out of range', 400)
      }
      oldKey = updatedKeys[replaceIndex] ?? null
      updatedKeys[replaceIndex] = uploadedKey
    }

    await setDangerReportImages(actor, report.id, { processedImageKeys: updatedKeys })
    if (oldKey && oldKey !== uploadedKey) await bucket.delete(oldKey).catch(() => undefined)
    return json('Processed image uploaded and report updated successfully.', 200, {
      processedImageUrl: privateMediaUrl(uploadedKey),
      updatedUrls: updatedKeys.map(privateMediaUrl),
    })
  } catch (error) {
    if (uploadedKey && bucket) await bucket.delete(uploadedKey).catch(() => undefined)
    if (error instanceof AuthzError) return json('このレポートを更新する権限がありません', 403)
    console.error('[api/image/process] failed', error instanceof Error ? error.message : 'unknown')
    return json('画像の処理に失敗しました', 500)
  }
}

export async function DELETE(request: Request) {
  const actor = await getActor()
  if (actor.kind === 'anon') return json('認証が必要です', 401)
  try {
    const body = await request.json() as Record<string, unknown>
    const reportId = typeof body.reportId === 'string' ? body.reportId : ''
    const index = Number(body.index)
    if (!KEY_SEGMENT.test(reportId) || !Number.isInteger(index) || index < 0) {
      return json('reportId または index が不正です', 400)
    }
    const report = await getDangerReportForImageUpdate(actor, reportId)
    if (!report) return json('Report not found', 404)
    const key = report.processedImageKeys[index]
    if (!key) return json('Processed image not found', 404)
    const updatedKeys = report.processedImageKeys.filter((_, current) => current !== index)
    await setDangerReportImages(actor, report.id, { processedImageKeys: updatedKeys })
    const { env } = getCloudflareContext()
    await (env as unknown as { MEDIA_PRIVATE: MediaBucket }).MEDIA_PRIVATE.delete(key).catch(() => undefined)
    return json('Processed image deleted.', 200, { updatedUrls: updatedKeys.map(privateMediaUrl) })
  } catch (error) {
    if (error instanceof AuthzError) return json('このレポートを更新する権限がありません', 403)
    if (error instanceof SyntaxError) return json('リクエストが不正です', 400)
    console.error('[api/image/process] delete failed', error instanceof Error ? error.message : 'unknown')
    return json('画像の削除に失敗しました', 500)
  }
}
