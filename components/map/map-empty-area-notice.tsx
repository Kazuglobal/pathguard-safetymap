"use client"

import { Flame, PlusCircle, X } from "lucide-react"

import { tankenTokens } from "@/lib/design/tanken"
import { BELOW_MAP_TOP_ROWS } from "@/lib/map-overlay-ui"
import { REPORT_ENTRY_LABEL } from "@/lib/report-entry"

interface MapEmptyAreaNoticeProps {
  onReport: () => void
  onShowHeatmap: () => void
  onDismiss: () => void
}

// 案内は、上の列(検索・通学路チェック・くわしい表示)と下の操作の列のあいだの帯のまんなかに出す。上の列の下に潜ると見出しや
// 「閉じる」が押せなくなり、下にはみ出すと報告のボタンを覆うので、入りきらないときは帯の中でスクロールさせる。
// 「くわしい表示」の列を開いているあいだと、低すぎる画面(SHORT_MAP_SCREEN_QUERY)では map-container が出さない

/**
 * 地図に見えている範囲に報告が1件もないときの案内(UIUX改装 項目10)。
 * 何もない地図のままにせず、最初の1件の報告と、全国の事故データ(事故ヒートマップ)へ進めるようにする。
 */
export function MapEmptyAreaNotice({ onReport, onShowHeatmap, onDismiss }: MapEmptyAreaNoticeProps) {
  const t = tankenTokens
  return (
    <div
      data-testid="map-empty-area-band"
      className={`pointer-events-none absolute inset-x-3 z-20 flex flex-col bottom-[calc(env(safe-area-inset-bottom,0px)+9.5rem)] md:bottom-[13.5rem] ${BELOW_MAP_TOP_ROWS.folded}`}
    >
      <section
        role="status"
        aria-labelledby="map-empty-area-title"
        className="pointer-events-auto relative mx-auto my-auto max-h-full w-full max-w-sm overflow-y-auto rounded-[22px] border p-4 pr-12"
        style={{ background: "rgba(255,253,247,.97)", borderColor: t.border.soft, boxShadow: t.shadow.float }}
        data-testid="map-empty-area-notice"
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="この案内を閉じる"
          className={`absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full ${t.cls.focus}`}
          style={{ color: t.color.inkSoft }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <h2 id="map-empty-area-title" className="text-base font-black" style={{ color: t.color.ink }}>
          この地域の報告はまだありません
        </h2>
        <p className="mt-1 text-sm font-bold" style={{ color: t.color.inkSoft }}>
          最初の1件を報告しませんか。
        </p>
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={onReport}
            className={`chunky-press inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-black text-white ${t.cls.focus}`}
            style={{ background: t.color.accent, boxShadow: t.shadow.pressAccent }}
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            {REPORT_ENTRY_LABEL}
          </button>
          <button
            type="button"
            onClick={onShowHeatmap}
            className={`chunky-press inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 px-4 text-sm font-black ${t.cls.focus}`}
            style={{ background: t.color.card, borderColor: t.border.soft, color: t.color.ink, boxShadow: t.shadow.pressPaper }}
          >
            <Flame className="h-4 w-4" aria-hidden="true" />
            事故ヒートマップ(全国データ)を見る
          </button>
        </div>
      </section>
    </div>
  )
}
