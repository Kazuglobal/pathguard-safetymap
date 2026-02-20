import { beforeEach, describe, expect, it, vi } from "vitest";
import { adjustYearsForAccidentDataset } from "@/lib/accident-stats-year-window";

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase-client";
import { getAccidentStatsRPC } from "@/lib/traffic-accident-data";

describe("getAccidentStatsRPC year adjustment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adjusts RPC years to match static dataset window and keeps UI summary as requested years", async () => {
    const currentYear = new Date().getFullYear();
    const expectedRpcYears = adjustYearsForAccidentDataset(5, currentYear);

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        total_accidents: 4,
        total_fatalities: 0,
        total_injuries: 4,
        child_involved: 0,
        pedestrian_involved: 0,
        fatal_accidents: 0,
        by_year: { "2020": 2, "2023": 2 },
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
          total_text: "4件の事故が過去8年間に半径300m以内で発生",
          severity_text: "死亡事故なし",
          pedestrian_text: "歩行者事故なし",
          weather_risk_text: "悪天候時の事故1件",
          road_text: "事故の過半数が交差点で発生",
          surface_text: null,
          elderly_text: null,
        },
        nearest_accidents: [],
        risk_score: 40,
        search_params: {
          latitude: 35.0,
          longitude: 139.0,
          radius_meters: 300,
          years: expectedRpcYears,
        },
      },
      error: null,
    } as any);

    const result = await getAccidentStatsRPC({
      latitude: 35.0,
      longitude: 139.0,
      radiusMeters: 300,
      years: 5,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("get_nearby_accident_stats", {
      p_latitude: 35.0,
      p_longitude: 139.0,
      p_radius_meters: 300,
      p_years: expectedRpcYears,
    });
    expect(result.search_params.years).toBe(5);
    expect(result.situation_summary.total_text).toContain("過去5年間");
  });

  it("retries with smaller years when statement timeout occurs", async () => {
    const currentYear = new Date().getFullYear();
    const adjusted = adjustYearsForAccidentDataset(5, currentYear);

    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({
        data: null,
        error: { message: "canceling statement due to statement timeout" },
      } as any)
      .mockResolvedValueOnce({
        data: {
          total_accidents: 4,
          total_fatalities: 1,
          total_injuries: 3,
          child_involved: 0,
          pedestrian_involved: 0,
          fatal_accidents: 1,
          by_year: { "2020": 2, "2023": 2 },
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
            total_text: "4件の事故が過去7年間に半径300m以内で発生",
            severity_text: "死亡事故1件を含む",
            pedestrian_text: "歩行者事故なし",
            weather_risk_text: "悪天候時の事故1件",
            road_text: "事故の過半数が交差点で発生",
            surface_text: null,
            elderly_text: null,
          },
          nearest_accidents: [],
          risk_score: 40,
          search_params: {
            latitude: 35.0,
            longitude: 139.0,
            radius_meters: 300,
            years: adjusted - 1,
          },
        },
        error: null,
      } as any);

    const result = await getAccidentStatsRPC({
      latitude: 35.0,
      longitude: 139.0,
      radiusMeters: 300,
      years: 5,
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.rpc).toHaveBeenNthCalledWith(1, "get_nearby_accident_stats", {
      p_latitude: 35.0,
      p_longitude: 139.0,
      p_radius_meters: 300,
      p_years: adjusted,
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "get_nearby_accident_stats", {
      p_latitude: 35.0,
      p_longitude: 139.0,
      p_radius_meters: 300,
      p_years: adjusted - 1,
    });
    expect(result.search_params.years).toBe(5);
  });
});
