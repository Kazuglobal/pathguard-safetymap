import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"
import MapPageClient from "@/components/map/map-page-client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

export default async function MapPage() {
  // Supabaseクライアントを取得（Next.js 15 の async cookies() API 対応）
  const supabase = await createServerClient()

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/b349c1ba-7a94-4a7b-b6bb-fc791afcc5fc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'run2',
      hypothesisId: 'H4',
      location: 'app/map/page.tsx:MapPage',
      message: 'map:client-created',
      data: { hasClient: !!supabase },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/b349c1ba-7a94-4a7b-b6bb-fc791afcc5fc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'run2',
      hypothesisId: 'H5',
      location: 'app/map/page.tsx:MapPage',
      message: 'map:session-result',
      data: { hasSession: !!session },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  if (!session) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b349c1ba-7a94-4a7b-b6bb-fc791afcc5fc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run2',
        hypothesisId: 'H5',
        location: 'app/map/page.tsx:MapPage',
        message: 'map:redirect-login',
        data: { reason: 'no-session' },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    redirect("/login")
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