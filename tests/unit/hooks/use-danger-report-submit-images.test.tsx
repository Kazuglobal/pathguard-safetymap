import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDangerReportSubmit } from '@/hooks/use-danger-report-submit'

vi.mock('@/lib/map/reverse-geocode', () => ({ reverseGeocodeLocation: async () => ({ prefecture: null, city: null }) }))
const original = '/api/media/private/danger-reports/owner/report/original.webp'
const processed = '/api/media/private/danger-reports/owner/report/processed.webp'

describe('processed report attachments', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([true, false])('keeps processed uploads in the submitted preview (has original: %s)', async (hasOriginal) => {
    const setSubmittedReport = vi.fn()
    const uploads: string[] = []
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      if (url === '/api/reports') return new Response(JSON.stringify({ report: { id: 'report', title: '交差点', image_url: null, processed_image_urls: [] } }))
      if (url === '/api/image/process') {
        const form = options.body as FormData
        const imageType = String(form.get('imageType'))
        uploads.push(imageType)
        expect(form.get('file')).toBeInstanceOf(File)
        return new Response(JSON.stringify(imageType === 'original' ? { imageUrl: original } : { processedImageUrl: processed, updatedUrls: [processed] }))
      }
      return new Response('{}')
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      const { result } = renderHook(() => useDangerReportSubmit({
        supabase: { auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) } },
        selectedLocation: [139.7, 35.6], selectedUserRoute: null, toast: vi.fn(), setSubmittedReport,
      }))
      const response = await result.current({
        title: '交差点', danger_type: 'other', danger_level: 1,
        ...(hasOriginal ? { originalImageFile: new File(['original'], 'original.png', { type: 'image/png' }) } : {}),
        processedImageFiles: [new File(['processed'], 'processed.png', { type: 'image/png' })],
      })
      expect(uploads).toEqual(hasOriginal ? ['original', 'processed'] : ['processed'])
      expect(setSubmittedReport).toHaveBeenCalledWith(expect.objectContaining({ originalImage: hasOriginal ? original : null, processedImages: [processed] }))
      expect(response.imageUrl).toBe(hasOriginal ? original : processed)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
