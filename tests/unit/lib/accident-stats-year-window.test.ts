import { describe, expect, it } from "vitest";
import {
  adjustYearsForAccidentDataset,
  normalizeSummaryYearText,
} from "@/lib/accident-stats-year-window";

describe("adjustYearsForAccidentDataset", () => {
  it("shifts 5 years to 8 years when current year is 2026 and dataset max is 2023", () => {
    expect(adjustYearsForAccidentDataset(5, 2026, 2018, 2023)).toBe(8);
  });

  it("keeps 5 years when current year equals dataset max year", () => {
    expect(adjustYearsForAccidentDataset(5, 2023, 2018, 2023)).toBe(5);
  });

  it("caps request so it does not go before dataset min year", () => {
    expect(adjustYearsForAccidentDataset(20, 2026, 2018, 2023)).toBe(9);
  });
});

describe("normalizeSummaryYearText", () => {
  it("replaces backend year phrase with requested years text", () => {
    expect(
      normalizeSummaryYearText("4件の事故が過去8年間に半径300m以内で発生", 5)
    ).toBe("4件の事故が過去5年間に半径300m以内で発生");
  });
});

