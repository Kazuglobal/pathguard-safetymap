import { describe, expect, it } from 'vitest'
import { buildQuizPrintDocument } from '@/lib/report-generation/quiz-print-document'
import type { PhotoQuizView } from '@/lib/hunter/routes/photo-quiz-schema'
const session = { title: '自宅の前から学校', learned: [{ id: 'a', title: '自宅の門', observation: '私有地の詳しいメモ', action: '安全な場所で止まる' }, { id: 'b', title: '曲がり角', observation: '塀がある', action: '左右をたしかめる' }] } as PhotoQuizView
const options = { purpose: 'family' as const, selectedIds: ['a', 'b'], sharedTitle: '', placeNames: {}, furigana: true, generatedAt: '2026-09-09' }
describe('quiz print document', () => {
  it('excludes private names and observations from the school document', () => {
    const source = buildQuizPrintDocument(session, { ...options, purpose: 'school' })
    expect(source.title).toBe('みんなの通学路')
    expect(JSON.stringify(source)).not.toMatch(/自宅|私有地/)
    expect(source.items[0]).toMatchObject({ title: 'たしかめる場所 1', action: '安全な場所で止まる' })
  })
  it('keeps selected order and deduplicates without inserting unavailable items', () => {
    const source = buildQuizPrintDocument(session, { ...options, selectedIds: ['b', 'b', 'missing', 'a'] })
    expect(source.items.map(item => [item.number, item.id])).toEqual([[1, 'b'], [2, 'a']])
    expect(source.furigana).toBe(true)
    expect(source.items[1].observation).toBe('私有地の詳しいメモ')
  })
})
