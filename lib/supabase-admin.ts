import { createClient, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

// サービスロールキーを利用したクライアント（遅延初期化でビルド時エラーを回避）
let _supabaseAdmin: SupabaseClient<Database> | null = null

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
      )
    }
    _supabaseAdmin = createClient<Database>(url, key, {
      auth: { persistSession: false },
    })
  }
  return _supabaseAdmin
}

/** @deprecated Use getSupabaseAdmin() instead */
export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return (getSupabaseAdmin() as Record<string | symbol, unknown>)[prop]
  },
})