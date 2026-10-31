"use client"

import { Bell, BellOff, SquarePlus } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardIcon } from "@/components/ui/card"
import type { UsePushSubscriptionReturn } from "@/hooks/use-push-subscription"
import { IosInstallSteps } from "@/components/pwa/ios-install-steps"
import { BRAND } from "@/lib/brand"
import { getPushUnavailableReason, type PushUnavailableReason } from "@/lib/pwa-install"
import { mypageCardStyle } from "./mypage-shared"
import { tankenTokens } from "@/lib/design/tanken"
import type { NotificationPreferences } from "@/lib/notifications/builders"

const t = tankenTokens

const PREFERENCE_LABELS: Record<
  "danger_reports" | "daily_digest" | "local_alerts" | "news" | "magazine",
  { label: string; description: string }
> = {
  daily_digest: {
    label: "朝のダイジェスト",
    description: "毎朝7:30に、昨日から今朝までの通学路情報をまとめてお知らせ（1日1通）",
  },
  local_alerts: {
    label: "地域の安全アラート",
    description: "お住まいの地域で声かけ・不審者情報が確認されたとき（夜間分は朝のダイジェストにまとめます）",
  },
  danger_reports: {
    label: "危険レポートアラート",
    description: "登録通学路300m圏内に危険報告が投稿されたとき",
  },
  news: {
    label: BRAND.news,
    description: "通学路に関するニュース記事が追加されたとき",
  },
  magazine: {
    label: BRAND.magazine,
    description: `${BRAND.magazine} の新しい記事が公開されたとき`,
  },
}

const cardStyle = mypageCardStyle

/** 通知を受け取れない環境で出す説明(カードを消さずに理由を出す。UIUX改装 項目37) */
const UNAVAILABLE_COPY: Record<PushUnavailableReason, { title: string; description: string }> = {
  "ios-needs-home-screen": {
    title: "ホーム画面に追加すると通知を受け取れます",
    description: "iPhone・iPad では、ホーム画面に追加したアプリから通知を受け取れます。追加したアイコンから開いて、ここで通知をオンにしてください。",
  },
  "ios-too-old": {
    title: "この端末では通知を受け取れません",
    description: "iOS 16.4 より前の iPhone・iPad は、通知に対応していません。iOS を新しくすると受け取れるようになります。",
  },
  browser: {
    title: "このブラウザでは通知を受け取れません",
    description: "このブラウザ(アプリの中で開いたページなど)は通知に対応していません。Chrome・Edge・Safari などで開くと受け取れます。",
  },
}

/**
 * マイページ専用の通知カード。
 * usePushSubscription の状態に応じて「導線 / 設定 / 注意書き」を出し分ける。
 * 通知を受け取れない環境でもカードを消さず、理由(iPhone・iPad ならホーム画面に追加する手順)を出す。
 * フックはページ側で一度だけ呼び、状態を props で受け取る。
 */
export function MypageNotificationCard({ push }: { push: UsePushSubscriptionReturn }) {
  const { state, preferences, subscribe, unsubscribe, updatePreferences } = push

  if (state === "unsupported") {
    // 状態はブラウザで確かめてから決まる(最初の描画は loading)ので、ここで window を読んでよい
    const reason = getPushUnavailableReason()
    const copy = UNAVAILABLE_COPY[reason]
    return (
      <Card className="border" style={cardStyle} data-testid="mypage-notification-unavailable">
        <CardHeader className="flex-row items-center gap-3 pb-3">
          <CardIcon
            icon={reason === "ios-needs-home-screen" ? <SquarePlus className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            color={reason === "ios-needs-home-screen" ? "info" : "warning"}
          />
          <div>
            <CardTitle style={{ color: t.color.ink }}>{copy.title}</CardTitle>
            <CardDescription style={{ color: t.color.inkSoft }}>{copy.description}</CardDescription>
          </div>
        </CardHeader>
        {reason === "ios-needs-home-screen" && (
          <CardContent className="p-6 pt-0">
            <IosInstallSteps className="space-y-1.5 text-sm" />
          </CardContent>
        )}
      </Card>
    )
  }

  // 状態確認中は何も出さない。通知設定は非クリティカルなので、
  // 確認が終わらない環境で空の枠が残り続けるより、静かに待つ方がよい。
  if (state === "loading") {
    return null
  }

  if (state === "denied") {
    return (
      <Card className="border" style={cardStyle}>
        <CardHeader className="flex-row items-center gap-3 pb-3">
          <CardIcon icon={<BellOff className="h-5 w-5" />} color="warning" />
          <div>
            <CardTitle style={{ color: t.color.ink }}>お知らせは今おやすみ中</CardTitle>
            <CardDescription style={{ color: t.color.inkSoft }}>
              通知がブロックされています。ブラウザの設定から許可すると、通学路の危険情報を受け取れます。
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
    )
  }

  if (state === "subscribed") {
    return (
      <Card className="border" style={cardStyle}>
        <CardHeader className="flex-row items-center gap-3 pb-3">
          <CardIcon icon={<Bell className="h-5 w-5" />} color="primary" />
          <div>
            <CardTitle style={{ color: t.color.ink }}>お知らせを受け取っています</CardTitle>
            <CardDescription style={{ color: t.color.inkSoft }}>
              受け取る内容はいつでも切り替えられます。
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6 pt-0">
          <div className="space-y-3">
            {(Object.keys(PREFERENCE_LABELS) as Array<keyof typeof PREFERENCE_LABELS>).map((key) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: t.color.ink }}>
                    {PREFERENCE_LABELS[key].label}
                  </p>
                  <p className="text-xs" style={{ color: t.color.inkSoft }}>
                    {PREFERENCE_LABELS[key].description}
                  </p>
                </div>
                <Switch
                  checked={preferences[key as keyof NotificationPreferences] ?? true}
                  onCheckedChange={(checked) => updatePreferences({ [key]: checked })}
                  aria-label={PREFERENCE_LABELS[key].label}
                />
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className={`w-full ${t.cls.focus}`} onClick={unsubscribe}>
            通知を解除する
          </Button>
        </CardContent>
      </Card>
    )
  }

  // state === "unsubscribed"
  return (
    <Card className="border" style={cardStyle}>
      <CardHeader className="flex-row items-center gap-3 pb-3">
        <CardIcon icon={<Bell className="h-5 w-5" />} color="info" />
        <div>
          <CardTitle style={{ color: t.color.ink }}>危険情報をいち早く受け取ろう</CardTitle>
          <CardDescription style={{ color: t.color.inkSoft }}>
            通知をオンにすると、登録した通学路の近くで危険報告が出たときにお知らせします。
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <Button
          className={`w-full text-white ${t.cls.focus}`}
          style={{ background: t.color.primary, boxShadow: t.shadow.pressGreen }}
          onClick={subscribe}
        >
          <Bell className="mr-2 h-4 w-4" />
          通知をオンにする
        </Button>
      </CardContent>
    </Card>
  )
}
