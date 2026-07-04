"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/components/providers/supabase-provider"
import { RouteManager } from "@/components/map/route-manager"
import { Skeleton } from "@/components/ui/skeleton"
import { Route as RouteIcon } from "lucide-react"
import { tankenTokens } from "@/lib/design/tanken"
import type { UserRoute } from "@/lib/types"

const C = tankenTokens.color

export default function RoutesPage() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  const [selectedRoute, setSelectedRoute] = useState<UserRoute | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push("/login")
          return
        }

        setIsAuthChecking(false)
      } catch {
        // Authentication failed - redirect to login
        router.push("/login")
      }
    }

    checkAuth()
  }, [supabase, router])

  const handleRouteSelect = (route: UserRoute) => {
    setSelectedRoute(route)
  }

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    )
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
