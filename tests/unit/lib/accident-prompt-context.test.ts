import { describe, expect, it } from "vitest"

import {
  buildAccidentPromptContext,
  isAccidentImageContextEnabled,
} from "@/lib/accident-prompt-context"
import type { AccidentStats } from "@/lib/traffic-accident-data"

function stats(overrides: Partial<AccidentStats> = {}): AccidentStats {
  return {
    total_accidents: 12,
    total_fatalities: 1,
    total_injuries: 11,
    child_involved: 2,
    pedestrian_involved: 5,
    fatal_accidents: 1,
    by_year: {},
    by_time_of_day: {
      "07-09_morning_commute": 7,
      "14-17_after_school": 3,
    },
    by_weather: { 晴: 4, 雨: 8 },
    by_accident_type: { 出会い頭: 9, 追突: 3 },
    by_party_type: {},
    by_road_surface: {},
    by_terrain: {},
    injury_analysis: { by_injury_level: {}, severe_ratio: 0 },
    road_environment: {
      by_road_shape: {},
      by_sidewalk: {},
      intersection_ratio: 0,
      no_sidewalk_ratio: 0,
    },
    party_analysis: { by_age_group: {}, elderly_ratio: 0, young_ratio: 0 },
    time_analysis: { by_hour: {}, by_month: {}, peak_hour: 8, peak_month: null },
    situation_summary: {
      total_text: "",
      severity_text: "",
      pedestrian_text: "",
      weather_risk_text: "",
      road_text: "",
      surface_text: null,
      elderly_text: null,
    },
    nearest_accidents: [],
    risk_score: 40,
    search_params: { latitude: 40.82, longitude: 140.74, radius_meters: 300, years: 5 },
    ...overrides,
  }
}

describe("buildAccidentPromptContext", () => {
  it("returns null when stats are absent or contain zero accidents", () => {
    expect(buildAccidentPromptContext(null)).toBeNull()
    expect(buildAccidentPromptContext(stats({ total_accidents: 0 }))).toBeNull()
  })

  it("uses only objective counts and the highest known labels", () => {
    const context = buildAccidentPromptContext(stats())

    expect(context).toContain("半径300m・直近5年・警察庁交通事故統計オープンデータ")
    expect(context).toContain("事故 12件（歩行者関与 5件 / 子ども関与 2件 / 死亡事故 1件）")
    expect(context).toContain("多い時間帯: 朝の通学時間（7-9時）")
    expect(context).toContain("多い事故類型: 出会い頭")
    expect(context).toContain("多い天候: 雨")
    expect(context).toContain("データにない事故・件数・被害を描かない。数値を変えない。")
    expect(context).toContain("事故の瞬間・負傷者・損壊車両・血は描かない")
    expect(context).toContain("安全/危険」という断定文を画像に書かない")
  })

  it("omits missing counters and labels instead of inventing them", () => {
    const partial = stats({
      pedestrian_involved: undefined as unknown as number,
      child_involved: undefined as unknown as number,
      fatal_accidents: undefined as unknown as number,
      by_time_of_day: {},
      by_accident_type: {},
      by_weather: {},
    })
    const context = buildAccidentPromptContext(partial)

    expect(context).toContain("- 事故 12件")
    expect(context).not.toContain("歩行者関与")
    expect(context).not.toContain("多い時間帯")
    expect(context).not.toContain("多い事故類型")
    expect(context).not.toContain("多い天候")
  })

  it("preserves extreme integer counts without rounding or abbreviation", () => {
    const context = buildAccidentPromptContext(stats({
      total_accidents: 1_234_567,
      pedestrian_involved: 987_654,
    }))

    expect(context).toContain("事故 1234567件")
    expect(context).toContain("歩行者関与 987654件")
    expect(context).not.toContain("万")
  })

  it("skips unknown labels", () => {
    const context = buildAccidentPromptContext(stats({
      by_time_of_day: { mystery_slot: 100 },
      by_accident_type: { 不明: 100 },
      by_weather: { unknown: 100 },
    }))

    expect(context).not.toContain("mystery_slot")
    expect(context).not.toContain("不明")
    expect(context).not.toContain("unknown")
  })
})

describe("isAccidentImageContextEnabled", () => {
  it("is enabled only by the explicit true value", () => {
    expect(isAccidentImageContextEnabled("true")).toBe(true)
    expect(isAccidentImageContextEnabled("TRUE")).toBe(true)
    expect(isAccidentImageContextEnabled("false")).toBe(false)
    expect(isAccidentImageContextEnabled(undefined)).toBe(false)
  })
})
