import { describe, expect, it } from "vitest"
import { RULES, evaluate, fisherTwoSided, rateOf } from "../../../artifacts/series-20/mining/gaps-lib.mjs"
import { CANDIDATES } from "../../../artifacts/series-20/mining/candidates.mjs"

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
