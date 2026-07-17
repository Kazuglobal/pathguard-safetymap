import { describe, expect, it } from "vitest";
import {
  deriveHeadlineInsight,
  deriveAccidentActionAdvice,
} from "@/components/danger-report/accident-stats-panel";

function baseStats(overrides: Record<string, unknown> = {}) {
  return {
    fatal_accidents: 0,
    total_fatalities: 0,
    nearest_accidents: [],
    total_accidents: 10,
    pedestrian_involved: 1,
    time_analysis: { by_hour: {}, by_month: {}, peak_hour: null, peak_month: null },
    road_environment: {
      by_road_shape: {},
      by_sidewalk: {},
      intersection_ratio: 10,
      no_sidewalk_ratio: 0,
    },
    party_analysis: { by_age_group: {}, elderly_ratio: 5, young_ratio: 5 },
    risk_score: 5,
    ...overrides,
  };
}

describe("deriveHeadlineInsight / deriveAccidentActionAdvice priority order", () => {
  it("prioritizes a fatal accident above every other signal", () => {
    const stats = baseStats({ fatal_accidents: 1, total_fatalities: 1, risk_score: 90 });

    expect(deriveHeadlineInsight(stats as any)).toBe("死亡事故が発生している地点です");
    expect(deriveAccidentActionAdvice(stats as any)).toContain("車が完全に止まったのを目で確認する");
  });

  it("flags morning commute concentration when no fatal accident is recorded", () => {
    const stats = baseStats({
      time_analysis: { by_hour: { "7": 3, "8": 3 }, by_month: {}, peak_hour: 7, peak_month: null },
    });

    expect(deriveHeadlineInsight(stats as any)).toBe("登校時間帯の事故が集中している地点です");
    expect(deriveAccidentActionAdvice(stats as any)).toContain("登校時間帯(7〜8時)");
  });

  it("flags afternoon commute concentration", () => {
    const stats = baseStats({
      time_analysis: {
        by_hour: { "14": 3, "15": 3, "16": 2 },
        by_month: {},
        peak_hour: 14,
        peak_month: null,
      },
    });

    expect(deriveHeadlineInsight(stats as any)).toBe("下校時間帯の事故が集中している地点です");
    expect(deriveAccidentActionAdvice(stats as any)).toContain("下校時間帯(14〜16時)");
  });

  it("falls back to intersection risk when there is no commute-hour concentration", () => {
    const stats = baseStats({
      road_environment: {
        by_road_shape: {},
        by_sidewalk: {},
        intersection_ratio: 70,
        no_sidewalk_ratio: 0,
      },
    });

    expect(deriveHeadlineInsight(stats as any)).toBe("交差点での事故が多い地点です");
    expect(deriveAccidentActionAdvice(stats as any)).toContain("交差点では信号だけに頼らず");
  });

  it("falls back to elderly-driver risk when intersection ratio is unremarkable", () => {
    const stats = baseStats({
      party_analysis: { by_age_group: {}, elderly_ratio: 40, young_ratio: 5 },
    });

    expect(deriveHeadlineInsight(stats as any)).toBe("高齢ドライバーが関わる事故が多い地点です");
    expect(deriveAccidentActionAdvice(stats as any)).toContain("高齢ドライバーの車は急な進路変更に注意し");
  });

  it("falls back to pedestrian-involvement risk when nothing else stands out", () => {
    const stats = baseStats({ total_accidents: 10, pedestrian_involved: 5 });

    expect(deriveHeadlineInsight(stats as any)).toBe("歩行者が関わる事故が多い地点です");
    expect(deriveAccidentActionAdvice(stats as any)).toContain("歩行者用信号が青でも");
  });

  it("falls back to the generic risk-level description when no signal is dominant", () => {
    const stats = baseStats({ risk_score: 5 });

    expect(deriveHeadlineInsight(stats as any)).toBe("近隣での事故記録はほぼありません。");
    expect(deriveAccidentActionAdvice(stats as any)).toContain("基本の交通ルール");
  });
});
