const SWEEP_SOFT_DEADLINE_MS = 220_000

export function hasModerationSweepTimeRemaining(
  startedAt: number,
  now = Date.now(),
): boolean {
  return now - startedAt < SWEEP_SOFT_DEADLINE_MS
}
