// =============================================
// AGENT_TEAM.md パイプライン型定義
// Vision → Think → Score の3段階パイプライン
// =============================================

// ---- Prompt Types (既存互換) ----

export type PromptType = "default" | "expert" | "child"

// ---- Vision Stage (A6: VisionAgent 相当) ----

export type DetectionCategory =
  | "safety_equipment"
  | "hazards"
  | "traffic"
  | "obstructions"

export interface BoundingBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface DetectionItem {
  readonly category: DetectionCategory
  readonly label: string
  readonly description: string
  readonly count: number
  readonly confidence: number
  readonly coverageRatio: number
  readonly positions: readonly BoundingBox[]
}

export interface VisionResult {
  readonly safetyEquipment: readonly DetectionItem[]
  readonly hazards: readonly DetectionItem[]
  readonly traffic: readonly DetectionItem[]
  readonly obstructions: readonly DetectionItem[]
  readonly inferenceTimeMs: number
}

// ---- Think Stage (A7: ThinkAgent 相当) ----

export type RiskSeverity = "high" | "medium" | "low"

export interface ContextualRisk {
  readonly description: string
  readonly severity: RiskSeverity
  readonly relatedDetections: readonly string[]
}

export interface ThinkResult {
  readonly contextualRisks: readonly ContextualRisk[]
  readonly priorityImprovements: readonly string[]
  readonly latentRisks: readonly string[]
  readonly childPerspectiveRisks: readonly string[]
}

// ---- Score Stage (A8: ScoreAgent 相当) ----

export type SafetyLevel = "safe" | "caution" | "warning" | "danger"

export interface ScoreBreakdownItem {
  readonly item: string
  readonly category: DetectionCategory | "contextual"
  readonly points: number
  readonly reason: string
}

export interface SafetyScore {
  readonly score: number
  readonly level: SafetyLevel
  readonly breakdown: readonly ScoreBreakdownItem[]
  readonly detectionSummary: {
    readonly safetyEquipmentCount: number
    readonly hazardCount: number
    readonly trafficCount: number
    readonly obstructionCount: number
  }
  readonly thinkSummary: {
    readonly contextualRiskCount: number
    readonly highSeverityCount: number
    readonly mediumSeverityCount: number
    readonly lowSeverityCount: number
  }
}

// ---- Pipeline Types ----

export type PipelineStage = "vision" | "think" | "score" | "complete"

export interface PipelineProgress {
  readonly currentStage: PipelineStage
  readonly stagesCompleted: readonly PipelineStage[]
  readonly startTime: number
  readonly elapsedMs: number
}

export interface PipelineAnalysisResult {
  readonly vision: VisionResult
  readonly think: ThinkResult
  readonly score: SafetyScore
  readonly educationalTips: readonly string[]
  readonly analysisTimestamp: string
}

// ---- User Marker Types (Interactive Mode) ----

export type UserMarkerCategory = "hazard" | "safety" | "traffic" | "obstruction" | "unknown"

export interface UserMarker {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly label: string
  readonly category: UserMarkerCategory
  readonly timestamp: number
}

export interface UserMarkingResult {
  readonly markers: readonly UserMarker[]
  readonly markingStartTime: number
  readonly markingEndTime: number
}

// ---- Comparison Types ----

export interface MarkerMatch {
  readonly userMarker: UserMarker
  readonly aiDetection: DetectionItem
  readonly overlapRatio: number
  readonly categoryMatch: boolean
}

export interface ComparisonResult {
  readonly matches: readonly MarkerMatch[]
  readonly unmatchedUserMarkers: readonly UserMarker[]
  readonly unmatchedAiDetections: readonly DetectionItem[]
  readonly accuracyScore: number
  readonly bonusPoints: number
}

export interface PipelineAnalysisResultWithComparison extends PipelineAnalysisResult {
  readonly comparison?: ComparisonResult
  readonly userMarking?: UserMarkingResult
}

// ---- Legacy 互換型 ----

export interface LegacyHazard {
  readonly type: string
  readonly description: string
  readonly severity: number
  readonly location: string
  readonly confidence: number
  readonly bbox?: BoundingBox
}

export interface LegacyHazardAnalysisResult {
  readonly hazards: readonly LegacyHazard[]
  readonly overallSafety: number
  readonly educationalTips: readonly string[]
  readonly score: number
}
