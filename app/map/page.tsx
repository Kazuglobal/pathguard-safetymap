import { redirect } from "next/navigation"
import { loginPathFor } from "@/lib/auth/login-path"
import { createServerClient } from "@/lib/supabase-server"
import MapPageClient from "@/components/map/map-page-client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Supabaseクライアントを取得（Next.js 15 の async cookies() API 対応）
  const supabase = await createServerClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    // ログイン後に同じ地図(報告・ルート指定つき)へ戻れるよう、元のクエリごと next に渡す
    const params = await searchParams
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") query.set(key, value)
    }
    const queryString = query.toString()
    redirect(loginPathFor(queryString ? `/map?${queryString}` : "/map"))
  }

  const hasMapboxToken = !!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

  return (
    <main className="flex min-h-screen flex-col overflow-x-hidden">
      {!hasMapboxToken && (
        <Alert variant="destructive" className="m-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>設定エラー</AlertTitle>
          <AlertDescription>
            Mapboxアクセストークンが設定されていません。環境変数NEXT_PUBLIC_MAPBOX_ACCESS_TOKENを設定してください。
          </AlertDescription>
        </Alert>
      )}
      <MapPageClient />
    </main>
  )
} 