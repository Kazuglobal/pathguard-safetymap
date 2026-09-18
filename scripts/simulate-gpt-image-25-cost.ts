/**
 * GPT Image 2.5 コストシミュレーション
 *
 * 「危険報告(danger report)の画像生成を GPT Image 2.5 に置き換えたら
 *  いくらになるか」を、実際のコード上の呼び出し構造から積み上げで試算する。
 *
 * 実行:  npx tsx scripts/simulate-gpt-image-25-cost.ts
 * 任意:  npx tsx scripts/simulate-gpt-image-25-cost.ts --img-in=4000 --regen=0.3
 *
 * 前提の出典:
 *  - 料金(GPT Image 2.5): $8/M 画像入力, $5/M テキスト入力, $30/M 画像出力
 *    (sunburst / flare 共通。OpenAI Image generation ガイド)
 *  - 出力トークン数: GPT Image 2.5 の tier 別トークン数は公表値が無く、
 *    ドキュメント上は対話型カリキュレータでのみ提供される。ここでは
 *    「出力単価が同じ $30/M」である gpt-image-2 の公表 per-image 価格から
 *    逆算したトークン数を代理値として使う(下記 OUTPUT_TOKENS_BY_QUALITY)。
 *    → 実測でのキャリブレーションが必要(README の「実測手順」参照)。
 *  - 呼び出し回数: components/danger-report/danger-report-form.tsx の
 *    自動生成フロー(viz 1回 + シミュレーション最大4回)と
 *    lib/disaster-image-verification.ts(是正再生成は最大1回)より。
 *  - 現行ベースライン: lib/gemini-image.ts の FORCED_GEMINI_IMAGE_MODEL
 *    = gemini-3.1-flash-lite-image、lib/api-cost-calculator.ts より $0.0336/枚。
 */

// ---------------------------------------------------------------------------
// 料金(USD / 1M トークン) — OpenAI 公表値
// ---------------------------------------------------------------------------

const PRICE_PER_MILLION = {
  imageInput: 8,
  imageInputCached: 2,
  textInput: 5,
  textInputCached: 1.25,
  imageOutput: 30,
} as const

/**
 * 品質 tier ごとの画像出力トークン数(1024x1024)。
 *
 * gpt-image-2 の公表 per-image 価格 ÷ ($30/1M) で逆算した値。
 * gpt-image-2 と GPT Image 2.5 は出力トークン単価が同一だが、
 * 同じ tier でもトークン数は異なりうるとドキュメントに明記されている。
 * xhigh / max は 2.5 で新設された tier で公表値が無いため null。
 */
const OUTPUT_TOKENS_BY_QUALITY: Record<string, number | null> = {
  low: 200, // $0.006 / 30e-6
  medium: 1767, // $0.053 / 30e-6
  high: 7033, // $0.211 / 30e-6
  xhigh: null, // 未公表 — 要実測
  max: null, // 未公表 — 要実測
}

/** 現行の Gemini 画像生成の実効単価(lib/api-cost-calculator.ts と同値) */
const GEMINI_LITE_COST_PER_IMAGE_USD = 0.0336

// ---------------------------------------------------------------------------
// 可変パラメータ(CLI で上書き可能)
// ---------------------------------------------------------------------------

function numArg(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (!hit) return fallback
  const parsed = Number(hit.split('=')[1])
  return Number.isFinite(parsed) ? parsed : fallback
}

const PARAMS = {
  /**
   * 参照画像1枚あたりの画像入力トークン数。
   * 報告フローは image-to-image(images.edit)で、元写真を 1.5MB 以下に
   * 圧縮して送る(danger-report-form.tsx の compressImage)。
   * GPT Image は入力画像を常に high fidelity で処理するため相応に嵩む。
   * 公表の換算式が無いので実測前の仮値。
   */
  imageInputTokens: numArg('img-in', 2000),
  /**
   * プロンプトのテキスト入力トークン数。
   * 実測: FALLBACK_VIZ_PROMPT 2,353字 + SCENE_PRESERVATION_GUARD_SUFFIX 513字
   * + 地域制約 ≒ 3,000字前後の英文 ≒ 700〜900 トークン。
   */
  textInputTokens: numArg('txt-in', 800),
  /** 1報告あたりの生成回数: viz 1 + シミュレーション(地震/台風/火災 + 浸水は区域内のみ) */
  generationsPerReport: numArg('gen-per-report', 5),
  /** 機械検証による是正再生成の発生率(lib/disaster-image-verification.ts、最大1回) */
  regenerationRate: numArg('regen', 0.15),
} as const

const MONTHLY_REPORT_VOLUMES = [100, 500, 1_000, 5_000] as const

// ---------------------------------------------------------------------------
// 計算
// ---------------------------------------------------------------------------

function perImageCostUsd(outputTokens: number): number {
  return (
    (outputTokens * PRICE_PER_MILLION.imageOutput) / 1_000_000 +
    (PARAMS.imageInputTokens * PRICE_PER_MILLION.imageInput) / 1_000_000 +
    (PARAMS.textInputTokens * PRICE_PER_MILLION.textInput) / 1_000_000
  )
}

/** 1報告あたりの実効生成回数(是正再生成込み) */
const effectiveGenerationsPerReport =
  PARAMS.generationsPerReport * (1 + PARAMS.regenerationRate)

const usd = (n: number) => `$${n.toFixed(4)}`
/** 符号付きの差額表記。節約(負)は -$… として出す。 */
const signed = (n: number) => `${n < 0 ? '-' : '+'}$${Math.abs(n).toFixed(4)}`
const signed2 = (n: number) => `${n < 0 ? '-' : '+'}$${Math.abs(n).toFixed(2)}`
const usd2 = (n: number) => `$${n.toFixed(2)}`
const pad = (s: string, w: number) => s.padEnd(w)
const padL = (s: string, w: number) => s.padStart(w)

function section(title: string) {
  console.log(`\n${'='.repeat(78)}\n${title}\n${'='.repeat(78)}`)
}

// --- 前提の表示 -------------------------------------------------------------

section('前提条件')
console.log(`画像入力トークン/枚      : ${PARAMS.imageInputTokens.toLocaleString()} (--img-in)`)
console.log(`テキスト入力トークン/枚  : ${PARAMS.textInputTokens.toLocaleString()} (--txt-in)`)
console.log(`生成回数/報告            : ${PARAMS.generationsPerReport} (--gen-per-report)`)
console.log(`是正再生成の発生率        : ${(PARAMS.regenerationRate * 100).toFixed(0)}% (--regen)`)
console.log(`実効生成回数/報告        : ${effectiveGenerationsPerReport.toFixed(2)} 枚`)
console.log(`現行ベースライン単価      : ${usd(GEMINI_LITE_COST_PER_IMAGE_USD)}/枚 (gemini-3.1-flash-lite-image)`)

// --- 1枚あたり -------------------------------------------------------------

section('1) 画像1枚あたりのコスト (GPT Image 2.5, 1024x1024, image-to-image)')
console.log(
  `${pad('品質', 10)}${padL('出力tok', 10)}${padL('出力$', 10)}${padL('画像入力$', 12)}${padL('文字入力$', 12)}${padL('合計$', 11)}${padL('vs現行', 10)}`,
)
console.log('-'.repeat(78))

const perImage: Record<string, number> = {}
for (const [quality, outTokens] of Object.entries(OUTPUT_TOKENS_BY_QUALITY)) {
  if (outTokens === null) {
    console.log(`${pad(quality, 10)}${padL('未公表', 10)}${padL('—', 10)}${padL('—', 12)}${padL('—', 12)}${padL('要実測', 11)}${padL('—', 10)}`)
    continue
  }
  const outCost = (outTokens * PRICE_PER_MILLION.imageOutput) / 1_000_000
  const imgInCost = (PARAMS.imageInputTokens * PRICE_PER_MILLION.imageInput) / 1_000_000
  const txtInCost = (PARAMS.textInputTokens * PRICE_PER_MILLION.textInput) / 1_000_000
  const total = outCost + imgInCost + txtInCost
  perImage[quality] = total
  const ratio = total / GEMINI_LITE_COST_PER_IMAGE_USD
  console.log(
    `${pad(quality, 10)}${padL(outTokens.toLocaleString(), 10)}${padL(usd(outCost), 10)}${padL(usd(imgInCost), 12)}${padL(usd(txtInCost), 12)}${padL(usd(total), 11)}${padL(`${ratio.toFixed(1)}x`, 10)}`,
  )
}

// --- 1報告あたり -----------------------------------------------------------

section('2) 危険報告1件あたりのコスト')
console.log(`(viz 1枚 + シミュレーション ${PARAMS.generationsPerReport - 1}枚、是正再生成 ${(PARAMS.regenerationRate * 100).toFixed(0)}% 込み = ${effectiveGenerationsPerReport.toFixed(2)}枚)\n`)
console.log(`${pad('品質', 10)}${padL('1件あたり$', 14)}${padL('現行比', 10)}${padL('差額$', 12)}`)
console.log('-'.repeat(78))

const geminiPerReport = GEMINI_LITE_COST_PER_IMAGE_USD * effectiveGenerationsPerReport
console.log(`${pad('現行(Gemini)', 10)}${padL(usd(geminiPerReport), 14)}${padL('1.0x', 10)}${padL('—', 12)}`)

const perReport: Record<string, number> = {}
for (const [quality, unit] of Object.entries(perImage)) {
  const cost = unit * effectiveGenerationsPerReport
  perReport[quality] = cost
  console.log(
    `${pad(`2.5 ${quality}`, 10)}${padL(usd(cost), 14)}${padL(`${(cost / geminiPerReport).toFixed(1)}x`, 10)}${padL(signed(cost - geminiPerReport), 12)}`,
  )
}

// --- 月次 -------------------------------------------------------------------

section('3) 月次コスト(報告件数別)')
console.log(
  `${pad('報告/月', 10)}${padL('現行Gemini', 13)}${padL('2.5 low', 12)}${padL('2.5 medium', 13)}${padL('2.5 high', 12)}${padL('medium差額', 13)}`,
)
console.log('-'.repeat(78))
for (const volume of MONTHLY_REPORT_VOLUMES) {
  const g = geminiPerReport * volume
  const lo = perReport.low * volume
  const me = perReport.medium * volume
  const hi = perReport.high * volume
  console.log(
    `${pad(volume.toLocaleString(), 10)}${padL(usd2(g), 13)}${padL(usd2(lo), 12)}${padL(usd2(me), 13)}${padL(usd2(hi), 12)}${padL(signed2(me - g), 13)}`,
  )
}

// --- 感度分析 ---------------------------------------------------------------

section('4) 感度分析 — 2.5 の出力トークン数が未公表であることへの備え')
console.log('medium 相当の出力トークン数を振った場合の月次コスト(報告1,000件/月)\n')
console.log(`${pad('出力tok/枚', 14)}${padL('1枚$', 11)}${padL('1報告$', 12)}${padL('月次$', 12)}${padL('現行比', 10)}`)
console.log('-'.repeat(78))
const baseMediumTokens = OUTPUT_TOKENS_BY_QUALITY.medium as number
for (const factor of [0.5, 0.75, 1.0, 1.5, 2.0, 4.0]) {
  const tokens = Math.round(baseMediumTokens * factor)
  const unit = perImageCostUsd(tokens)
  const report = unit * effectiveGenerationsPerReport
  const monthly = report * 1000
  console.log(
    `${pad(`${tokens.toLocaleString()} (x${factor})`, 14)}${padL(usd(unit), 11)}${padL(usd(report), 12)}${padL(usd2(monthly), 12)}${padL(`${(report / geminiPerReport).toFixed(1)}x`, 10)}`,
  )
}

console.log('\n画像入力トークン数を振った場合(medium 固定、報告1,000件/月)\n')
console.log(`${pad('画像入力tok', 14)}${padL('1枚$', 11)}${padL('月次$', 12)}`)
console.log('-'.repeat(78))
for (const imgTokens of [1000, 2000, 4000, 8000]) {
  const unit =
    (baseMediumTokens * PRICE_PER_MILLION.imageOutput) / 1_000_000 +
    (imgTokens * PRICE_PER_MILLION.imageInput) / 1_000_000 +
    (PARAMS.textInputTokens * PRICE_PER_MILLION.textInput) / 1_000_000
  console.log(
    `${pad(imgTokens.toLocaleString(), 14)}${padL(usd(unit), 11)}${padL(usd2(unit * effectiveGenerationsPerReport * 1000), 12)}`,
  )
}

// --- ハイブリッド構成 -------------------------------------------------------

section('5) ハイブリッド構成 — viz のみ GPT Image 2.5 / シミュレーションは Gemini 継続')
console.log('日本語ラベル入りの viz(オーバーレイ注釈)だけ GPT Image 2.5 に出し、')
console.log('写実シミュレーション4枚は現行 Gemini のまま据え置く構成。\n')
console.log(
  `${pad('viz品質', 12)}${padL('viz$/報告', 13)}${padL('sim$/報告', 13)}${padL('計$/報告', 12)}${padL('現行比', 9)}${padL('月次$@1000', 13)}`,
)
console.log('-'.repeat(78))

const vizPerReport = 1 * (1 + PARAMS.regenerationRate)
const simPerReport = (PARAMS.generationsPerReport - 1) * (1 + PARAMS.regenerationRate)
const simCost = GEMINI_LITE_COST_PER_IMAGE_USD * simPerReport

for (const quality of ['low', 'medium', 'high']) {
  const vizCost = perImage[quality] * vizPerReport
  const total = vizCost + simCost
  console.log(
    `${pad(quality, 12)}${padL(usd(vizCost), 13)}${padL(usd(simCost), 13)}${padL(usd(total), 12)}${padL(`${(total / geminiPerReport).toFixed(2)}x`, 9)}${padL(usd2(total * 1000), 13)}`,
  )
}
console.log('')
console.log(`参考: 全枚数を 2.5 medium にした場合 = ${usd2(perReport.medium * 1000)}/月 @1,000件`)
console.log('→ viz だけ high にしても、全枚数 medium とほぼ同額に収まる。')

// --- 付随コスト -------------------------------------------------------------

section('6) 付随する論点')
const batchPromptCount = 24
console.log(`一括生成(24プロンプト)1回の追加コスト:`)
console.log(`  現行Gemini : ${usd2(GEMINI_LITE_COST_PER_IMAGE_USD * batchPromptCount)}`)
for (const q of ['low', 'medium', 'high']) {
  console.log(`  2.5 ${pad(q, 7)}: ${usd2(perImage[q] * batchPromptCount)}`)
}
console.log('')
console.log('・現行 Gemini 経路は1リクエストで最大2枚返し、UI もその2枚を採用する')
console.log('  (danger-report-form.tsx の imgs.slice(0, 2))。GPT Image は n=1 なので、')
console.log('  同じ枚数を出すならリクエスト数が倍 = 上表の月次コストも倍になる。')
console.log('・cached input($2/M 画像・$1.25/M テキスト)は、同一参照画像で複数')
console.log('  シミュレーションを回す本フローと相性が良い。1報告5枚のうち4枚が')
console.log('  キャッシュヒットすれば画像入力分は約 1/4 に下がる。')
console.log('・是正再生成(lib/disaster-image-verification.ts)は現状 OpenAI 経路では')
console.log('  動いていない。移行時に有効化するなら --regen を上げて再試算すること。')

section('実測によるキャリブレーション手順')
console.log('1. OPENAI_IMAGE_MODEL=gpt-image-2.5-flare で報告フローを1回流す')
console.log('2. lib/openai-image.ts の toImageGenerationUsage が拾う response.usage を記録')
console.log('   (input_tokens / input_tokens_details.image_tokens / output_tokens)')
console.log('3. 本スクリプトを --img-in= --txt-in= に実測値を入れて再実行')
console.log('4. lib/api-cost-calculator.ts に gpt-image-2.5-* の単価を追加')
console.log('')
