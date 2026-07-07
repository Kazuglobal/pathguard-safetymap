import type { SafetyQuestChallenge } from "@/lib/safety-quest"

export function getChallengeHazardPoints(challenge: SafetyQuestChallenge) {
  const points = challenge.aiDetections.flatMap((detection, detectionIndex) =>
    detection.positions.map((position, positionIndex) => ({
      id: `${challenge.id}-${detectionIndex}-${positionIndex}`,
      label: detection.label,
      description: detection.description,
      x: Math.min(92, Math.max(8, (position.x + position.width / 2) * 100)),
      y: Math.min(88, Math.max(12, (position.y + position.height / 2) * 100)),
    })),
  )

  if (points.length > 0) return points

  return [
    { id: `${challenge.id}-fallback-1`, label: "見通し", description: "見通しに注意しましょう。", x: 41, y: 31 },
    { id: `${challenge.id}-fallback-2`, label: "飛び出し", description: "飛び出しに注意しましょう。", x: 70, y: 41 },
    { id: `${challenge.id}-fallback-3`, label: "車のかげ", description: "車のかげに注意しましょう。", x: 55, y: 58 },
  ]
}

export function buildSafetyQuestAttemptMarkers(challenge: SafetyQuestChallenge, foundHazards: readonly string[]) {
  return getChallengeHazardPoints(challenge)
    .filter((point) => foundHazards.includes(point.id))
    .map((point, index) => ({
      id: point.id,
      x: Math.max(0, Math.min(0.95, point.x / 100 - 0.06)),
      y: Math.max(0, Math.min(0.95, point.y / 100 - 0.06)),
      width: 0.12,
      height: 0.12,
      label: point.label,
      category: "hazard",
      timestamp: index + 1,
    }))
}
