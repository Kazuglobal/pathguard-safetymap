/**
 * Route Danger Report — Image Selection Helpers
 *
 * 危険箇所の表示写真候補(報告画像/加工画像)の列挙と選択解決。
 * route-danger-report.ts から抽出したモジュール(挙動は同一)。
 * 公開APIの互換のため route-danger-report.ts からも re-export される。
 */

import type { DangerReport } from '@/lib/types'

export interface DangerImageOption {
  label: string
  type: 'original' | 'processed'
  url: string
}

export function getDangerImageOptions(danger: DangerReport): DangerImageOption[] {
  const processedOptions: DangerImageOption[] = []
  for (const [index, url] of (danger.processed_image_urls ?? []).entries()) {
    const safeUrl = sanitizeImageUrl(url)
    if (!safeUrl) {
      continue
    }

    processedOptions.push({
      label: `加工画像 ${index + 1}`,
      type: 'processed',
      url: safeUrl,
    })
  }

  const originalImageUrl = sanitizeImageUrl(danger.image_url)
  const originalOptions = originalImageUrl
    ? [
        {
          label: '報告画像',
          type: 'original' as const,
          url: originalImageUrl,
        },
      ]
    : []

  const seenUrls = new Set<string>()

  return [...originalOptions, ...processedOptions].filter((option) => {
    if (seenUrls.has(option.url)) {
      return false
    }

    seenUrls.add(option.url)
    return true
  })
}

export function resolveDangerDisplayImageUrl(
  danger: DangerReport,
  selectedImageUrls?: Record<string, string>
): string | null {
  const options = getDangerImageOptions(danger)
  if (options.length === 0) {
    return null
  }

  const selectedImageUrl = selectedImageUrls?.[danger.id]
  if (selectedImageUrl && options.some((option) => option.url === selectedImageUrl)) {
    return selectedImageUrl
  }

  return options[0]?.url ?? null
}

export function sanitizeImageUrl(url: string | null): string | null {
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}
