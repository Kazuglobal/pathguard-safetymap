import { describe, expect, it } from "vitest";
import type { AccidentStats } from "@/lib/traffic-accident-data";
import {
  buildAccidentSummary,
  buildAccidentPromptContext,
  childRiskHint,
  extractAccidentThemes,
  kidAccidentLabel,
} from "@/lib/hunter/accident-context";

describe("kidAccidentLabel", () => {
  it("converts technical accident labels to kid-friendly wording", () => {
    expect(kidAccidentLabel("車両相互正面衝突")).toBe("正面からの衝突");
    expect(kidAccidentLabel("出会い頭衝突")).toBe("角での出会い頭");
    expect(kidAccidentLabel("人対車両横断中")).toBe("道路を渡っているときの事故");
  });

  it("never returns a raw technical term for unknown labels", () => {
    expect(kidAccidentLabel("謎の専門用語ABC")).toBe("交通事故");
    expect(kidAccidentLabel(null)).toBe("交通事故");
    expect(kidAccidentLabel(undefined)).toBe("交通事故");
  });

  it("drops the hard technical phrase for a common label", () => {
    expect(kidAccidentLabel("車両相互正面衝突")).not.toContain("車両相互");
  });
});

/**
 * AccidentStats は多数の必須フィールドを持つため、テストで使う最小限のフィールドだけを
 * 指定し、残りは妥当なゼロ値で埋めるファクトリ。
 */
function makeStats(overrides: Partial<AccidentStats>): AccidentStats {
  return {
    total_accidents: 0,
    total_fatalities: 0,
    total_injuries: 0,
    child_involved: 0,
    pedestrian_involved: 0,
    fatal_accidents: 0,
    by_year: {},
    by_time_of_day: {},
    by_weather: {},
    by_accident_type: {},
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
    time_analysis: {
      by_hour: {},
      by_month: {},
      peak_hour: null,
      peak_month: null,
    },
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
    risk_score: 0,
    search_params: {
      latitude: 0,
      longitude: 0,
    } as AccidentStats["search_params"],
    ...overrides,
  } as AccidentStats;
}

describe("buildAccidentSummary", () => {
  it("returns no-data summary for null", () => {
    const summary = buildAccidentSummary(null);
    expect(summary.hasData).toBe(false);
    expect(summary.riskScore).toBe(0);
    expect(summary.riskLevel).toBe("safe");
    expect(summary.riskLabel).toBe("安全");
    expect(summary.riskEmoji).toBe("🟢");
    expect(summary.totalAccidents).toBe(0);
    expect(summary.childInvolved).toBe(0);
    expect(summary.topAccidentType).toBeNull();
    expect(summary.peakTimeSlot).toBeNull();
    expect(summary.kidMessage).toContain("ゆだん");
  });

  it("returns no-data summary when total_accidents is 0", () => {
    const summary = buildAccidentSummary(
      makeStats({ total_accidents: 0, risk_score: 90 }),
    );
    expect(summary.hasData).toBe(false);
    expect(summary.riskLevel).toBe("safe");
    expect(summary.kidMessage).toContain("ゆだん");
  });

  it("maps risk level at the critical boundary (80)", () => {
    const summary = buildAccidentSummary(
      makeStats({ total_accidents: 5, risk_score: 80 }),
    );
    expect(summary.hasData).toBe(true);
    expect(summary.riskScore).toBe(80);
    expect(summary.riskLevel).toBe("critical");
    expect(summary.riskLabel).toBe("非常に危険");
    expect(summary.riskEmoji).toBe("🔴");
  });

  it("maps risk level at the high boundary (50)", () => {
    const summary = buildAccidentSummary(
      makeStats({ total_accidents: 5, risk_score: 50 }),
    );
    expect(summary.riskLevel).toBe("high");
    expect(summary.riskLabel).toBe("危険");
    expect(summary.riskEmoji).toBe("🟠");
  });

  it("maps risk level at the moderate boundary (30)", () => {
    const summary = buildAccidentSummary(
      makeStats({ total_accidents: 5, risk_score: 30 }),
    );
    expect(summary.riskLevel).toBe("moderate");
    expect(summary.riskLabel).toBe("やや危険");
    expect(summary.riskEmoji).toBe("🟡");
  });

  it("maps risk level at the low boundary (10)", () => {
    const summary = buildAccidentSummary(
      makeStats({ total_accidents: 5, risk_score: 10 }),
    );
    expect(summary.riskLevel).toBe("low");
    expect(summary.riskLabel).toBe("注意");
    expect(summary.riskEmoji).toBe("🔵");
  });

  it("maps risk level to safe below 10", () => {
    const summary = buildAccidentSummary(
      makeStats({ total_accidents: 5, risk_score: 9 }),
    );
    expect(summary.riskLevel).toBe("safe");
    expect(summary.riskLabel).toBe("安全");
    expect(summary.riskEmoji).toBe("🟢");
  });

  it("selects the accident type with the most cases", () => {
    const summary = buildAccidentSummary(
      makeStats({
        total_accidents: 12,
        risk_score: 40,
        by_accident_type: { 出会い頭: 3, 追突: 7, 右折時: 2 },
      }),
    );
    expect(summary.topAccidentType).toBe("追突");
  });

  it("returns null topAccidentType when by_accident_type is empty", () => {
    const summary = buildAccidentSummary(
      makeStats({ total_accidents: 4, risk_score: 40, by_accident_type: {} }),
    );
    expect(summary.topAccidentType).toBeNull();
  });

  it("returns topAccidentTypes in count-descending order, capped at 3", () => {
    const summary = buildAccidentSummary(
      makeStats({
        total_accidents: 20,
        risk_score: 40,
        by_accident_type: { 出会い頭: 3, 追突: 7, 右折時: 2, 横断中: 5 },
      }),
    );
    expect(summary.topAccidentTypes).toEqual(["追突", "横断中", "出会い頭"]);
  });

  it("returns empty topAccidentTypes for no-data summaries", () => {
    expect(buildAccidentSummary(null).topAccidentTypes).toEqual([]);
    expect(
      buildAccidentSummary(makeStats({ total_accidents: 4, risk_score: 40, by_accident_type: {} }))
        .topAccidentTypes,
    ).toEqual([]);
  });

  it("maps peak_hour 8 to the morning commute slot", () => {
    const summary = buildAccidentSummary(
      makeStats({
        total_accidents: 4,
        risk_score: 40,
        time_analysis: {
          by_hour: {},
          by_month: {},
          peak_hour: 8,
          peak_month: null,
        },
      }),
    );
    expect(summary.peakTimeSlot).toBe("朝の通学時間 (7-9時)");
  });

  it("maps peak_hour 15 to the after-school slot", () => {
    const summary = buildAccidentSummary(
      makeStats({
        total_accidents: 4,
        risk_score: 40,
        time_analysis: {
          by_hour: {},
          by_month: {},
          peak_hour: 15,
          peak_month: null,
        },
      }),
    );
    expect(summary.peakTimeSlot).toBe("下校時間 (14-17時)");
  });

  it("maps peak_hour 18 to the evening slot", () => {
    const summary = buildAccidentSummary(
      makeStats({
        total_accidents: 4,
        risk_score: 40,
        time_analysis: {
          by_hour: {},
          by_month: {},
          peak_hour: 18,
          peak_month: null,
        },
      }),
    );
    expect(summary.peakTimeSlot).toBe("夕方 (17-19時)");
  });

  it("falls back to a generic hour label for other hours", () => {
    const summary = buildAccidentSummary(
      makeStats({
        total_accidents: 4,
        risk_score: 40,
        time_analysis: {
          by_hour: {},
          by_month: {},
          peak_hour: 22,
          peak_month: null,
        },
      }),
    );
    expect(summary.peakTimeSlot).toBe("22時ごろ");
  });

  it("returns null peakTimeSlot when peak_hour is null", () => {
    const summary = buildAccidentSummary(
      makeStats({ total_accidents: 4, risk_score: 40 }),
    );
    expect(summary.peakTimeSlot).toBeNull();
  });

  it("uses a child-focused message when children are involved", () => {
    const summary = buildAccidentSummary(
      makeStats({
        total_accidents: 8,
        child_involved: 3,
        risk_score: 55,
      }),
    );
    expect(summary.childInvolved).toBe(3);
    expect(summary.kidMessage).toContain("子ども");
    expect(summary.kidMessage).toContain("3けん");
    expect(summary.kidMessage).toContain("危険");
  });

  it("uses a gentle message without asserting safety when no children involved", () => {
    const summary = buildAccidentSummary(
      makeStats({
        total_accidents: 6,
        child_involved: 0,
        risk_score: 55,
      }),
    );
    expect(summary.kidMessage.length).toBeGreaterThan(0);
    expect(summary.kidMessage).not.toContain("子どもが かかわる");
  });
});

describe("buildAccidentPromptContext", () => {
  it("returns empty string for null", () => {
    expect(buildAccidentPromptContext(null)).toBe("");
  });

  it("returns empty string when there are 0 accidents", () => {
    expect(
      buildAccidentPromptContext(makeStats({ total_accidents: 0 })),
    ).toBe("");
  });

  it("includes accident counts and top type names when data exists", () => {
    const context = buildAccidentPromptContext(
      makeStats({
        total_accidents: 12,
        child_involved: 4,
        risk_score: 60,
        by_accident_type: { 出会い頭: 6, 追突: 4, 右折時: 2 },
      }),
    );
    expect(context).not.toBe("");
    expect(context).toContain("12");
    expect(context).toContain("4");
    expect(context).toContain("出会い頭");
    expect(context).toContain("追突");
  });

  it("includes the peak time slot when present", () => {
    const context = buildAccidentPromptContext(
      makeStats({
        total_accidents: 5,
        risk_score: 40,
        by_accident_type: { 出会い頭: 5 },
        time_analysis: {
          by_hour: {},
          by_month: {},
          peak_hour: 8,
          peak_month: null,
        },
      }),
    );
    expect(context).toContain("朝の通学時間 (7-9時)");
  });
});

describe("childRiskHint", () => {
  it("is action-oriented and never uses the blunt '非常に危険' label", () => {
    for (const score of [0, 10, 30, 50, 80, 100]) {
      const hint = childRiskHint(score);
      expect(hint.length).toBeGreaterThan(0);
      expect(hint).not.toContain("非常に危険");
      expect(hint).not.toContain("件");
    }
  });

  it("escalates wording with risk score without asserting safety", () => {
    expect(childRiskHint(60)).toContain("止まって");
    expect(childRiskHint(0)).not.toContain("止まって");
  });
});

describe("extractAccidentThemes", () => {
  it("returns empty array for null", () => {
    expect(extractAccidentThemes(null)).toEqual([]);
  });

  it("returns empty array when by_accident_type is empty", () => {
    expect(
      extractAccidentThemes(makeStats({ total_accidents: 5 })),
    ).toEqual([]);
  });

  it("returns top types in descending order, default max 3", () => {
    const themes = extractAccidentThemes(
      makeStats({
        total_accidents: 20,
        by_accident_type: { 出会い頭: 6, 追突: 9, 右折時: 3, 左折時: 2 },
      }),
    );
    expect(themes).toEqual(["追突", "出会い頭", "右折時"]);
  });

  it("respects the max argument", () => {
    const themes = extractAccidentThemes(
      makeStats({
        total_accidents: 20,
        by_accident_type: { 出会い頭: 6, 追突: 9, 右折時: 3, 左折時: 2 },
      }),
      2,
    );
    expect(themes).toEqual(["追突", "出会い頭"]);
  });
});
