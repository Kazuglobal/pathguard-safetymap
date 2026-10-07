import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();

import { getAccidentStatsRPC } from "@/lib/traffic-accident-data";

describe("getAccidentStatsRPC year window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  it("sends the requested years as-is (the server anchors them to the latest data year)", async () => {
    const stats = {
      total_accidents: 4,
      situation_summary: { total_text: "4件の事故が過去5年間（2021〜2025年）に半径300m以内で発生" },
      search_params: { latitude: 35, longitude: 139, radius_meters: 300, years: 5, min_year: 2021, max_year: 2025 },
    };
    mockFetch.mockResolvedValue(new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const result = await getAccidentStatsRPC({ latitude: 35.0, longitude: 139.0, radiusMeters: 300, years: 5 });

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('latitude=35');
    expect(url).toContain('longitude=139');
    expect(url).toContain('radiusMeters=300');
    expect(url).toContain('years=5');
    expect(result).toEqual(stats);
  });

  it("does not hide D1 timeouts by shrinking the requested year window", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'query timeout' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(getAccidentStatsRPC({
      latitude: 35,
      longitude: 139,
      radiusMeters: 300,
      years: 5,
    })).rejects.toThrow('事故統計取得エラー: query timeout');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
