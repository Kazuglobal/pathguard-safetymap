export type SystemASituation = "earthquake" | "typhoon" | "flood" | "fire"

export type SystemASimulationPrompts = Record<SystemASituation, string | null>

export type SystemASimulationJob = {
  situation: SystemASituation
  prompt: string
}

export const SYSTEM_A_FLOOD_TRUTH_SUFFIX = `[Hazard-zone truth constraint]
This location is within an official flood inundation zone. Keep the existing restrained simulation limit of 15–20 cm visible standing water for this child-facing image. Do not depict the official maximum depth as the visible water depth; that value is communicated separately in the interface.`

export function appendSystemAFloodTruth(prompt: string): string {
  return `${prompt}\n\n${SYSTEM_A_FLOOD_TRUTH_SUFFIX}`
}

export function buildSystemASimulationJobs(
  prompts: SystemASimulationPrompts,
): SystemASimulationJob[] {
  return (["earthquake", "typhoon", "flood", "fire"] as const).flatMap(
    (situation) => {
      const prompt = prompts[situation]
      return typeof prompt === "string" && prompt.trim().length > 0
        ? [{ situation, prompt }]
        : []
    },
  )
}

export async function settleSystemASimulationBatch<T>(
  jobs: readonly Promise<T>[],
): Promise<{ values: T[]; errors: unknown[] }> {
  const settled = await Promise.allSettled(jobs)
  const values: T[] = []
  const errors: unknown[] = []
  for (const result of settled) {
    if (result.status === "fulfilled") values.push(result.value)
    else errors.push(result.reason)
  }
  return { values, errors }
}

export function appendImageGenerationContext(
  formData: FormData,
  situation: string,
  point: readonly [longitude: number, latitude: number] | null,
): void {
  formData.append("situation", situation)
  if (!point) return
  formData.append("longitude", String(point[0]))
  formData.append("latitude", String(point[1]))
}
