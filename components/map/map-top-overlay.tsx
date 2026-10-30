"use client"

import { useState, type ReactElement, type ReactNode } from "react"
import { Building2, ChevronDown, Flame, Layers, Route, ScanEye } from "lucide-react"

import { getDangerTypePresentation } from "@/lib/map/danger-type-presentation"

export type MapTopOverlayPanel = "3d" | "ar" | "heatmap" | "hazard" | "suspicious" | null

interface MapTopOverlayProps {
  activePanel: MapTopOverlayPanel
  is3DEnabled: boolean
  isARMode: boolean
  isHeatmapVisible: boolean
  isSuspiciousVisible: boolean
  onPanelChange: (panel: MapTopOverlayPanel) => void
  onToggle3D: () => void
  onToggleAR: () => void
  onToggleHeatmap: () => void
  onToggleSuspicious: () => void
  searchSlot: ReactNode
  threeDPanelSlot: ReactNode
  arPanelSlot: ReactNode
  heatmapPanelSlot: ReactNode
  hazardPanelSlot: ReactNode
  suspiciousPanelSlot: ReactNode
  /**
   * 「くわしい表示」の中の「地図の見た目」(背景の地図と、洪水・津波など重ねる情報)。
   * 渡したボタン(このメニューと同じ見た目)を、開くきっかけに使って描く
   */
  renderDisplayOptions?: (trigger: ReactElement) => ReactNode
}

type AdvancedPanel = Exclude<MapTopOverlayPanel, "hazard" | null>

// 初期表示は「通学路チェック」(自分の通学路・危険のピン・事故多発地点)。そのほかの表示は「くわしい表示」に
// たたみ、それぞれにひとことの説明を添える(UIUX改装 項目9・10)。不審者情報は地図ピンと同じ絵を使う
const ADVANCED_CHIPS: readonly { id: AdvancedPanel; label: string; description: string; icon: typeof Flame }[] = [
  { id: "heatmap", label: "事故ヒートマップ", description: "事故の多い場所を色で", icon: Flame },
  { id: "suspicious", label: "不審者情報", description: "不審者の情報を円で", icon: getDangerTypePresentation("suspicious").icon },
  { id: "ar", label: "AR", description: "カメラに危険を重ねる", icon: ScanEye },
  { id: "3d", label: "3D", description: "建物を立体で見る", icon: Building2 },
]

const ADVANCED_IDS = new Set<MapTopOverlayPanel>(ADVANCED_CHIPS.map((chip) => chip.id))

const CHIP_CLASS = "chunky-press flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 py-2 text-[13px] font-black transition-colors"

const ACTIVE_STYLE = {
  background: "#159E72",
  color: "#fff",
  borderColor: "rgba(67,57,43,.2)",
  boxShadow: "0 3px 0 #0C7A55",
} as const

const IDLE_STYLE = {
  background: "rgba(255,253,247,.95)",
  color: "#746855",
  borderColor: "rgba(67,57,43,.12)",
  boxShadow: "0 3px 0 rgba(67,57,43,.14)",
} as const

function getPanelSlot({
  activePanel,
  threeDPanelSlot,
  arPanelSlot,
  heatmapPanelSlot,
  hazardPanelSlot,
  suspiciousPanelSlot,
}: Pick<
  MapTopOverlayProps,
  "activePanel" | "threeDPanelSlot" | "arPanelSlot" | "heatmapPanelSlot" | "hazardPanelSlot" | "suspiciousPanelSlot"
>) {
  switch (activePanel) {
    case "3d":
      return threeDPanelSlot
    case "ar":
      return arPanelSlot
    case "heatmap":
      return heatmapPanelSlot
    case "hazard":
      return hazardPanelSlot
    case "suspicious":
      return suspiciousPanelSlot
    default:
      return null
  }
}

function TwoLineChipBody({ icon: Icon, label, description }: { icon: typeof Flame; label: string; description: string }) {
  return (
    <>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        <span className="text-[12px] font-bold opacity-80">{description}</span>
      </span>
    </>
  )
}

export function MapTopOverlay(props: MapTopOverlayProps) {
  const activeSlot = getPanelSlot(props)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  // くわしい表示の中のパネルを開いているあいだは、たたまない
  const showDetails = isDetailsOpen || ADVANCED_IDS.has(props.activePanel)

  const handleChipClick = (panel: Exclude<MapTopOverlayPanel, null>) => {
    // くわしい表示の中のボタンで開け閉めしたあとも、列はたたまない
    if (ADVANCED_IDS.has(panel)) setIsDetailsOpen(true)

    if (props.activePanel === panel) {
      props.onPanelChange(null)
      return
    }

    if (panel === "3d" && !props.is3DEnabled) {
      props.onToggle3D()
    }

    if (panel === "ar" && !props.isARMode) {
      props.onToggleAR()
    }

    if (panel === "heatmap" && !props.isHeatmapVisible) {
      props.onToggleHeatmap()
    }

    if (panel === "suspicious" && !props.isSuspiciousVisible) {
      props.onToggleSuspicious()
    }

    props.onPanelChange(panel)
  }

  const toggleDetails = () => {
    if (showDetails && ADVANCED_IDS.has(props.activePanel)) props.onPanelChange(null)
    setIsDetailsOpen(!showDetails)
  }

  // 押してある見た目は「その表示が出ているか」(パネルを閉じても、出ているあいだは押してあるまま)
  const isAdvancedActive = (id: AdvancedPanel) =>
    (id === "3d" && props.is3DEnabled) ||
    (id === "ar" && props.isARMode) ||
    (id === "heatmap" && props.isHeatmapVisible) ||
    (id === "suspicious" && props.isSuspiciousVisible)

  const isRouteCheckActive = props.activePanel === "hazard"

  return (
    <div className="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] md:top-[calc(env(safe-area-inset-top,0px)+4.75rem)] z-30">
      <div data-map-overlay="top" className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-2">
        <div
          className="overflow-visible rounded-[1.75rem] border shadow-tanken-float"
          style={{
            background: "rgba(255,253,247,.95)",
            borderColor: "rgba(67,57,43,.12)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          {props.searchSlot}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            aria-label="通学路チェック"
            aria-pressed={isRouteCheckActive}
            className={CHIP_CLASS}
            style={isRouteCheckActive ? ACTIVE_STYLE : IDLE_STYLE}
            onClick={() => handleChipClick("hazard")}
          >
            <Route className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
            通学路チェック
          </button>
          <button
            type="button"
            aria-expanded={showDetails}
            aria-controls="map-detail-layers"
            className={CHIP_CLASS}
            style={IDLE_STYLE}
            onClick={toggleDetails}
          >
            <Layers className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
            くわしい表示
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${showDetails ? "rotate-180" : ""}`} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        {showDetails && (
          <div
            id="map-detail-layers"
            role="group"
            aria-label="くわしい表示"
            className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex min-w-max gap-2">
              {ADVANCED_CHIPS.map((chip) => {
                const isActive = isAdvancedActive(chip.id)
                return (
                  <button
                    key={chip.id}
                    type="button"
                    aria-label={chip.label}
                    aria-pressed={isActive}
                    className={CHIP_CLASS}
                    style={isActive ? ACTIVE_STYLE : IDLE_STYLE}
                    onClick={() => handleChipClick(chip.id)}
                  >
                    <TwoLineChipBody icon={chip.icon} label={chip.label} description={chip.description} />
                  </button>
                )
              })}
              {props.renderDisplayOptions?.(
                <button type="button" aria-label="地図の見た目" className={CHIP_CLASS} style={IDLE_STYLE}>
                  <TwoLineChipBody icon={Layers} label="地図の見た目" description="背景・多発地点・浸水" />
                </button>,
              )}
            </div>
          </div>
        )}

        {activeSlot ? (
          <div
            className="rounded-3xl border p-3 shadow-tanken-float"
            style={{
              background: "rgba(255,253,247,.97)",
              borderColor: "rgba(67,57,43,.12)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            {activeSlot}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default MapTopOverlay
