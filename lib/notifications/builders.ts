/**
 * 通知ビルダー
 *
 * Supabase notifications テーブルへのINSERT用オブジェクトと
 * Web Pushペイロードの両方を構築するユーティリティ
 */

export interface NotificationPreferences {
  danger_reports: boolean
  news: boolean
  magazine: boolean
  local_alerts: boolean
}

export interface PushPayload {
  title: string
  body: string
  icon: string
  badge: string
  tag: string
  data: {
    url: string
    type: keyof NotificationPreferences
  }
}

export const ROUTE_REPORT_NOTIFICATION_TYPE = "route_report"

export function getNotificationTypeLabel(type: string): string | null {
  if (type === ROUTE_REPORT_NOTIFICATION_TYPE) {
    return "通学路更新"
  }
  return null
}

export function buildRouteReportNotification(params: {
  userId: string
  reportId: string
  reportTitle: string
  routeId?: string | null
  routeName?: string | null
}) {
  const routeLabel = params.routeName?.trim() || "通学路"

  return {
    user_id: params.userId,
    type: ROUTE_REPORT_NOTIFICATION_TYPE,
    title: `${routeLabel}に新しい危険報告があります`,
    content: `「${params.reportTitle}」として報告されました。家族にも共有して見直してください。`,
    link: params.routeId ? `/map?routeId=${params.routeId}` : "/map",
    is_read: false,
  }
}

export function buildDangerReportPushPayload(params: {
  reportId: string
  reportTitle: string
  routeName?: string | null
}): PushPayload {
  const routeLabel = params.routeName?.trim() || "通学路"
  return {
    title: `${routeLabel}に危険報告`,
    body: params.reportTitle,
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    tag: `danger-report-${params.reportId}`,
    data: {
      url: `/map?reportId=${params.reportId}`,
      type: 'danger_reports',
    },
  }
}

export function buildNewsPushPayload(params: {
  slug: string
  title: string
}): PushPayload {
  return {
    title: '通学路ニュース',
    body: params.title,
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    tag: `news-${params.slug}`,
    data: {
      url: `/school-route-news/${params.slug}`,
      type: 'news',
    },
  }
}

export type LocalAlertCategory = 'suspicious' | 'voice_call' | 'following' | 'other'

export const LOCAL_ALERT_CATEGORY_LABELS: Record<LocalAlertCategory, string> = {
  suspicious: '不審者情報',
  voice_call: '声かけ事案',
  following: 'つきまとい',
  other: 'その他',
} as const

export function buildLocalAlertPushPayload(params: {
  alertId: string
  category: LocalAlertCategory
  prefecture: string
  city: string | null
  description: string
}): PushPayload {
  const location = params.city
    ? `${params.prefecture} ${params.city}`
    : params.prefecture
  const categoryLabel = LOCAL_ALERT_CATEGORY_LABELS[params.category]
  const body = params.description.length > 80
    ? `${params.description.slice(0, 80)}…`
    : params.description

  return {
    title: `【速報】${location}で${categoryLabel}`,
    body,
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    tag: `local-alert-${params.alertId}`,
    data: {
      url: `/local-alerts?id=${params.alertId}`,
      type: 'local_alerts',
    },
  }
}

export function buildMagazinePushPayload(params: {
  slug: string
  title: string
}): PushPayload {
  return {
    title: '安全マガジン新着',
    body: params.title,
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    tag: `magazine-${params.slug}`,
    data: {
      url: `/safe-magazine/${params.slug}`,
      type: 'magazine',
    },
  }
}
