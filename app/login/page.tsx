import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"
import LoginForm from "@/components/auth/login-form"

export default async function LoginPage() {
  const supabase = await createServerClient()

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/b349c1ba-7a94-4a7b-b6bb-fc791afcc5fc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'H2',
      location: 'app/login/page.tsx:LoginPage',
      message: 'login:client-created',
      data: { hasClient: !!supabase },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  if (!supabase) {
    console.error("Failed to create Supabase server client.")
    redirect('/error?message=supabase-init-failed')
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/b349c1ba-7a94-4a7b-b6bb-fc791afcc5fc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'H3',
      location: 'app/login/page.tsx:LoginPage',
      message: 'login:session-result',
      data: {
        hasSession: !!session,
        hasSessionError: !!sessionError,
        sessionErrorMessage: sessionError?.message ?? null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  if (sessionError) {
    console.error("Error getting session:", sessionError)
  }

  if (session) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b349c1ba-7a94-4a7b-b6bb-fc791afcc5fc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H3',
        location: 'app/login/page.tsx:LoginPage',
        message: 'login:redirecting-to-map',
        data: { reason: 'session-present' },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    redirect("/map")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">通学路安全マップ</h1>
          <p className="mt-2 text-gray-600">子供たちの安全な通学をサポートします</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
