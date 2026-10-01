import { describe, expect, it } from 'vitest'

import {
  HONHYO_INSERT_HEADERS,
  honhyoInsertColumnIndex,
  honhyoRowToInsert,
  parseDmsLatitude,
  parseDmsLongitude,
} from '@/lib/traffic-accident/honhyo'

type Field = keyof typeof HONHYO_INSERT_HEADERS

// 実際の本票と同じく、全角スペース入りの見出しを順不同に並べて「見出し名で引く」ことを確かめる。
const HEADER = ['路線コード', ...Object.values(HONHYO_INSERT_HEADERS).reverse(), '祝日(発生年月日)']
const INDEX = honhyoInsertColumnIndex(HEADER)

// 2025年本票の1行目（北海道・札幌方面）を元にした行。
const BASE: Partial<Record<Field, string>> = {
  recordType: '1', prefectureCode: '10', policeStationCode: '059', recordNumber: '0001',
  accidentContent: '2', fatalities: '000', injuries: '004', municipalityCode: '103',
  year: '2025', month: '01', day: '02', hour: '11', minute: '50', dayNight: '12',
  weather: '1', terrain: '1', roadSurface: '2', roadShape: '14', signal: '7', roadWidth: '02',
  zoneRegulation: '70', sidewalk: '4', accidentType: '21', ageA: '35', ageB: '45',
  partyAType: '03', partyBType: '03', injuryA: '4', injuryB: '2',
  latitude: '430607590', longitude: '1412109644', dayOfWeek: '5',
}

function row(overrides: Partial<Record<Field, string>> = {}): string[] {
  const cells = new Array<string>(HEADER.length).fill('')
  for (const [key, value] of Object.entries({ ...BASE, ...overrides })) cells[INDEX[key as Field]] = value!
  return cells
}

describe('parseDmsLatitude / parseDmsLongitude', () => {
  it('converts 度分秒 digit strings to decimal degrees', () => {
    expect(parseDmsLatitude('430607590')).toBeCloseTo(43 + 6 / 60 + 7.59 / 3600, 9)
    expect(parseDmsLongitude('1412109644')).toBeCloseTo(141 + 21 / 60 + 9.644 / 3600, 9)
  })

  it('rejects malformed values and points outside Japan (NPA tool bounds)', () => {
    expect(parseDmsLatitude(null)).toBeNull()
    expect(parseDmsLatitude('')).toBeNull()
    expect(parseDmsLatitude('43060759')).toBeNull()
    expect(parseDmsLatitude('436007590')).toBeNull() // 60分
    expect(parseDmsLatitude('000000000')).toBeNull()
    expect(parseDmsLatitude('470000000')).toBeNull()
    expect(parseDmsLongitude('1210000000')).toBeNull()
    expect(parseDmsLongitude('1550000000')).toBeNull()
  })
})

describe('honhyoRowToInsert', () => {
  it('builds every traffic_accidents column from one 本票 row', () => {
    const result = honhyoRowToInsert(row(), 2025, INDEX)
    expect(result?.key).toEqual({ sourceYear: 2025, prefectureCode: 10, policeStationCode: '059', recordNumber: '0001' })
    expect(result?.values).toMatchObject({
      municipalityCode: '103',
      occurredAt: '2025-01-02T11:50:00+09:00',
      severityCode: 2,
      accidentTypeCode: '21',
      accidentTypeLabel: '車両相互',
      fatalities: 0,
      injuries: 4,
      involvesChild: false,
      involvesPedestrian: false,
      partyAAge: 35,
      partyBAge: 45,
      partyATypeLabel: '乗用車－普通車',
      dayNightCode: 12,
      dayOfWeek: 5,
      weatherCode: 1,
      weatherLabel: '晴',
      roadSurfaceLabel: '舗装－湿潤',
      injuryLevelB: '負傷',
    })
    expect(result?.values.latitude).toBeCloseTo(43.1021083, 6)
    expect(result?.values.longitude).toBeCloseTo(141.3526789, 6)
  })

  it('keeps the 0～24歳 age code as 1 so the existing young filter (age = 1) keeps working', () => {
    expect(honhyoRowToInsert(row({ ageA: '01' }), 2025, INDEX)?.values.partyAAge).toBe(1)
  })

  it('marks fatal accidents with severity code 1', () => {
    const result = honhyoRowToInsert(row({ accidentContent: '1', fatalities: '001' }), 2025, INDEX)
    expect(result?.values.severityCode).toBe(1)
    expect(result?.values.fatalities).toBe(1)
  })

  it('stores an impossible date as null instead of rolling it over', () => {
    expect(honhyoRowToInsert(row({ month: '02', day: '30' }), 2025, INDEX)?.values.occurredAt).toBeNull()
    expect(honhyoRowToInsert(row({ hour: '24' }), 2025, INDEX)?.values.occurredAt).toBeNull()
  })

  it('handles the JST day boundary without shifting the calendar date', () => {
    expect(honhyoRowToInsert(row({ day: '01', hour: '00', minute: '05' }), 2025, INDEX)?.values.occurredAt)
      .toBe('2025-01-01T00:05:00+09:00')
  })

  it('skips rows without usable coordinates or that are not 本票', () => {
    expect(honhyoRowToInsert(row({ latitude: '' }), 2025, INDEX)).toBeNull()
    expect(honhyoRowToInsert(row({ longitude: '0000000000' }), 2025, INDEX)).toBeNull()
    expect(honhyoRowToInsert(row({ recordType: '2' }), 2025, INDEX)).toBeNull()
  })

  it('leaves an unknown weather code as null', () => {
    expect(honhyoRowToInsert(row({ weather: '9' }), 2025, INDEX)?.values.weatherCode).toBeNull()
  })

  it('fails loudly when a required insert header is missing', () => {
    expect(() => honhyoInsertColumnIndex(['資料区分'])).toThrow('honhyo header missing')
  })
})
