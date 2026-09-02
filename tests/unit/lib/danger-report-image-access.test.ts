import { describe, expect, it } from 'vitest'

import {
  dangerReportDisplayUrl,
  useDangerReportSignedImageUrl,
  useDangerReportSignedImageUrls,
} from '@/lib/danger-report-image-access'

describe('danger report R2 image compatibility hooks', () => {
  it('maps a persisted key to the authenticated private route synchronously', () => {
    expect(useDangerReportSignedImageUrl(
      null,
      'danger-reports/user-1/report-1/photo one.webp',
    )).toBe('/api/media/private/danger-reports/user-1/report-1/photo%20one.webp')
  })

  it('keeps local previews but rejects legacy absolute URL fallbacks', () => {
    expect(dangerReportDisplayUrl('blob:http://localhost/preview')).toBe('blob:http://localhost/preview')
    expect(dangerReportDisplayUrl('data:image/webp;base64,AAAA')).toBe('data:image/webp;base64,AAAA')
    expect(dangerReportDisplayUrl('https://old-project.supabase.co/photo.webp')).toBeNull()
    expect(dangerReportDisplayUrl(null)).toBeNull()
  })

  it('preserves list order and null placeholders', () => {
    expect(useDangerReportSignedImageUrls(null, [
      'danger-reports/u/r/one.webp',
      null,
      'danger-reports/u/r/two.webp',
    ])).toEqual([
      '/api/media/private/danger-reports/u/r/one.webp',
      null,
      '/api/media/private/danger-reports/u/r/two.webp',
    ])
  })
})
