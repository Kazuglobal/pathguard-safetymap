import { describe, expect, it } from "vitest";
import { extractSliderValue } from "@/components/3d-route/time-of-day-slider";

describe("extractSliderValue", () => {
  it("returns null when slider emits an empty array", () => {
    expect(extractSliderValue([])).toBeNull();
  });

  it("returns the first value when slider emits values", () => {
    expect(extractSliderValue([9.25])).toBe(9.25);
  });
});

