import type { dangerReports } from '@/lib/db/schema'
import { privateMediaUrl } from '@/lib/media/url'

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
    created_at: report.createdAt,
    updated_at: report.updatedAt,
  }
}

/** Match the former security-invoker public preview: coarse coordinates and no media keys. */
export function toPublicDangerReportPreviewJson(report: DangerReportRow) {
  return {
    ...toDangerReportJson(report),
    latitude: Math.round(report.latitude * 100) / 100,
    longitude: Math.round(report.longitude * 100) / 100,
    image_url: null,
    processed_image_url: null,
    processed_image_urls: [],
    user_id: '',
    ai_moderation_reason: null,
  }
}
