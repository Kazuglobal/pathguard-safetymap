// =============================================
// 警察庁 交通事故統計オープンデータ「本票」CSV → traffic_accidents 補正値
//
// 既存の traffic_accidents は当事者種別・路面状態・歩車道区分などが空で、事故類型ラベルも誤っている。
// 本票 CSV の1行から、行を特定するキーと、コード表で解読した補正値を作る（純粋関数）。
// 子ども（15歳以下）は本票の年齢区分（最小が 0～24歳）では判別できないため扱わない。
// =============================================

import codebook from './npa-codebook.json'
import { accidentClassFromCode } from './codes'

/** 本票 CSV の見出し名。年によって列の位置が違う（2020-2021 は58列、2022以降は68列）ので見出しで引く。 */
export const HONHYO_HEADERS = {
  recordType: '資料区分',
  prefectureCode: '都道府県コード',
  policeStationCode: '警察署等コード',
  recordNumber: '本票番号',
  weather: '天候',
  terrain: '地形',
  roadSurface: '路面状態',
  roadShape: '道路形状',
  signal: '信号機',
  roadWidth: '車道幅員',
  zoneRegulation: 'ゾーン規制',
  sidewalk: '歩車道区分',
  accidentType: '事故類型',
  partyAType: '当事者種別（当事者A）',
  partyBType: '当事者種別（当事者B）',
  injuryA: '人身損傷程度（当事者A）',
  injuryB: '人身損傷程度（当事者B）',
} as const

export type HonhyoField = keyof typeof HONHYO_HEADERS
export type HonhyoColumnIndex = Record<HonhyoField, number>

/** 見出し行から各項目の列位置を求める。必須の見出しが無ければエラー。 */
export function honhyoColumnIndex(header: readonly string[]): HonhyoColumnIndex {
  const trimmed = header.map((name) => name.trim())
  const index = {} as HonhyoColumnIndex
  for (const [field, name] of Object.entries(HONHYO_HEADERS) as Array<[HonhyoField, string]>) {
    const position = trimmed.indexOf(name)
    if (position < 0) throw new Error(`honhyo header missing: ${name}`)
    index[field] = position
  }
  return index
}

const PEDESTRIAN_PARTY_CODE = '61'

type CodeTable = Record<string, string>
const tables = codebook as unknown as Record<string, CodeTable>

export interface HonhyoKey {
  sourceYear: number
  prefectureCode: number
  policeStationCode: string
  recordNumber: string
}

export interface HonhyoBackfillValues {
  accidentTypeLabel: string | null
  involvesPedestrian: boolean
  partyATypeCode: string | null
  partyATypeLabel: string | null
  partyBTypeCode: string | null
  partyBTypeLabel: string | null
  roadSurfaceCode: number | null
  roadSurfaceLabel: string | null
  roadShapeCode: string | null
  roadShapeLabel: string | null
  sidewalkCode: string | null
  sidewalkLabel: string | null
  terrainCode: number | null
  terrainLabel: string | null
  weatherLabel: string | null
  signalCode: string | null
  roadWidthCode: string | null
  zoneRegulationCode: string | null
  injuryLevelA: string | null
  injuryLevelB: string | null
}

function cell(row: readonly string[], column: number): string | null {
  const value = (row[column] ?? '').trim()
  return value === '' ? null : value
}

function label(table: string, code: string | null): string | null {
  if (code == null) return null
  return tables[table]?.[code] ?? null
}

function intOrNull(code: string | null): number | null {
  if (code == null || !/^\d+$/.test(code)) return null
  return Number(code)
}

/** 本票の1行を補正値に変換する。本票以外・キー欠落は null。 */
export function honhyoRowToBackfill(
  row: readonly string[],
  sourceYear: number,
  c: HonhyoColumnIndex,
): { key: HonhyoKey; values: HonhyoBackfillValues } | null {
  if (cell(row, c.recordType) !== '1') return null
  const prefecture = intOrNull(cell(row, c.prefectureCode))
  const station = cell(row, c.policeStationCode)
  const recordNumber = cell(row, c.recordNumber)
  if (prefecture == null || station == null || recordNumber == null) return null

  const accidentType = cell(row, c.accidentType)
  const partyA = cell(row, c.partyAType)
  const partyB = cell(row, c.partyBType)
  const surface = cell(row, c.roadSurface)
  const terrain = cell(row, c.terrain)
  const shape = cell(row, c.roadShape)
  const sidewalk = cell(row, c.sidewalk)

  return {
    key: { sourceYear, prefectureCode: prefecture, policeStationCode: station, recordNumber },
    values: {
      accidentTypeLabel: accidentClassFromCode(accidentType),
      involvesPedestrian: accidentClassFromCode(accidentType) === '人対車両'
        || partyA === PEDESTRIAN_PARTY_CODE || partyB === PEDESTRIAN_PARTY_CODE,
      partyATypeCode: partyA,
      partyATypeLabel: label('party_type', partyA),
      partyBTypeCode: partyB,
      partyBTypeLabel: label('party_type', partyB),
      roadSurfaceCode: label('road_surface', surface) ? intOrNull(surface) : null,
      roadSurfaceLabel: label('road_surface', surface),
      roadShapeCode: shape,
      roadShapeLabel: label('road_shape', shape),
      sidewalkCode: sidewalk,
      sidewalkLabel: label('sidewalk', sidewalk),
      terrainCode: label('terrain', terrain) ? intOrNull(terrain) : null,
      terrainLabel: label('terrain', terrain),
      weatherLabel: label('weather', cell(row, c.weather)),
      signalCode: cell(row, c.signal),
      roadWidthCode: cell(row, c.roadWidth),
      zoneRegulationCode: cell(row, c.zoneRegulation),
      injuryLevelA: label('injury_level', cell(row, c.injuryA)),
      injuryLevelB: label('injury_level', cell(row, c.injuryB)),
    },
  }
}

// ---------------------------------------------
// 新しい年の本票を traffic_accidents へ追加するための全列変換
// ---------------------------------------------

/** INSERT に追加で必要な見出し（発生日時・緯度経度などは全角スペース入りの見出し名）。 */
export const HONHYO_INSERT_HEADERS = {
  ...HONHYO_HEADERS,
  accidentContent: '事故内容',
  fatalities: '死者数',
  injuries: '負傷者数',
  municipalityCode: '市区町村コード',
  year: '発生日時　　年',
  month: '発生日時　　月',
  day: '発生日時　　日',
  hour: '発生日時　　時',
  minute: '発生日時　　分',
  dayNight: '昼夜',
  ageA: '年齢（当事者A）',
  ageB: '年齢（当事者B）',
  latitude: '地点　緯度（北緯）',
  longitude: '地点　経度（東経）',
  dayOfWeek: '曜日(発生年月日)',
} as const

export type HonhyoInsertField = keyof typeof HONHYO_INSERT_HEADERS
export type HonhyoInsertColumnIndex = Record<HonhyoInsertField, number>

/** 見出し行から INSERT 用の列位置を求める。必須の見出しが無ければエラー。 */
export function honhyoInsertColumnIndex(header: readonly string[]): HonhyoInsertColumnIndex {
  const trimmed = header.map((name) => name.trim())
  const index = {} as HonhyoInsertColumnIndex
  for (const [field, name] of Object.entries(HONHYO_INSERT_HEADERS) as Array<[HonhyoInsertField, string]>) {
    const position = trimmed.indexOf(name)
    if (position < 0) throw new Error(`honhyo header missing: ${name}`)
    index[field] = position
  }
  return index
}

/** 警察庁ツールと同じく、日本（離島含む）の外に落ちる座標は除外する。 */
export const JAPAN_BOUNDS = { minLat: 20, maxLat: 46, minLng: 122, maxLng: 154 } as const

/** 度分秒の数字列（度は degreeDigits 桁、分2桁、秒2桁、ミリ秒3桁）を十進の度に変換する。 */
function parseDms(value: string | null, degreeDigits: number): number | null {
  if (value == null || value.length !== degreeDigits + 7 || !/^\d+$/.test(value)) return null
  const degrees = Number(value.slice(0, degreeDigits))
  const minutes = Number(value.slice(degreeDigits, degreeDigits + 2))
  const seconds = Number(value.slice(degreeDigits + 2)) / 1000
  if (minutes >= 60 || seconds >= 60) return null
  return degrees + minutes / 60 + seconds / 3600
}

/** 例: '430607590' → 43°06'07.590" → 43.10210833… 範囲外・不正は null。 */
export function parseDmsLatitude(value: string | null): number | null {
  const lat = parseDms(value, 2)
  if (lat == null || lat < JAPAN_BOUNDS.minLat || lat > JAPAN_BOUNDS.maxLat) return null
  return lat
}

/** 例: '1412109599' → 141°21'09.599" 範囲外・不正は null。 */
export function parseDmsLongitude(value: string | null): number | null {
  const lng = parseDms(value, 3)
  if (lng == null || lng < JAPAN_BOUNDS.minLng || lng > JAPAN_BOUNDS.maxLng) return null
  return lng
}

/** 発生日時（日本時間）を ISO 8601（+09:00）にする。日付として不正なら null。 */
function occurredAtIso(year: string | null, month: string | null, day: string | null,
  hour: string | null, minute: string | null): string | null {
  const parts = [year, month, day, hour, minute]
  if (parts.some((part) => part == null || !/^\d+$/.test(part))) return null
  const [y, mo, d, h, mi] = parts.map(Number)
  const utc = new Date(Date.UTC(y, mo - 1, d, h - 9, mi))
  const check = new Date(utc.valueOf() + 9 * 3600_000)
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d
    || check.getUTCHours() !== h || check.getUTCMinutes() !== mi) return null
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  return `${pad(y, 4)}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00+09:00`
}

export interface HonhyoInsertValues extends HonhyoBackfillValues {
  municipalityCode: string | null
  latitude: number
  longitude: number
  occurredAt: string | null
  severityCode: number | null
  accidentTypeCode: string | null
  fatalities: number | null
  injuries: number | null
  /** 本票の年齢は最小区分が 0～24歳 なので、子ども（15歳以下）は判別できない。常に false。 */
  involvesChild: false
  partyAAge: number | null
  partyBAge: number | null
  dayNightCode: number | null
  dayOfWeek: number | null
  weatherCode: number | null
}

/** 本票の1行を traffic_accidents の1行（id・imported_at 以外の全列）に変換する。本票以外・キー欠落・座標不正は null。 */
export function honhyoRowToInsert(
  row: readonly string[],
  sourceYear: number,
  c: HonhyoInsertColumnIndex,
): { key: HonhyoKey; values: HonhyoInsertValues } | null {
  const base = honhyoRowToBackfill(row, sourceYear, c)
  if (!base) return null
  const latitude = parseDmsLatitude(cell(row, c.latitude))
  const longitude = parseDmsLongitude(cell(row, c.longitude))
  if (latitude == null || longitude == null) return null

  const weather = cell(row, c.weather)
  return {
    key: base.key,
    values: {
      ...base.values,
      municipalityCode: cell(row, c.municipalityCode),
      latitude,
      longitude,
      occurredAt: occurredAtIso(cell(row, c.year), cell(row, c.month), cell(row, c.day),
        cell(row, c.hour), cell(row, c.minute)),
      severityCode: intOrNull(cell(row, c.accidentContent)),
      accidentTypeCode: cell(row, c.accidentType),
      fatalities: intOrNull(cell(row, c.fatalities)),
      injuries: intOrNull(cell(row, c.injuries)),
      involvesChild: false,
      partyAAge: intOrNull(cell(row, c.ageA)),
      partyBAge: intOrNull(cell(row, c.ageB)),
      dayNightCode: intOrNull(cell(row, c.dayNight)),
      dayOfWeek: intOrNull(cell(row, c.dayOfWeek)),
      weatherCode: label('weather', weather) ? intOrNull(weather) : null,
    },
  }
}
