export const ACCIDENT_DATA_MIN_YEAR = 2019;
export const ACCIDENT_DATA_MAX_YEAR = 2025;
export const DEFAULT_ACCIDENT_YEARS = 5;
export const ACCIDENT_IMAGE_CONTEXT_PARAMS = {
  radiusMeters: 300,
  years: DEFAULT_ACCIDENT_YEARS,
} as const;

export interface AccidentYearWindow {
  minYear: number;
  maxYear: number;
}

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
 * 「過去N年」を、今年ではなくデータの最新年から数えた年の範囲にする。
 * 例: 最新年2025・5年 → 2021〜2025。データの最古年より前には広げない。
 */
export function accidentYearWindow(
  requestedYears: number = DEFAULT_ACCIDENT_YEARS,
  minYear: number = ACCIDENT_DATA_MIN_YEAR,
  maxYear: number = ACCIDENT_DATA_MAX_YEAR
): AccidentYearWindow {
  const years = toPositiveInt(requestedYears, DEFAULT_ACCIDENT_YEARS);
  return { minYear: Math.max(minYear, maxYear - years + 1), maxYear };
}

/** 統計結果の search_params から「（2021〜2025年）」を作る。範囲が無い古いキャッシュは空文字。 */
export function statsYearRangeSuffix(params: { min_year?: number; max_year?: number }): string {
  if (params.min_year == null || params.max_year == null) return "";
  return `（${formatAccidentYearWindow({ minYear: params.min_year, maxYear: params.max_year })}）`;
}

/** 表示用: 「2021〜2025年」 */
export function formatAccidentYearWindow(window: AccidentYearWindow): string {
  return window.minYear === window.maxYear
    ? `${window.maxYear}年`
    : `${window.minYear}〜${window.maxYear}年`;
}
