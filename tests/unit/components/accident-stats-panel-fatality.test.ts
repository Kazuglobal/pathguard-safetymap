import { describe, expect, it } from "vitest";
import {
  deriveFatalAccidentCount,
  deriveSeveritySummaryText,
  isFatalNearbyAccident,
} from "@/components/danger-report/accident-stats-panel";

describe("accident-stats-panel fatality consistency", () => {
  it("does not treat injury severity as fatal even when fatalities is greater than zero", () => {
    expect(
      isFatalNearbyAccident({
        severity: "injury",
        fatalities: 1,
      } as any)
    ).toBe(false);
  });

  it("does not derive fatal accident count from nearby accidents when DB aggregate is zero", () => {
    const count = deriveFatalAccidentCount({
      fatal_accidents: 0,
      total_fatalities: 0,
      nearest_accidents: [
        { severity: "fatal", fatalities: 1 },
        { severity: "injury", fatalities: 0 },
      ],
    } as any);

    expect(count).toBe(0);
  });

  it("keeps no-fatal summary when only injury entries have fatalities", () => {
    const summary = deriveSeveritySummaryText({
      fatal_accidents: 0,
      total_fatalities: 0,
      nearest_accidents: [{ severity: "injury", fatalities: 2 }],
      situation_summary: {
        severity_text: "この地点の死亡事故なし",
      },
    } as any);

    expect(summary).toBe("この地点の死亡事故なし");
  });
});
