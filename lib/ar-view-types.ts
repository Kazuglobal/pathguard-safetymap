import type { DangerReport } from "@/lib/types"
import type { AccidentHeatmapFilters } from '@/lib/traffic-accident-heatmap'

export type ARViewMode = (
  | { kind: "nearby"; reports: DangerReport[] }
  | {
      kind: "parent_child_route"
      routeId: string
      routeName: string
      childId: string | null
      childName: string | null
      reports: DangerReport[]
      sessionId: string
    }
) & { accidentFilters?: AccidentHeatmapFilters }

export interface ARViewProps {
  mode: ARViewMode
  onClose: () => void
}
