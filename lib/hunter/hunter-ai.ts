// =============================================
// きけんハンター 専用画像解析 (Geminiラッパー)
// 汎用 Vision在庫AI(analyzeImagePipeline)を流用せず、子ども向け専用
// プロンプト+スキーマで「危険ポイントだけ」を1コールで取得する。
// 探索もクイズも同じ1解析で賄う(コール数を増やさない)。
// 失敗・空・解析不能は throw せず、すべてガイドモードへ吸収する。
// =============================================

import { callGeminiVision } from "@/lib/gemini-hazard"
import { extractHunterJson } from "@/lib/hunter/ai-json"
import { validateHunterResponse } from "@/lib/hunter/ai-schema"
import { DISPLAY_CONF_MIN, sanitizeDangerPoints, sanitizeSafePoints } from "@/lib/hunter/sanitize"
import { buildQuizItemsFromAi } from "@/lib/hunter/quiz"
import { buildGuideMode } from "@/lib/hunter/fallback-hazards"
import { KID_DANGER_KINDS } from "@/lib/hunter/kid-copy"
import { HUNTER_GENERATION_CONFIG } from "@/lib/hunter/ai-request-schema"
import type { HunterAccidentSummary, HunterAnalyzeResult } from "@/lib/hunter/types"

export interface AnalyzeHunterOptions {
  readonly sessionId: string
  /** buildAccidentPromptContext の出力(空可)。プロンプト末尾に注入。 */
  readonly accidentContext?: string
  /** 事故サマリ。ガイドモードのテーマ選択・クイズに使用。 */
  readonly accidentSummary: HunterAccidentSummary
  /** ログ/コスト計測の区別用(例 "hunter-explore")。 */
  readonly purpose?: string
  /** JSON解析失敗時に1回だけ再出力を試みるか。既定 true。 */
  readonly allowRetry?: boolean
}

const KIND_LIST = KID_DANGER_KINDS.join(" / ")

/** 専用ハンターAIのプロンプト。危険「ポイント」だけを子ども向けに返させる。 */
export function buildHunterPrompt(
  accidentContext: string | undefined,
  accidentSummary: HunterAccidentSummary,
): string {
  const accidentBlock = accidentSummary.hasData
    ? `【この地点の事故傾向】多い事故: ${accidentSummary.topAccidentType ?? "不明"} / 子ども関与: ${accidentSummary.childInvolved}件 / 合計: ${accidentSummary.totalAccidents}件${
        accidentSummary.peakTimeSlot ? ` / 多い時間帯: ${accidentSummary.peakTimeSlot}` : ""
      }\n出会い頭→見通しの悪い角(blind_corner) / 横断中→信号のない横断(crossing_no_signal) / 飛び出し→物かげ(popout_spot) / 右左折→曲がる車(turning_car) を写真内で優先的に同定し accidentLink を付けてください。\n`
    : ""
  const ctx = accidentContext && accidentContext.trim().length > 0 ? `\n${accidentContext.trim()}` : ""

  return `あなたは「通学する低学年の子の視点で、写真の中の“事故が起こりうる状況の場所”だけを見つける専門家」です。
通学路の写真を見て、子どもが立ち止まって確かめるべき「危険ポイント」だけを返してください。

【とても重要・的外れな正解を出さない】
- ただ写っているだけの普通のもの(停車中の車・走行中の車そのもの・通常の看板・自転車・雑草・建物)は danger point にしない。
- 「物の名前」ではなく「歩く子が立ち止まって確かめるべき“状況のある場所”」だけを返す。
- 出さない具体例: 「死角を作っていない、ふつうに停まっている車」「ふつうの看板・電柱・標識そのもの」「まっすぐで見通しの良い歩道」。これら単体は danger point にしない。
- 出す前に自分へ問う:「ここで子どもが立ち止まり、左右を確かめる具体的な理由があるか？」無ければ出さない。
- 該当が無ければ dangerPoints は空配列[]でよい(無理に作らない)。量より質。自信のないものは入れない。

【kind(必ずこの中から選ぶ)】
${KIND_LIST}
- blind_corner=見通しの悪い角 / popout_spot=物かげからの飛び出し地点 / crossing_no_signal=信号のない横断 / turning_car=曲がってくる車(右左折) / narrow_sidewalk=せまい歩道 / parked_car_shadow=停車中の車のかげ(死角) / falling_object=落ちてくるもの / flood_dip=水がたまりやすい所 / other=その他

【region(bbox)の正確さ】
- x,y はその危険「状況」が実際に写っている場所の左上、w,h はその範囲(画像左上が0,0、右下が1,1の正規化座標)。
- 危険の原因そのもの(角・物かげ・横断帯・曲がってくる車など)を囲む。画面全体や無関係に広い範囲を指定しない。
- 同じ場所・同じ状況の危険は1つにまとめる(重複して出さない)。

【ことば(低学年むけ)】
- 1〜2年生の ことば。ひらがな多め。みじかい文。むずかしい漢字や 英語は つかわない。こわがらせない。「ぜったい安全」と 断定しない。
- whyDangerous は「何があるか」ではなく「なぜ立ち止まるべきか(この写真の状況)」を 1文で。

【クイズ同梱(コールを増やさない)】
- 各 dangerPoint は必ず quiz(4択)を持つ。choices は index0 が正解、のこり3つは「もっともらしいが危険な誤り」。
- 誤答は「目をつぶって進む」のような荒唐無稽は禁止。「車の音がしなければ渡る」「手をあげれば車は必ず止まる」のような“ありがちな思い込み”にする。

【件数・長さ】
- dangerPoints は最大4。explanation は40字以内、各 choice は18字以内。
- imageUsable: 写真が暗すぎる/通学路でない等で判断できないときは false。

【安全の工夫(safePoints・任意)】
- ガードレール・歩道・カーブミラー・信号 などの「安全の工夫」があれば safePoints に最大3つ。各 { kind, kidType(やさしい日本語), region, whyGood(なぜ安全か・1文) }。無ければ空配列。

【confidence と severity の意味】
- confidence は「ここが本当に危険ポイントである」確からしさ(0〜1)。物体検出の確信度ではない。${DISPLAY_CONF_MIN} 未満の確信度なら、無理に出さず候補から外す。
- severity は「歩く子への事故リスク」で high/medium/low を自分で判断する(カテゴリ固定ではない)。

${accidentBlock}${ctx}

次のJSONだけを出力してください(説明・前置き・コードフェンスは不要):
{
  "version": "hunter-1",
  "imageUsable": true,
  "dangerPoints": [
    {
      "kind": "blind_corner",
      "kidType": "見通しの悪い角",
      "region": { "x": 0.40, "y": 0.52, "w": 0.18, "h": 0.20 },
      "severity": "high",
      "confidence": 0.78,
      "whyDangerous": "曲がってくる 車から きみが 見えにくいよ。",
      "safeAction": "いちど 止まって 左右を よく 見よう。",
      "accidentLink": "出会い頭",
      "quiz": {
        "question": "見通しの わるい 角では どうする？",
        "choices": ["止まって 左右を 見る", "車の音が しなければ 進む", "走って ぬける", "車は 来ないと 決める"],
        "explanation": "止まれば 車に すぐ 気づけるよ。"
      }
    }
  ],
  "safePoints": [],
  "noHazardFollow": null
}
必ずJSONのみを出力。`
}

const RETRY_SUFFIX =
  "\n\n前回の出力はJSONとして読み取れませんでした。説明・前置き・コードフェンスを一切付けず、有効なJSONオブジェクトだけを出力してください。"

/** 一時的失敗の再試行前バックオフ(429/過負荷の即時再試行を避けつつ、合計レイテンシは有界)。 */
const RETRY_BACKOFF_MS = 400

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Gemini呼び出しの失敗が「再試行で回復し得る一時的失敗」かを判定する。
 * callGeminiVision は構造化エラーを投げない(lib/gemini-hazard.ts は構造変更禁止)ため、
 * 例外メッセージから分類する。429(レート超過)/5xx(サーバ過負荷)/空candidates/
 * ネットワーク瞬断のみ true。400/401/403 や画像不正など「再試行しても直らない」失敗は
 * false を返し、無駄な待ち時間を作らない。
 */
export function isRetryableGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "")
  const status = msg.match(/failed:\s*(\d{3})/)
  if (status) {
    const code = Number(status[1])
    return code === 429 || code >= 500
  }
  if (/did not contain text output/i.test(msg)) return true // 空candidates
  if (/fetch failed|Failed to fetch|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(msg)) return true
  return false // 不明・入力起因は保守的に再試行しない
}

/**
 * 低温度+構造化出力でGeminiを呼ぶ。一時的失敗のときだけ、短いバックオフを挟んで
 * 1回だけ再試行する(合計2コールで有界)。恒久的失敗は即座に投げ直す。
 */
async function callHunterVision(
  imageBase64: string,
  prompt: string,
  allowRetry: boolean,
): Promise<string> {
  try {
    return await callGeminiVision(imageBase64, prompt, HUNTER_GENERATION_CONFIG)
  } catch (err) {
    if (!allowRetry || !isRetryableGeminiError(err)) throw err
    await sleep(RETRY_BACKOFF_MS)
    return await callGeminiVision(imageBase64, prompt, HUNTER_GENERATION_CONFIG)
  }
}

/**
 * マスク済み画像を専用ハンターAIで解析し、HunterAnalyzeResult を返す。
 * いかなる失敗(ネットワーク/JSON破損/空/解析不能)も throw せず guide で吸収する。
 */
export async function analyzeHunterImage(
  imageBase64: string,
  options: AnalyzeHunterOptions,
): Promise<HunterAnalyzeResult> {
  const { sessionId, accidentContext, accidentSummary, allowRetry = true } = options
  const prompt = buildHunterPrompt(accidentContext, accidentSummary)

  // 1) Gemini 呼び出し(throw は ai_error ガイド)。低温度+構造化出力で精度を底上げ。
  //    一時的失敗(429/5xx/空candidates/瞬断)は callHunterVision が1回だけ再試行する。
  let text: string
  try {
    text = await callHunterVision(imageBase64, prompt, allowRetry)
  } catch {
    return buildGuideMode(accidentSummary, "ai_error", [], sessionId)
  }

  // 2) JSON抽出(失敗かつ allowRetry のとき1回だけ再出力)
  let extracted = extractHunterJson(text)
  if (!extracted.ok && allowRetry) {
    try {
      const retryText = await callGeminiVision(imageBase64, prompt + RETRY_SUFFIX, HUNTER_GENERATION_CONFIG)
      extracted = extractHunterJson(retryText)
    } catch {
      return buildGuideMode(accidentSummary, "ai_error", [], sessionId)
    }
  }
  if (!extracted.ok) {
    return buildGuideMode(accidentSummary, "parse_error", [], sessionId)
  }

  // 3) スキーマ検証(壊れた要素はドロップ)。imageUsable=false は unusable。
  const validated = validateHunterResponse(extracted.value)
  if (!validated.imageUsable) {
    return buildGuideMode(accidentSummary, "unusable", [], sessionId)
  }

  // 4) サニタイズ&選別(的外れ正解の構造排除)。空化は empty(逆モード素材は引き継ぐ)。
  const { hazards, materials } = sanitizeDangerPoints(validated.dangerPoints, { sessionId })
  const safePoints = sanitizeSafePoints(validated.safePoints, { sessionId })
  if (hazards.length === 0) {
    return buildGuideMode(accidentSummary, "empty", safePoints, sessionId)
  }

  // 5) 同梱クイズ素材から写真連動の良問を生成
  const quiz = buildQuizItemsFromAi(hazards, materials, accidentSummary)

  return {
    mode: "explore",
    hazards,
    quiz,
    safePoints,
    noHazardFollow: null,
    usedFallback: false,
    fallbackReason: null,
  }
}
