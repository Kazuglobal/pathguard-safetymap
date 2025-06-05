import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

// サービスロールキーを利用したクライアント
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: { persistSession: false },
  }
) 