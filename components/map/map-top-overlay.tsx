"use client"

import type { ReactNode } from "react"

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
}

const CHIP_CONFIG = [
  { id: "3d" as const, label: "3D" },
  { id: "ar" as const, label: "AR" },
  { id: "heatmap" as const, label: "事故ヒートマップ" },
  { id: "suspicious" as const, label: "不審者情報" },
  { id: "hazard" as const, label: "ハザード" },
]

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

export function MapTopOverlay(props: MapTopOverlayProps) {
  const activeSlot = getPanelSlot(props)

  const handleChipClick = (panel: Exclude<MapTopOverlayPanel, null>) => {
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

  return (
    <div className="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] md:top-[calc(env(safe-area-inset-top,0px)+4.75rem)] z-30">
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-2">
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

        <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2">
            {CHIP_CONFIG.map((chip) => {
              const isActive =
                (chip.id === "3d" && props.is3DEnabled && props.activePanel === "3d") ||
                (chip.id === "ar" && props.isARMode && props.activePanel === "ar") ||
                (chip.id === "heatmap" && props.isHeatmapVisible && props.activePanel === "heatmap") ||
                (chip.id === "suspicious" && props.isSuspiciousVisible && props.activePanel === "suspicious") ||
                (chip.id === "hazard" && props.activePanel === "hazard")

              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-label={chip.label}
                  aria-pressed={isActive}
                  className="chunky-press rounded-full border-2 px-4 py-2 text-[13px] font-black transition-colors"
                  style={
                    isActive
                      ? {
                          background: "#159E72",
                          color: "#fff",
                          borderColor: "rgba(67,57,43,.2)",
                          boxShadow: "0 3px 0 #0C7A55",
                        }
                      : {
                          background: "rgba(255,253,247,.95)",
                          color: "#847661",
                          borderColor: "rgba(67,57,43,.12)",
                          boxShadow: "0 3px 0 rgba(67,57,43,.14)",
                        }
                  }
                  onClick={() => handleChipClick(chip.id)}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
        </div>

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
