import { describe, expect, it } from 'vitest'
import { buildPrintDocument } from '@/lib/report-generation/print-document'
import { mockRoutes } from '../../../fixtures/routes'
import { mockDangerReportsNearRoute } from '../../../fixtures/dangers'

const route = { ...mockRoutes[0], name: '個人名が入る家庭用ルート', child_name: '子どもの名前' }
const dangers = mockDangerReportsNearRoute.map((danger, index) => ({ ...danger, id: `d${index}`, description: '個人の詳しいメモ', image_url: 'https://example.test/private-photo.jpg' }))

describe('print document boundary', () => {
  it('uses exactly the selected order, ignoring duplicates and missing IDs', () => {
    const doc = buildPrintDocument({ route, dangers, purpose: 'family', selectedIds: ['d1', 'missing', 'd0', 'd1'], includePhotos: false })
    expect(doc.items.map(item => item.id)).toEqual(['d1', 'd0'])
    expect(doc.items.map(item => item.number)).toEqual([1, 2])
  })
  it('creates an independent school document without private fields, map or photos', () => {
    const doc = buildPrintDocument({ route, dangers, purpose: 'school', selectedIds: dangers.map(d => d.id), includePhotos: true, includeMap: true })
    const serialized = JSON.stringify(doc)
    for (const privateText of [route.name, route.child_name, route.start_address, route.end_address, '個人の詳しいメモ', 'private-photo.jpg']) expect(serialized).not.toContain(privateText)
    expect(doc.mapUrl).toBeUndefined()
    expect(doc.title).toBe('みんなの通学路')
    expect(doc.items.every(item => !item.photoUrl)).toBe(true)
  })
  it('supports empty selection without silently including every point', () => {
    expect(buildPrintDocument({ route, dangers, purpose: 'family', selectedIds: [] }).items).toEqual([])
  })
  it('does not truncate a long family description', () => {
    const description = '長い説明を途中で切りません。'.repeat(40)
    const doc = buildPrintDocument({ route, dangers: [{ ...dangers[0], description }], purpose: 'family', selectedIds: ['d0'] })
    expect(doc.items[0].observation).toBe(description)
  })
  it('supports private R2 photo keys and honors the selected photo', () => {
    const original = 'danger-reports/owner/report/original.webp'
    const processed = 'danger-reports/owner/report/processed.webp'
    const photoDanger = { ...dangers[0], image_url: original, processed_image_urls: [processed] }
    const options = { route, dangers: [photoDanger], purpose: 'family' as const, selectedIds: ['d0'], includePhotos: true }
    expect(buildPrintDocument(options).items[0].photoUrl).toBe(`/api/media/private/${processed}`)
    expect(buildPrintDocument({ ...options, selectedImageUrls: { d0: original } }).items[0].photoUrl).toBe(`/api/media/private/${original}`)
    expect(buildPrintDocument({ ...options, selectedImageUrls: { d0: 'https://unrelated.test/photo.jpg' } }).items[0].photoUrl).toBe(`/api/media/private/${processed}`)
  })
})
