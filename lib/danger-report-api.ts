import type { Actor } from '@/lib/db/authz'
import type { dangerReports } from '@/lib/db/schema'
import { reportMediaUrl } from '@/lib/media/report-media'
import { isMaskedMediaKey, privateMediaUrl } from '@/lib/media/url'
import { toJapanDate } from '@/lib/report-dates'

type DangerReportRow = typeof dangerReports.$inferSelect

export function toDangerReportJson(report: DangerReportRow) {
  return {
    id: report.id,
    user_id: report.userId,
    title: report.title,
    description: report.description,
    latitude: report.latitude,
    longitude: report.longitude,
    danger_type: report.dangerType,
    danger_level: report.dangerLevel,
    status: report.status,
    image_url: report.imageKey ? privateMediaUrl(report.imageKey) : null,
    processed_image_url: report.processedImageKey ? privateMediaUrl(report.processedImageKey) : null,
    processed_image_urls: report.processedImageKeys.map(privateMediaUrl),
    prefecture: report.prefecture,
    prefecture_code: report.prefectureCode,
    city: report.city,
    municipality_code: report.municipalityCode,
    town: report.town,
    postal_code: report.postalCode,
    geocode_source: report.geocodeSource,
    geocoded_at: report.geocodedAt,
    geocode_confidence: report.geocodeConfidence,
    address_hash: report.addressHash,
    alert_radius_m: report.alertRadiusM,
    ai_moderation_status: report.aiModerationStatus,
    ai_moderation_reason: report.aiModerationReason,
    ai_moderation_checked_at: report.aiModerationCheckedAt,
    ai_moderation_score: report.aiModerationScore,
    /** 写真が端末でぼかした(加工済みの)ものか。false の写真はほかの人には出さない */
    image_masked: report.imageMasked,
    created_at: report.createdAt,
    updated_at: report.updatedAt,
  }
}

const roundTo3 = (value: number) => Math.round(value * 1000) / 1000
/** 日時を日単位(日本時間の日付 YYYY-MM-DD)にする。いつ・どこに誰がいたかを細かく残さない */
const toDay = (value: string) => toJapanDate(value)

/**
 * ほかの人の報告(UIUX改装 項目57・61)。投稿者の id・審査の結果や理由は返さず、日時は日単位、
 * 座標は小数3桁(約100m)にする。写真は端末でぼかしたものだけ(既存の写真は管理者がぼかし直すまで出さない)
 */
export function toOthersDangerReportJson(report: DangerReportRow) {
  const base = toDangerReportJson(report)
  // 写真ごとに、ぼかし済みの印があるものだけを返す(元の写真を差し替えても、古いもしも画像は出さない)。
  // URL は報告の id と写真の場所だけで作り、投稿者の id が入った保存のキーは見せない
  return {
    ...base,
    user_id: '',
    latitude: roundTo3(report.latitude),
    longitude: roundTo3(report.longitude),
    image_url: report.imageKey && isMaskedMediaKey(report.imageKey) ? reportMediaUrl(report.id, 'image') : null,
    processed_image_url: report.processedImageKey && isMaskedMediaKey(report.processedImageKey) ? reportMediaUrl(report.id, 'legacy') : null,
    processed_image_urls: report.processedImageKeys
      .map((key, index) => (isMaskedMediaKey(key) ? reportMediaUrl(report.id, `p${index}`) : null))
      .filter((url): url is string => url !== null),
    postal_code: null,
    address_hash: null,
    geocode_source: null,
    geocoded_at: null,
    geocode_confidence: null,
    ai_moderation_status: null,
    ai_moderation_reason: null,
    ai_moderation_checked_at: null,
    ai_moderation_score: null,
    created_at: toDay(report.createdAt),
    updated_at: toDay(report.updatedAt),
  }
}

/** 見る人に合わせた報告の JSON。本人・管理者には全部、ほかの人には粗くしたもの、未ログインはプレビュー */
export function toDangerReportJsonForViewer(report: DangerReportRow, actor: Actor) {
  if (actor.kind === 'anon') return toPublicDangerReportPreviewJson(report)
  if (actor.kind === 'service' || actor.isAdmin || actor.id === report.userId) return toDangerReportJson(report)
  return toOthersDangerReportJson(report)
}

/**
 * 未ログインのプレビュー。ログインしたほかの人に見せるもの(toOthersDangerReportJson)より、さらに粗くする:
 * 座標は小数2桁(約1km)、写真は返さない。投稿者の id・審査の結果・細かい日時・郵便番号なども返さない
 */
export function toPublicDangerReportPreviewJson(report: DangerReportRow) {
  return {
    ...toOthersDangerReportJson(report),
    latitude: Math.round(report.latitude * 100) / 100,
    longitude: Math.round(report.longitude * 100) / 100,
    image_url: null,
    processed_image_url: null,
    processed_image_urls: [],
  }
}
