import { describe, expect, it } from 'vitest'
import { accidentStatsIntegrityError } from '@/lib/traffic-accident/stats-integrity'

const valid = {
  total_accidents: 1, fatal_accidents: 1, total_fatalities: 1, total_injuries: 0,
  child_involved: 0, pedestrian_involved: 0, risk_score: 50,
  search_params: { latitude: 35, longitude: 139, radius_meters: 300, years: 5, min_year: 2021, max_year: 2025 },
  nearest_accidents: [],
}
const record = { severity: 'fatal', fatalities: 1, injuries: 0, latitude: 35, longitude: 139, distance_m: 10, year: 2024 }

describe('accident stats integrity', () => {
  it.each([
    { ...valid, fatal_accidents: 0 },
    { ...valid, total_accidents: 0, fatal_accidents: 0, total_fatalities: 0, total_injuries: 1 },
    { ...valid, risk_score: Number.NaN },
    { ...valid, nearest_accidents: [{ ...record, longitude: 181 }] },
    { ...valid, nearest_accidents: [{ ...record, year: undefined }] },
    { ...valid, accident_records: [record], records_truncated: false, nearest_accidents: [{ ...record, fatalities: 2 }] },
  ])('rejects contradictory or malformed data before showing an exact count', (stats) => {
    expect(accidentStatsIntegrityError(stats)).toMatch(/整合性/)
  })

  it('accepts a consistent complete list containing a fatal accident', () => {
    expect(accidentStatsIntegrityError({ ...valid, accident_records: [record], records_truncated: false })).toBeNull()
  })
})
