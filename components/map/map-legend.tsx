"use client"

import { Info } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { tankenTokens } from "@/lib/design/tanken"
import {
  DANGER_TYPE_ORDER,
  getDangerTypePresentation,
} from "@/lib/map/danger-type-presentation"
import { PIN_PATH, PIN_VIEW_BOX } from "@/lib/map/pin-shape"
import { getRouteHazardPresentation } from "@/lib/map/route-hazard-presentation"
import {
  DANGER_LEVEL_MAX,
  getDangerLevelPresentation,
} from "@/lib/report-generation/danger-level-presentation"

const C = tankenTokens.color

const DANGER_LEVELS = Array.from({ length: DANGER_LEVEL_MAX }, (_, index) =>
  getDangerLevelPresentation(index + 1),
)

/** 凡例用の小さなしずく形(地図のピンと同じ path) */
function MiniPin({ colorHex }: { colorHex: string }) {
  return (
    <svg viewBox={PIN_VIEW_BOX} className="h-5 w-4 shrink-0" aria-hidden="true" focusable="false">
      <path d={PIN_PATH} fill={colorHex} stroke="#fff" strokeWidth={3} />
      <circle cx="22" cy="20" r="11" fill="#fff" />
    </svg>
  )
}

/** 白い丸の中に種類の絵(地図のピンの中身と同じ見た目) */
function TypeDisc({ type }: { type: string }) {
  const Icon = getDangerTypePresentation(type).icon
  return (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border bg-white"
      style={{ borderColor: tankenTokens.border.soft, color: C.ink }}
      aria-hidden="true"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
    </span>
  )
}

/**
 * デスクトップ左下に常時出す1行の凡例。
 * 絵=種類、色=あぶなさ、の2つだけを伝える(くわしい説明は MapLegendDetails)。
 */
export function MapLegendCompact() {
  return (
    <div className="flex items-center gap-2" data-testid="map-legend-compact">
      <ul className="flex items-center gap-2" aria-label="ピンの絵と種類">
        {DANGER_TYPE_ORDER.map((id) => {
          const type = getDangerTypePresentation(id)
          return (
            <li key={id} className="flex items-center gap-1" title={`${type.label}の危険`}>
              <TypeDisc type={id} />
              <span className="text-xs font-bold" style={{ color: C.inkSoft }}>
                {type.label}
              </span>
            </li>
          )
        })}
      </ul>
      <span className="h-4 w-px" style={{ background: tankenTokens.border.soft }} aria-hidden="true" />
      <div
        className="flex items-center gap-1"
        role="img"
        aria-label="ピンの色はあぶなさ。黄色から赤へ高くなります"
      >
        <span className="text-xs font-bold" style={{ color: C.inkSoft }}>
          あぶなさ
        </span>
        {DANGER_LEVELS.map((level) => (
          <span
            key={level.level}
            className="h-3 w-3 rounded-full border border-white"
            style={{ background: level.colorHex }}
            title={`${level.stars} ${level.kidLabel}`}
          />
        ))}
        <span className="text-[10px] font-bold" style={{ color: C.inkFaint }}>
          高
        </span>
      </div>
    </div>
  )
}

/** 凡例の全文(種類・あぶなさ・かたち)。スマホのポップオーバーとヘルプで使う */
export function MapLegendDetails() {
  const flood = getRouteHazardPresentation("flood")
  const tsunami = getRouteHazardPresentation("tsunami")
  const FloodIcon = flood.icon
  const TsunamiIcon = tsunami.icon

  return (
    <div className="space-y-3" data-testid="map-legend-details">
      <section>
        <h3 className="text-xs font-black" style={{ color: C.ink }}>
          ピンの絵 = きけんの種類
        </h3>
        <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {DANGER_TYPE_ORDER.map((id) => {
            const type = getDangerTypePresentation(id)
            return (
              <li key={id} className="flex items-center gap-1.5">
                <TypeDisc type={id} />
                <span className="min-w-0">
                  <span className="block text-xs font-black leading-tight" style={{ color: C.ink }}>
                    {type.label}
                  </span>
                  <span className="block text-[10px] font-bold leading-tight" style={{ color: C.inkSoft }}>
                    {type.hint}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-black" style={{ color: C.ink }}>
          ピンの色 = あぶなさ
        </h3>
        <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {DANGER_LEVELS.map((level) => (
            <li key={level.level} className="flex items-center gap-1.5">
              <MiniPin colorHex={level.colorHex} />
              <span className="min-w-0">
                <span className="block text-[10px] font-bold leading-tight" style={{ color: C.inkSoft }}>
                  {level.stars}
                </span>
                <span className="block text-xs font-black leading-tight" style={{ color: C.ink }}>
                  {level.kidLabel}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-black" style={{ color: C.ink }}>
          かたち
        </h3>
        <ul className="mt-1.5 space-y-1.5 text-xs font-bold" style={{ color: C.ink }}>
          <li className="flex items-center gap-1.5">
            <MiniPin colorHex={DANGER_LEVELS[1].colorHex} />
            しずく形: きけんの報告
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-white text-[9px] font-black"
              style={{ background: DANGER_LEVELS[2].colorHex, color: "#fff" }}
              aria-hidden="true"
            >
              3
            </span>
            まる と 数字: 近くの報告をまとめて表示
          </li>
          <li className="flex items-center gap-1.5">
            <span className="flex shrink-0 gap-0.5" aria-hidden="true">
              <span
                className="grid h-5 w-5 place-items-center rounded-[6px] border-2 border-white text-white"
                style={{ background: flood.colorHex }}
              >
                <FloodIcon className="h-3 w-3" strokeWidth={2.6} />
              </span>
              <span
                className="grid h-5 w-5 place-items-center rounded-[6px] border-2 border-white text-white"
                style={{ background: tsunami.colorHex }}
              >
                <TsunamiIcon className="h-3 w-3" strokeWidth={2.6} />
              </span>
            </span>
            四角: 通学路の{flood.label}・{tsunami.label}ハザード
          </li>
        </ul>
      </section>
    </div>
  )
}

/** スマホ用: 常時表示する場所がないので、ボタンから凡例を開く */
export function MapLegendButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="map-legend-button"
          className={`chunky-press flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-black ${tankenTokens.cls.focus}`}
          style={{
            background: "rgba(255,253,247,.95)",
            borderColor: "rgba(67,57,43,.12)",
            boxShadow: tankenTokens.shadow.float,
            color: C.inkSoft,
          }}
          aria-label="ピンの見方を表示"
        >
          <Info className="h-3.5 w-3.5" strokeWidth={2.6} />
          ピンの見方
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[17.5rem] rounded-2xl p-3"
        style={{ background: C.card, borderColor: tankenTokens.border.soft }}
      >
        <MapLegendDetails />
      </PopoverContent>
    </Popover>
  )
}
