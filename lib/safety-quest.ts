import { compareUserMarkersWithAI } from "@/lib/hazard-game-matching"
import type { DetectionItem, UserMarker } from "@/lib/hazard-game-types"

export type SafetyQuestSourceType = "report" | "sample" | "private"
export type SafetyQuestDifficulty = "easy" | "normal" | "hard"
export type SafetyQuestAttemptMode = "hazard" | "quiz-battle" | "private-practice"

export type SafetyQuestChallenge = {
  id: string
  sourceType: SafetyQuestSourceType
  reportId: string | null
  title: string
  imageUrl: string
  thumbnailUrl: string
  areaLabel: string
  difficulty: SafetyQuestDifficulty
  status: "active" | "locked" | "retired"
  aiDetections: readonly DetectionItem[]
}

export type SafetyQuestAttemptInput = {
  challenge: SafetyQuestChallenge
  mode: SafetyQuestAttemptMode
  userMarkers: readonly UserMarker[]
  answerPayload?: { answer?: string; correct?: boolean } | null
  durationMs?: number | null
}

export type SafetyQuestAttemptResult = {
  score: number
  accuracy: number
  matches: number
  missed: number
  falsePositives: number
  pointsAwarded: number
  rewardKeys: string[]
  educationalFeedback: string[]
}

const PRIVATE_PRACTICE_POINT_CAP = 120

function detection(
  category: DetectionItem["category"],
  label: string,
  description: string,
  x: number,
  y: number,
  width = 0.16,
  height = 0.16,
): DetectionItem {
  return {
    category,
    label,
    description,
    count: 1,
    confidence: 0.86,
    coverageRatio: width * height,
    positions: [{ x, y, width, height }],
  }
}

export const SAMPLE_SAFETY_QUEST_CHALLENGES: readonly SafetyQuestChallenge[] = [
  {
    id: "sample-crossing-1",
    sourceType: "sample",
    reportId: null,
    title: "見通しの悪い交差点",
    imageUrl: "/placeholder.jpg",
    thumbnailUrl: "/placeholder.jpg",
    areaLabel: "サンプル通学路",
    difficulty: "normal",
    status: "active",
    aiDetections: [
      detection("hazards", "見通しの悪い角", "角の先から車や自転車が急に出てくる可能性があります。", 0.22, 0.26),
      detection("traffic", "車のかげ", "車のかげで歩行者や自転車が見えにくくなります。", 0.63, 0.35),
      detection("obstructions", "路上の障害物", "歩く場所が狭くなり、車道側へふくらみやすくなります。", 0.48, 0.56),
    ],
  },
]

// 利用者の報告の写真はクエストに使わない(UIUX改装 項目57)。問題は自前の見本(SAMPLE_SAFETY_QUEST_CHALLENGES)だけ

export function calculateSafetyQuestPoints({
  rawPoints,
  sourceType,
}: {
  rawPoints: number
  sourceType: SafetyQuestSourceType
}): number {
  const points = Math.max(0, Math.round(rawPoints))
  return sourceType === "private" ? Math.min(PRIVATE_PRACTICE_POINT_CAP, points) : points
}

export function parseSafetyQuestMarkers(value: unknown): UserMarker[] | null {
  if (!Array.isArray(value)) return null

  const markers: UserMarker[] = []
  for (const [index, marker] of value.entries()) {
    if (!marker || typeof marker !== "object") return null
    const raw = marker as Record<string, unknown>
    const x = Number(raw.x)
    const y = Number(raw.y)
    const width = Number(raw.width)
    const height = Number(raw.height)
    const timestamp = Number(raw.timestamp ?? index + 1)

    if (![x, y, width, height, timestamp].every(Number.isFinite)) return null
    if (x < 0 || y < 0 || x > 1 || y > 1 || width <= 0 || height <= 0) return null

    markers.push({
      id: String(raw.id ?? `marker-${index + 1}`),
      x,
      y,
      width,
      height,
      label: typeof raw.label === "string" ? raw.label : "hazard",
      category: raw.category === "safety" || raw.category === "traffic" || raw.category === "obstruction" || raw.category === "unknown"
        ? raw.category
        : "hazard",
      timestamp,
    })
  }

  return markers
}

function detectionTargetCount(detections: readonly DetectionItem[]): number {
  return detections.reduce((count, item) => count + Math.max(1, item.positions.length), 0)
}

export function scoreSafetyQuestAttempt(input: SafetyQuestAttemptInput): SafetyQuestAttemptResult {
  const comparison = compareUserMarkersWithAI(input.userMarkers, input.challenge.aiDetections)
  const targetCount = detectionTargetCount(input.challenge.aiDetections)
  const matches = comparison.matches.length
  const missed = Math.max(0, targetCount - matches)
  const accuracy = targetCount === 0 ? 0 : Math.round((matches / targetCount) * 100)
  const quizCorrect = input.answerPayload?.correct === true || input.answerPayload?.answer === "danger"
  const rawPoints = matches * 50 + Math.floor(accuracy * 0.9) + (quizCorrect ? 80 : 0)
  const pointsAwarded = calculateSafetyQuestPoints({
    rawPoints,
    sourceType: input.challenge.sourceType,
  })
  const score = Math.min(100, accuracy + (quizCorrect ? 10 : 0))

  return {
    score,
    accuracy,
    matches,
    missed,
    falsePositives: comparison.unmatchedUserMarkers.length,
    pointsAwarded,
    rewardKeys: accuracy >= 60 ? ["lookout-master"] : [],
    educationalFeedback: [
      matches > 0 ? `${matches}こ見つけられました。` : "まずは赤い丸で危険そうな場所を囲んでみましょう。",
      missed > 0 ? "まだ見つけられる危険があります。車のかげや曲がり角も見てみましょう。" : "すべての危険ポイントを見つけました。",
    ],
  }
}

export function findSampleSafetyQuestChallenge(id: string): SafetyQuestChallenge | null {
  return SAMPLE_SAFETY_QUEST_CHALLENGES.find((challenge) => challenge.id === id) ?? null
}
