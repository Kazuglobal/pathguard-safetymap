import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { localSafetyAlerts } from '@/lib/db/schema'
import { getServiceActor } from '@/lib/auth/service-actor'
import { createSchoolDistrictRepo } from '@/lib/db/repos/school-districts.repo'
import { assessAlertLocation } from '@/lib/local-alert-location'

export async function associateLocalAlertDistricts(ids: readonly string[]) {
  const db = getDb()
  const repo = createSchoolDistrictRepo(db)
  const counts = { checked: 0, matched: 0, unmatched: 0, failed: 0 }
  // Bounded concurrency keeps source/geocoder load small; callers can use waitUntil.
  for (let offset = 0; offset < ids.length; offset += 2) {
    await Promise.all(ids.slice(offset, offset + 2).map(async id => {
      try {
        const [row] = await db.select().from(localSafetyAlerts).where(eq(localSafetyAlerts.id, id)).limit(1)
        if (!row) return
        const location = await assessAlertLocation({ prefecture: row.prefecture, city: row.city ?? '', category: row.category as 'suspicious' | 'voice_call' | 'following' | 'other', description: row.description, source_url: row.sourceUrl, occurred_at: row.occurredAt })
        const association = await repo.associate(getServiceActor(), id, location, row.prefecture)
        counts.checked++
        if (association.matched) counts.matched++; else counts.unmatched++
      } catch { counts.failed++ }
    }))
  }
  console.info('[local-alert-districts]', counts)
  return counts
}
