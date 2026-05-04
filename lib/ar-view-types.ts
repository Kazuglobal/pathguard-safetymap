import type { DangerReport } from "@/lib/types"

export type ARViewMode =
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

export interface ARViewProps {
  mode: ARViewMode
  onClose: () => void
}
