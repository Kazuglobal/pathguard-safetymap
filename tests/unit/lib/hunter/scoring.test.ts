import { describe, expect, it } from "vitest"

import {
  SEVERITY_POINTS,
  comboMultiplier,
  judgeTap,
  scoreSession,
} from "@/lib/hunter/scoring"
import type { HunterHazard, HunterRegion } from "@/lib/hunter/types"

function makeHazard(
  id: string,
  severity: HunterHazard["severity"],
  region: HunterRegion,
): HunterHazard {
  return {
    id,
    type: `type-${id}`,
    region,
    severity,
    kidExplanation: `explain-${id}`,
    safeAction: `action-${id}`,
    confidence: 0.9,
  }
}

// A: 高, 左上 x∈[0.1,0.3], y∈[0.1,0.3]
const hazardA = makeHazard("A", "high", { x: 0.1, y: 0.1, w: 0.2, h: 0.2 })
// B: 中, 右下 x∈[0.6,0.8], y∈[0.6,0.8]
const hazardB = makeHazard("B", "medium", { x: 0.6, y: 0.6, w: 0.2, h: 0.2 })
// C: 低, 右上 x∈[0.6,0.8], y∈[0.1,0.3]
const hazardC = makeHazard("C", "low", { x: 0.6, y: 0.1, w: 0.2, h: 0.2 })

const hazards: readonly HunterHazard[] = [hazardA, hazardB, hazardC]
const noneFound: ReadonlySet<string> = new Set<string>()

describe("SEVERITY_POINTS", () => {
  it("severity ごとの基礎点", () => {
    expect(SEVERITY_POINTS.high).toBe(150)
    expect(SEVERITY_POINTS.medium).toBe(100)
    expect(SEVERITY_POINTS.low).toBe(50)
  })
})

describe("judgeTap", () => {
  it("tight 内包は severity 点の hit", () => {
    expect(judgeTap({ x: 0.2, y: 0.2 }, hazards, noneFound)).toEqual({
      result: "hit",
      hazardId: "A",
      points: 150,
    })
    expect(judgeTap({ x: 0.7, y: 0.7 }, hazards, noneFound)).toEqual({
      result: "hit",
      hazardId: "B",
      points: 100,
    })
    expect(judgeTap({ x: 0.7, y: 0.2 }, hazards, noneFound)).toEqual({
      result: "hit",
      hazardId: "C",
      points: 50,
    })
  })

  it("境界線上 (region の端) も内包扱い", () => {
    expect(judgeTap({ x: 0.1, y: 0.1 }, hazards, noneFound).result).toBe("hit")
    expect(judgeTap({ x: 0.3, y: 0.3 }, hazards, noneFound).result).toBe("hit")
  })

  it("既発見 hazard は二重加点せず near 扱い (tight 中心の再タップ)", () => {
    const found = new Set<string>(["A"])
    const outcome = judgeTap({ x: 0.2, y: 0.2 }, hazards, found)
    expect(outcome.result).toBe("near")
    expect(outcome.hazardId).toBe("A")
    expect(outcome.points).toBe(0)
  })

  it("tight 外でも nearMargin 内なら near", () => {
    // x=0.34 は tight [0.1,0.3] 外、拡張 [0.04,0.36] 内
    const outcome = judgeTap({ x: 0.34, y: 0.2 }, hazards, noneFound)
    expect(outcome).toEqual({ result: "near", hazardId: "A", points: 0 })
  })

  it("nearMargin を狭めると near が miss になる", () => {
    const outcome = judgeTap({ x: 0.34, y: 0.2 }, hazards, noneFound, {
      nearMargin: 0.01,
    })
    expect(outcome.result).toBe("miss")
    expect(outcome.hazardId).toBeNull()
  })

  it("どの領域にも当たらなければ miss", () => {
    expect(judgeTap({ x: 0.5, y: 0.5 }, hazards, noneFound)).toEqual({
      result: "miss",
      hazardId: null,
      points: 0,
    })
  })
})

describe("comboMultiplier", () => {
  it("0 以下は 1.0", () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(-5)).toBe(1)
  })

  it("1hit は 1.0", () => {
    expect(comboMultiplier(1)).toBe(1)
  })

  it("段階的に 0.1 ずつ増える", () => {
    expect(comboMultiplier(2)).toBeCloseTo(1.1, 10)
    expect(comboMultiplier(3)).toBeCloseTo(1.2, 10)
    expect(comboMultiplier(5)).toBeCloseTo(1.4, 10)
  })

  it("上限 2.0 でクランプ", () => {
    expect(comboMultiplier(11)).toBe(2)
    expect(comboMultiplier(50)).toBe(2)
  })
})

describe("scoreSession", () => {
  it("連続 hit でコンボ加算され comboMax/score/matches を集計", () => {
    const result = scoreSession(
      [
        { x: 0.2, y: 0.2 }, // hit A: consec1 x1.0 => 150
        { x: 0.7, y: 0.7 }, // hit B: consec2 x1.1 => round(110)=110
        { x: 0.7, y: 0.2 }, // hit C: consec3 x1.2 => round(60)=60
      ],
      hazards,
    )

    expect(result.outcomes).toHaveLength(3)
    expect(result.outcomes.map((o) => o.points)).toEqual([150, 110, 60])
    expect(result.score).toBe(320)
    expect(result.matches).toBe(3)
    expect(result.comboMax).toBe(3)
  })

  it("miss でコンボがリセットされる", () => {
    const result = scoreSession(
      [
        { x: 0.2, y: 0.2 }, // hit A: consec1 => 150
        { x: 0.5, y: 0.5 }, // miss: reset
        { x: 0.7, y: 0.7 }, // hit B: consec1 => 100
      ],
      hazards,
    )

    expect(result.outcomes.map((o) => o.result)).toEqual(["hit", "miss", "hit"])
    expect(result.outcomes.map((o) => o.points)).toEqual([150, 0, 100])
    expect(result.score).toBe(250)
    expect(result.matches).toBe(2)
    expect(result.comboMax).toBe(1)
  })

  it("同一 hazard の二重タップは加点されず matches も増えない", () => {
    const result = scoreSession(
      [
        { x: 0.2, y: 0.2 }, // hit A => 150
        { x: 0.2, y: 0.2 }, // 既発見: near, 0点, コンボリセット
      ],
      hazards,
    )

    expect(result.outcomes[0].result).toBe("hit")
    expect(result.outcomes[1].result).toBe("near")
    expect(result.outcomes[1].points).toBe(0)
    expect(result.score).toBe(150)
    expect(result.matches).toBe(1)
    expect(result.comboMax).toBe(1)
  })

  it("空タップ列は初期値", () => {
    const result = scoreSession([], hazards)
    expect(result).toEqual({ score: 0, matches: 0, comboMax: 0, outcomes: [] })
  })
})
