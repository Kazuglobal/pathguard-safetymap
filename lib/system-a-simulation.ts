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
