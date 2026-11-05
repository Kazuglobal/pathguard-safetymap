/**
 * Google アナリティクス(GA4)の測定ID。環境変数 NEXT_PUBLIC_GA_MEASUREMENT_ID(ビルド時に埋め込む)から読む。
 * 形が正しくない値は使わない(<script> に埋めるため。値がないときは何も読み込まない)。
 */
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/

export function readGaMeasurementId(value: string | undefined | null): string | null {
  const trimmed = value?.trim() ?? ""
  return MEASUREMENT_ID_PATTERN.test(trimmed) ? trimmed : null
}

export const GA_MEASUREMENT_ID = readGaMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)
