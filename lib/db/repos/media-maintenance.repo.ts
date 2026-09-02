import { inArray, lte, sql } from 'drizzle-orm'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { dangerReports, hunterPhotos, reportImages } from '../schema'

const KEY_CHUNK_SIZE = 50
const HUNTER_DELETE_LIMIT = 200

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

export function createMediaMaintenanceRepo(db: AppDb) {
  return {
    async findReferencedKeys(actor: Actor, candidateKeys: readonly string[]): Promise<Set<string>> {
      assertCan(actor, 'select', 'danger_reports')
      const candidates = [...new Set(candidateKeys.filter(Boolean))]
      if (candidates.length > 500) throw new RangeError('At most 500 candidate keys are allowed')

      const referenced = new Set<string>()
      for (const keyChunk of chunks(candidates, KEY_CHUNK_SIZE)) {
        const [originals, processedSingles, images] = await Promise.all([
          db.select({ key: dangerReports.imageKey }).from(dangerReports)
            .where(inArray(dangerReports.imageKey, keyChunk)),
          db.select({ key: dangerReports.processedImageKey }).from(dangerReports)
            .where(inArray(dangerReports.processedImageKey, keyChunk)),
          db.select({ key: reportImages.imageKey }).from(reportImages)
            .where(inArray(reportImages.imageKey, keyChunk)),
        ])
        for (const row of [...originals, ...processedSingles, ...images]) {
          if (row.key) referenced.add(row.key)
        }

        const parameters = sql.join(keyChunk.map((key) => sql`${key}`), sql`, `)
        const arrayKeys = await db.all<{ key: string }>(sql`
          select cast(json_each.value as text) as key
          from ${dangerReports}, json_each(${dangerReports.processedImageKeys})
          where cast(json_each.value as text) in (${parameters})
        `)
        for (const row of arrayKeys) referenced.add(row.key)
      }
      return referenced
    },

    async listExpiredHunterRows(actor: Actor, now = new Date()) {
      assertCan(actor, 'select', 'hunter_photos')
      return db.select({
        id: hunterPhotos.id,
        imageKey: hunterPhotos.imageKey,
      }).from(hunterPhotos).where(lte(hunterPhotos.retentionUntil, now.toISOString()))
        .limit(HUNTER_DELETE_LIMIT)
    },

    async deleteHunterRows(actor: Actor, ids: readonly string[]): Promise<void> {
      assertCan(actor, 'delete', 'hunter_photos')
      const uniqueIds = [...new Set(ids.filter(Boolean))]
      if (uniqueIds.length === 0) return
      if (uniqueIds.length > HUNTER_DELETE_LIMIT) throw new RangeError('Too many hunter photo ids')
      await db.delete(hunterPhotos).where(inArray(hunterPhotos.id, uniqueIds))
    },
  }
}

export function findReferencedKeys(actor: Actor, candidateKeys: readonly string[]) {
  return createMediaMaintenanceRepo(getDb()).findReferencedKeys(actor, candidateKeys)
}

export function listExpiredHunterRows(actor: Actor, now?: Date) {
  return createMediaMaintenanceRepo(getDb()).listExpiredHunterRows(actor, now)
}

export function deleteHunterRows(actor: Actor, ids: readonly string[]) {
  return createMediaMaintenanceRepo(getDb()).deleteHunterRows(actor, ids)
}
