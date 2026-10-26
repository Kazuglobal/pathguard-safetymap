import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { localAlertDistricts, localAlertLocations, schoolDistrictBoundaries, schoolDistricts } from '../schema'
import { isInsideSchoolDistrict, type SchoolDistrictOptions } from '@/lib/school-districts'

export function createSchoolDistrictRepo(db: AppDb) {
  return {
    async options(actor: Actor, prefecture: string, city?: string): Promise<SchoolDistrictOptions> {
      assertCan(actor, 'select', 'school_districts')
      const cities = await db.selectDistinct({ city: schoolDistricts.city }).from(schoolDistricts)
        .where(eq(schoolDistricts.prefecture, prefecture)).orderBy(asc(schoolDistricts.city))
      const districts = city ? await db.select().from(schoolDistricts)
        .where(and(eq(schoolDistricts.prefecture, prefecture), eq(schoolDistricts.city, city)))
        .orderBy(asc(schoolDistricts.name), asc(schoolDistricts.id)) : []
      return { cities: cities.map(row => row.city), districts }
    },
    async get(actor: Actor, id: string) {
      assertCan(actor, 'select', 'school_districts')
      const [district] = await db.select().from(schoolDistricts).where(eq(schoolDistricts.id, id)).limit(1)
      return district ?? null
    },
    async associate(actor: Actor, alertId: string, location: {
      address: string | null; evidence: string | null; sourceUrl: string | null
      longitude: number | null; latitude: number | null; status: string
    }, prefecture: string) {
      assertCan(actor, 'insert', 'local_alert_locations')
      const { longitude, latitude } = location
      const districtIds: string[] = []
      if (location.status === 'verified' && longitude !== null && latitude !== null) {
        const candidates = await db.select({ districtId: schoolDistrictBoundaries.districtId, geometry: schoolDistrictBoundaries.geometry })
          .from(schoolDistrictBoundaries).innerJoin(schoolDistricts, eq(schoolDistricts.id, schoolDistrictBoundaries.districtId))
          .where(and(eq(schoolDistricts.prefecture, prefecture),
            lte(schoolDistrictBoundaries.minLng, longitude), gte(schoolDistrictBoundaries.maxLng, longitude),
            lte(schoolDistrictBoundaries.minLat, latitude), gte(schoolDistrictBoundaries.maxLat, latitude)))
        const grouped = new Map<string, typeof candidates[number]['geometry'][]>()
        for (const row of candidates) grouped.set(row.districtId, [...(grouped.get(row.districtId) ?? []), row.geometry])
        for (const [id, geometries] of grouped) if (isInsideSchoolDistrict(longitude, latitude, geometries)) districtIds.push(id)
      }
      const status = location.status === 'verified' && !districtIds.length ? 'no_district_match' : location.status
      // D1 batch is atomic: a failed reassessment cannot leave stale matches visible.
      const statements: Parameters<AppDb['batch']>[0] = [
        db.delete(localAlertDistricts).where(eq(localAlertDistricts.alertId, alertId)),
        db.insert(localAlertLocations).values({ alertId, ...location, status, checkedAt: new Date().toISOString() })
          .onConflictDoUpdate({ target: localAlertLocations.alertId, set: { ...location, status, checkedAt: new Date().toISOString() } }),
      ]
      if (districtIds.length) await db.batch([...statements, db.insert(localAlertDistricts).values(districtIds.map(districtId => ({ alertId, districtId })))])
      else await db.batch(statements)
      return { status, matched: districtIds.length }
    },
  }
}

export function getSchoolDistrictOptions(actor: Actor, prefecture: string, city?: string) { return createSchoolDistrictRepo(getDb()).options(actor, prefecture, city) }
export function getSchoolDistrict(actor: Actor, id: string) { return createSchoolDistrictRepo(getDb()).get(actor, id) }
