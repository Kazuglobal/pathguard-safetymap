import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"
import MapPageClient from "@/components/map/map-page-client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

export default async function MapPage() {
  // Supabaseクライアントを取得（Next.js 15 の async cookies() API 対応）
  const supabase = await createServerClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  const hasMapboxToken = !!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

  return (
    <main className="flex min-h-screen flex-col">
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