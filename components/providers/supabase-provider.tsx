'use client'

import React, { createContext, useContext, useState } from 'react'
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs' // 古いインポートを削除
// import type { SupabaseClient } from '@supabase/auth-helpers-nextjs' // 古い型インポートを削除
import { createBrowserClient } from '@supabase/ssr' // 新しいインポート
import type { SupabaseClient } from '@supabase/supabase-js' // SupabaseClientは@supabase/supabase-jsから取得
import type { Database } from '@/lib/database.types'

type SupabaseContext = {
  supabase: SupabaseClient<Database>
}

const Context = createContext<SupabaseContext | undefined>(undefined)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() =>
    // createClientComponentClient<Database>({ // 古い関数呼び出しを削除
    //   supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //   supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // })
    createBrowserClient<Database>( // 新しい関数呼び出し
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  )

  return <Context.Provider value={{ supabase }}>{children}</Context.Provider>
}

export const useSupabase = () => {
  const context = useContext(Context)
  if (!context) throw new Error('useSupabase must be used inside SupabaseProvider')
  return context
}
