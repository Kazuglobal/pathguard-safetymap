import type {
  UserMarker,
  DetectionItem,
  MarkerMatch,
  ComparisonResult,
  BoundingBox,
} from "./hazard-game-types"

const IOU_THRESHOLD = 0.1
const PERFECT_MATCH_BONUS = 20
const GOOD_MATCH_BONUS = 10
const WEAK_MATCH_BONUS = 5
const CATEGORY_MATCH_BONUS = 5

export function calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
  const x1 = Math.max(box1.x, box2.x)
  const y1 = Math.max(box1.y, box2.y)
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width)
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height)

  if (x2 <= x1 || y2 <= y1) {
    return 0
  }

  const intersectionArea = (x2 - x1) * (y2 - y1)
  const box1Area = box1.width * box1.height
  const box2Area = box2.width * box2.height
  const unionArea = box1Area + box2Area - intersectionArea

  return unionArea > 0 ? intersectionArea / unionArea : 0
}

function categoriesMatch(
  markerCat: UserMarker["category"],
  detectionCat: DetectionItem["category"]
): boolean {
  const categoryMap: Record<UserMarker["category"], readonly DetectionItem["category"][]> = {
    hazard: ["hazards"],
    safety: ["safety_equipment"],
    traffic: ["traffic"],
    obstruction: ["obstructions"],
    unknown: ["hazards", "safety_equipment", "traffic", "obstructions"],
  }

  return categoryMap[markerCat]?.includes(detectionCat) ?? false
}

function findBestMatch(
  marker: UserMarker,
  detections: readonly DetectionItem[],
  alreadyMatchedDetectionInstances: ReadonlySet<string>
): {
  detection: DetectionItem
  iou: number
  categoryMatch: boolean
  instanceKey: string
} | null {
  let bestMatch: {
    detection: DetectionItem
    iou: number
    categoryMatch: boolean
    instanceKey: string
  } | null = null

  for (const [detectionIndex, detection] of detections.entries()) {
    for (const [positionIndex, position] of detection.positions.entries()) {
      const instanceKey = `${detectionIndex}:${positionIndex}`
      if (alreadyMatchedDetectionInstances.has(instanceKey)) continue

      const markerBox: BoundingBox = {
        x: marker.x,
        y: marker.y,
        width: marker.width,
        height: marker.height,
      }
      const iou = calculateIoU(markerBox, position)

      if (iou >= IOU_THRESHOLD && (!bestMatch || iou > bestMatch.iou)) {
        bestMatch = {
          detection,
          iou,
          categoryMatch: categoriesMatch(marker.category, detection.category),
          instanceKey,
        }
      }
    }
  }

  return bestMatch
}

function calculateBonusForMatch(match: MarkerMatch): number {
  let bonus = 0

  if (match.overlapRatio >= 0.7) {
    bonus += PERFECT_MATCH_BONUS
  } else if (match.overlapRatio >= 0.4) {
    bonus += GOOD_MATCH_BONUS
  } else {
    bonus += WEAK_MATCH_BONUS
  }

  if (match.categoryMatch) {
    bonus += CATEGORY_MATCH_BONUS
  }

  return bonus
}

function buildUnmatchedAiDetections(
  allDetections: readonly DetectionItem[],
  matchedDetectionInstances: ReadonlySet<string>
): DetectionItem[] {
  const unmatched: DetectionItem[] = []

  for (const [detectionIndex, detection] of allDetections.entries()) {
    if (detection.positions.length === 0) {
      unmatched.push(detection)
      continue
    }

    for (const [positionIndex, position] of detection.positions.entries()) {
      const instanceKey = `${detectionIndex}:${positionIndex}`
      if (matchedDetectionInstances.has(instanceKey)) continue

      unmatched.push({
        ...detection,
        count: 1,
        positions: [position],
      })
    }
  }

  return unmatched
}

export function compareUserMarkersWithAI(
  markers: readonly UserMarker[],
  allDetections: readonly DetectionItem[]
): ComparisonResult {
  const matches: MarkerMatch[] = []
  const unmatchedUserMarkers: UserMarker[] = []
  const matchedDetectionInstances = new Set<string>()

  const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp)

  for (const marker of sortedMarkers) {
    const bestMatch = findBestMatch(marker, allDetections, matchedDetectionInstances)

    if (bestMatch) {
      const match: MarkerMatch = {
        userMarker: marker,
        aiDetection: bestMatch.detection,
        overlapRatio: bestMatch.iou,
        categoryMatch: bestMatch.categoryMatch,
      }
      matches.push(match)
      matchedDetectionInstances.add(bestMatch.instanceKey)
    } else {
      unmatchedUserMarkers.push(marker)
    }
  }

  const unmatchedAiDetections = buildUnmatchedAiDetections(
    allDetections,
    matchedDetectionInstances
  )

  const totalMarkers = markers.length
  const matchCount = matches.length
  const avgIoU = matchCount > 0
    ? matches.reduce((sum, m) => sum + m.overlapRatio, 0) / matchCount
    : 0
  const categoryMatchCount = matches.filter((m) => m.categoryMatch).length

  const accuracyScore = totalMarkers === 0
    ? 0
    : Math.round(
        ((matchCount / totalMarkers) * 50) +
        (avgIoU * 30) +
        ((categoryMatchCount / totalMarkers) * 20)
      )

  const bonusPoints = matches.reduce(
    (sum, match) => sum + calculateBonusForMatch(match),
    0
  )

  return {
    matches,
    unmatchedUserMarkers,
    unmatchedAiDetections,
    accuracyScore,
    bonusPoints,
  }
}
