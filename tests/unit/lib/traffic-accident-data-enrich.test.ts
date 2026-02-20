import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockUpdateEq = vi.fn();
  const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
  const mockSelectEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockSelectEq }));
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  }));
  const mockRpc = vi.fn();
  return {
    mockSingle,
    mockUpdateEq,
    mockUpdate,
    mockSelectEq,
    mockSelect,
    mockFrom,
    mockRpc,
  };
});

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    from: mocked.mockFrom,
    rpc: mocked.mockRpc,
  },
}));

import { enrichReportWithAccidents } from "@/lib/traffic-accident-data";

function makeRpcStats() {
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
      total_text: "",
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
      latitude: 0,
      longitude: 139,
      radius_meters: 300,
      years: 5,
    },
  };
}

describe("enrichReportWithAccidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.mockUpdateEq.mockResolvedValue({});
  });

  it("accepts zero coordinates and still fetches accident stats", async () => {
    mocked.mockSingle.mockResolvedValue({
      data: { latitude: 0, longitude: 139 },
      error: null,
    });
    mocked.mockRpc.mockResolvedValue({
      data: makeRpcStats(),
      error: null,
    });

    const result = await enrichReportWithAccidents("report-0");

    expect(result).not.toBeNull();
    expect(mocked.mockRpc).toHaveBeenCalledWith(
      "get_nearby_accident_stats",
      expect.objectContaining({
        p_latitude: 0,
        p_longitude: 139,
      })
    );
  });
});
