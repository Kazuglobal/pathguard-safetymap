import { and, desc, eq, gte, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'

import { assertCan, AuthzError, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { isReportCreateLimitViolation, ReportCreateRateLimitError, ReportCreateUnavailableError } from '../report-create-errors'
import { dangerReports, reportCreateHistory, reportImages } from '../schema'

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

export function validateCreate(input: CreateDangerReportInput): void {
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
      if (input.prefecture) {
        // Legacy reports can lack geocoded addresses. On the map, bounds still
        // constrain their location; a prefecture-only list remains strict.
        predicates.push(input.bounds
          ? or(
            eq(dangerReports.prefecture, input.prefecture),
            isNull(dangerReports.prefecture),
            eq(dangerReports.prefecture, ''),
          )!
          : eq(dangerReports.prefecture, input.prefecture))
      }
      if (input.city) predicates.push(eq(dangerReports.city, input.city))
      if (input.dangerType) predicates.push(eq(dangerReports.dangerType, input.dangerType))
      if (input.minimumDangerLevel != null) predicates.push(gte(dangerReports.dangerLevel, input.minimumDangerLevel))
      if (input.exactDangerLevel != null) predicates.push(eq(dangerReports.dangerLevel, input.exactDangerLevel))
      // ほかの人には座標を丸め(ログイン中は小数3桁、未ログインは2桁)、日時は日単位で見せるので、絞り込みも同じ粗さで行う
      // (細かい値で絞り込めると、範囲を狭めながら問い合わせて、丸める前の場所と時刻を割り出せるため。UIUX改装 項目61)
      const coarseDecimals = actor.kind === 'anon' ? 2 : actor.kind === 'user' && !actor.isAdmin ? 3 : null
      if (input.createdAfter) {
        predicates.push(coarseDecimals === null
          ? gte(dangerReports.createdAt, input.createdAfter)
          : sql`substr(${dangerReports.createdAt}, 1, 10) >= ${input.createdAfter.slice(0, 10)}`)
      }
      if (input.bounds) {
        const longitude = coarseDecimals === null ? sql`${dangerReports.longitude}` : sql`round(${dangerReports.longitude}, ${coarseDecimals})`
        const latitude = coarseDecimals === null ? sql`${dangerReports.latitude}` : sql`round(${dangerReports.latitude}, ${coarseDecimals})`
        predicates.push(
          sql`${longitude} >= ${input.bounds.minLng}`,
          sql`${longitude} <= ${input.bounds.maxLng}`,
          sql`${latitude} >= ${input.bounds.minLat}`,
          sql`${latitude} <= ${input.bounds.maxLat}`,
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

      try {
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
          rewardPoints: 0,
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
      } catch (error) {
        if (!isReportCreateLimitViolation(error)) throw new ReportCreateUnavailableError(error)
        // The failed INSERT is already rolled back. Compute both windows from
        // the DB clock; quota checks themselves happen inside the INSERT trigger.
        try {
          const [limits] = await db.select({
            hourlyReset: sql<number | null>`case when sum(case when ${reportCreateHistory.createdAt} > unixepoch() - 3600 then 1 else 0 end) >= 10
              then min(case when ${reportCreateHistory.createdAt} > unixepoch() - 3600 then ${reportCreateHistory.createdAt} end) + 3600 end`,
            dailyReset: sql<number | null>`case when count(*) >= 50 then min(${reportCreateHistory.createdAt}) + 86400 end`,
          }).from(reportCreateHistory).where(and(
            eq(reportCreateHistory.userId, actor.id),
            sql`${reportCreateHistory.createdAt} > unixepoch() - 86400`,
          ))
          throw new ReportCreateRateLimitError(Math.max(
            (limits?.hourlyReset ?? 0) * 1000,
            (limits?.dailyReset ?? 0) * 1000,
            Date.now() + 1000,
          ))
        } catch (resetError) {
          if (resetError instanceof ReportCreateRateLimitError) throw resetError
          throw new ReportCreateUnavailableError(resetError)
        }
      }
    },

    /**
     * 管理者が、ぼかしていない元の写真を、ぼかした写真に置き換える(UIUX改装 項目57)。審査はやり直さない。
     * keyFor で新しいキーを決め、store でその写真を保存してから D1 を書き換える。元のキーを返す(呼び出し側が消す)
     */
    async replaceImageWithMasked(
      actor: Actor,
      reportId: string,
      keyFor: (report: { id: string; userId: string }) => string,
      store: (key: string) => Promise<void>,
    ): Promise<{ imageKey: string; previousKey: string | null } | null> {
      if (actor.kind !== 'user' || !actor.isAdmin) throw new Error('管理者権限が必要です')
      const [report] = await db.select({ id: dangerReports.id, userId: dangerReports.userId, imageKey: dangerReports.imageKey })
        .from(dangerReports).where(eq(dangerReports.id, reportId)).limit(1)
      if (!report) return null
      assertCan(actor, 'update', 'danger_reports', { ownerId: report.userId, changedFields: ['image_key', 'image_masked'] })
      const imageKey = keyFor(report)
      await store(imageKey)
      await db.update(dangerReports).set({ imageKey, imageMasked: true, updatedAt: new Date().toISOString() })
        .where(eq(dangerReports.id, report.id))
      return { imageKey, previousKey: report.imageKey }
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
      /** imageMasked: imageKey の写真が端末でぼかした(加工済みの)ものか。imageKey と一緒に渡す */
      input: { imageKey?: string; imageMasked?: boolean; processedImageKeys?: string[] },
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
      // 公開中か、AI か運営(人)が承認済みなら、写真が変わったので審査をやり直す(人の承認も取り消す)。
      // 承認の時刻を記録する前に人が公開した報告(human_approved_at が空)も、公開中なら審査に戻す。
      // 運営(管理者)が写真を足す・差し替える・消すときは、運営が見ているので審査に戻さない
      // (戻すと公開が止まり、投稿者のポイントが減り、承認し直したときに同じ通知がもう一度届くため)
      const adminEdit = actor.kind === 'user' && actor.isAdmin
      const reopens = adminEdit
        ? sql`0`
        : sql`(${dangerReports.status} in ('approved', 'published', 'resolved') or ${dangerReports.aiModerationStatus} = 'approved' or ${dangerReports.humanApprovedAt} is not null)`
      const moderationFields = {
        status: sql<string>`case when ${reopens} then 'pending' else ${dangerReports.status} end`,
        aiModerationStatus: sql<string | null>`case when ${reopens} then 'needs_review' else ${dangerReports.aiModerationStatus} end`,
        humanApprovedAt: sql<string | null>`case when ${reopens} then null else ${dangerReports.humanApprovedAt} end`,
        aiModerationReason: sql<string | null>`case
          when ${reopens} then
            case when ${dangerReports.aiModerationReason} is null or ${dangerReports.aiModerationReason} = ''
              then ${IMAGE_REOPEN_REASON}
              else ${dangerReports.aiModerationReason} || ' / ' || ${IMAGE_REOPEN_REASON}
            end
          else ${dangerReports.aiModerationReason}
        end`,
        aiModerationCheckedAt: sql<string | null>`case when ${reopens} then ${now} else ${dangerReports.aiModerationCheckedAt} end`,
        pushNotifiedAt: sql<string | null>`case when ${reopens} then null else ${dangerReports.pushNotifiedAt} end`,
        updatedAt: now,
      }
      const values = input.imageKey !== undefined
        ? { ...moderationFields, imageKey: input.imageKey, imageMasked: input.imageMasked === true }
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
      assertCan(actor, 'update', 'danger_reports', { changedFields: ['status', 'human_approved_at'] })
      const keepsNotificationState = ['approved', 'published', 'resolved'].includes(status)
      const now = new Date().toISOString()
      // 運営(管理者)が非公開から公開にしたら承認した時刻を残す(通知のゲート・取りこぼしの範囲に使う)。
      // すでに公開中の状態どうしの変更(公開→解決済みなど)では、時刻が無くても付けない
      // (付けると、通知していない古い報告が「新しい報告」として届き、保持期間も延びるため)。非公開に戻したら承認を取り消す
      const humanApprovedAt = keepsNotificationState
        ? actor.kind === 'user' && actor.isAdmin
          ? { humanApprovedAt: sql<string | null>`case when ${dangerReports.status} in ('approved', 'published', 'resolved') then ${dangerReports.humanApprovedAt} else ${now} end` }
          : {}
        : { humanApprovedAt: null }
      const [row] = await db.update(dangerReports).set({
        status,
        ...humanApprovedAt,
        ...(!keepsNotificationState ? { pushNotifiedAt: null } : {}),
        updatedAt: now,
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
  let db: AppDb
  try {
    db = getDb()
  } catch (error) {
    throw new ReportCreateUnavailableError(error)
  }
  return createDangerReportsRepo(db).create(actor, input)
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

export function replaceDangerReportImageWithMasked(
  actor: Actor,
  reportId: string,
  keyFor: (report: { id: string; userId: string }) => string,
  store: (key: string) => Promise<void>,
) {
  return createDangerReportsRepo(getDb()).replaceImageWithMasked(actor, reportId, keyFor, store)
}

export function setDangerReportImages(actor: Actor, reportId: string, input: { imageKey?: string; imageMasked?: boolean; processedImageKeys?: string[] }) {
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
