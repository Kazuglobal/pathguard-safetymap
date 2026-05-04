import type { KidsChecklistItem } from "@/lib/ar-learning-quiz"
import type { ARLearningTourStatus } from "@/lib/ar-learning-tour"
import { SessionPayloadSchema, type SessionPayload } from "@/lib/route-learning-session-schema"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function buildRouteLearningSessionPayload(input: {
  checklist: KidsChecklistItem[]
  progress: Record<string, ARLearningTourStatus>
}): SessionPayload {
  return SessionPayloadSchema.parse({
    schemaVersion: 1,
    checklist: input.checklist.map((item) => ({
      id: item.id,
      label: item.label,
      checked: item.checked,
    })),
    stopResults: Object.entries(input.progress)
      .filter(([hazardId]) => UUID_PATTERN.test(hazardId))
      .map(([hazardId, status]) => ({
        hazardId,
        status,
      })),
  })
}
