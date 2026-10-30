import type { CreateDangerReportInput } from '@/lib/db/repos/danger-reports.repo'

import municipalities from './gsi-municipalities.json'

// 国土地理院の逆ジオコーダ。キー不要で、市区町村コード(muniCd)を返す。
const GSI_REVERSE_GEOCODER_URL = 'https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress'
const DEFAULT_TIMEOUT_MS = 3_000
// 外部サービスへ送る座標は約100mに丸める(lib/map/reverse-geocode.ts と同じ方針)
const COORDINATE_DECIMALS = 3

// 値は [都道府県名, 市区町村名](scripts/generate-gsi-municipalities.mjs で生成)
const MUNICIPALITIES: Record<string, string[]> = municipalities

export interface GsiAddress {
  prefecture: string
  prefectureCode: number
  city: string
  municipalityCode: string
}

export interface GsiReverseGeocodeOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/** 市区町村コード(先頭0の有無は問わない)から都道府県・市区町村名を引く */
export function lookupGsiMunicipality(code: string): GsiAddress | null {
  if (!/^\d{4,5}$/.test(code)) return null
  const municipalityCode = code.padStart(5, '0')
  const entry = MUNICIPALITIES[municipalityCode]
  if (entry?.length !== 2) return null
  return {
    prefecture: entry[0],
    prefectureCode: Number(municipalityCode.slice(0, 2)),
    city: entry[1],
    municipalityCode,
  }
}

function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS
  return Math.round(value * factor) / factor
}

/** 座標から都道府県・市区町村を求める。日本の外・通信失敗・未知のコードは null */
export async function reverseGeocodeGsi(
  latitude: number,
  longitude: number,
  options: GsiReverseGeocodeOptions = {},
): Promise<GsiAddress | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null
  }
  const { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = options
  const params = new URLSearchParams({
    lat: String(roundCoordinate(latitude)),
    lon: String(roundCoordinate(longitude)),
  })
  try {
    const response = await fetchImpl(`${GSI_REVERSE_GEOCODER_URL}?${params}`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return null
    const body = await response.json() as { results?: { muniCd?: unknown } | null }
    const code = body.results?.muniCd
    return typeof code === 'string' ? lookupGsiMunicipality(code) : null
  } catch {
    return null
  }
}

/**
 * 都道府県が空の投稿に、サーバー側で住所を補う。
 * 都道府県が空だと地域で絞った一覧(ランディング・/report)に一切出なくなるため、
 * ブラウザ側の Mapbox 逆ジオコーディングが失敗したときの予備として使う。
 * 補えなかった場合も投稿自体は止めない。
 */
export async function withGsiAddressFallback(
  input: CreateDangerReportInput,
  options: GsiReverseGeocodeOptions = {},
): Promise<CreateDangerReportInput> {
  if (input.prefecture?.trim()) return input
  const address = await reverseGeocodeGsi(input.latitude, input.longitude, options)
  if (!address) return input
  return {
    ...input,
    prefecture: address.prefecture,
    prefectureCode: address.prefectureCode,
    city: address.city,
    municipalityCode: address.municipalityCode,
    geocodeSource: 'gsi',
    geocodedAt: new Date().toISOString(),
  }
}
