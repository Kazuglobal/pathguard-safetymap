// series-20 の時間割（基準36秒）と、声に合わせた伸び縮み。
// scene.js（ブラウザ）・render.mjs（node）・単体テストで共有する。DOM や three.js に依存しない。

export const HOOK_END = 3.5 // 基準タイムライン上のフック（問い）の終わり
export const BASE_TOTAL = 36 // 基準尺

// 時刻（基準タイムライン上の秒）
export const T = {
  refStart: 3.6, refGrow: 2.4,
  r3Start: 9.0, r2Start: 14.0, grow: 1.8,
  r1Start: 19.0, r1Grow: 2.2,
  ratioEnd: 24.0,
  reasons: 24.0, reasonsEnd: 30.0,
  cta: 30.0, source: 34.0,
}
export const IMPACT = T.r1Start + T.r1Grow

/** 致死率の桁数。0.1%未満は小数3桁（0.03% と出すと倍率の割り算が合わなく見えるため）。 */
export function rateDigits(rate) {
  return rate < 0.1 ? 3 : 2
}
export const rateText = (rate) => `${rate.toFixed(rateDigits(rate))}%`

// 声の区切り（実時間の秒）と、それに合わせる基準タイムライン上の時刻
export const MARK_BASE = [
  ['hookEnd', HOOK_END], ['refStart', T.refStart], ['r3Start', T.r3Start], ['r2Start', T.r2Start],
  ['r1Start', T.r1Start], ['reasons', T.reasons], ['cta', T.cta],
]
const MIN_GAP = 0.15 // これより詰まった区切りは捨てる（実時間の秒）。問いの終わり→参考の始まりは0.3〜0.5秒しか離れない

/**
 * 実時間 ⇄ 基準時間の対応。marks（実時間の秒）があれば区切りごとの折れ線、なければ
 * 「フック3.5秒は固定・残りを比例で伸ばす」（今までと同じ）。順番が逆・詰まりすぎの区切りは捨てる。
 */
export function makeTimeMap(total, marks = null) {
  const knots = [[0, 0]]
  const wanted = MARK_BASE.map(([key, base]) => [marks?.[key], base])
  if (!Number.isFinite(marks?.hookEnd)) wanted[0] = [HOOK_END, HOOK_END]
  for (const [real, base] of wanted) {
    if (!Number.isFinite(real)) continue
    const [lastReal, lastBase] = knots[knots.length - 1]
    if (real > lastReal + MIN_GAP && base > lastBase && real < total - MIN_GAP) knots.push([real, base])
  }
  knots.push([total, BASE_TOTAL])
  const interp = (x, xi, yi) => {
    if (x <= knots[0][xi]) return knots[0][yi] + (x - knots[0][xi])
    for (let i = 1; i < knots.length; i++) {
      const a = knots[i - 1]; const b = knots[i]
      if (x <= b[xi]) return a[yi] + ((x - a[xi]) / (b[xi] - a[xi])) * (b[yi] - a[yi])
    }
    const last = knots[knots.length - 1]
    return last[yi] + (x - last[xi])
  }
  return { toBase: (t) => interp(t, 0, 1), fromBase: (b) => interp(b, 1, 0), knots }
}

// ---------- 声の区切りを、台本と無音の区間から決める ----------

// 1文字あたりの読みの長さのおよそ（拍の数の目安）。数字・小数点・% は読みが長い
function weight(ch) {
  if (/[0-9]/.test(ch)) return 1.3
  if (ch === '.') return 2
  if (ch === '%') return 5
  if (ch === '、') return 2.5
  if (ch === '。' || ch === '？') return 4
  if (/[一-鿿]/.test(ch)) return 1.6
  if (/[「」『』・（）()\s]/.test(ch)) return 0.2
  return 1
}

/**
 * 台本のどこで各区切りが始まるかを、読みの長さの割合（0〜1）で返す。見つからない区切りは null。
 * rates: { ref, w3, w2, w1 } … 台本に出てくる致死率の文字列（例「0.035%」）
 *   各柱の区切り = その数字を含む節（読点・句点で区切った塊）の始まり
 *   hookEnd = 最初の「？」の直後 / reasons = 第1位の数字の次の文の始まり / cta = 最後の文の始まり
 */
export function narrationFractions(narration, rates) {
  const chars = [...narration]
  const cum = [0]
  for (const ch of chars) cum.push(cum[cum.length - 1] + weight(ch))
  const totalW = cum[cum.length - 1]
  const frac = (i) => cum[i] / totalW
  const text = chars.join('')
  const posOf = (s) => (s ? [...text.slice(0, Math.max(0, text.indexOf(s)))].length : -1)
  const back = (i, stops) => { let j = i; while (j > 0 && !stops.includes(chars[j - 1])) j--; return j }
  const clauseStart = (i) => back(i, '、。？')
  const sentenceStart = (i) => back(i, '。？')
  const sentenceEnds = chars.flatMap((ch, i) => ('。？'.includes(ch) ? [i + 1] : [])).filter((i) => i < chars.length)
  const out = { hookEnd: null, refStart: null, r3Start: null, r2Start: null, r1Start: null, reasons: null, cta: null }
  const q = chars.indexOf('？')
  if (q >= 0 && q < chars.length - 1) out.hookEnd = frac(q + 1)
  // 参考の柱は、その数字を含む文の始まり（「警察庁のデータでは…」から見出しと参考の柱を出す。節にすると数秒なにも出ない）
  // 第3位・第2位・第1位は、その数字を含む節の始まり（「◯◯は」と言い始める所で伸び始める）
  for (const [key, rate, start] of [['refStart', rates.ref, sentenceStart], ['r3Start', rates.w3, clauseStart], ['r2Start', rates.w2, clauseStart], ['r1Start', rates.w1, clauseStart]]) {
    if (!rate || !text.includes(rate)) continue
    out[key] = frac(start(posOf(rate)))
  }
  if (rates.w1 && text.includes(rates.w1)) {
    const after = sentenceEnds.find((i) => i > posOf(rates.w1))
    if (after != null && after < chars.length) out.reasons = frac(after)
  }
  if (sentenceEnds.length) out.cta = frac(sentenceEnds[sentenceEnds.length - 1])
  return out
}

/**
 * 割合から実時間の見込みを出し、近くの無音に合わせる（±window 秒）。
 * hookEnd は無音の始まり（話し終わり）、ほかは無音の終わり（次を話し始める所）に合わせる。
 * silences: [{ start, end }]（声の wav を silencedetect した結果）
 */
export function computeMarks(narration, rates, duration, silences, window = 1.2) {
  const fr = narrationFractions(narration, rates)
  const marks = {}
  for (const [key, f] of Object.entries(fr)) {
    if (f == null) continue
    const est = f * duration
    const edges = silences.map((s) => (key === 'hookEnd' ? s.start : s.end)).filter((x) => x > 0.2 && x < duration - 0.2)
    let best = null
    for (const x of edges) if (Math.abs(x - est) <= window && (best == null || Math.abs(x - est) < Math.abs(best - est))) best = x
    marks[key] = Math.round((best ?? est) * 1000) / 1000
  }
  return marks
}

/** ffmpeg の silencedetect の出力（stderr）から無音の区間を取り出す。 */
export function parseSilences(stderr) {
  const out = []
  let start = null
  for (const line of stderr.split(/\r?\n/)) {
    const s = /silence_start:\s*([\d.]+)/.exec(line)
    if (s) start = Number(s[1])
    const e = /silence_end:\s*([\d.]+)/.exec(line)
    if (e && start != null) { out.push({ start, end: Number(e[1]) }); start = null }
  }
  return out
}
