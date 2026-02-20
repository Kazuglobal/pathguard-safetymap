import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccidentStats } from "@/lib/traffic-accident-data";

const mocked = vi.hoisted(() => ({
  getAccidentStatsRPC: vi.fn(),
  enrichReportWithAccidents: vi.fn(),
}));

vi.mock("@/lib/traffic-accident-data", () => ({
  getAccidentStatsRPC: mocked.getAccidentStatsRPC,
  enrichReportWithAccidents: mocked.enrichReportWithAccidents,
}));

import { useAccidentStats } from "@/hooks/use-accident-stats";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeStats(overrides: Partial<AccidentStats> = {}): AccidentStats {
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
      latitude: 35.0,
      longitude: 139.0,
      radius_meters: 300,
      years: 5,
    },
    ...overrides,
  };
}

describe("useAccidentStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with idle state", () => {
    const { result } = renderHook(() => useAccidentStats());
    expect(result.current.status).toBe("idle");
    expect(result.current.stats).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.hasData).toBe(false);
  });

  it("loads stats successfully", async () => {
    const stats = makeStats({ risk_score: 88 });
    mocked.getAccidentStatsRPC.mockResolvedValueOnce(stats);

    const { result } = renderHook(() => useAccidentStats());

    await act(async () => {
      await result.current.fetchStats({ latitude: 35.0, longitude: 139.0 });
    });

    expect(mocked.getAccidentStatsRPC).toHaveBeenCalledWith({
      latitude: 35.0,
      longitude: 139.0,
    });
    expect(result.current.status).toBe("loaded");
    expect(result.current.stats).toEqual(stats);
    expect(result.current.error).toBeNull();
    expect(result.current.hasData).toBe(true);
  });

  it("sets error state on fetch failure", async () => {
    mocked.getAccidentStatsRPC.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useAccidentStats());

    await act(async () => {
      await result.current.fetchStats({ latitude: 35.0, longitude: 139.0 });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.stats).toBeNull();
    expect(result.current.error).toContain("boom");
  });

  it("keeps only latest fetch result when requests resolve out of order", async () => {
    const first = createDeferred<AccidentStats>();
    const second = createDeferred<AccidentStats>();

    mocked.getAccidentStatsRPC
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const firstStats = makeStats({ risk_score: 11 });
    const secondStats = makeStats({ risk_score: 99 });

    const { result } = renderHook(() => useAccidentStats());

    act(() => {
      void result.current.fetchStats({ latitude: 35.0, longitude: 139.0 });
      void result.current.fetchStats({ latitude: 36.0, longitude: 140.0 });
    });

    await act(async () => {
      second.resolve(secondStats);
      await second.promise;
    });

    await waitFor(() => {
      expect(result.current.status).toBe("loaded");
      expect(result.current.stats).toEqual(secondStats);
    });

    await act(async () => {
      first.resolve(firstStats);
      await first.promise;
    });

    expect(result.current.stats).toEqual(secondStats);
  });

  it("invalidates in-flight request on reset", async () => {
    const deferred = createDeferred<AccidentStats>();
    mocked.getAccidentStatsRPC.mockReturnValueOnce(deferred.promise);
    const { result } = renderHook(() => useAccidentStats());

    act(() => {
      void result.current.fetchStats({ latitude: 35.0, longitude: 139.0 });
    });

    act(() => {
      result.current.reset();
    });

    await act(async () => {
      deferred.resolve(makeStats({ risk_score: 70 }));
      await deferred.promise;
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.stats).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("enriches report and handles null as error", async () => {
    const stats = makeStats({ risk_score: 42 });
    mocked.enrichReportWithAccidents
      .mockResolvedValueOnce(stats)
      .mockResolvedValueOnce(null);

    const { result } = renderHook(() => useAccidentStats());

    await act(async () => {
      await result.current.enrichReport("report-1");
    });
    expect(result.current.status).toBe("loaded");
    expect(result.current.stats).toEqual(stats);

    await act(async () => {
      await result.current.enrichReport("report-missing");
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("統計付与に失敗しました");
  });
});
