// lib/supabase-server.ts
import { cookies } from 'next/headers'
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

/**
 * Next.js 13 App Router 以降は @supabase/ssr を使用します。
 */
export const createServerClient = async () => {
  const cookieStore = await cookies()

  const client = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // サーバーコンポーネントから set メソッドが呼び出された場合、
            // cookies() は読み取り専用のためエラーになります。
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // サーバーコンポーネントから remove メソッドが呼び出された場合、
            // cookies() は読み取り専用のためエラーになります。
          }
        },
      },
    }
  )

  return client
}
