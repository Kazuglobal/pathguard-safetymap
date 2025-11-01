'use client'

import React, { createContext, useContext, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type SupabaseContext = {
  supabase: SupabaseClient<Database>
}

const Context = createContext<SupabaseContext | undefined>(undefined)

const buildSupabaseClient = (): SupabaseClient<Database> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const safeFetch: typeof fetch = async (input, init) => {
    try {
      return await fetch(input, init)
    } catch (error) {
      console.warn('[Supabase] fetchが失敗しました。オフラインモードを継続します。', error)
      return new Response(
        JSON.stringify({ error: 'network_error', message: 'Supabase fetch failed' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  if (!url || !anonKey) {
    console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です。ダミークライアントを返します。')
    return createBrowserClient<Database>('https://example.supabase.co', 'public-anon-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: safeFetch,
      },
    })
  }

  return createBrowserClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
    },
    global: {
      fetch: safeFetch,
    },
  })
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(buildSupabaseClient, [])
  return <Context.Provider value={{ supabase }}>{children}</Context.Provider>
}

export const useSupabase = () => {
  const context = useContext(Context)
  if (!context) throw new Error('useSupabase must be used inside SupabaseProvider')
  return context
}
