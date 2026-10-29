import { SLOW_NETWORK_NOTE } from "@/components/layout/page-loading"
import { tankenTokens } from "@/lib/design/tanken"

/**
 * 地図の部品が届くまでの表示。サーバの HTML に含まれるので、低速の端末でもすぐに出る。
 * 以前は無地のグレーのままで「壊れている」ように見えていた(低速端末で約20秒)。
 * 地図の画面を開いた直後(app/map/loading.tsx)と、地図の部品を読み込む間(map-page-client.tsx)で同じものを出す。
 */
export function MapLoadingPlaceholder() {
  const t = tankenTokens
  return (
    <div className="fullscreen-map-container">
      <div
        className="relative flex h-full min-h-[500px] w-full items-center justify-center p-4"
        style={{ background: t.color.paperDeep }}
        role="status"
        aria-live="polite"
        data-testid="map-loading-placeholder"
      >
        <div
          className="w-full max-w-sm rounded-[22px] border p-5"
          style={{ background: t.color.card, borderColor: t.border.soft, boxShadow: t.shadow.card }}
        >
          <p className="font-black" style={{ color: t.color.ink }}>
            地図を準備しています
          </p>
          <p className="mt-2 text-sm font-bold" style={{ color: t.color.inkSoft }}>
            地図の部品を読み込んでいます。このあと地図がひらき、危険マーカーがならびます。
          </p>
          <p className="mt-2 text-sm" style={{ color: t.color.inkSoft }}>
            {SLOW_NETWORK_NOTE}
          </p>
        </div>
      </div>
    </div>
  )
}
