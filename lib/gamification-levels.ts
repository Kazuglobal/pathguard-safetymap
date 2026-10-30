/**
 * レベルは 500pt ごとに1つ上がる。サーバの計算(lib/db/repos/gamification.repo.ts)と画面で同じ値を使う。
 * D1 のトリガー(lib/db/migrations/20260903155959_report_creation_rewards.sql)にも 500 が直接書いてあるので、変えるときはそちらも
 */
export const POINTS_PER_LEVEL = 500

/**
 * 報告が公開されたときにもらえるポイント。付けるのは D1 のトリガー(report_reward_approve。
 * lib/db/migrations/20260903155959_report_creation_rewards.sql)で、ここは画面の説明に使う値
 */
export const REPORT_PUBLISHED_POINTS = 20

/** いまのレベルの進み具合(マイページの進み具合のバーに使う) */
export function getLevelProgress(points: number, level: number) {
  const safeLevel = Math.max(level, 1)
  const previousThreshold = (safeLevel - 1) * POINTS_PER_LEVEL
  const nextThreshold = safeLevel * POINTS_PER_LEVEL
  const pointsTowardsLevel = Math.max(points - previousThreshold, 0)
  return {
    level: safeLevel,
    nextLevel: safeLevel + 1,
    ratio: Math.min(pointsTowardsLevel / POINTS_PER_LEVEL, 1),
    pointsToNextLevel: Math.max(nextThreshold - points, 0),
  }
}
