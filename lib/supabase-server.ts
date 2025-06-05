// lib/supabase-server.ts
import { cookies } from 'next/headers'
// import { createServerComponentClient } from '@supabase/auth-helpers-nextjs' // 古いインポートを削除
import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr' // 新しいインポートと CookieOptions をインポート
import type { Database } from '@/lib/database.types'

/**
 * Next.js 13 App Router 以降は @supabase/ssr を使用します。
 */
export const createServerClient = async () => {
  const cookieStore = await cookies()

  // return createServerComponentClient<Database>({ // 古い関数呼び出しを削除
  return createSupabaseServerClient<Database>( // 新しい関数呼び出し
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
}
