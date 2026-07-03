"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/components/providers/supabase-provider"
import { RouteManager } from "@/components/map/route-manager"
import { Skeleton } from "@/components/ui/skeleton"
import { Route as RouteIcon } from "lucide-react"
import type { UserRoute } from "@/lib/types"

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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 pb-32 md:pb-16">
        <header className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RouteIcon className="h-6 w-6 text-primary" />
            通学路管理
          </h1>
          <p className="text-muted-foreground mt-1">
            通学路を登録・管理して、安全な通学をサポートします
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
