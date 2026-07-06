/**
 * Unit Tests: packSectionsIntoPages
 *
 * PDFのセクション→ページ割付の純関数。カードがページ境界で
 * 分断されないことを保証する中核ロジック。
 *
 * Target: lib/report-generation/route-danger-report.ts
 */

import { describe, it, expect } from 'vitest'
import { packSectionsIntoPages } from '@/lib/report-generation/route-danger-report'

describe('packSectionsIntoPages', () => {
  const PAGE = 277 // A4(297mm) - 余白10mm×2

  it('puts everything on one page when it fits', () => {
    expect(packSectionsIntoPages([100, 100, 70], PAGE)).toEqual([[0, 1, 2]])
  })

  it('starts a new page when the next section would overflow', () => {
    expect(packSectionsIntoPages([150, 150, 100], PAGE)).toEqual([[0], [1, 2]])
  })

  it('never splits a section that fits on a page (no mid-card page break)', () => {
    const pages = packSectionsIntoPages([200, 200, 200], PAGE)
    expect(pages).toEqual([[0], [1], [2]])
  })

  it('gives an oversized section its own page group', () => {
    const pages = packSectionsIntoPages([50, 400, 50], PAGE)
    expect(pages).toEqual([[0], [1], [2]])
  })

  it('keeps an oversized first section alone even when followed by small ones', () => {
    const pages = packSectionsIntoPages([400, 10, 10], PAGE)
    expect(pages).toEqual([[0], [1, 2]])
  })

  it('handles the exact-fit boundary without an extra page', () => {
    expect(packSectionsIntoPages([100, 177], PAGE)).toEqual([[0, 1]])
    expect(packSectionsIntoPages([100, 178], PAGE)).toEqual([[0], [1]])
  })

  it('returns no pages for an empty input', () => {
    expect(packSectionsIntoPages([], PAGE)).toEqual([])
  })
})
