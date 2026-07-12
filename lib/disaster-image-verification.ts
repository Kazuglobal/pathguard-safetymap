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
  /** 日本語ラベルの字形が明らかに崩れて判読不能か。段階導入: 現状はログのみで isImageClean には含めない。 */
  readonly garbledJapaneseText: boolean
  /** 過度に恐ろしい災害描写か(完全倒壊・画面内の炎・黒煙等)。段階導入: 現状はログのみで isImageClean には含めない。 */
  readonly excessiveDamage: boolean
}

export interface VerifiedGenerationOutcome {
  readonly images: GeneratedImage[]
  /** 生成画像を採用できなかった場合の日本語警告（フォールバック表示用）。 */
  readonly warning?: string
  /** 生成後検証のためにVisionへ投げたリクエスト数（コスト/監視ログ用）。 */
  readonly verificationRequestCount: number
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
    garbledJapaneseText: { type: "BOOLEAN" },
    excessiveDamage: { type: "BOOLEAN" },
  },
  // 新フィールドは required に入れない(旧形式応答との互換維持。欠落時は parseVerification が false に既定化)。
  required: ["readableText", "textSamples", "faces", "licensePlates", "otherPrivacyRisk"],
}

const VERIFICATION_PROMPT = `この画像は日本の通学路写真をもとにした防災・防犯・交通安全のインフォグラフィックです。
短い日本語の注意ラベル（例:「冠水注意」「かべが たおれるかも」）、色分けの凡例、番号マーカー、矢印は意図的なデザインなので、問題として報告しないでください。
意図的なラベルは通常、次のいずれかの短い定型文です:「フェンス倒壊注意」「電柱倒壊注意」「冠水注意」「延焼注意」、凡例「凡例 赤=倒壊・落下注意 / 青=冠水注意 / 橙=火災注意」、番号マーカー「1」〜「4」。ただしユーザー指定のカスタムハザードでは別の短い日本語ラベルになることもあり、正しく読める短い日本語の注意ラベルは問題にしないでください。炎・水滴・警告三角などの平面的なインフォグラフィック用アイコンも意図的なデザインであり、問題として報告しないでください。

あなたの仕事は、意図しない「文字の混入」「匿名化漏れ」「不適切な表現」だけを検出することです。次のものだけを問題として扱います:
- アルファベット/ラテン文字の透かし・ロゴ・ブランド名・AIモデル名・英単語のキャプション
- 人物や場所を特定できる文字情報（人名・表札・住所・学校名・電話番号・メールアドレス・連絡先）
- ぼかされておらず個人が判別できる人物の顔
- 文字や数字が判読できるナンバープレート
- その他のプライバシー・個人情報リスク
- 明らかに崩れた・実在しない字形の日本語風文字（ラベルとして判読できない歪んだ文字。様式化されているだけで正しく読める文字は報告しない）
- 過度に恐ろしい災害描写: 完全に倒壊・崩壊した建物、実写として燃えている炎や物、爆発のような瓦礫の飛散、空全体を覆う黒煙、暗く不吉に加工された空（ひび割れ・浅い冠水・薄い煙もや・落ち葉の散乱など穏当な被害表現、および平面的な警告アイコンは問題にしない）

次のJSON形式のみで回答してください（説明文なし）:
{
  "readableText": <上記の「規約違反となる文字（英字透かし/モデル名/特定情報）」が読み取れるなら true、意図的な日本語ラベルや凡例しかないなら false>,
  "textSamples": [<検出した問題文字を原文のまま最大5個。意図的な日本語ラベルは含めない>],
  "faces": <ぼかされていない判別可能な顔があれば true>,
  "licensePlates": <判読可能なナンバープレートがあれば true>,
  "otherPrivacyRisk": [<人名・住所・学校名・連絡先などその他のリスクを日本語で簡潔に。なければ空配列>],
  "garbledJapaneseText": <日本語ラベルの字形が明らかに崩れて判読不能なら true。すべて正しく読めるなら false>,
  "excessiveDamage": <上記の「過度に恐ろしい災害描写」があれば true。穏当な被害表現のみなら false>
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

/** 検出内容を是正指示（再生成プロンプトの末尾に付けるサフィックス）へ変換する。
 *  英語ベースプロンプトへの混合言語連結の追従低下と、日本語指示文自体が画像に描画される
 *  instruction leakage を避けるため英語で出力する。 */
export function buildCorrectiveSuffix(verification: GeneratedImageVerification): string {
  const lines: string[] = [
    "",
    "[POST-GENERATION AUDIT FEEDBACK — the previous image failed a safety check. Regenerate and strictly obey every rule below]",
  ]
  if (verification.textSamples.length > 0) {
    const samples = verification.textSamples.map((s) => `"${s}"`).join(", ")
    lines.push(`- The previous image contained the following forbidden text. It must NOT appear anywhere: ${samples}.`)
  }
  if (verification.readableText) {
    lines.push("- Remove every alphabet watermark, logo, brand name, AI model name, and English caption.")
  }
  if (verification.faces) {
    lines.push("- Repaint every visible human face as an unrecognizable soft blur covering the whole face area.")
  }
  if (verification.licensePlates) {
    lines.push("- Repaint every license plate as a plain blank surface with no readable characters or digits.")
  }
  if (verification.garbledJapaneseText) {
    lines.push("- The Japanese label text in the previous image was deformed or unreadable. Re-render each allowed Japanese label glyph-for-glyph in a clean bold gothic typeface on a high-contrast badge; if a label cannot be rendered accurately, omit that label entirely instead of drawing deformed glyphs.")
  }
  if (verification.excessiveDamage) {
    lines.push("- The previous image showed excessive damage. Scale all damage strictly in proportion to each structure's actual visible condition in the base photo, down to a 'shaken but standing' level. Do not darken the sky; do not depict flames, burning objects, explosion-like debris, or thick black smoke.")
  }
  if (verification.otherPrivacyRisk.length > 0) {
    lines.push(`- Do not render the following privacy-sensitive information: ${verification.otherPrivacyRisk.join(", ")}.`)
  }
  lines.push("- Allowed text is ONLY the exact Japanese label strings explicitly listed earlier in this prompt (if none are listed, render no text at all). Reproduce them glyph-for-glyph; render no other characters of any script.")
  lines.push("- Never render names, nameplates, street addresses, school names, phone numbers, or any other text identifying a person or place.")
  return lines.join("\n")
}

function mergeVerifications(
  verifications: readonly GeneratedImageVerification[],
): GeneratedImageVerification {
  return {
    readableText: verifications.some((v) => v.readableText),
    textSamples: [...new Set(verifications.flatMap((v) => v.textSamples))].slice(0, 5),
    faces: verifications.some((v) => v.faces),
    licensePlates: verifications.some((v) => v.licensePlates),
    otherPrivacyRisk: [...new Set(verifications.flatMap((v) => v.otherPrivacyRisk))].slice(0, 5),
    garbledJapaneseText: verifications.some((v) => v.garbledJapaneseText),
    excessiveDamage: verifications.some((v) => v.excessiveDamage),
  }
}

async function verifyGeneratedImages(
  images: readonly GeneratedImage[],
  onAttempt?: () => void,
): Promise<GeneratedImageVerification> {
  const results: GeneratedImageVerification[] = []

  for (const image of images) {
    onAttempt?.()
    results.push(await verifyGeneratedImage(image.dataUrl))
  }

  return mergeVerifications(results)
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
    garbledJapaneseText: Boolean(obj?.garbledJapaneseText),
    excessiveDamage: Boolean(obj?.excessiveDamage),
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
 * - 検証呼び出し自体が失敗: 未検証画像を採用せず warning を返す。
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
    return { images, verificationRequestCount: 0 }
  }

  let verification: GeneratedImageVerification
  let verificationRequestCount = 0
  try {
    verification = await verifyGeneratedImages(images, () => {
      verificationRequestCount += 1
    })
  } catch (error) {
    // 未検証の生成画像は返さない。表示側は warning を受けてフォールバックする。
    console.error("[ImageVerification] 検証呼び出しに失敗したため生成画像を破棄します", error)
    return { images: [], warning: IMAGE_VERIFICATION_FAILED_WARNING, verificationRequestCount }
  }

  if (verification.garbledJapaneseText || verification.excessiveDamage) {
    // 段階導入: まずフラグ率を実測する(enforcement=是正再生成への組込みはフラグ率確認後に判断)。
    // isImageClean には含めないため、このフラグ単独では画像を破棄も再生成もしない。
    console.warn("[ImageVerification] ソフト検出フラグ(ログのみ・画像は破棄しない)", {
      garbledJapaneseText: verification.garbledJapaneseText,
      excessiveDamage: verification.excessiveDamage,
    })
  }

  if (isImageClean(verification)) {
    return { images, verificationRequestCount }
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
    return { images: [], warning: IMAGE_VERIFICATION_FAILED_WARNING, verificationRequestCount }
  }

  let reVerification: GeneratedImageVerification
  try {
    reVerification = await verifyGeneratedImages(regenerated, () => {
      verificationRequestCount += 1
    })
  } catch (error) {
    // 再生成後も検証できなければ未検証画像は返さない。
    console.error("[ImageVerification] 再検証の呼び出しに失敗したため再生成画像を破棄します", error)
    return { images: [], warning: IMAGE_VERIFICATION_FAILED_WARNING, verificationRequestCount }
  }

  if (isImageClean(reVerification)) {
    return { images: regenerated, verificationRequestCount }
  }

  // 是正再生成でも通らなければ生成画像を採用しない（検証不能な画像を黙って通さない）。
  console.warn("[ImageVerification] 是正再生成後も検証を通らなかったため生成画像を破棄します")
  return { images: [], warning: IMAGE_VERIFICATION_FAILED_WARNING, verificationRequestCount }
}
