/**
 * Supabase Storage の公開URLから、バケット内のオブジェクトパスを抽出する。
 *
 * 例: https://xxx.supabase.co/storage/v1/object/public/danger-reports/user-id/foo.jpg
 *     -> "user-id/foo.jpg"
 *
 * app/api/image/process/route.ts と components/map/map-container.tsx の
 * 両方から画像削除時のURL→パス変換に利用する共通ユーティリティ。
 */
export function extractStoragePathFromPublicUrl(publicUrl: string, bucketName: string): string | null {
  try {
    const url = new URL(publicUrl)
    const marker = `/storage/v1/object/public/${bucketName}/`
    const idx = url.pathname.indexOf(marker)
    if (idx < 0) return null
    const path = decodeURIComponent(url.pathname.slice(idx + marker.length))
    return path || null
  } catch {
    return null
  }
}
