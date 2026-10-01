import { describe, expect, it } from "vitest";
import {
  ACCIDENT_DATA_MAX_YEAR,
  ACCIDENT_DATA_MIN_YEAR,
  ACCIDENT_IMAGE_CONTEXT_PARAMS,
  accidentYearWindow,
  formatAccidentYearWindow,
} from "@/lib/accident-stats-year-window";

describe("ACCIDENT_IMAGE_CONTEXT_PARAMS", () => {
  it("shares the 300m and five-year product window", () => {
    expect(ACCIDENT_IMAGE_CONTEXT_PARAMS).toEqual({
      radiusMeters: 300,
      years: 5,
    });
  });
});

describe("dataset years", () => {
  it("covers the NPA open data through 2025 (令和7年)", () => {
    expect(ACCIDENT_DATA_MIN_YEAR).toBe(2019);
    expect(ACCIDENT_DATA_MAX_YEAR).toBe(2025);
  });
});

describe("accidentYearWindow", () => {
  it("counts five years back from the latest data year", () => {
    expect(accidentYearWindow(5)).toEqual({ minYear: 2021, maxYear: 2025 });
  });

  it("does not depend on the calendar year", () => {
    expect(accidentYearWindow(5, 2019, 2025)).toEqual(accidentYearWindow(5));
  });

  it("never reaches before the oldest data year", () => {
    expect(accidentYearWindow(20)).toEqual({ minYear: 2019, maxYear: 2025 });
  });

  it("falls back to five years for invalid input", () => {
    expect(accidentYearWindow(0)).toEqual({ minYear: 2021, maxYear: 2025 });
    expect(accidentYearWindow(Number.NaN)).toEqual({ minYear: 2021, maxYear: 2025 });
  });
});

describe("formatAccidentYearWindow", () => {
  it("formats a range and a single year", () => {
    expect(formatAccidentYearWindow({ minYear: 2021, maxYear: 2025 })).toBe("2021〜2025年");
    expect(formatAccidentYearWindow({ minYear: 2025, maxYear: 2025 })).toBe("2025年");
  });
});
