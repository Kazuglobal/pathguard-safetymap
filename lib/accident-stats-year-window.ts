export const ACCIDENT_DATA_MIN_YEAR = 2018;
export const ACCIDENT_DATA_MAX_YEAR = 2024;
export const DEFAULT_ACCIDENT_YEARS = 5;

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

/**
 * Backend RPC currently calculates year window from current calendar year.
 * Our dataset ends at ACCIDENT_DATA_MAX_YEAR, so we shift requested years
 * forward by the gap to keep the effective window anchored to dataset years.
 */
export function adjustYearsForAccidentDataset(
  requestedYears: number,
  currentYear: number = new Date().getFullYear(),
  minYear: number = ACCIDENT_DATA_MIN_YEAR,
  maxYear: number = ACCIDENT_DATA_MAX_YEAR
): number {
  const safeRequested = toPositiveInt(requestedYears, DEFAULT_ACCIDENT_YEARS);
  const safeCurrent = toPositiveInt(currentYear, maxYear);
  const safeMin = toPositiveInt(minYear, ACCIDENT_DATA_MIN_YEAR);
  const safeMax = toPositiveInt(maxYear, ACCIDENT_DATA_MAX_YEAR);

  const gap = Math.max(0, safeCurrent - safeMax);
  const maxDatasetYears = Math.max(1, safeMax - safeMin + 1);
  return Math.min(safeRequested + gap, maxDatasetYears + gap);
}

export function normalizeSummaryYearText(text: string, years: number): string {
  if (!text) return text;
  return text.replace(/過去\s*\d+\s*年(?:間)?/g, `過去${years}年間`);
}

