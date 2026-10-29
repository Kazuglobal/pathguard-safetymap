import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

/** 待ち表示に添える一文(地図の待ち表示 components/map/map-loading-placeholder.tsx と同じ) */
export const SLOW_NETWORK_NOTE = "通信が遅いと少し時間がかかります。このままお待ちください。"

/**
 * 画面を開くまでの共通の待ち表示(各ルートの loading.tsx が使う。UIUX改装 項目42)。
 * サーバーコンポーネントのまま描く(先読みと最初の表示を軽くするため、動きの部品は読み込まない)。
 */
export function PageLoading({ label = "画面を準備しています…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[60vh] w-full items-center justify-center px-6 py-10"
      style={{ fontFamily: tankenTokens.font.family }}
      data-testid="page-loading"
    >
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 text-center">
        <span
          className="h-12 w-12 animate-spin rounded-full border-4 motion-reduce:animate-none"
          style={{ borderColor: C.primarySoft, borderTopColor: C.primary }}
          aria-hidden="true"
        />
        <p className="text-base font-bold" style={{ color: C.ink }}>
          {label}
        </p>
        <p className="text-sm" style={{ color: C.inkSoft }}>
          {SLOW_NETWORK_NOTE}
        </p>
      </div>
    </div>
  )
}
