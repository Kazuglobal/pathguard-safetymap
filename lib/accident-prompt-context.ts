import type { AccidentStats } from "@/lib/traffic-accident-data"
import { ACCIDENT_IMAGE_CONTEXT_PARAMS } from "@/lib/accident-stats-year-window"

const TIME_SLOT_LABELS: Record<string, string> = {
  "07-09_morning_commute": "朝の通学時間（7-9時）",
  "14-17_after_school": "下校時間（14-17時）",
  "17-19_evening": "夕方（17-19時）",
  other: "その他の時間帯",
}
const KNOWN_WEATHER_LABELS = new Set(["晴", "曇", "雨", "雪", "霧"])
const UNKNOWN_LABELS = new Set(["", "不明", "unknown", "その他", "other", "null", "未設定"])

export function isAccidentImageContextEnabled(
  value = process.env.ACCIDENT_IMAGE_CONTEXT_ENABLED,
): boolean {
  return value?.toLowerCase() === "true"
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function topKnownLabel(
  counts: Record<string, number> | null | undefined,
  resolveLabel: (key: string) => string | null,
): string | null {
  if (!counts) return null
  const candidates = Object.entries(counts)
    .filter(([, count]) => isCount(count) && count > 0)
    .map(([key, count]) => ({ label: resolveLabel(key.trim()), count }))
    .filter((item): item is { label: string; count: number } => item.label !== null)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "ja"))
  return candidates[0]?.label ?? null
}

function knownFreeLabel(value: string): string | null {
  return UNKNOWN_LABELS.has(value.toLowerCase()) || UNKNOWN_LABELS.has(value)
    ? null
    : value
}

export function buildAccidentPromptContext(
  stats: AccidentStats | null,
): string | null {
  if (!stats || !isCount(stats.total_accidents) || stats.total_accidents === 0) return null

  const countParts: string[] = []
  if (isCount(stats.pedestrian_involved)) {
    countParts.push(`歩行者関与 ${stats.pedestrian_involved}件`)
  }
  if (isCount(stats.child_involved)) {
    countParts.push(`子ども関与 ${stats.child_involved}件`)
  }
  if (isCount(stats.fatal_accidents)) {
    countParts.push(`死亡事故 ${stats.fatal_accidents}件`)
  }
  const countLine = `- 事故 ${stats.total_accidents}件${
    countParts.length > 0 ? `（${countParts.join(" / ")}）` : ""
  }`

  const topFacts = [
    topKnownLabel(stats.by_time_of_day, (key) => TIME_SLOT_LABELS[key] ?? null)
      ? `多い時間帯: ${topKnownLabel(stats.by_time_of_day, (key) => TIME_SLOT_LABELS[key] ?? null)}`
      : null,
    topKnownLabel(stats.by_accident_type, knownFreeLabel)
      ? `多い事故類型: ${topKnownLabel(stats.by_accident_type, knownFreeLabel)}`
      : null,
    topKnownLabel(stats.by_weather, (key) => KNOWN_WEATHER_LABELS.has(key) ? key : null)
      ? `多い天候: ${topKnownLabel(stats.by_weather, (key) => KNOWN_WEATHER_LABELS.has(key) ? key : null)}`
      : null,
  ].filter((value): value is string => value !== null)

  return `[この地点の客観データ（半径${ACCIDENT_IMAGE_CONTEXT_PARAMS.radiusMeters}m・直近${ACCIDENT_IMAGE_CONTEXT_PARAMS.years}年・警察庁交通事故統計オープンデータ）]
${countLine}${topFacts.length > 0 ? `\n- ${topFacts.join(" / ")}` : ""}
[このデータの使い方]
- 上記データが示すリスク（例: 出会い頭・登下校時間帯）に対応する注意表現を優先する。
- データにない事故・件数・被害を描かない。数値を変えない。
- 事故の瞬間・負傷者・損壊車両・血は描かない（恐怖演出禁止の既存原則）。
- 「事故が少ない/多いから安全/危険」という断定文を画像に書かない。`
}
