/**
 * 生成後の機械検証レイヤー。
 * 危険レポートの生成画像を callGeminiVision で構造化チェックし、
 * プロンプト頼みでは防ぎきれない「英字ラベル等の混入」「顔・ナンバーの匿名化漏れ」を
 * 多層防御で捕捉する。防災インフォグラフィックが意図的に描く短い日本語ラベルや凡例は
 * 問題として扱わず、規約違反となる文字・プライバシーリスクだけを検出させる。
 */

import { callGeminiVision } from "./gemini-hazard"
import type { GeneratedImage } from "./gemini-image"

/** 生成画像1枚に対する検証結果。true / 非空配列は「混入・匿名化漏れあり」を意味する。 */
export interface GeneratedImageVerification {
  /** 規約違反となる読み取り可能文字（英字透かし・モデル名・特定情報）があるか。意図的な日本語ラベルは除外。 */
  readonly readableText: boolean
  /** 検出した問題文字の実サンプル（是正再生成時のフィードバックに使う）。 */
  readonly textSamples: string[]
  /** ぼかされていない判別可能な人物の顔があるか。 */
  readonly faces: boolean
  /** 判読可能なナンバープレートの文字・数字があるか。 */
  readonly licensePlates: boolean
  /** その他のプライバシーリスク（人名・住所・学校名・連絡先など）の説明。 */
  readonly otherPrivacyRisk: string[]
}

export interface VerifiedGenerationOutcome {
  readonly images: GeneratedImage[]
  /** 生成画像を採用できなかった場合の日本語警告（フォールバック表示用）。 */
  readonly warning?: string
}

/** 検証を通らず生成画像を採用できなかったときにクライアントへ返す警告文。 */
export const IMAGE_VERIFICATION_FAILED_WARNING =
  "生成画像の安全チェック（文字の混入・顔やナンバーの写り込み）に通らなかったため、この画像は表示できませんでした。プロンプトを調整してもう一度お試しください。"

// Gemini Schema形式（type は大文字）。responseMimeType: application/json と併用する。
const VERIFICATION_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    readableText: { type: "BOOLEAN" },
    textSamples: { type: "ARRAY", items: { type: "STRING" } },
    faces: { type: "BOOLEAN" },
    licensePlates: { type: "BOOLEAN" },
    otherPrivacyRisk: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["readableText", "textSamples", "faces", "licensePlates", "otherPrivacyRisk"],
}

const VERIFICATION_PROMPT = `この画像は日本の通学路写真をもとにした防災・防犯・交通安全のインフォグラフィックです。
短い日本語の注意ラベル（例:「冠水注意」「かべが たおれるかも」）、色分けの凡例、番号マーカー、矢印は意図的なデザインなので、問題として報告しないでください。

あなたの仕事は、意図しない「文字の混入」と「匿名化漏れ」だけを検出することです。次のものだけを問題として扱います:
- アルファベット/ラテン文字の透かし・ロゴ・ブランド名・AIモデル名・英単語のキャプション
- 人物や場所を特定できる文字情報（人名・表札・住所・学校名・電話番号・メールアドレス・連絡先）
- ぼかされておらず個人が判別できる人物の顔
- 文字や数字が判読できるナンバープレート
- その他のプライバシー・個人情報リスク

次のJSON形式のみで回答してください（説明文なし）:
{
  "readableText": <上記の「規約違反となる文字（英字透かし/モデル名/特定情報）」が読み取れるなら true、意図的な日本語ラベルや凡例しかないなら false>,
  "textSamples": [<検出した問題文字を原文のまま最大5個。意図的な日本語ラベルは含めない>],
  "faces": <ぼかされていない判別可能な顔があれば true>,
  "licensePlates": <判読可能なナンバープレートがあれば true>,
  "otherPrivacyRisk": [<人名・住所・学校名・連絡先などその他のリスクを日本語で簡潔に。なければ空配列>]
}`

/** すべての検出フラグが陰性なら「クリーン」（採用してよい）。 */
export function isImageClean(verification: GeneratedImageVerification): boolean {
  return (
    !verification.readableText &&
    !verification.faces &&
    !verification.licensePlates &&
    verification.textSamples.length === 0 &&
    verification.otherPrivacyRisk.length === 0
  )
}

/** 検出内容を是正指示（再生成プロンプトの末尾に付けるサフィックス）へ変換する。 */
export function buildCorrectiveSuffix(verification: GeneratedImageVerification): string {
  const lines: string[] = [
    "",
    "[生成後検証フィードバック - 前回の画像に問題が見つかりました。次を厳守して作り直してください]",
  ]
  if (verification.textSamples.length > 0) {
    const samples = verification.textSamples.map((s) => `「${s}」`).join("、")
    lines.push(`- 前回混入した次の文字は絶対に描画しない: ${samples}`)
  }
  if (verification.readableText) {
    lines.push("- アルファベットの透かし・ロゴ・ブランド名・AIモデル名・英単語のキャプションを一切描かない。")
  }
  if (verification.faces) {
    lines.push("- 写り込んだ人物の顔は必ずぼかすか判別できないように簡略化する。")
  }
  if (verification.licensePlates) {
    lines.push("- 車のナンバープレートの文字・数字を描かない（ぼかす／塗りつぶす）。")
  }
  if (verification.otherPrivacyRisk.length > 0) {
    lines.push(`- 次のプライバシー情報を描かない: ${verification.otherPrivacyRisk.join("、")}`)
  }
  lines.push("- 人名・表札・住所・学校名・電話番号・連絡先など個人や場所を特定できる文字を描かない。")
  return lines.join("\n")
}

function parseVerification(raw: string): GeneratedImageVerification {
  let obj: any
  try {
    obj = JSON.parse(raw)
  } catch {
    // responseMimeType 指定でも稀にコードフェンス付きで返るため、波括弧範囲を抽出して再挑戦。
    const start = raw.indexOf("{")
    const end = raw.lastIndexOf("}")
    if (start >= 0 && end > start) {
      obj = JSON.parse(raw.slice(start, end + 1))
    } else {
      throw new Error("検証レスポンスをJSONとして解析できませんでした")
    }
  }
  const toStrings = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter((s) => s.trim().length > 0) : []
  return {
    readableText: Boolean(obj?.readableText),
    textSamples: toStrings(obj?.textSamples),
    faces: Boolean(obj?.faces),
    licensePlates: Boolean(obj?.licensePlates),
    otherPrivacyRisk: toStrings(obj?.otherPrivacyRisk),
  }
}

/** 生成画像1枚を callGeminiVision で構造化検証する（低温度・JSON強制）。 */
export async function verifyGeneratedImage(
  imageBase64OrDataUrl: string
): Promise<GeneratedImageVerification> {
  const text = await callGeminiVision(imageBase64OrDataUrl, VERIFICATION_PROMPT, {
    temperature: 0,
    responseMimeType: "application/json",
    responseSchema: VERIFICATION_RESPONSE_SCHEMA,
  })
  return parseVerification(text)
}

/**
 * 生成画像を検証し、必要なら是正サフィックス付きで1回だけ再生成する。
 * - 検証OK: 生成画像をそのまま採用（追加コストは検証1コールのみ）。
 * - 検証NG: 是正サフィックスで1回だけ再生成 → 再検証OKなら採用。
 * - 再検証もNG（または再生成が画像を返さない）: 生成画像を採用せず warning を返す（フォールバックへ合流）。
 * - 検証呼び出し自体が失敗: 現行動作を維持し、その時点の画像を採用する。
 *
 * @param images   一次生成の画像群（先頭を代表画像として検証）。
 * @param regenerate 是正サフィックスを受け取り再生成した画像群を返すコールバック。
 */
export async function verifyOrRegenerateImages({
  images,
  regenerate,
}: {
  images: GeneratedImage[]
  regenerate: (correctiveSuffix: string) => Promise<GeneratedImage[]>
}): Promise<VerifiedGenerationOutcome> {
  // 画像が無い場合は既存の「画像なし」パスをそのまま踏襲（検証しない）。
  if (images.length === 0) {
    return { images }
  }

  let verification: GeneratedImageVerification
  try {
    verification = await verifyGeneratedImage(images[0].dataUrl)
  } catch (error) {
    // 検証呼び出し自体の失敗は生成機能を壊さない。現行動作を維持して採用する。
    console.error("[ImageVerification] 検証呼び出しに失敗したため生成画像をそのまま採用します", error)
    return { images }
  }

  if (isImageClean(verification)) {
    return { images }
  }

  // 検出内容をフィードバックして1回だけ再生成。
  console.warn("[ImageVerification] 生成画像に混入・匿名化漏れを検出したため是正再生成します", {
    readableText: verification.readableText,
    faces: verification.faces,
    licensePlates: verification.licensePlates,
    otherPrivacyRiskCount: verification.otherPrivacyRisk.length,
  })
  const regenerated = await regenerate(buildCorrectiveSuffix(verification))
  if (regenerated.length === 0) {
    return { images: [], warning: IMAGE_VERIFICATION_FAILED_WARNING }
  }

  let reVerification: GeneratedImageVerification
  try {
    reVerification = await verifyGeneratedImage(regenerated[0].dataUrl)
  } catch (error) {
    // 再検証の呼び出し失敗も現行動作を維持し、是正再生成した画像を採用する。
    console.error("[ImageVerification] 再検証の呼び出しに失敗したため再生成画像を採用します", error)
    return { images: regenerated }
  }

  if (isImageClean(reVerification)) {
    return { images: regenerated }
  }

  // 是正再生成でも通らなければ生成画像を採用しない（検証不能な画像を黙って通さない）。
  console.warn("[ImageVerification] 是正再生成後も検証を通らなかったため生成画像を破棄します")
  return { images: [], warning: IMAGE_VERIFICATION_FAILED_WARNING }
}
