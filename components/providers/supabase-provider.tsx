'use client'

import React, { createContext, useContext, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

type SupabaseContext = {
  supabase: any
}

const Context = createContext<SupabaseContext | undefined>(undefined)

export function isAbortLikeFetchError(error: unknown): boolean {
  if (!error) return false
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name ?? '')
      : ''
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : String(error)

  const lower = `${name} ${message}`.toLowerCase()
  return (
    lower.includes('aborterror') ||
    lower.includes('signal is aborted') ||
    lower.includes('operation was aborted') ||
    lower.includes('the operation was aborted')
  )
}

export function createSafeSupabaseFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    try {
      return await baseFetch(input, init)
    } catch (error) {
      // Abort is expected during navigation/unmount; avoid noisy console warnings.
      if (isAbortLikeFetchError(error)) {
        throw error
      }

      console.warn('[Supabase] fetchが失敗しました。オフラインモードを継続します。', error)
      return new Response(
        JSON.stringify({ error: 'network_error', message: 'Supabase fetch failed' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }
}

const isValidSupabaseUrl = (url: string | undefined): boolean => {
  if (!url) return false
  // Check for placeholder/redacted values
  if (url === 'REDACTED_SUPABASE_URL' || url.includes('REDACTED')) return false
  // Check for valid Supabase URL format
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.includes('supabase')
  } catch {
    return false
  }
}

const buildSupabaseClient = (): any => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const safeFetch = createSafeSupabaseFetch()

  if (!url || !isValidSupabaseUrl(url) || !anonKey) {
    console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定または無効です。ダミークライアントを返します。')
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
      autoRefreshToken: true,
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
