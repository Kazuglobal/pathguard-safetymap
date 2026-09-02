"use client"

import type { SupabaseClient } from '@supabase/supabase-js'

import { privateMediaUrl } from '@/lib/media/url'

function isLocalPreviewUrl(value: string): boolean {
  return value.startsWith('blob:') || value.startsWith('data:')
}

function displayUrl(key: string | null | undefined): string | null {
  if (!key) return null
  if (isLocalPreviewUrl(key)) return key
  if (key.startsWith('/api/media/private/')) return key
  try {
    return privateMediaUrl(key)
  } catch {
    return null
  }
}

/**
 * Compatibility hook for existing callers. Media keys now map synchronously to the
 * authenticated R2 streaming route; Supabase is retained only in the public signature.
 */
export function useDangerReportSignedImageUrl(
  _client: SupabaseClient | null | undefined,
  key: string | null | undefined,
  _ttlSeconds = 3600,
  _bucketName = 'danger-reports',
): string | null {
  return displayUrl(key)
}

/** Preserves input ordering and null placeholders while mapping keys to R2 URLs. */
export function useDangerReportSignedImageUrls(
  _client: SupabaseClient | null | undefined,
  keys: ReadonlyArray<string | null | undefined> | null | undefined,
  _ttlSeconds = 3600,
  _bucketName = 'danger-reports',
): Array<string | null> {
  return (keys ?? []).map(displayUrl)
}

export function dangerReportDisplayUrl(key: string | null | undefined): string | null {
  return displayUrl(key)
}
