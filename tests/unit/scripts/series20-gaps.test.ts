import { describe, expect, it } from "vitest"
import { RULES, evaluate, fisherTwoSided, rateOf } from "../../../artifacts/series-20/mining/gaps-lib.mjs"
import { CANDIDATES } from "../../../artifacts/series-20/mining/candidates.mjs"
import { CANDIDATES as CANDIDATES_04_20 } from "../../../artifacts/series-20/mining/candidates_ep04-20.mjs"
import { UNSPEAKABLE, sayOf } from "../../../artifacts/series-20/mining/speech.mjs"
import {
  BASE_TOTAL,
  HOOK_END,
  T,
  computeMarks,
  focusRatio,
  formatRatio,
  makeTimeMap,
  mergeSilences,
  narrationFractions,
  orderMarks,
  parseSilences,
  rateText,
} from "../../../artifacts/series-20/threejs/timeline.mjs"
import episodes from "../../../artifacts/series-20/episodes.json"

describe("timeline の区切り（レビューで見つかった失敗の再発防止）", () => {
  const ep24 = (episodes as Array<{ id: string; narration: string; ref: { rate: number }; worst: { rate: number }[] }>).find(
    (e) => e.id === "24",
  )!
  const rates = {
    ref: rateText(ep24.ref.rate),
    w1: rateText(ep24.worst[0].rate),
    w2: rateText(ep24.worst[1].rate),
    w3: rateText(ep24.worst[2].rate),
  }

  it("問いの終わりは「？」の後の長い無音に合わせ、参考は同じ無音の終わりから（EP24 の実際の無音）", () => {
    // 4.81〜5.72 =「？」の後（0.90秒）、6.99〜7.34 =「警察庁のデータでは、」の後（0.35秒）
    const silences = [
      { start: 4.81, end: 5.72 },
      { start: 6.99, end: 7.34 },
    ]
    const marks = computeMarks(ep24.narration, rates, 32.94, silences)
    expect(marks.hookEnd).toBeCloseTo(4.81, 3)
    expect(marks.refStart).toBeCloseTo(5.72, 3)
  })

  it("問いのあとに「〜ではありません。」がある回は、問いの絵をその文の終わりまで出す（EP25 の実際の無音）", () => {
    const ep25 = (episodes as Array<{ id: string; narration: string; ref: { rate: number }; worst: { rate: number }[] }>).find(
      (e) => e.id === "25",
    )!
    expect(ep25.narration).toContain("？60キロの道ではありません。")
    const r25 = {
      ref: rateText(ep25.ref.rate),
      w1: rateText(ep25.worst[0].rate),
      w2: rateText(ep25.worst[1].rate),
      w3: rateText(ep25.worst[2].rate),
    }
    // 4.21〜4.86 =「？」の後（0.65秒・こちらの方が長い）、6.46〜6.99 =「ではありません。」の後、8.18〜8.61 =「警察庁のデータで、」の後
    const silences = [
      { start: 1.529, end: 1.91 },
      { start: 4.211, end: 4.857 },
      { start: 6.462, end: 6.986 },
      { start: 8.177, end: 8.61 },
    ]
    const marks = computeMarks(ep25.narration, r25, 33.363, silences)
    expect(marks.hookEnd).toBeCloseTo(6.462, 3)
    expect(marks.refStart).toBeCloseTo(6.986, 3)
  })

  it("第3位と第2位が同じ値でも、第2位の区切りは第2位の数字の節から（EP18: どちらも1.27%）", () => {
    const narration = "ATの乗用車より、5.8倍も死にやすい車を知っていますか？警察庁のデータでは、ATの乗用車の致死率は0.59%。MTの乗用車は1.27%、ATのトラックは1.27%。そして第1位はMTのトラックで3.49%、約5.8倍です。"
    const f = narrationFractions(narration, { ref: "0.59%", w3: "1.27%", w2: "1.27%", w1: "3.49%" })
    expect(f.r2Start).toBeGreaterThan(f.r3Start!)
    expect(f.r1Start).toBeGreaterThan(f.r2Start!)
  })

  it("0.1秒未満の間で割れた無音はつなぐ", () => {
    expect(mergeSilences([{ start: 5.13, end: 5.45 }, { start: 5.53, end: 5.95 }, { start: 8, end: 8.3 }])).toEqual([
      { start: 5.13, end: 5.95 },
      { start: 8, end: 8.3 },
    ])
  })

  it("順番が合わない区切りは捨てて、捨てたものを返す（ログに出す）", () => {
    const { marks, dropped } = orderMarks({ hookEnd: 7.8, refStart: 6.6, r3Start: 12, r1Start: 18 })
    expect(Object.keys(marks)).toEqual(["hookEnd", "r3Start", "r1Start"])
    expect(dropped).toEqual(["refStart"])
  })
})

describe("timeline（声に合わせた時間割）", () => {
  const narration =
    "車同士の事故で、追突の67.7倍も死にやすいぶつかり方を知っていますか？警察庁のデータで交差点の中を除くと、追突の致死率は0.035%。横からの衝突は0.83%、斜めの衝突は1.51%。そして第1位は正面衝突で2.34%、約67.7倍です。お互いの速度が足し算になるからです。車で通勤する家族に送ってください。"
  const rates = { ref: "0.035%", w3: "0.83%", w2: "1.51%", w1: "2.34%" }

  it("marks が無ければ、今まで（フック3.5秒固定・残りを比例）と同じ", () => {
    const total = 33
    const k = (total - HOOK_END) / (BASE_TOTAL - HOOK_END)
    const { toBase, fromBase } = makeTimeMap(total, null)
    for (const t of [0, 1.2, 3.5, 10, 20, 33]) {
      const old = t <= HOOK_END ? t : HOOK_END + (t - HOOK_END) / k
      expect(toBase(t)).toBeCloseTo(old, 9)
      expect(fromBase(toBase(t))).toBeCloseTo(t, 9)
    }
  })

  it("marks があれば、各区切りが基準タイムラインの区切りに対応する", () => {
    const marks = { hookEnd: 4.2, refStart: 4.6, r3Start: 11.0, r2Start: 13.5, r1Start: 16.8, reasons: 22.4, cta: 27.0 }
    const { toBase } = makeTimeMap(31, marks)
    expect(toBase(4.6)).toBeCloseTo(T.refStart, 9)
    expect(toBase(16.8)).toBeCloseTo(T.r1Start, 9)
    expect(toBase(27.0)).toBeCloseTo(T.cta, 9)
    expect(toBase(31)).toBeCloseTo(BASE_TOTAL, 9)
  })

  it("順番が逆の区切りは捨てる（時間が逆戻りしない）", () => {
    const { knots } = makeTimeMap(30, { refStart: 10, r3Start: 8, r1Start: 15 })
    for (let i = 1; i < knots.length; i++) {
      expect(knots[i][0]).toBeGreaterThan(knots[i - 1][0])
      expect(knots[i][1]).toBeGreaterThan(knots[i - 1][1])
    }
  })

  it("台本から、問い→参考→第3位→第2位→第1位→理由→締めの順に区切りが出る", () => {
    const f = narrationFractions(narration, rates)
    const order = [f.hookEnd, f.refStart, f.r3Start, f.r2Start, f.r1Start, f.reasons, f.cta]
    for (const v of order) expect(v).not.toBeNull()
    // 参考の柱は問いの次の文の始まりなので、台本の上では問いの終わりと同じ位置（時間は無音の始まりと終わりで分かれる）
    expect(f.refStart).toBe(f.hookEnd)
    for (let i = 2; i < order.length; i++) expect(order[i]!).toBeGreaterThan(order[i - 1]!)
  })

  it("区切りは近くの無音に合わせる（話し始め＝無音の終わり、問いの終わり＝無音の始まり）", () => {
    const silences = parseSilences(
      ["[silencedetect] silence_start: 6.10", "[silencedetect] silence_end: 6.45 | silence_duration: 0.35"].join("\n"),
    )
    expect(silences).toEqual([{ start: 6.1, end: 6.45 }])
    const marks = computeMarks(narration, rates, 31, silences)
    expect(marks.hookEnd).toBeCloseTo(6.1, 3) // 見込み約6.4秒 → 0.3秒前の無音の始まりに合わせる
    expect(marks.refStart).toBeCloseTo(6.45, 3) // 参考の柱は次の文の始まり（無音の終わり）
  })
})

type Counts = Map<string, { n: number; fatal: number }>
const counts = (entries: Record<string, [number, number]>): Counts =>
  new Map(Object.entries(entries).map(([k, [n, fatal]]) => [k, { n, fatal }]))
const candidate = (id: string) => CANDIDATES.find((c: { id: string }) => c.id === id)

describe("fisherTwoSided", () => {
  it("R の fisher.test と同じ両側 p 値を返す", () => {
    // fisher.test(matrix(c(3, 1, 1, 3), 2)) → p = 0.4857
    expect(fisherTwoSided(3, 4, 1, 4)).toBeCloseTo(0.4857, 4)
    // fisher.test(matrix(c(1, 11, 9, 3), 2)) → p = 0.002759
    expect(fisherTwoSided(1, 10, 11, 14)).toBeCloseTo(0.002759, 6)
  })

  it("差がなければ 1 になる", () => {
    expect(fisherTwoSided(10, 1000, 10, 1000)).toBeCloseTo(1, 10)
  })
})

describe("sayOf（読み上げ用の言い換え）", () => {
  it("km/h・年齢の範囲・〜 を TTS が読みやすい言い方にする", () => {
    expect(sayOf("30km/hの道")).toBe("時速30キロの道")
    expect(sayOf("0〜24歳")).toBe("0歳から24歳")
    expect(sayOf("65〜74歳")).toBe("65歳から74歳")
    expect(sayOf("A〜B")).toBe("AからB")
    expect(sayOf("75歳以上")).toBe("75歳以上")
  })

  it("言い換えた結果に読み上げにくい記号が残らない", () => {
    for (const label of ["30km/hの道", "0〜24歳", "高速道路・専用道"]) {
      for (const mark of UNSPEAKABLE) expect(sayOf(label)).not.toContain(mark)
    }
  })
})

describe("evaluate", () => {
  const cand = { id: "T", ref: "参考", notRanked: ["（その他）"] }

  it("条件を満たす区分だけを致死率の高い順に3つ並べる", () => {
    const m = counts({
      参考: [10000, 30], // 0.30%
      A: [1000, 30], // 3.0%
      B: [500, 10], // 2.0%
      C: [2000, 20], // 1.0%
      件数不足: [150, 20], // 13% だが 200件未満
      死亡不足: [5000, 9], // 死亡10件未満
      "（その他）": [3000, 300], // 並べない区分
    })
    const result = evaluate(cand, m)
    expect(result.worst.map((w: { label: string }) => w.label)).toEqual(["A", "B", "C"])
    expect(result.worst[0].ratio).toBeCloseTo(10, 6)
    expect(result.problems).toEqual([])
    expect(result.verdict).toBe("採用候補")
  })

  it("参考が少ない・第1位が2倍未満・3つそろわないときは不採用にする", () => {
    const m = counts({ 参考: [900, 9], A: [1000, 15], B: [1000, 12] })
    const result = evaluate(cand, m)
    expect(result.verdict).toBe("不採用")
    expect(result.problems.join(" ")).toContain(`参考が${RULES.minRefN}件未満`)
    expect(result.problems.join(" ")).toContain("第1位が2倍未満")
    expect(result.problems.join(" ")).toContain("ワースト3がそろわない")
  })

  it("rateOf は死亡事故件数 ÷ 件数（%）", () => {
    expect(rateOf({ n: 63, fatal: 41 })).toBeCloseTo(65.0794, 4)
  })
})

describe("candidates の分類", () => {
  const row = (over: Record<string, string>) => ({
    事故類型: "21",
    "当事者種別（当事者A）": "03",
    "当事者種別（当事者B）": "04",
    "車両の衝突部位（当事者A）": "10",
    "車両の衝突部位（当事者B）": "30",
    "速度規制（指定のみ）（当事者A）": "02",
    "速度規制（指定のみ）（当事者B）": "00",
    路線コード: "30010",
    ...over,
  })

  it("衝突部位の上の桁で、前×後ろを追突、前×前を正面衝突にする（四輪どうしだけ）", () => {
    const c01 = candidate("C01")
    expect(c01.categorize(row({}))).toBe("追突（前と後ろ）")
    expect(c01.categorize(row({ "車両の衝突部位（当事者B）": "12" }))).toBe("正面衝突（前と前）")
    expect(c01.categorize(row({ "当事者種別（当事者B）": "51" }))).toBeNull()
  })

  it("制限速度は当事者Aが原付以上でなければ当事者Bのものを使う", () => {
    const c02 = candidate("C02")
    const pedestrian = { 事故類型: "01" }
    expect(c02.categorize(row({ ...pedestrian }))).toBe("30km/h")
    expect(
      c02.categorize(row({ ...pedestrian, "速度規制（指定のみ）（当事者A）": "00", "速度規制（指定のみ）（当事者B）": "04" })),
    ).toBe("50km/h")
  })

  it("路線コードは5桁の上4桁で道路の種類を決める", () => {
    const c14 = candidate("C14")
    expect(c14.categorize(row({ 路線コード: "30010" }))).toBe("市町村道")
    expect(c14.categorize(row({ 路線コード: "00010" }))).toBe("国道")
    expect(c14.categorize(row({ 路線コード: "40010" }))).toBe("高速道路・自動車専用道")
    // 1500〜1999 は「主要地方道－市道」なので市町村道に入れる
    expect(c14.categorize(row({ 路線コード: "15010" }))).toBe("市町村道")
    expect(c14.categorize(row({ 路線コード: "10010" }))).toBe("都道府県道")
  })

  it("C31（交差点の中を除く）は衝突地点が交差点内(30)の事故だけを外す", () => {
    const c31 = candidate("C31")
    const headOn = { "車両の衝突部位（当事者B）": "10" }
    expect(c31.categorize(row({ ...headOn, 衝突地点: "01" }))).toBe("正面衝突（前と前）")
    expect(c31.categorize(row({ ...headOn, 衝突地点: "20" }))).toBe("正面衝突（前と前）")
    expect(c31.categorize(row({ ...headOn, 衝突地点: "30" }))).toBeNull()
  })

  it("自転車の候補（C23・C24）は相手が四輪の事故だけを数える", () => {
    const bike = { "当事者種別（当事者A）": "03", "当事者種別（当事者B）": "51", "年齢（当事者B）": "75" }
    expect(candidate("C23").categorize(row(bike))).toBe("75歳以上")
    expect(candidate("C24").categorize(row(bike))).toBe("30km/h")
    const vsMotorcycle = { ...bike, "当事者種別（当事者A）": "35" }
    expect(candidate("C23").categorize(row(vsMotorcycle))).toBeNull()
    expect(candidate("C24").categorize(row(vsMotorcycle))).toBeNull()
  })

  it("C32 は自転車の側の種別（52＝電動アシスト）と年齢で分け、相手が四輪の事故だけを数える", () => {
    const c32 = candidate("C32")
    const bike = { "当事者種別（当事者A）": "03", "当事者種別（当事者B）": "51", "年齢（当事者B）": "75" }
    expect(c32.categorize(row(bike))).toBe("普通・75歳以上")
    expect(c32.categorize(row({ ...bike, "当事者種別（当事者B）": "52" }))).toBe("電動アシスト・75歳以上")
    // 自転車が当事者Aでも、年齢は自転車の側のもの
    expect(
      c32.categorize(row({ "当事者種別（当事者A）": "52", "年齢（当事者A）": "45", "当事者種別（当事者B）": "03", "年齢（当事者B）": "75" })),
    ).toBe("電動アシスト・25〜64歳")
    expect(c32.categorize(row({ ...bike, "年齢（当事者B）": "65" }))).toBe("普通・65〜74歳")
    expect(c32.categorize(row({ ...bike, "当事者種別（当事者A）": "35" }))).toBeNull() // 相手がバイク
    expect(c32.categorize(row({ ...bike, "年齢（当事者B）": "00" }))).toBeNull() // 年齢不明
  })

  it("「車にはねられた歩行者」は相手が四輪の事故だけを数える", () => {
    const c22 = candidate("C22")
    const ped = { 事故類型: "01", "当事者種別（当事者B）": "61", "年齢（当事者B）": "75" }
    expect(c22.categorize(row({ ...ped, "当事者種別（当事者A）": "03" }))).toBe("75歳以上")
    expect(c22.categorize(row({ ...ped, "当事者種別（当事者A）": "51" }))).toBeNull() // 自転車
    expect(c22.categorize(row({ ...ped, "当事者種別（当事者A）": "35" }))).toBeNull() // バイク
    expect(
      c22.categorize(row({ 事故類型: "01", "当事者種別（当事者A）": "61", "当事者種別（当事者B）": "00", "年齢（当事者A）": "75" })),
    ).toBeNull() // 相手不明
  })
})

describe("focusRatio（第1位を明かす場面の大きな倍率は、声の「約○倍」と同じ）", () => {
  type Ep = {
    id: string
    narration: string
    hookLine1: string
    hookHighlight: string
    hookLine2: string
    ref: { rate: number }
    worst: { rate: number }[]
  }
  const all = episodes as Ep[]
  const ratesOf = (e: Ep) => [e.ref.rate, e.worst[2].rate, e.worst[1].rate, e.worst[0].rate]
  const hookOf = (e: Ep) => e.hookLine1 + e.hookHighlight + e.hookLine2
  // 前の作り（フックの「○倍」に一番近い柱・±20%以内）。EP07・EP26・EP27 以外は今と同じ結果になること
  const old = (e: Ep) => {
    const r = ratesOf(e)
    const m = /([0-9０-９]+(?:\.[0-9]+)?)倍/.exec(e.hookHighlight + e.hookLine1 + e.hookLine2)
    let index = 3
    if (m) {
      const n = Number(m[1])
      let diff = Infinity
      let best = 3
      for (const i of [1, 2, 3]) {
        const d = Math.abs(r[i] / r[0] - n) / n
        if (d < diff) {
          diff = d
          best = i
        }
      }
      index = diff <= 0.2 ? best : 3
    }
    return { index, baseIndex: 0, ratio: formatRatio(r[index], r[0]) }
  }

  it("作り直していない回（EP01〜03・EP17）と EP21〜30 で、前の作りから変わるのは EP26・EP27 だけ", () => {
    const changed = all
      .filter((e) => ["01", "02", "03", "17"].includes(e.id) || Number(e.id) >= 21)
      .filter((e) => {
        const n = focusRatio(ratesOf(e), e.narration, hookOf(e))
        const o = old(e)
        return n.index !== o.index || n.baseIndex !== o.baseIndex || n.ratio !== o.ratio
      })
      .map((e) => e.id)
    expect(changed).toEqual(["26", "27"])
  })

  it("EP26 は第1位÷第2位（同じ年齢）、EP27 は第1位÷第2位（高速道路）", () => {
    const by = (id: string) => all.find((e) => e.id === id)!
    expect(focusRatio(ratesOf(by("26")), by("26").narration, hookOf(by("26")))).toMatchObject({ index: 3, baseIndex: 2, ratio: "2.2", exact: true })
    expect(focusRatio(ratesOf(by("27")), by("27").narration, hookOf(by("27")))).toMatchObject({ index: 3, baseIndex: 2, ratio: "2.6", exact: true })
  })

  it("フックの最初の数字ではなく、第1位を言う文の倍率を出す（前の EP07: フック「軽は1.8倍、大型バイクは21倍」）", () => {
    const narration = "普通乗用車の致死率は0.50%。一方、軽乗用車は0.90%と約1.8倍、大型トラックは3.87%で約7.7倍、そして大型バイクは10.53%と、普通車の約21倍に達します。"
    expect(focusRatio([0.5, 0.9, 3.87, 10.53], narration, "普通車と比べて軽は1.8倍、大型バイクは21倍")).toMatchObject({ index: 3, baseIndex: 0, ratio: "21" })
  })

  it("作り直した回（EP04〜20 の EP17 以外と EP21〜30）は全部、声の倍率がちょうど画面の倍率になる（exact）", () => {
    const notExact = all
      .filter((e) => Number(e.id) >= 4 && e.id !== "17")
      .filter((e) => !focusRatio(ratesOf(e), e.narration, hookOf(e)).exact)
      .map((e) => e.id)
    expect(notExact).toEqual([])
  })

  it("声の倍率がどの比とも合わなければ exact にならず、±20%以内の一番近い柱にする", () => {
    // 参考1%・第3位2%・第2位3%・第1位5.9%。声は「約6倍」→ 5.9倍の柱（EP02 と同じ形）
    expect(focusRatio([1, 2, 3, 5.9], "第1位は5.90%、約6倍です。", "")).toMatchObject({ index: 3, ratio: "5.9", exact: false })
  })
})

describe("EP04〜20 の作り直しの区分（candidates_ep04-20.mjs）", () => {
  const cand = (id: string) => CANDIDATES_04_20.find((c: { id: string }) => c.id === id)!
  const row = (over: Record<string, string>) => ({ 事故類型: "21", "年齢（当事者A）": "75", ...over })

  it("D08 は四輪の単独事故を年代別に、参考は全年代の四輪どうしの事故（自転車・二輪は数えない）", () => {
    const d08 = cand("D08")
    const car = { "当事者種別（当事者A）": "03", "当事者種別（当事者B）": "04" }
    expect(d08.categorize(row({ ...car, 事故類型: "41" }))).toBe("75歳以上・単独事故")
    expect(d08.categorize(row({ ...car, 事故類型: "41", "年齢（当事者A）": "45" }))).toBe("25〜64歳・単独事故")
    expect(d08.categorize(row({ ...car, "年齢（当事者A）": "45" }))).toBe("車同士（全年代）")
    expect(d08.categorize(row({ ...car, "当事者種別（当事者B）": "51" }))).toBeNull() // 車と自転車
    expect(d08.categorize(row({ ...car, 事故類型: "41", "当事者種別（当事者A）": "51" }))).toBeNull() // 自転車の単独事故
    expect(d08.categorize(row({ ...car, 事故類型: "01" }))).toBeNull()
  })

  it("D05・D12 は時間帯にまとめる（1時間ずつだと死亡10件未満の高い時間が黙って外れる）、D12・D19 は四輪の運転者だけ", () => {
    expect(cand("D05").categorize({ "当事者種別（当事者A）": "03", "当事者種別（当事者B）": "51", 発生日時_時: "4" })).toBe("明け方4〜6時")
    expect(cand("D05").categorize({ "当事者種別（当事者A）": "03", "当事者種別（当事者B）": "51", 発生日時_時: "0" })).toBe("深夜0〜3時")
    expect(cand("D12").categorize({ "年齢（当事者A）": "01", "当事者種別（当事者A）": "03", 発生日時_時: "12" })).toBe("昼間7〜18時")
    expect(cand("D12").categorize({ "年齢（当事者A）": "01", "当事者種別（当事者A）": "51", 発生日時_時: "12" })).toBeNull()
    expect(cand("D19").categorize({ "年齢（当事者A）": "01", "当事者種別（当事者A）": "61" })).toBeNull()
    expect(cand("D19").categorize({ "年齢（当事者A）": "75", "当事者種別（当事者A）": "04" })).toBe("75歳以上")
  })

  it("D15 は参考が凍結で、非舗装は並べない", () => {
    const d15 = cand("D15")
    expect(d15.ref).toBe("舗装・凍結")
    expect(d15.notRanked).toEqual(["非舗装"])
    expect(d15.categorize({ 路面状態: "2" })).toBe("舗装・湿潤")
  })

  it("D18 は四輪の AT/MT を乗用車・貨物車に分け、二輪や不明は数えない", () => {
    const d18 = cand("D18")
    expect(d18.categorize({ "オートマチック車（当事者A）": "2", "当事者種別（当事者A）": "11" })).toBe("MT・貨物車")
    expect(d18.categorize({ "オートマチック車（当事者A）": "1", "当事者種別（当事者A）": "03" })).toBe("AT・乗用車")
    expect(d18.categorize({ "オートマチック車（当事者A）": "0", "当事者種別（当事者A）": "03" })).toBeNull()
    expect(d18.categorize({ "オートマチック車（当事者A）": "2", "当事者種別（当事者A）": "31" })).toBeNull()
  })

  it("D20 は踏切（第一種・第三種・第四種）をまとめ、交差点付近は交差点と分ける", () => {
    const d20 = cand("D20")
    for (const code of ["21", "22", "23"]) expect(d20.categorize({ 道路形状: code })).toBe("踏切")
    expect(d20.categorize({ 道路形状: "01" })).toBe("交差点")
    expect(d20.categorize({ 道路形状: "07" })).toBe("交差点付近")
    expect(d20.rules).toEqual({ minWorstN: 100 })
  })
})
