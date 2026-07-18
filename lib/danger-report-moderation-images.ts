import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"
import { extractStoragePathFromPublicUrl } from "@/lib/storage-path"

const BUCKET_NAME = "danger-reports"
const MAX_MODERATION_IMAGES = 3
const MAX_MODERATION_IMAGE_BYTES = 8 * 1024 * 1024
const MODERATION_IMAGE_DOWNLOAD_TIMEOUT_MS = 10_000

function withDownloadTimeout<T>(promise: PromiseLike<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("moderation image download timed out")),
      MODERATION_IMAGE_DOWNLOAD_TIMEOUT_MS,
    )
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timeout)
        resolve(value)
      },
      (error) => {
        clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

interface StorageDownloadResult {
  data: Blob | null
  error: unknown
}

function guessImageMimeFromPath(path: string): string {
  if (path.endsWith(".png")) return "image/png"
  if (path.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}

export async function collectDangerReportImageDataUrls(
  supabaseAdmin: Pick<SupabaseClient<Database>, "storage">,
  report: { image_url?: unknown; processed_image_urls?: unknown },
): Promise<string[]> {
  const candidates: string[] = []
  if (typeof report.image_url === "string" && report.image_url) {
    candidates.push(report.image_url)
  }
  if (Array.isArray(report.processed_image_urls)) {
    for (const url of report.processed_image_urls) {
      if (typeof url === "string" && url) candidates.push(url)
    }
  }

  const downloadImage = async (url: string): Promise<string | null> => {
    const path = extractStoragePathFromPublicUrl(url, BUCKET_NAME)
    if (!path) return null
    try {
      const { data, error } = await withDownloadTimeout<StorageDownloadResult>(
        supabaseAdmin.storage.from(BUCKET_NAME).download(path),
      )
      if (error || !data || data.size > MAX_MODERATION_IMAGE_BYTES) {
        return null
      }
      const buffer = Buffer.from(await data.arrayBuffer())
      const mime =
        typeof data.type === "string" && data.type.startsWith("image/")
          ? data.type
          : guessImageMimeFromPath(path)
      return `data:${mime};base64,${buffer.toString("base64")}`
    } catch (error) {
      console.error(
        "danger report moderation image download failed:",
        error instanceof Error ? error.message : "unknown error",
      )
      return null
    }
  }

  const results = await Promise.all(
    candidates.slice(0, MAX_MODERATION_IMAGES).map(downloadImage),
  )
  return results.filter((value): value is string => value !== null)
}
