"use client"

import { useState } from "react"
import { RouteManager } from "@/components/map/route-manager"
import { Route as RouteIcon } from "lucide-react"
import { tankenTokens } from "@/lib/design/tanken"
import type { UserRoute } from "@/lib/types"

const C = tankenTokens.color

// /routes は middleware.ts の PROTECTED_PREFIXES で守られており、未ログインでの遷移は
// サーバー側で /login?next=... に送られる。ここで getUser() を待ち直すと認証サーバーとの
// 往復のぶん見出しまで全面スケルトンになるため、ページでは待たずにすぐ描画する。
// 一覧の読み込み中の表示は RouteManager が受け持つ。
export default function RoutesPage() {
  const [selectedRoute, setSelectedRoute] = useState<UserRoute | null>(null)

  const handleRouteSelect = (route: UserRoute) => {
    setSelectedRoute(route)
  }

  return (
    <div className="min-h-screen" style={{ background: C.paper }}>
      <div className="mx-auto max-w-4xl px-4 py-8 pb-32 md:pb-16">
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-black" style={{ color: C.ink }}>
            <RouteIcon className="h-6 w-6" style={{ color: C.primary }} />
            うちの子の通学路
          </h1>
          <p className="mt-1" style={{ color: C.inkSoft }}>
            いつもの道をとうろくすると、毎朝の「通学3分チェック」で注意点がわかります
          </p>
        </header>

        <RouteManager onRouteSelect={handleRouteSelect} />

        {selectedRoute && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              選択中: <span className="font-medium text-foreground">{selectedRoute.name}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
