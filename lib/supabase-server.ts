// lib/supabase-server.ts
import { cookies } from 'next/headers'
// import { createServerComponentClient } from '@supabase/auth-helpers-nextjs' // 古いインポートを削除
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
// import type { Database } from '@/lib/database.types'

/**
 * Next.js 13 App Router 以降は @supabase/ssr を使用します。
 */
export const createServerClient = async () => {
  const cookieStore = await cookies()

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/b349c1ba-7a94-4a7b-b6bb-fc791afcc5fc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'H1',
      location: 'lib/supabase-server.ts:createServerClient',
      message: 'entry:createServerClient',
      data: {
        urlPresent: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        keyPresent: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        cookieCount: cookieStore.getAll?.().length ?? 0,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  try {
    // return createServerComponentClient<Database>({ // 古い関数呼び出しを削除
    const client = createSupabaseServerClient( // 新しい関数呼び出し
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) { // options の型を CookieOptions に
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              // サーバーコンポーネントから set メソッドが呼び出された場合、
              // cookies() は読み取り専用のためエラーになります。
              // ミドルウェアでユーザーセッションを更新している場合は、このエラーを無視できます。
              // console.warn(`Supabase SSR: Failed to set cookie '${name}' from Server Component. Error: ${error}`);
            }
          },
          remove(name: string, options: CookieOptions) { // options の型を CookieOptions に
            try {
              // Supabase のドキュメントでは remove も set で空文字とオプションを指定する形になっている
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // サーバーコンポーネントから remove メソッドが呼び出された場合、
              // cookies() は読み取り専用のためエラーになります。
              // ミドルウェアでユーザーセッションを更新している場合は、このエラーを無視できます。
              // console.warn(`Supabase SSR: Failed to remove cookie '${name}' from Server Component. Error: ${error}`);
            }
          },
        },
      }
    )

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b349c1ba-7a94-4a7b-b6bb-fc791afcc5fc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H1',
        location: 'lib/supabase-server.ts:createServerClient',
        message: 'createServerClient success',
        data: { clientCreated: !!client },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    return client
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/b349c1ba-7a94-4a7b-b6bb-fc791afcc5fc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H1',
        location: 'lib/supabase-server.ts:createServerClient',
        message: 'createServerClient error',
        data: { error: (error as Error)?.message ?? 'unknown' },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    throw error
  }
}
