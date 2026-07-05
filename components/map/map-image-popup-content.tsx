"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useDangerReportSignedImageUrl } from "@/lib/danger-report-image-access"

interface MapImagePopupContentProps {
  url: string
  hasError: boolean
  supabase: any
  onPreview: (resolvedUrl: string) => void
  onRetry: () => void
  onImageError: () => void
}

export function MapImagePopupContent({
  url,
  hasError,
  supabase,
  onPreview,
  onRetry,
  onImageError,
}: MapImagePopupContentProps) {
  // danger-reports バケット非公開化に備え、DB保存済みの公開URL文字列を
  // 表示直前に短TTLの署名URLへ差し替える。
  // 注意: この popup は mapboxgl.Popup + createRoot() による独立したReactツリーで
  // 描画されるため、上位の SupabaseProvider context は継承されない。
  // そのため supabase クライアントは props で明示的に受け取る。
  const signedUrl = useDangerReportSignedImageUrl(supabase, url)

  if (hasError) {
    return (
      <div className="w-28 sm:w-36 rounded-xl border border-blue-100 bg-white/90 px-3 py-2 shadow-md">
        <p className="mb-2 text-center text-xs text-slate-500">画像を読み込めませんでした</p>
        <Button type="button" variant="outline" size="sm" className="h-8 w-full" onClick={onRetry}>
          再試行
        </Button>
      </div>
    )
  }

  if (!signedUrl) {
    return (
      <div className="w-28 sm:w-36 rounded-xl border border-blue-100 bg-white/90 px-3 py-2 shadow-md">
        <div className="flex aspect-[4/3] w-full items-center justify-center">
          <span className="text-xs text-slate-400">読み込み中...</span>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="relative block w-28 sm:w-36 overflow-hidden rounded-xl shadow-md"
      onClick={() => onPreview(signedUrl)}
    >
      <div className="relative aspect-[4/3] w-full">
        <Image
          src={signedUrl}
          alt="加工画像プレビュー"
          fill
          sizes="(max-width: 640px) 112px, 144px"
          className="object-cover"
          onError={onImageError}
          priority
        />
      </div>
    </button>
  )
}

export default MapImagePopupContent
