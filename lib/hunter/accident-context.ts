// =============================================
// きけんハンター 事故統計 → コンテキスト変換 (純粋ロジック)
// 事故統計を ①UI「気をつけるカード」サマリ ②Gemini注入用プロンプト文字列
// ③(将来用) 出題テーマ に変換する。React/IO/副作用なし。イミュータブル。
// =============================================

// 重要: traffic-accident-data は "use client" のため、runtime値はimportせず型のみimportする。
import type { AccidentStats } from "@/lib/traffic-accident-data";
import type { HunterAccidentSummary } from "@/lib/hunter/types";

/** リスクレベルの表示メタ情報 (本モジュール内で自前定義)。 */
interface RiskLevelMeta {
  readonly level: string;
  readonly label: string;
  readonly emoji: string;
}

const SAFE_RISK_LEVEL: RiskLevelMeta = {
  level: "safe",
  label: "安全",
  emoji: "🟢",
};

/** risk_score (0-100) からリスクレベルのメタ情報を導く。 */
function resolveRiskLevel(score: number): RiskLevelMeta {
  if (score >= 80) return { level: "critical", label: "非常に危険", emoji: "🔴" };
  if (score >= 50) return { level: "high", label: "危険", emoji: "🟠" };
  if (score >= 30) return { level: "moderate", label: "やや危険", emoji: "🟡" };
  if (score >= 10) return { level: "low", label: "注意", emoji: "🔵" };
  return SAFE_RISK_LEVEL;
}

/** 件数降順に並べた事故タイプ名の配列を返す (0件キーやデータ無しは []）。 */
function sortAccidentTypesByCount(
  byAccidentType: Record<string, number>,
): readonly string[] {
  return Object.entries(byAccidentType)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([type]) => type);
}

/** peak_hour を子ども向けの時間帯ラベルに変換する。null は null。 */
function resolvePeakTimeSlot(peakHour: number | null): string | null {
  if (peakHour === null) return null;
  if (peakHour >= 7 && peakHour <= 9) return "朝の通学時間 (7-9時)";
  if (peakHour >= 14 && peakHour <= 17) return "下校時間 (14-17時)";
  if (peakHour >= 17 && peakHour <= 19) return "夕方 (17-19時)";
  return `${peakHour}時ごろ`;
}

/**
 * 警察庁の事故類型ラベル（例「車両相互正面衝突」「出会い頭衝突」）を
 * 小学生にも わかる やさしい言い回しへ変換する（表示用）。
 * 未知の専門ラベルは技術用語を見せないよう汎用「交通事故」にフォールバック。
 * 注: マッチング(pickChoiceTemplate)やAI注入には元の専門ラベルを使う。
 */
const KID_ACCIDENT_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["正面衝突", "しょうめんからの しょうとつ"],
  ["追突", "うしろからの しょうとつ"],
  ["出会い頭", "かどでの 出会いがしら"],
  ["出合い頭", "かどでの 出会いがしら"],
  ["右折", "右に まがる車との 事故"],
  ["左折", "左に まがる車との 事故"],
  ["すれ違い", "すれちがいの 事故"],
  ["追越", "おいこしの 事故"],
  ["追抜", "おいぬきの 事故"],
  ["進路変更", "しんろを かえる 事故"],
  ["横断中", "どうろを わたっているときの 事故"],
  ["横断", "どうろを わたるときの 事故"],
  ["対面通行", "むかいあって あるくときの 事故"],
  ["背面通行", "せなか むきで あるくときの 事故"],
  ["歩行者", "歩いている人の 事故"],
  ["工作物", "かべや ポールに ぶつかる 事故"],
  ["路外逸脱", "みちから はずれる 事故"],
  ["転落", "おちる 事故"],
  ["転倒", "ころぶ 事故"],
  ["駐車車両", "とまっている車に ぶつかる 事故"],
  ["自転車", "自転車の 事故"],
  ["列車", "ふみきりの 事故"],
];

export function kidAccidentLabel(raw: string | null | undefined): string {
  if (!raw) return "交通事故";
  const hit = KID_ACCIDENT_LABELS.find(([key]) => raw.includes(key));
  return hit ? hit[1] : "交通事故";
}

/** データ無し (null / 0件) を表す共通サマリ。 */
const EMPTY_SUMMARY: HunterAccidentSummary = {
  hasData: false,
  riskScore: 0,
  riskLevel: SAFE_RISK_LEVEL.level,
  riskLabel: SAFE_RISK_LEVEL.label,
  riskEmoji: SAFE_RISK_LEVEL.emoji,
  totalAccidents: 0,
  childInvolved: 0,
  topAccidentType: null,
  peakTimeSlot: null,
  kidMessage: "このあたりの きろくは 少ないよ。でも ゆだんは きんもつ！",
};

function hasAccidentData(stats: AccidentStats | null): stats is AccidentStats {
  return stats !== null && stats.total_accidents > 0;
}

/** 子ども向けのやさしい一文を生成する (安全を断定しない)。 */
function buildKidMessage(
  childInvolved: number,
  riskLabel: string,
): string {
  if (childInvolved > 0) {
    return `このあたりでは、子どもが かかわる 事故が ${childInvolved}けん あったよ。${riskLabel}だから 気をつけて 練習しよう！`;
  }
  return `このあたりは ${riskLabel}な ばしょだよ。まわりを よく見て あんぜんに 歩こう！`;
}

/**
 * 事故統計を UI「気をつけるカード」用のサマリへ変換する。
 * データ無し (null / 0件) のときは安全側のデフォルトサマリを返す。
 */
export function buildAccidentSummary(
  stats: AccidentStats | null,
): HunterAccidentSummary {
  if (!hasAccidentData(stats)) {
    return EMPTY_SUMMARY;
  }

  const riskScore = stats.risk_score;
  const riskMeta = resolveRiskLevel(riskScore);
  const sortedTypes = sortAccidentTypesByCount(stats.by_accident_type);
  const topAccidentType = sortedTypes.length > 0 ? sortedTypes[0] : null;
  const peakTimeSlot = resolvePeakTimeSlot(stats.time_analysis.peak_hour);
  const childInvolved = stats.child_involved;

  return {
    hasData: true,
    riskScore,
    riskLevel: riskMeta.level,
    riskLabel: riskMeta.label,
    riskEmoji: riskMeta.emoji,
    totalAccidents: stats.total_accidents,
    childInvolved,
    topAccidentType,
    peakTimeSlot,
    kidMessage: buildKidMessage(childInvolved, riskMeta.label),
  };
}

/**
 * Gemini 注入用の日本語コンテキストブロックを生成する。
 * データ無し (null / 0件) のときは空文字を返す。
 */
export function buildAccidentPromptContext(stats: AccidentStats | null): string {
  if (!hasAccidentData(stats)) {
    return "";
  }

  const topTypes = sortAccidentTypesByCount(stats.by_accident_type).slice(0, 3);
  const peakTimeSlot = resolvePeakTimeSlot(stats.time_analysis.peak_hour);

  const lines: string[] = ["【この地点の過去の事故傾向】"];
  lines.push(
    `この付近では過去に事故が${stats.total_accidents}件（うち子ども関与${stats.child_involved}件）記録されています。`,
  );
  if (topTypes.length > 0) {
    lines.push(`多い事故タイプ: ${topTypes.join("、")}。`);
  }
  if (peakTimeSlot !== null) {
    lines.push(`事故が多い時間帯: ${peakTimeSlot}。`);
  }
  lines.push(
    "写真の中で、この傾向に関連する危険（出会い頭→見通しの悪い角、飛び出し→物かげからの飛び出し地点 など）を優先的に、正確なbboxで検出してください。",
  );

  return lines.join("");
}

/**
 * (将来用) 出題テーマの素となる事故タイプ名を件数降順で上位 max 件返す。
 * データ無しは []。
 */
export function extractAccidentThemes(
  stats: AccidentStats | null,
  max = 3,
): string[] {
  if (!hasAccidentData(stats)) {
    return [];
  }
  return sortAccidentTypesByCount(stats.by_accident_type).slice(0, max);
}
