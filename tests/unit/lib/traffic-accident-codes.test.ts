import { describe, expect, it } from 'vitest'

import {
  accidentClassFromCode,
  isPedestrianAccident,
  normalizeAccidentRow,
} from '@/lib/traffic-accident/codes'

describe('traffic accident codes (警察庁 本票)', () => {
  it('maps the 事故類型 major-class code to its label', () => {
    expect(accidentClassFromCode('01')).toBe('人対車両')
    expect(accidentClassFromCode('21')).toBe('車両相互')
    expect(accidentClassFromCode('41')).toBe('車両単独')
    expect(accidentClassFromCode('61')).toBe('列車')
    expect(accidentClassFromCode('1')).toBe('人対車両')
    expect(accidentClassFromCode(null)).toBeNull()
    expect(accidentClassFromCode('99')).toBeNull()
  })

  it('treats 人対車両 as pedestrian-involved', () => {
    expect(isPedestrianAccident({ accidentTypeCode: '01', involvesPedestrian: false })).toBe(true)
    expect(isPedestrianAccident({ accidentTypeCode: '21', involvesPedestrian: false })).toBe(false)
    expect(isPedestrianAccident({ accidentTypeCode: null, involvesPedestrian: true })).toBe(true)
  })

  it('replaces the fabricated detail label with the class derived from the code', () => {
    const row = { accidentTypeCode: '21', accidentTypeLabel: '車両相互_正面衝突', involvesPedestrian: false, id: 7 }
    const normalized = normalizeAccidentRow(row)
    expect(normalized).toEqual({ ...row, accidentTypeLabel: '車両相互', involvesPedestrian: false })
    expect(row.accidentTypeLabel).toBe('車両相互_正面衝突') // input is not mutated
  })

  it('keeps the stored label when the code is unknown', () => {
    const row = { accidentTypeCode: null, accidentTypeLabel: '事故類型_その他', involvesPedestrian: false }
    expect(normalizeAccidentRow(row).accidentTypeLabel).toBe('事故類型_その他')
  })

  it('marks 人対車両 rows as pedestrian-involved even when the stored flag is false', () => {
    const row = { accidentTypeCode: '01', accidentTypeLabel: '人対車両_横断中', involvesPedestrian: false }
    expect(normalizeAccidentRow(row)).toMatchObject({ accidentTypeLabel: '人対車両', involvesPedestrian: true })
  })
})
