import { extractStoragePathFromPublicUrl } from "@/lib/storage-path"

const BUCKET_NAME = "danger-reports"
const MAX_MODERATION_IMAGES = 3
const MAX_MODERATION_IMAGE_BYTES = 8 * 1024 * 1024

function guessImageMimeFromPath(path: string): string {
  if (path.endsWith(".png")) return "image/png"
  if (path.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}

export async function collectDangerReportImageDataUrls(
  supabaseAdmin: any,
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

  const dataUrls: string[] = []
  for (const url of candidates.slice(0, MAX_MODERATION_IMAGES)) {
    const path = extractStoragePathFromPublicUrl(url, BUCKET_NAME)
    if (!path) continue
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .download(path)
      if (error || !data || data.size > MAX_MODERATION_IMAGE_BYTES) continue
      const buffer = Buffer.from(await data.arrayBuffer())
      const mime =
        typeof data.type === "string" && data.type.startsWith("image/")
          ? data.type
          : guessImageMimeFromPath(path)
      dataUrls.push(`data:${mime};base64,${buffer.toString("base64")}`)
    } catch (error) {
      console.error(
        "danger report moderation image download failed:",
        error instanceof Error ? error.message : "unknown error",
      )
    }
  }
  return dataUrls
}
