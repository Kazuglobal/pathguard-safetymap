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
  /** 朝のダイジェスト通知（毎朝7:30 JST・1日1通）。未設定はオプトイン扱い（送信する） */
  daily_digest?: boolean
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

/**
 * 不審者情報のAI一次審査の結果を投稿者本人へ知らせる通知。
 *
 * ロック画面に出るため、審査理由(個人情報検出等)は本文に含めない。
 * 詳細な理由はアプリ内の報告詳細(getReportStatusPresentation)で見せる。
 */
export function buildModerationResultPushPayload(params: {
  reportId: string
  verdictStatus: "approved" | "needs_review" | "rejected"
}): PushPayload {
  const content = {
    approved: {
      title: "報告が公開されました",
      body: "ご報告ありがとうございます。不審者情報が地図に公開されました。",
    },
    needs_review: {
      title: "報告を確認しています",
      body: "いただいた報告は追加の確認が必要と判定されました。結果までお待ちください。",
    },
    rejected: {
      title: "報告は公開されませんでした",
      body: "審査の結果、公開を見送りました。理由はアプリの報告詳細で確認できます。",
    },
  }[params.verdictStatus]

  return {
    ...content,
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    tag: `moderation-result-${params.reportId}`,
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

/**
 * 同一都道府県でアラートが集中した際のまとめ通知（バースト抑制）。
 * 個別に何通も送る代わりに1通へ束ねて通知疲れを防ぐ。
 */
export function buildLocalAlertBatchPushPayload(params: {
  prefecture: string
  count: number
  latestAlertId: string
}): PushPayload {
  return {
    title: `【速報】${params.prefecture}で新しい事案${params.count}件`,
    body: '直近2時間に複数の情報が届いています。アプリでまとめて確認できます。',
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    tag: `local-alert-batch-${params.latestAlertId}`,
    data: {
      url: '/school-route-news',
      type: 'local_alerts',
    },
  }
}

/**
 * 朝のダイジェスト通知（毎朝7:30 JST・1日1通）。
 * 0件の日も「安心」を届ける（完了感・恐怖に頼らないリテンションの一部）。
 * prefecture / localAlertCount を渡すと地域別の文面になる（自分ごと化）。
 */
export function buildDailyDigestPushPayload(params: {
  date: string
  newsCount: number
  alertCount: number
  prefecture?: string | null
  localAlertCount?: number
}): PushPayload {
  const total = params.newsCount + params.alertCount
  const regional = params.prefecture != null && params.localAlertCount !== undefined

  let body: string
  if (total === 0) {
    body = 'この24時間、新しい事案の情報はありません。いつもどおりの朝です。'
  } else if (regional && params.localAlertCount! > 0) {
    body = `昨日から今朝までに全国で${total}件・${params.prefecture}で${params.localAlertCount}件の通学路情報。1分でチェックしましょう。`
  } else if (regional) {
    body = `昨日から今朝までに全国で${total}件。${params.prefecture}では新しい事案はありません。`
  } else {
    body = `昨日から今朝までに全国で${total}件の通学路情報があります。1分でチェックしましょう。`
  }

  return {
    title: 'けさの通学路ダイジェスト',
    body,
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    tag: `daily-digest-${params.date}`,
    data: {
      url: '/school-route-news',
      type: 'daily_digest',
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
