"use client"

import Link from "next/link"
import { Bell, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AccountCredentialsSettings } from "@/components/settings/account-credentials-settings"
import { AccountDeletionSettings } from "@/components/settings/account-deletion-settings"
import { ChildrenSettings } from "@/components/settings/children-settings"
import { LocationPrecisionSettings } from "@/components/settings/location-precision-settings"
import type { UsePushSubscriptionReturn } from "@/hooks/use-push-subscription"
import { tankenTokens } from "@/lib/design/tanken"
import { MYPAGE_NOTIFICATIONS_ID } from "@/lib/mypage-sections"
import { MypageNotificationCard } from "./mypage-notification-card"
import { MypageGroup, mypageCardStyle } from "./mypage-shared"

const t = tankenTokens

/**
 * 通知がまだ使えるようになっていない(未設定・ブロック中・この環境では受け取れない)か。
 * そのときは通知のカードをマイページのいちばん上に出し、設定のグループには場所の案内だけを出す(UIUX改装 項目37)。
 */
export function needsNotificationSetup(state: UsePushSubscriptionReturn["state"]): boolean {
  return state === "unsubscribed" || state === "denied" || state === "unsupported"
}

export interface MypageSettingsProps {
  push: UsePushSubscriptionReturn
  onEditProfile: () => void
  onSignOut: () => void
  isSigningOut: boolean
}

/** マイページの「設定」(UIUX改装 項目7・46)。表示名とアイコン・通知・お子さま・位置の保存・メールとパスワード・退会・ログアウト */
export function MypageSettings({ push, onEditProfile, onSignOut, isSigningOut }: MypageSettingsProps) {
  return (
    <MypageGroup id="settings" title="設定">
      {push.state === "subscribed" && (
        <div id={MYPAGE_NOTIFICATIONS_ID} className="scroll-mt-20">
          <MypageNotificationCard push={push} />
        </div>
      )}
      <Card className="border" style={mypageCardStyle}>
        <CardContent className="space-y-6 p-6">
          <section aria-labelledby="profile-settings-title" className="space-y-2">
            <h3 id="profile-settings-title" className="flex items-center gap-2 text-base font-bold">
              <UserRound className="h-4 w-4" aria-hidden="true" />
              表示名とアイコン
            </h3>
            <p className="text-sm" style={{ color: t.color.inkSoft }}>
              ヘッダーやマイページに出る呼び名です。本名ではなく、呼び名やニックネームにしてください。
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={t.cls.focus}
              onClick={onEditProfile}
              data-testid="profile-edit-button"
            >
              表示名とアイコンを変える
            </Button>
          </section>
          {needsNotificationSetup(push.state) && (
            <section aria-labelledby="notification-settings-title" className="space-y-2">
              <h3 id="notification-settings-title" className="flex items-center gap-2 text-base font-bold">
                <Bell className="h-4 w-4" aria-hidden="true" />
                通知
              </h3>
              <p className="text-sm" style={{ color: t.color.inkSoft }}>
                通知はまだ届かない状態です。設定は
                <Link href={`#${MYPAGE_NOTIFICATIONS_ID}`} className={`mx-1 font-bold underline underline-offset-4 ${t.cls.focus}`} style={{ color: t.color.primaryStrong }}>
                  このページのいちばん上
                </Link>
                にあります。
              </p>
            </section>
          )}
          <ChildrenSettings />
          <LocationPrecisionSettings />
          <AccountCredentialsSettings />
          <AccountDeletionSettings />
        </CardContent>
      </Card>
      <div className="flex justify-center pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={t.cls.focus}
          style={{ color: t.color.inkSoft }}
          onClick={onSignOut}
          disabled={isSigningOut}
          aria-label="マイページからログアウト"
          data-testid="mypage-logout-button"
        >
          {isSigningOut ? "ログアウト中..." : "ログアウト"}
        </Button>
      </div>
    </MypageGroup>
  )
}
