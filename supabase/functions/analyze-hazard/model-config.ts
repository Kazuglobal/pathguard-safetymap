export const DEFAULT_ANTHROPIC_MODELS = [
  "claude-haiku-4-5-20251001",
] as const

export function buildAnthropicModelCandidates(
  configuredModel: string | undefined,
  configuredCandidates: string[],
): string[] {
  const normalizedModel = configuredModel?.trim()
  return [
    ...new Set(
      [
        ...(normalizedModel ? [normalizedModel] : []),
        ...configuredCandidates,
        ...DEFAULT_ANTHROPIC_MODELS,
      ].filter((value) => value.trim().length > 0),
    ),
  ]
}
