import { describe, expect, it } from 'vitest'

import { HONHYO_HEADERS, honhyoColumnIndex, honhyoRowToBackfill } from '@/lib/traffic-accident/honhyo'

// 2020-2021 layout has fewer columns and different positions: build a shuffled header to prove lookup is by name.
const HEADER = ['事故内容', ...Object.values(HONHYO_HEADERS).reverse(), '上下線']
const INDEX = honhyoColumnIndex(HEADER)

function honhyoRow(overrides: Partial<Record<keyof typeof HONHYO_HEADERS, string>>): string[] {
  const row = new Array<string>(HEADER.length).fill('')
  const base: Partial<Record<keyof typeof HONHYO_HEADERS, string>> = {
    recordType: '1', prefectureCode: '30', policeStationCode: '104', recordNumber: '0008',
    weather: '1', terrain: '1', roadSurface: '1', roadShape: '14', signal: '7', roadWidth: '03',
    zoneRegulation: '70', sidewalk: '2', accidentType: '21', partyAType: '03', partyBType: '51',
    injuryA: '4', injuryB: '2',
  }
  for (const [key, value] of Object.entries({ ...base, ...overrides })) {
    row[INDEX[key as keyof typeof HONHYO_HEADERS]] = value!
  }
  return row
}

describe('honhyoRowToBackfill', () => {
  it('builds the match key and decodes the codes using the NPA codebook', () => {
    const result = honhyoRowToBackfill(honhyoRow({}), 2024, INDEX)
    expect(result).toEqual({
      key: { sourceYear: 2024, prefectureCode: 30, policeStationCode: '104', recordNumber: '0008' },
      values: {
        accidentTypeLabel: '車両相互',
        involvesPedestrian: false,
        partyATypeCode: '03',
        partyATypeLabel: '乗用車－普通車',
        partyBTypeCode: '51',
        partyBTypeLabel: '軽車両－自転車',
        roadSurfaceCode: 1,
        roadSurfaceLabel: '舗装－乾燥',
        roadShapeCode: '14',
        roadShapeLabel: '単路－その他',
        sidewalkCode: '2',
        sidewalkLabel: '区分あり－縁石・ブロック等',
        terrainCode: 1,
        terrainLabel: '市街地－人口集中',
        weatherLabel: '晴',
        signalCode: '7',
        roadWidthCode: '03',
        zoneRegulationCode: '70',
        injuryLevelA: '損傷なし',
        injuryLevelB: '負傷',
      },
    })
  })

  it('marks pedestrian involvement from 人対車両 or a 歩行者 party', () => {
    expect(honhyoRowToBackfill(honhyoRow({ accidentType: '01', partyBType: '03' }), 2024, INDEX)?.values.involvesPedestrian).toBe(true)
    expect(honhyoRowToBackfill(honhyoRow({ accidentType: '21', partyBType: '61' }), 2024, INDEX)?.values.involvesPedestrian).toBe(true)
  })

  it('decodes icy / snowy road surfaces', () => {
    expect(honhyoRowToBackfill(honhyoRow({ roadSurface: '3' }), 2024, INDEX)?.values.roadSurfaceLabel).toBe('舗装－凍結')
    expect(honhyoRowToBackfill(honhyoRow({ roadSurface: '4' }), 2024, INDEX)?.values.roadSurfaceLabel).toBe('舗装－積雪')
  })

  it('leaves unknown codes as null labels instead of inventing one', () => {
    const result = honhyoRowToBackfill(honhyoRow({ partyAType: '99', roadSurface: '' }), 2024, INDEX)
    expect(result?.values.partyATypeCode).toBe('99')
    expect(result?.values.partyATypeLabel).toBeNull()
    expect(result?.values.roadSurfaceCode).toBeNull()
    expect(result?.values.roadSurfaceLabel).toBeNull()
  })

  it('fails loudly when a required header is missing', () => {
    expect(() => honhyoColumnIndex(['資料区分', '都道府県コード'])).toThrow('honhyo header missing')
  })

  it('skips non-本票 rows and rows without a record key', () => {
    expect(honhyoRowToBackfill(honhyoRow({ recordType: '2' }), 2024, INDEX)).toBeNull()
    expect(honhyoRowToBackfill(honhyoRow({ recordNumber: '' }), 2024, INDEX)).toBeNull()
  })
})
