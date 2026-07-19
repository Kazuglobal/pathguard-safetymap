import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockSingle = vi.fn();
  const mockSelectEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockSelectEq }));
  const mockUpdateEq = vi.fn();
  const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  }));

  const mockAdjustYears = vi.fn((years: number) => years);
  const mockNormalizeSummaryYearText = vi.fn((text: string) => text);

  return {
    mockRpc,
    mockSingle,
    mockSelectEq,
    mockSelect,
    mockUpdateEq,
    mockUpdate,
    mockFrom,
    mockAdjustYears,
    mockNormalizeSummaryYearText,
  };
});

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    rpc: mocked.mockRpc,
    from: mocked.mockFrom,
  },
}));

vi.mock("@/lib/accident-stats-year-window", () => ({
  ACCIDENT_IMAGE_CONTEXT_PARAMS: { radiusMeters: 300, years: 5 },
  DEFAULT_ACCIDENT_YEARS: 5,
  adjustYearsForAccidentDataset: mocked.mockAdjustYears,
  normalizeSummaryYearText: mocked.mockNormalizeSummaryYearText,
}));

import {
  enrichReportWithAccidents,
  getAccidentRiskLevel,
  getAccidentStatsRPC,
} from "@/lib/traffic-accident-data";

function makeStats(overrides?: Record<string, unknown>) {
  return {
    total_accidents: 1,
    total_fatalities: 0,
    total_injuries: 1,
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
    time_analysis: { by_hour: {}, by_month: {}, peak_hour: null, peak_month: null },
    situation_summary: {
      total_text: "直近5年で事故1件",
      severity_text: "",
      pedestrian_text: "",
      weather_risk_text: "",
      road_text: "",
      surface_text: null,
      elderly_text: null,
    },
    nearest_accidents: [],
    risk_score: 10,
    search_params: {
      latitude: 35.6585,
      longitude: 139.7006,
      radius_meters: 300,
      years: 5,
    },
    ...overrides,
  };
}

describe("getAccidentStatsRPC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("RPCを呼び出して事故統計を返す", async () => {
    const stats = makeStats();
    mocked.mockRpc.mockResolvedValueOnce({ data: stats, error: null });

    const result = await getAccidentStatsRPC({
      latitude: 35.6585,
      longitude: 139.7006,
      radiusMeters: 500,
      years: 3,
    });

    expect(mocked.mockRpc).toHaveBeenCalledWith("get_nearby_accident_stats", {
      p_latitude: 35.6585,
      p_longitude: 139.7006,
      p_radius_meters: 500,
      p_years: 3,
    });
    expect(result.search_params.years).toBe(3);
    expect(mocked.mockNormalizeSummaryYearText).toHaveBeenCalledWith(
      "直近5年で事故1件",
      3
    );
  });

  it("RPCエラー時は例外を投げる", async () => {
    mocked.mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "timeout" },
    });

    await expect(
      getAccidentStatsRPC({
        latitude: 35.6585,
        longitude: 139.7006,
      })
    ).rejects.toThrow("事故統計取得エラー: timeout");
  });
});

describe("getAccidentRiskLevel", () => {
  it("閾値ごとにレベルを返す", () => {
    expect(getAccidentRiskLevel(0).level).toBe("safe");
    expect(getAccidentRiskLevel(10).level).toBe("low");
    expect(getAccidentRiskLevel(30).level).toBe("moderate");
    expect(getAccidentRiskLevel(50).level).toBe("high");
    expect(getAccidentRiskLevel(80).level).toBe("critical");
  });

  it("高リスク帯の表示ラベルを返す", () => {
    const result = getAccidentRiskLevel(70);
    expect(result.emoji).toBe("🟠");
    expect(result.label).toBe("危険");
  });
});

describe("enrichReportWithAccidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.mockUpdateEq.mockResolvedValue({});
  });

  it("有効な座標のレポートを事故統計で更新し統計を返す", async () => {
    const stats = makeStats({ risk_score: 85 });
    mocked.mockSingle.mockResolvedValueOnce({
      data: { latitude: 35.6585, longitude: 139.7006 },
      error: null,
    });
    mocked.mockRpc.mockResolvedValueOnce({ data: stats, error: null });

    const result = await enrichReportWithAccidents("report-123");

    expect(result).toEqual(stats);
    expect(mocked.mockUpdate).toHaveBeenCalledWith({
      accident_stats: stats,
      accident_risk_score: 85,
    });
    expect(mocked.mockUpdateEq).toHaveBeenCalledWith("id", "report-123");
  });

  it("レポートが見つからない場合は null を返す", async () => {
    mocked.mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" },
    });

    const result = await enrichReportWithAccidents("missing-report");

    expect(result).toBeNull();
    expect(mocked.mockRpc).not.toHaveBeenCalled();
  });

  it("座標が不正な場合は null を返す", async () => {
    mocked.mockSingle.mockResolvedValueOnce({
      data: { latitude: null, longitude: 139.7 },
      error: null,
    });

    const result = await enrichReportWithAccidents("invalid-coord-report");

    expect(result).toBeNull();
    expect(mocked.mockRpc).not.toHaveBeenCalled();
  });
});
