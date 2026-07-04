"use client"

import { Bell, BellOff } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardIcon } from "@/components/ui/card"
import type { UsePushSubscriptionReturn } from "@/hooks/use-push-subscription"
import { tankenTokens } from "@/lib/design/tanken"
import type { NotificationPreferences } from "@/lib/notifications/builders"

const t = tankenTokens

const PREFERENCE_LABELS: Record<
  "danger_reports" | "news" | "magazine",
  { label: string; description: string }
> = {
  danger_reports: {
    label: "危険レポートアラート",
    description: "登録通学路300m圏内に危険報告が投稿されたとき",
  },
  news: {
    label: "通学路ニュース",
    description: "通学路に関するニュース記事が追加されたとき",
  },
  magazine: {
    label: "安全マガジン",
    description: "安全マガジンの新着記事が公開されたとき",
  },
}

const cardStyle = {
  background: t.color.card,
  borderColor: t.border.soft,
  boxShadow: t.shadow.card,
  borderRadius: t.radius.card,
} as const

/**
 * マイページ専用の通知カード。
 * usePushSubscription の状態に応じて「導線 / 設定 / 注意書き」を出し分ける。
 * 未対応ブラウザでは何も描画しない（空のベージュ矩形を出さない）。
 * フックはページ側で一度だけ呼び、状態を props で受け取る。
 */
export function MypageNotificationCard({ push }: { push: UsePushSubscriptionReturn }) {
  const { state, preferences, subscribe, unsubscribe, updatePreferences } = push

  // 未対応ブラウザでは枠ごと非表示にする
  if (state === "unsupported") {
    return null
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
                  checked={preferences[key as keyof NotificationPreferences]}
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
