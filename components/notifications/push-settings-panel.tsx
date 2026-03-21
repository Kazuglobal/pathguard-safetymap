"use client"

import { Bell, BellOff } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { usePushSubscription } from '@/hooks/use-push-subscription'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const PREFERENCE_LABELS = {
  danger_reports: {
    label: '危険レポートアラート',
    description: '登録通学路300m圏内に危険報告が投稿されたとき',
  },
  news: {
    label: '通学路ニュース',
    description: '通学路に関するニュース記事が追加されたとき',
  },
  magazine: {
    label: '安全マガジン',
    description: '安全マガジンの新着記事が公開されたとき',
  },
} as const

export function PushSettingsPanel() {
  const { state, preferences, subscribe, unsubscribe, updatePreferences } =
    usePushSubscription()

  if (state === 'loading') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            プッシュ通知
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    )
  }

  if (state === 'unsupported') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellOff className="h-4 w-4" />
            プッシュ通知
          </CardTitle>
          <CardDescription>
            お使いのブラウザはプッシュ通知に対応していません
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (state === 'denied') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellOff className="h-4 w-4" />
            プッシュ通知
          </CardTitle>
          <CardDescription>
            通知がブロックされています。ブラウザの設定から許可してください。
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          プッシュ通知
        </CardTitle>
        <CardDescription>
          {state === 'subscribed'
            ? '通知を受け取っています'
            : '通知を許可すると安全情報をリアルタイムで受け取れます'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === 'subscribed' ? (
          <>
            <div className="space-y-3">
              {(Object.keys(PREFERENCE_LABELS) as Array<keyof typeof PREFERENCE_LABELS>).map(
                (key) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        {PREFERENCE_LABELS[key].label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {PREFERENCE_LABELS[key].description}
                      </p>
                    </div>
                    <Switch
                      checked={preferences[key]}
                      onCheckedChange={(checked) =>
                        updatePreferences({ [key]: checked })
                      }
                    />
                  </div>
                )
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={unsubscribe}
            >
              通知を解除する
            </Button>
          </>
        ) : (
          <Button className="w-full" onClick={subscribe}>
            <Bell className="mr-2 h-4 w-4" />
            通知を許可する
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
