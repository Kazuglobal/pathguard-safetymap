// =============================================
// きけんハンター 専用画像解析 (Geminiラッパー)
// 汎用 Vision在庫AI(analyzeImagePipeline)を流用せず、子ども向け専用
// プロンプト+スキーマで「危険ポイントだけ」を1コールで取得する。
// 探索もクイズも同じ1解析で賄う(コール数を増やさない)。
// 失敗・空・解析不能は throw せず、すべてガイドモードへ吸収する。
// =============================================

import { callGeminiVision } from "@/lib/gemini-hazard"
import { REALTIME_VISION_DEFAULT_MODEL } from "@/lib/gemini-util"
import { extractHunterJson } from "@/lib/hunter/ai-json"
import { validateHunterResponse } from "@/lib/hunter/ai-schema"
import { DISPLAY_CONF_MIN, MAX_AREA, sanitizeDangerPoints, sanitizeSafePoints } from "@/lib/hunter/sanitize"
import { buildQuizItemsFromAi } from "@/lib/hunter/quiz"
import { buildGuideMode } from "@/lib/hunter/fallback-hazards"
import { accidentTypeToKind, KID_DANGER_KINDS, KID_LABEL_BY_KIND } from "@/lib/hunter/kid-copy"
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
  const topTypes = (
    accidentSummary.topAccidentTypes && accidentSummary.topAccidentTypes.length > 0
      ? accidentSummary.topAccidentTypes
      : accidentSummary.topAccidentType
        ? [accidentSummary.topAccidentType]
        : []
  ).slice(0, 3)
  const priorityKind = accidentTypeToKind(accidentSummary.topAccidentType)
  const priorityLine = priorityKind
    ? `- 2周目チェックでは、まず「${KID_LABEL_BY_KIND[priorityKind]}(${priorityKind})」に当たる状況が写真に無いかを最初に確かめてください。`
    : `- 出会い頭→見通しの悪い角(blind_corner) / 横断中→信号のない横断(crossing_no_signal) / 飛び出し→物かげ(popout_spot) / 右左折→曲がる車(turning_car) に当たる状況が写真に無いかを確かめてください。`
  const accidentBlock = accidentSummary.hasData
    ? `【この地点の事故傾向(さがす順番のヒント)】多い事故: ${topTypes.length > 0 ? topTypes.join("、") : "不明"} / 子ども関与: ${accidentSummary.childInvolved}件 / 合計: ${accidentSummary.totalAccidents}件${
        accidentSummary.peakTimeSlot ? ` / 多い時間帯: ${accidentSummary.peakTimeSlot}` : ""
      }\n${priorityLine}\n- これは「探すときのヒント」です。ヒントに合う状況が写真に無ければ、無理に見つけない・accidentLink を付けない(3つのゲートはヒントより優先)。写真に写っていない危険を、この情報から作らないでください。\n- accidentLink は、写真の状況がこの事故傾向と本当に対応しているときだけ付けます(対応しなければ null)。\n`
    : ""
  // 事故統計の二重注入を防ぐ: hasData のとき ctx(buildAccidentPromptContext)は同一 stats の
  // 重複情報+検出強要文(「…優先的に、正確なbboxで検出してください」)を含むため注入しない。
  // summary 無しで独自 ctx を渡す呼び出しは従来どおり注入される。
  const ctx =
    !accidentSummary.hasData && accidentContext && accidentContext.trim().length > 0
      ? `\n${accidentContext.trim()}`
      : ""

  return `あなたは「通学する低学年の子の視点で、写真の中の“事故が起こりうる状況の場所”だけを見つける専門家」です。
通学路の写真を見て、子どもが立ち止まって確かめるべき「危険ポイント」だけを返してください。

【とても重要・的外れな正解を出さない】
- ただ写っているだけの普通のもの(停車中の車・走行中の車そのもの・通常の看板・自転車・雑草・建物)は danger point にしない。
- 「物の名前」ではなく「歩く子が立ち止まって確かめるべき“状況のある場所”」だけを返す。
- 出さない具体例: 「死角を作っていない、ふつうに停まっている車」「ふつうの看板・電柱・標識そのもの」「まっすぐで見通しの良い歩道」。これら単体は danger point にしない。
- 判定は2段階で行う。まず頭の中で「危険かもしれない場所」の候補を全部挙げる(この段階は多めでよい)。次に各候補へ下の3つのゲートを当て、3つ全部「はい」のものだけを出力する。
- G1[原因]: 危険の原因になる物・地形が、この写真に実際に写っているか？(推測・画面の外は「いいえ」)
- G2[状況]: その原因が「見通しを遮る」「横断を強いる」「車の進路と交わる」「路面・頭上そのものの危険(水たまり・落下物・せまい歩道)」のどれかに当たると、この写真の位置関係から指させるか？(物が写っているだけなら「いいえ」)
- G3[行動]: 「だから ここで 立ち止まって 〇〇を 確かめる」と具体的な行動を1文で言えるか？
- 1つでも「いいえ」なら出さない。ゲートを通った根拠は evidence に書く。
- 該当が無ければ dangerPoints は空配列[]でよい(無理に作らない)。量より質。自信のないものは入れない。

【見分け方の例(同じ物でも周りの状況で判定が変わる)】
- 停まっている車: 見通しの良い直線で周りがよく見える→出さない。交差点の角にあり、その先の道が死角になる→ parked_car_shadow で出す。
- 看板・電柱: まっすぐな歩道にあり通行の邪魔にならない→出さない。角にあって、その先の車道が見えなくなっている→ blind_corner で出す。
- 横断歩道: 信号があることだけを理由に crossing_no_signal では出さない。ただし青信号でも車が確実に止まるとは限らない。右左折する車の進路と子どもの横断経路が写真上で交わるなら turning_car として判定する。信号がなく車の通行がある横断場所は crossing_no_signal で判定する。
- 走行中の車・自転車・歩く人: ただ道を通っているだけ→出さない。曲がってきて子どもの進路と交わる、または死角から現れる位置にいる→ turning_car / popout_spot で出す。
- 雑草・植えこみ・へい: 道ばたにあるだけ→出さない。角や横断する場所の見通しを実際に遮っている→ blind_corner / popout_spot で出す。
- 判断に迷ったら「この状況“だけ”が理由で子どもが立ち止まるか」で決める。物の名前だけで即決めない。
- 上の例は例にすぎない。例に出てきた物だけを探さず、どの候補にも同じ3つのゲート(G1〜G3)を当てる。

【kind(必ずこの中から選ぶ)】
${KIND_LIST}
- blind_corner=見通しの悪い角 / popout_spot=物かげからの飛び出し地点 / crossing_no_signal=信号のない横断 / turning_car=曲がってくる車(右左折) / narrow_sidewalk=せまい歩道 / parked_car_shadow=停車中の車のかげ(死角) / falling_object=落ちてくるもの / flood_dip=水がたまりやすい所 / other=その他

【region(bbox)の正確さ】
- x,y はその危険「状況」が実際に写っている場所の左上、w,h はその範囲(画像左上が0,0、右下が1,1の正規化座標)。
- 枠は「状況」の目印になる“実際に写っている物”を囲む: blind_corner→角を作っている建物・へいの はし / parked_car_shadow→死角を作っている その車 / crossing_no_signal→実際にわたる場所の路面 / popout_spot→出てきそうな すき間・物かげ / turning_car→曲がってくる車(写っていなければ曲がり込んでくる車道の口) / narrow_sidewalk→せまくなっている歩道の区間 / falling_object→落ちてきそうな物 / flood_dip→くぼみ・水たまりの路面。
- 画面全体や無関係に広い範囲を囲まない。枠の面積(w×h)が ${MAX_AREA} をこえる枠は、後処理で無効として捨てられる。危険の原因が写っている範囲だけを囲めば自然に収まる。
- 確認手順: box を決めたら、そこだけを頭の中で切り出して見る。危険の原因が枠の中で小さくしか写らないなら、原因のまわりまで枠を狭める。逆に原因がはみ出すなら広げる。
- 同じ場所・同じ状況の危険は1つにまとめる(重複して出さない)。写真の別の一部・別の角度から見えていても、同じ実世界の場所を指すものは1つに統合する。

【見落としを防ぐ(2周目チェック)】
- 1周目: 写真をふつうに見て、危険ポイントの候補を挙げる。
- 2周目: kind の一覧を思い出し、「この写真に、この種類の“状況”は写っていないか」を確かめて見落としを拾う。見落としやすい場所: 画面の端、奥(遠く)の小さい状況、足もとの路面、手前で切れている物のかげ。
- 2周目は「見落としがないかの確認」であって、各 kind を出す義務ではない。多くの写真で該当する kind は0〜2種類しかない。ゲートに合わないものは出さない。

【evidence(さいしょに根拠を書く)】
- 各 dangerPoint では最初に evidence を書く: 「何が・何を・どう遮る/交わるか」をこの写真から読み取れる事実で30字以内(例:「角のへいが 右から来る車を かくす」)。写真に写っていない推測を書かない。evidence は分析用で、子どもには表示されない。
- evidence が「物の名前だけ」にしかならない候補は G2 を満たしていない。出さない。
- region と confidence は evidence の後で決める: 枠は evidence に書いた場所を囲み、confidence は evidence の確かさに合わせる。

【ことば(低学年むけ)】
- 1〜2年生の ことば。ひらがな多め。みじかい文。むずかしい漢字や 英語は つかわない。こわがらせない。「ぜったい安全」と 断定しない。
- whyDangerous は「何があるか」ではなく「なぜ立ち止まるべきか(この写真の状況)」を 1文で。

【写真固有の文にする】
- whyDangerous と safeAction には、この写真に実際に写っている具体物をひとつ入れ、場所を「ひだり/みぎ/おく/てまえ」のことばで示す(例:「みぎの かどの しろい 車」)。どの写真にも当てはまる文だけ(「ここは あぶないよ」等)にしない。具体物の名前がうまく言えないときも、点は出してよい(そのときは場所のことばだけでよい)。
- 英語の文字(A〜Z・a〜z)は1文字も入れない。英字が1文字でも入った文は破棄され、写真と関係のない定型文に差し替えられてしまう。外来語はカタカナで書く(例: ガードレール、カーブミラー)。この英字禁止は quiz の question / choices / explanation と safePoints の kidType / whyGood にも同じように適用する。

【クイズ同梱(コールを増やさない)】
- 各 dangerPoint は必ず quiz(4択)を持つ。choices は index0 が正解、のこり3つは「もっともらしいが危険な誤り」。
- 誤答(のこり3つ)は、子どもが実際にしがちな「思い込み」から、たがいに違う類型を3つ選んで作る: ①音・気配だけで判断(「車の 音が しなければ わたる」) ②相手への過信(「手を あげれば 車は かならず 止まる」) ③急げば安全(「走って わたれば だいじょうぶ」) ④いつもの道への安心(「まいにち とおる 道だから だいじょうぶ」) ⑤ながら歩き(「スマホを 見ながらでも だいじょうぶ」)。
- 「目をつぶって進む」のような荒唐無稽な誤答は禁止。誤答もこの写真の状況に合うことばにする。
- 4つの choices は長さを だいたい そろえる(正解だけが目立って長い・短いにしない)。
- explanation は「正しい行動をすると なぜ 助かるのか」を1文で書く(正解の言い換えだけにしない)。

【件数・長さ】
- dangerPoints は最大4。explanation は40字以内、各 choice は18字以内。
- imageUsable: 写真が暗すぎる/通学路でない等で判断できないときは false。

【安全の工夫(safePoints)】
- 危険と同じように、写真の中の「安全の工夫」も1周かけて探す: ガードレール / 歩道 / カーブミラー / 信号 / 横断歩道 / 街灯。見つけたら safePoints に最大3つ。各 { kind, kidType(やさしい日本語), region, whyGood(この写真でなぜ安全か・1文) }。無ければ空配列。
- dangerPoints が空(=あぶない所が見つからない写真)のときこそ、safePoints をていねいに探す。

【confidence と severity の意味】
- confidence は「ここが本当に危険ポイントである」確からしさ(0〜1)。物体検出の確信度ではない。目安: 0.8以上=危険の原因と見えにくさの両方が写真からはっきり読み取れる / 0.6〜0.8=どちらか一方は推測を含む / それより低いなら候補から外す。${DISPLAY_CONF_MIN} 未満の確信度なら、無理に出さず候補から外す。
- severity は「歩く子への事故リスク」で high/medium/low を自分で判断する(カテゴリ固定ではない)。

【出力前の最終チェック】
- 出力する前に、各 dangerPoint を G1〜G3 と【とても重要】の基準へもう一度照らし合わせ、当てはまらないものは取り除いてから出力する。
- evidence が写真の事実か・region が evidence の場所を囲んでいるか・枠が広すぎないかを確かめる。

${accidentBlock}${ctx}

次のJSONだけを出力してください(説明・前置き・コードフェンスは不要):
{
  "version": "hunter-1",
  "imageUsable": true,
  "dangerPoints": [
    {
      "evidence": "角の へいが 右から来る 車を かくしている",
      "kind": "blind_corner",
      "kidType": "見通しの悪い角",
      "region": { "x": 0.40, "y": 0.52, "w": 0.18, "h": 0.20 },
      "severity": "high",
      "confidence": 0.78,
      "whyDangerous": "みぎの かどは 曲がってくる 車から きみが 見えにくいよ。",
      "safeAction": "かどの 手前で いちど 止まって 左右を よく 見よう。",
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
    return await callGeminiVision(imageBase64, prompt, HUNTER_GENERATION_CONFIG, REALTIME_VISION_DEFAULT_MODEL)
  } catch (err) {
    if (!allowRetry || !isRetryableGeminiError(err)) throw err
    await sleep(RETRY_BACKOFF_MS)
    return await callGeminiVision(imageBase64, prompt, HUNTER_GENERATION_CONFIG, REALTIME_VISION_DEFAULT_MODEL)
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
      const retryText = await callHunterVision(imageBase64, prompt + RETRY_SUFFIX, false)
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
