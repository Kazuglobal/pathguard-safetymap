import { describe, expect, it } from "vitest"

import {
  HIT_MARGIN,
  NEAR_OUTER,
  SEVERITY_POINTS,
  comboMultiplier,
  judgeTap,
  nearestUnfound,
  scoreSession,
  tapDirection,
  tapTemperature,
} from "@/lib/hunter/scoring"
import type { HunterHazard, HunterRegion } from "@/lib/hunter/types"

function makeHazard(
  id: string,
  severity: HunterHazard["severity"],
  region: HunterRegion,
  confidence = 0.9,
): HunterHazard {
  return {
    id,
    type: `type-${id}`,
    region,
    severity,
    kidExplanation: `explain-${id}`,
    safeAction: `action-${id}`,
    confidence,
  }
}

// A: 高, 左上 tight x∈[0.1,0.3], y∈[0.1,0.3], 中心(0.2,0.2)
const hazardA = makeHazard("A", "high", { x: 0.1, y: 0.1, w: 0.2, h: 0.2 })
// B: 中, 右下 tight x∈[0.6,0.8], y∈[0.6,0.8], 中心(0.7,0.7)
const hazardB = makeHazard("B", "medium", { x: 0.6, y: 0.6, w: 0.2, h: 0.2 })
// C: 低, 右上 tight x∈[0.6,0.8], y∈[0.1,0.3], 中心(0.7,0.2)
const hazardC = makeHazard("C", "low", { x: 0.6, y: 0.1, w: 0.2, h: 0.2 })

const hazards: readonly HunterHazard[] = [hazardA, hazardB, hazardC]
const noneFound: ReadonlySet<string> = new Set<string>()

describe("constants", () => {
  it("severity ごとの基礎点", () => {
    expect(SEVERITY_POINTS.high).toBe(150)
    expect(SEVERITY_POINTS.medium).toBe(100)
    expect(SEVERITY_POINTS.low).toBe(50)
  })

  it("やさしい当たり判定: HIT_MARGIN は near より狭い広めゾーン", () => {
    expect(HIT_MARGIN).toBeGreaterThan(0.06)
    expect(HIT_MARGIN).toBeLessThan(NEAR_OUTER)
  })
})

describe("judgeTap — やさしい当たり判定", () => {
  it("tight 内包は severity 点の hit", () => {
    expect(judgeTap({ x: 0.2, y: 0.2 }, hazards, noneFound)).toMatchObject({
      result: "hit",
      hazardId: "A",
      points: 150,
    })
    expect(judgeTap({ x: 0.7, y: 0.7 }, hazards, noneFound)).toMatchObject({
      result: "hit",
      hazardId: "B",
      points: 100,
    })
  })

  it("tight の少し外でも HIT_MARGIN 内なら hit(bboxズレ救済)", () => {
    // x=0.38 は tight [0.1,0.3] 外、hitゾーン [0.0,0.4] 内 → 以前は near、今は hit
    expect(judgeTap({ x: 0.38, y: 0.2 }, hazards, noneFound)).toMatchObject({
      result: "hit",
      hazardId: "A",
      points: 150,
    })
  })

  it("hit 候補が複数なら severity重み×confidence の高い方を選ぶ", () => {
    const high = makeHazard("H", "high", { x: 0.3, y: 0.3, w: 0.1, h: 0.1 }, 0.9)
    const low = makeHazard("L", "low", { x: 0.4, y: 0.4, w: 0.1, h: 0.1 }, 0.9)
    const out = judgeTap({ x: 0.42, y: 0.42 }, [low, high], noneFound)
    expect(out.result).toBe("hit")
    expect(out.hazardId).toBe("H")
    expect(out.points).toBe(150)
  })

  it("hit ゾーン外でも near ゾーン内なら near + 温度/方向/最近傍", () => {
    // (0.46,0.2): A hitゾーン[0,0.4]外、A nearゾーン[-0.08,0.38]... 待った xは0.1±0.18+w
    // A near zone x∈[-0.08,0.48] を使うため x=0.46 は near
    const out = judgeTap({ x: 0.46, y: 0.2 }, [hazardA], noneFound)
    expect(out.result).toBe("near")
    expect(out.hazardId).toBe("A")
    expect(out.nearestId).toBe("A")
    expect(out.direction).toBe("left") // hazard中心(0.2)はタップ(0.46)の左
    expect(out.temperature).toBeDefined()
  })

  it("どの near ゾーンにも入らなければ miss(ただし最近傍ヒントは付く)", () => {
    const out = judgeTap({ x: 0.95, y: 0.95 }, [hazardA], noneFound)
    expect(out.result).toBe("miss")
    expect(out.hazardId).toBeNull()
    expect(out.nearestId).toBe("A")
    expect(out.temperature).toBe("cold")
  })

  it("既発見 hazard は二重加点せず、最近傍の未発見へヒントを向ける", () => {
    const found = new Set<string>(["A"])
    const out = judgeTap({ x: 0.2, y: 0.2 }, hazards, found)
    expect(out.points).toBe(0)
    expect(out.hazardId).not.toBe("A")
    // 最近傍の未発見は C(中心0.7,0.2 が一番近い)
    expect(out.nearestId).toBe("C")
  })

  it("全 hazard 発見後はヒントを抑止(nearestId=null, miss)", () => {
    const found = new Set<string>(["A", "B", "C"])
    const out = judgeTap({ x: 0.2, y: 0.2 }, hazards, found)
    expect(out.result).toBe("miss")
    expect(out.nearestId).toBeNull()
    expect(out.temperature).toBeUndefined()
  })
})

describe("nearestUnfound / tapTemperature / tapDirection", () => {
  it("最近傍の未発見hazardと距離を返す", () => {
    const r = nearestUnfound({ x: 0.2, y: 0.2 }, hazards, noneFound)
    expect(r.hazardId).toBe("A")
    expect(r.distance).toBeCloseTo(0, 5)
  })

  it("全発見済みなら null", () => {
    const r = nearestUnfound({ x: 0.2, y: 0.2 }, hazards, new Set(["A", "B", "C"]))
    expect(r.hazardId).toBeNull()
  })

  it("距離で温度感を返す", () => {
    expect(tapTemperature(0.1)).toBe("hot")
    expect(tapTemperature(0.3)).toBe("warm")
    expect(tapTemperature(0.5)).toBe("cold")
  })

  it("中心への方向を返す", () => {
    expect(tapDirection({ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 })).toBe("right")
    expect(tapDirection({ x: 0.8, y: 0.5 }, { x: 0.2, y: 0.5 })).toBe("left")
    expect(tapDirection({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.8 })).toBe("down")
    expect(tapDirection({ x: 0.5, y: 0.8 }, { x: 0.5, y: 0.2 })).toBe("up")
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
        { x: 0.05, y: 0.95 }, // miss: reset (どの near ゾーンからも遠い)
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
        { x: 0.2, y: 0.2 }, // 既発見: 0点, コンボリセット
      ],
      hazards,
    )

    expect(result.outcomes[0].result).toBe("hit")
    expect(result.outcomes[1].result).not.toBe("hit")
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
