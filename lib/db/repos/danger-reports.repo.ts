import { and, desc, eq, gte, inArray, lte, or, sql, type SQL } from 'drizzle-orm'

import { assertCan, AuthzError, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { dangerReports, reportImages } from '../schema'

const IMAGE_REOPEN_REASON = 'AI承認後に画像が追加されたため、人間の確認に差し戻しました。'

export interface CreateDangerReportInput {
  title: string
  description?: string | null
  dangerType: string
  dangerLevel: number
  latitude: number
  longitude: number
  prefecture?: string | null
  prefectureCode?: number | null
  city?: string | null
  municipalityCode?: string | null
  town?: string | null
  postalCode?: string | null
  geocodeSource?: 'mapbox' | 'gsi' | 'osm' | 'manual' | 'batch' | null
  geocodeConfidence?: number | null
  geocodedAt?: string | null
  addressHash?: string | null
  alertRadiusM?: number | null
}

export interface DangerReportListInput {
  statuses?: readonly string[]
  ownerId?: string
  prefecture?: string
  city?: string
  dangerType?: string
  minimumDangerLevel?: number
  exactDangerLevel?: number
  createdAfter?: string
  bounds?: { minLng: number; minLat: number; maxLng: number; maxLat: number }
  limit?: number
}

function validateListInput(input: DangerReportListInput): number {
  const limit = Math.min(2_000, Math.max(1, Math.trunc(input.limit ?? 500)))
  if (input.statuses && (input.statuses.length === 0 || input.statuses.length > 10)) {
    throw new RangeError('Invalid statuses')
  }
  if (input.bounds) {
    const { minLng, minLat, maxLng, maxLat } = input.bounds
    if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)
      || minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90
      || minLng > maxLng || minLat > maxLat) {
      throw new RangeError('Invalid bounds')
    }
  }
  return limit
}

function validateCreate(input: CreateDangerReportInput): void {
  if (!input.title.trim() || input.title.length > 200) throw new RangeError('Invalid title')
  if (input.description != null && input.description.length > 5_000) throw new RangeError('Invalid description')
  if (!/^[a-z0-9_-]{1,64}$/i.test(input.dangerType)) throw new RangeError('Invalid dangerType')
  if (!Number.isInteger(input.dangerLevel) || input.dangerLevel < 1 || input.dangerLevel > 5) {
    throw new RangeError('Invalid dangerLevel')
  }
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90
    || !Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new RangeError('Invalid coordinates')
  }
  if (input.alertRadiusM != null && (!Number.isFinite(input.alertRadiusM)
    || input.alertRadiusM < 1 || input.alertRadiusM > 10_000)) {
    throw new RangeError('Invalid alertRadiusM')
  }
  if (input.geocodeConfidence != null && (!Number.isFinite(input.geocodeConfidence)
    || input.geocodeConfidence < 0 || input.geocodeConfidence > 1)) {
    throw new RangeError('Invalid geocodeConfidence')
  }
  const boundedStrings: Array<[string | null | undefined, number]> = [
    [input.prefecture, 100], [input.city, 100], [input.town, 200],
    [input.municipalityCode, 32], [input.postalCode, 20],
    [input.addressHash, 256], [input.geocodedAt, 64],
  ]
  if (boundedStrings.some(([value, maximum]) => value != null && value.length > maximum)) {
    throw new RangeError('Address field is too long')
  }
  if (input.prefectureCode != null && (!Number.isInteger(input.prefectureCode)
    || input.prefectureCode < 1 || input.prefectureCode > 99)) {
    throw new RangeError('Invalid prefectureCode')
  }
}

export function createDangerReportsRepo(db: AppDb) {
  return {
    async list(actor: Actor, input: DangerReportListInput = {}) {
      const limit = validateListInput(input)
      const predicates: SQL[] = []
      if (input.statuses) predicates.push(inArray(dangerReports.status, [...input.statuses]))
      if (input.ownerId) predicates.push(eq(dangerReports.userId, input.ownerId))
      if (input.prefecture) predicates.push(eq(dangerReports.prefecture, input.prefecture))
      if (input.city) predicates.push(eq(dangerReports.city, input.city))
      if (input.dangerType) predicates.push(eq(dangerReports.dangerType, input.dangerType))
      if (input.minimumDangerLevel != null) predicates.push(gte(dangerReports.dangerLevel, input.minimumDangerLevel))
      if (input.exactDangerLevel != null) predicates.push(eq(dangerReports.dangerLevel, input.exactDangerLevel))
      if (input.createdAfter) predicates.push(gte(dangerReports.createdAt, input.createdAfter))
      if (input.bounds) {
        predicates.push(
          gte(dangerReports.longitude, input.bounds.minLng),
          lte(dangerReports.longitude, input.bounds.maxLng),
          gte(dangerReports.latitude, input.bounds.minLat),
          lte(dangerReports.latitude, input.bounds.maxLat),
        )
      }

      if (actor.kind === 'anon') {
        predicates.push(inArray(dangerReports.status, ['approved', 'published', 'resolved']))
      } else if (actor.kind === 'user' && !actor.isAdmin) {
        predicates.push(or(
          inArray(dangerReports.status, ['approved', 'published', 'resolved']),
          eq(dangerReports.userId, actor.id),
        )!)
        if (input.ownerId && input.ownerId !== actor.id) throw new AuthzError('select', 'danger_reports')
      }
      assertCan(actor, 'select', 'danger_reports', actor.kind === 'anon'
        ? { publicPreview: true }
        : actor.kind === 'user'
          ? { ownerId: input.ownerId ?? actor.id, status: input.statuses?.[0] ?? 'approved' }
          : {})
      return db.select().from(dangerReports)
        .where(predicates.length ? and(...predicates) : undefined)
        .orderBy(desc(dangerReports.createdAt)).limit(limit)
    },

    async getById(actor: Actor, reportId: string) {
      const [report] = await db.select().from(dangerReports)
        .where(eq(dangerReports.id, reportId)).limit(1)
      if (!report) return null
      assertCan(actor, 'select', 'danger_reports', { ownerId: report.userId, status: report.status })
      return report
    },

    async create(actor: Actor, input: CreateDangerReportInput) {
      if (actor.kind !== 'user') {
        assertCan(actor, 'insert', 'danger_reports')
        throw new Error('A user actor is required')
      }
      assertCan(actor, 'insert', 'danger_reports', { ownerId: actor.id, status: 'pending' })
      validateCreate(input)

      const [created] = await db.insert(dangerReports).values({
        id: crypto.randomUUID(),
        userId: actor.id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        dangerType: input.dangerType,
        dangerLevel: input.dangerLevel,
        latitude: input.latitude,
        longitude: input.longitude,
        status: 'pending',
        prefecture: input.prefecture,
        prefectureCode: input.prefectureCode,
        city: input.city,
        municipalityCode: input.municipalityCode,
        town: input.town,
        postalCode: input.postalCode,
        geocodeSource: input.geocodeSource,
        geocodeConfidence: input.geocodeConfidence,
        geocodedAt: input.geocodedAt,
        addressHash: input.addressHash,
        alertRadiusM: input.alertRadiusM,
      }).returning()
      if (!created) throw new Error('Failed to create danger report')
      return created
    },

    async getForImageUpdate(actor: Actor, reportId: string) {
      const [report] = await db.select().from(dangerReports)
        .where(eq(dangerReports.id, reportId)).limit(1)
      if (!report) return null
      assertCan(actor, 'update', 'danger_reports', {
        ownerId: report.userId,
        changedFields: ['image_key'],
      })
      return report
    },

    async setImages(
      actor: Actor,
      reportId: string,
      input: { imageKey?: string; processedImageKeys?: string[] },
    ) {
      if (input.imageKey === undefined && input.processedImageKeys === undefined) {
        throw new RangeError('An image update is required')
      }
      const [report] = await db.select({ userId: dangerReports.userId }).from(dangerReports)
        .where(eq(dangerReports.id, reportId)).limit(1)
      if (!report) throw new Error('Danger report not found')
      assertCan(actor, 'update', 'danger_reports', {
        ownerId: report.userId,
        changedFields: input.imageKey !== undefined
          ? ['image_key']
          : ['processed_image_keys'],
      })
      const now = new Date().toISOString()
      const moderationFields = {
        status: sql<string>`case when ${dangerReports.aiModerationStatus} = 'approved' then 'pending' else ${dangerReports.status} end`,
        aiModerationStatus: sql<string | null>`case when ${dangerReports.aiModerationStatus} = 'approved' then 'needs_review' else ${dangerReports.aiModerationStatus} end`,
        aiModerationReason: sql<string | null>`case
          when ${dangerReports.aiModerationStatus} = 'approved' then
            case when ${dangerReports.aiModerationReason} is null or ${dangerReports.aiModerationReason} = ''
              then ${IMAGE_REOPEN_REASON}
              else ${dangerReports.aiModerationReason} || ' / ' || ${IMAGE_REOPEN_REASON}
            end
          else ${dangerReports.aiModerationReason}
        end`,
        aiModerationCheckedAt: sql<string | null>`case when ${dangerReports.aiModerationStatus} = 'approved' then ${now} else ${dangerReports.aiModerationCheckedAt} end`,
        pushNotifiedAt: sql<string | null>`case when ${dangerReports.aiModerationStatus} = 'approved' then null else ${dangerReports.pushNotifiedAt} end`,
        updatedAt: now,
      }
      const values = input.imageKey !== undefined
        ? { ...moderationFields, imageKey: input.imageKey }
        : { ...moderationFields, processedImageKeys: input.processedImageKeys ?? [] }
      const [updated] = await db.update(dangerReports).set(values)
        .where(eq(dangerReports.id, reportId)).returning()
      if (!updated) throw new Error('Danger report not found')
      return updated
    },

    async setAccidentStats(
      actor: Actor,
      reportId: string,
      stats: Record<string, unknown>,
      riskScore: number,
    ) {
      const [report] = await db.select({ userId: dangerReports.userId }).from(dangerReports)
        .where(eq(dangerReports.id, reportId)).limit(1)
      if (!report) return null
      assertCan(actor, 'update', 'danger_reports', {
        ownerId: report.userId,
        changedFields: ['accident_stats', 'accident_risk_score'],
      })
      const [updated] = await db.update(dangerReports).set({
        accidentStats: stats,
        accidentRiskScore: Number.isFinite(riskScore) ? riskScore : 0,
        updatedAt: new Date().toISOString(),
      }).where(eq(dangerReports.id, reportId)).returning()
      return updated ?? null
    },

    async updateStatus(actor: Actor, reportId: string, status: string) {
      if (!['pending', 'approved', 'published', 'resolved', 'rejected'].includes(status)) {
        throw new RangeError('Invalid report status')
      }
      assertCan(actor, 'update', 'danger_reports', { changedFields: ['status'] })
      const keepsNotificationState = ['approved', 'published', 'resolved'].includes(status)
      const [row] = await db.update(dangerReports).set({
        status,
        ...(!keepsNotificationState ? { pushNotifiedAt: null } : {}),
        updatedAt: new Date().toISOString(),
      })
        .where(eq(dangerReports.id, reportId)).returning()
      if (!row) throw new Error('Danger report not found')
      return row
    },

    async delete(actor: Actor, reportId: string) {
      const [report] = await db.select().from(dangerReports)
        .where(eq(dangerReports.id, reportId)).limit(1)
      if (!report) return null
      assertCan(actor, 'delete', 'danger_reports', { ownerId: report.userId, status: report.status })
      const extraImages = await db.select({ key: reportImages.imageKey }).from(reportImages)
        .where(eq(reportImages.reportId, reportId))
      await db.delete(dangerReports).where(eq(dangerReports.id, reportId))
      return {
        report,
        imageKeys: [
          report.imageKey,
          report.processedImageKey,
          ...report.processedImageKeys,
          ...extraImages.map((image) => image.key),
        ].filter((key): key is string => Boolean(key)),
      }
    },
  }
}

export function createDangerReport(actor: Actor, input: CreateDangerReportInput) {
  return createDangerReportsRepo(getDb()).create(actor, input)
}

export function listDangerReports(actor: Actor, input?: DangerReportListInput) {
  return createDangerReportsRepo(getDb()).list(actor, input)
}

export function getDangerReportById(actor: Actor, reportId: string) {
  return createDangerReportsRepo(getDb()).getById(actor, reportId)
}

export function getDangerReportForImageUpdate(actor: Actor, reportId: string) {
  return createDangerReportsRepo(getDb()).getForImageUpdate(actor, reportId)
}

export function setDangerReportImages(actor: Actor, reportId: string, input: { imageKey?: string; processedImageKeys?: string[] }) {
  return createDangerReportsRepo(getDb()).setImages(actor, reportId, input)
}

export function setDangerReportAccidentStats(
  actor: Actor,
  reportId: string,
  stats: Record<string, unknown>,
  riskScore: number,
) {
  return createDangerReportsRepo(getDb()).setAccidentStats(actor, reportId, stats, riskScore)
}

export function deleteDangerReport(actor: Actor, reportId: string) {
  return createDangerReportsRepo(getDb()).delete(actor, reportId)
}

export function updateDangerReportStatus(actor: Actor, reportId: string, status: string) {
  return createDangerReportsRepo(getDb()).updateStatus(actor, reportId, status)
}
