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

/** 倍率の表示。既存EPの note（例: 21.3倍・28倍）と同じく小数1桁で切り捨て（100倍以上は整数）。 */
export function formatRatio(rate, refRate) {
  if (!(refRate > 0)) return null
  const r = rate / refRate
  if (r >= 100) return String(Math.floor(r))
  const v = Math.floor(r * 10) / 10
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

const toAscii = (s) => s.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))

/**
 * 第1位を明かす場面で大きく見せる倍率。rates は [参考, 第3位, 第2位, 第1位] の致死率。
 * 返り値 { index, baseIndex, ratio, exact }: 柱 index は柱 baseIndex の ratio 倍（baseIndex 0 は参考）。
 * 声と画面を合わせるため、第1位の数字を言う文の「約○倍」を使う（その文になければフックの「○倍」）。
 *   1. 参考との比がちょうど同じ柱 → 2. 順位どうしの比がちょうど同じ組（EP26「同じ年齢で2.2倍」・EP27「高速道路の2.6倍」）
 *   → 3. 参考との比が一番近い柱（±20%以内。EP02「約6倍」→5.9倍）→ 4. 第1位と参考
 * exact は 1 か 2 で決まったとき true（build の検査に使う）。
 */
export function focusRatio(rates, narration = '', hook = '') {
  const top = { index: 3, baseIndex: 0, ratio: formatRatio(rates[3], rates[0]), exact: false }
  const w1 = rateText(rates[3])
  const sentence = narration.includes(w1)
    ? narration.slice(narration.indexOf(w1)).split(/[。？]/)[0]
    : ''
  const m = /([0-9０-９]+(?:[.．][0-9０-９]+)?)倍/.exec(sentence) ?? /([0-9０-９]+(?:[.．][0-9０-９]+)?)倍/.exec(hook)
  if (!m) return top
  const said = toAscii(m[1])
  for (const i of [3, 2, 1]) {
    if (formatRatio(rates[i], rates[0]) === said) return { index: i, baseIndex: 0, ratio: said, exact: true }
  }
  for (const [i, j] of [[3, 2], [3, 1], [2, 1]]) {
    if (formatRatio(rates[i], rates[j]) === said) return { index: i, baseIndex: j, ratio: said, exact: true }
  }
  const n = Number(said)
  let best = top; let diff = Infinity
  for (const i of [1, 2, 3]) {
    const d = Math.abs(rates[i] / rates[0] - n) / n
    if (d < diff) { diff = d; best = { index: i, baseIndex: 0, ratio: formatRatio(rates[i], rates[0]), exact: false } }
  }
  return diff <= 0.2 ? best : top
}

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
/**
 * 区切りごとに { f: 割合, sentence: 文の切れ目か } を返す（見つからない区切りは null）。
 * 文の切れ目（「。」「？」の直後）は無音が長いので、近くでいちばん長い無音に合わせる。節の切れ目（「、」の直後）は近い無音に合わせる。
 */
export function narrationBoundaries(narration, rates) {
  const chars = [...narration]
  const cum = [0]
  for (const ch of chars) cum.push(cum[cum.length - 1] + weight(ch))
  const totalW = cum[cum.length - 1]
  const frac = (i) => cum[i] / totalW
  const text = chars.join('')
  const posOf = (s) => (s ? [...text.slice(0, Math.max(0, text.indexOf(s)))].length : -1)
  const back = (i, stops) => { let j = i; while (j > 0 && !stops.includes(chars[j - 1])) j--; return j }
  const isSentenceStart = (i) => i === 0 || '。？'.includes(chars[i - 1])
  const sentenceEnds = chars.flatMap((ch, i) => ('。？'.includes(ch) ? [i + 1] : [])).filter((i) => i < chars.length)
  const at = (i) => ({ f: frac(i), sentence: isSentenceStart(i) })
  const out = { hookEnd: null, refStart: null, r3Start: null, r2Start: null, r1Start: null, reasons: null, cta: null }
  const q = chars.indexOf('？')
  if (q >= 0 && q < chars.length - 1) out.hookEnd = at(q + 1)
  // 参考の柱は、その数字を含む文の始まり（「警察庁のデータでは…」から見出しと参考の柱を出す。節にすると数秒なにも出ない）
  // 第3位・第2位・第1位は、その数字を含む節の始まり（「◯◯は」と言い始める所で伸び始める）
  for (const [key, rate, stops] of [['refStart', rates.ref, '。？'], ['r3Start', rates.w3, '、。？'], ['r2Start', rates.w2, '、。？'], ['r1Start', rates.w1, '、。？']]) {
    if (!rate || !text.includes(rate)) continue
    out[key] = at(back(posOf(rate), stops))
  }
  // 問いのあとに「雨の夜ではありません。」のような文が続く回は、問いの絵（フックの文字に「〜ではない」がある）をその文の終わりまで出す。
  // 問いの終わりで切ると、フックの「〜ではない」が声より先に消える（EP25 で 2.8秒早かった・2026-11-18）
  if (out.hookEnd && out.refStart && out.refStart.f > out.hookEnd.f) out.hookEnd = { ...out.refStart, extended: true }
  if (rates.w1 && text.includes(rates.w1)) {
    const after = sentenceEnds.find((i) => i > posOf(rates.w1))
    if (after != null && after < chars.length) out.reasons = at(after)
  }
  if (sentenceEnds.length) out.cta = at(sentenceEnds[sentenceEnds.length - 1])
  return out
}

/** 台本のどこで各区切りが始まるかを、読みの長さの割合（0〜1）で返す。見つからない区切りは null。 */
export function narrationFractions(narration, rates) {
  return Object.fromEntries(Object.entries(narrationBoundaries(narration, rates)).map(([k, v]) => [k, v ? v.f : null]))
}

/** 0.1秒未満の間で隣り合う無音をつなぐ（1つの間が2つに割れて出ることがある）。 */
export function mergeSilences(silences, gap = 0.1) {
  const out = []
  for (const s of [...silences].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1]
    if (last && s.start - last.end < gap) last.end = Math.max(last.end, s.end)
    else out.push({ ...s })
  }
  return out
}

/**
 * 割合から実時間の見込みを出し、近くの無音に合わせる。
 * - 文の切れ目（問いの終わり・参考・文頭の柱・理由・締め）: 窓に重なる無音のうち、いちばん長いもの
 *   （見込みは問いの所で約1秒遅れるので、問いの終わりは窓を広く ±1.8秒にする）
 * - 問いの終わり＝その無音の始まり、参考の始まり＝同じ無音の終わり（台本の上で同じ位置のとき）
 * - 節の切れ目（「、」の直後の柱）: いちばん近い無音の終わり（±window 秒）
 * 見つからなければ見込みのまま。silences: [{ start, end }]（声の wav を silencedetect した結果）
 */
export function computeMarks(narration, rates, duration, silences, window = 1.2) {
  const b = narrationBoundaries(narration, rates)
  const sil = mergeSilences(silences).filter((s) => s.end > 0.2 && s.start < duration - 0.2)
  const longestNear = (est, w) => sil.filter((s) => s.end >= est - w && s.start <= est + w)
    .sort((x, y) => (y.end - y.start) - (x.end - x.start))[0] ?? null
  const nearestEnd = (est, w) => {
    let best = null
    for (const s of sil) if (Math.abs(s.end - est) <= w && (best == null || Math.abs(s.end - est) < Math.abs(best - est))) best = s.end
    return best
  }
  const round = (x) => Math.round(x * 1000) / 1000
  const marks = {}
  let hookSil = null
  if (b.hookEnd) {
    const est = b.hookEnd.f * duration
    // 「〜ではありません。」まで伸ばした回は、問いの後の無音（そちらの方が長いことがある）を拾わないよう、文の始まりと同じ幅で探す
    hookSil = longestNear(est, b.hookEnd.extended ? window : 1.8)
    marks.hookEnd = round(hookSil ? hookSil.start : est)
  }
  for (const key of ['refStart', 'r3Start', 'r2Start', 'r1Start', 'reasons', 'cta']) {
    const x = b[key]
    if (!x) continue
    const est = x.f * duration
    if (key === 'refStart' && b.hookEnd && Math.abs(x.f - b.hookEnd.f) < 1e-9) {
      marks.refStart = round(hookSil ? hookSil.end : est)
      continue
    }
    const s = x.sentence ? longestNear(est, window) : null
    marks[key] = round(x.sentence ? (s ? s.end : est) : (nearestEnd(est, window) ?? est))
  }
  return marks
}

/** 順番どおり（MARK_BASE の順に増えていく）区切りだけを残し、捨てたものを返す（ログに出すため）。 */
export function orderMarks(marks) {
  const kept = {}
  const dropped = []
  let last = -Infinity
  for (const [key] of MARK_BASE) {
    const v = marks?.[key]
    if (!Number.isFinite(v)) continue
    if (v > last) { kept[key] = v; last = v } else dropped.push(key)
  }
  return { marks: kept, dropped }
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
