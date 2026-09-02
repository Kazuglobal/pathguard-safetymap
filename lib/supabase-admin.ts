import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

// The service-role client is deliberately narrowed to Auth. D1/R2 are the only
// production data and media paths after cutover.
export type SupabaseAuthAdminClient = Pick<SupabaseClient<Database>, "auth">
let _supabaseAdmin: SupabaseAuthAdminClient | null = null

export function getSupabaseAdmin(): SupabaseAuthAdminClient {
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
