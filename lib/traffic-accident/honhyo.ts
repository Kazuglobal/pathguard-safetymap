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
