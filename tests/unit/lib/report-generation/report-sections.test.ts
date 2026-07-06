/**
 * Unit Tests: Route Danger Report — 教育版セクションビルダー
 *
 * jsdom上でDOM構造・文言を検証する。
 * 教育文言のデータソースは createKidsHazardCue / createARLearningContent。
 *
 * Target: lib/report-generation/report-sections.ts
 */

import { describe, it, expect } from 'vitest'
import {
  buildCoverSection,
  buildMapSection,
  buildDangerCardSection,
  buildChecklistSection,
  buildParentGuideSection,
  buildSchoolSummarySection,
  buildReportSections,
} from '@/lib/report-generation/report-sections'
import { createKidsHazardCue } from '@/lib/ar-learning-tour-kids'
import { createARLearningContent } from '@/lib/ar-learning-tour'
import { assignDangerMarkerLabels } from '@/lib/report-generation/report-map'
import { createReportSummary } from '@/lib/report-generation/route-danger-report'
import { mockRoutes } from '../../../fixtures/routes'
import {
  mockDangerReportsNearRoute,
  createMockDangerReport,
} from '../../../fixtures/dangers'
import type { DangerReport, RouteDangerReport } from '@/lib/types'

const MOCK_TOKEN = 'pk.test.mock-token'

function createMockReport(
  dangers: DangerReport[],
  overrides: Partial<RouteDangerReport> = {}
): RouteDangerReport {
  return {
    route: mockRoutes[0],
    dangers,
    bufferMeters: 100,
    generatedAt: '2026-07-06T09:00:00Z',
    summary: createReportSummary(dangers),
    ...overrides,
  }
}

describe('report-sections', () => {
  describe('buildCoverSection', () => {
    it('shows route name and total danger count in kid-friendly wording', () => {
      const report = createMockReport(mockDangerReportsNearRoute)
      const section = buildCoverSection(report)

      expect(section.textContent).toContain(mockRoutes[0].name)
      expect(section.textContent).toContain('つうがくろ あんぜんノート')
      expect(section.textContent).toContain('3 こ')
    })

    it('shows star chips per danger level, highest level first', () => {
      const report = createMockReport(mockDangerReportsNearRoute) // levels 1,2,3
      const section = buildCoverSection(report)
      const text = section.textContent ?? ''

      expect(text).toContain('★★★☆ とてもちゅうい ×1')
      expect(text).toContain('★★☆☆ ちゅうい ×1')
      expect(text).toContain('★☆☆☆ きをつけて ×1')
      // 危険度の高い順に並ぶ
      expect(text.indexOf('★★★☆')).toBeLessThan(text.indexOf('★☆☆☆'))
    })
  })

  describe('buildMapSection', () => {
    it('returns null when the route has no geometry', () => {
      const report = createMockReport(mockDangerReportsNearRoute, {
        route: { ...mockRoutes[0], route_geometry: null },
      })
      expect(buildMapSection(report, MOCK_TOKEN)).toBeNull()
    })

    it('renders the Mapbox static map and callouts with marker labels', () => {
      const report = createMockReport(mockDangerReportsNearRoute)
      const section = buildMapSection(report, MOCK_TOKEN)

      expect(section).not.toBeNull()
      const mapImg = section!.querySelector('img')
      expect(mapImg?.src).toContain('api.mapbox.com')
      // コールアウト: 各危険箇所のタイトルが並ぶ
      for (const danger of mockDangerReportsNearRoute) {
        expect(section!.textContent).toContain(danger.title)
      }
    })
  })

  describe('buildDangerCardSection', () => {
    const trafficDanger = createMockDangerReport({
      id: 'danger-traffic',
      danger_type: 'traffic',
      title: '見通しの悪い交差点',
      description: '右側からの車が見えにくい',
      danger_level: 3,
    })

    it('includes the kid-facing danger explanation and action from createKidsHazardCue', () => {
      const cue = createKidsHazardCue(trafficDanger)
      const section = buildDangerCardSection(trafficDanger, '1')

      expect(section.textContent).toContain('なにが あぶない?')
      expect(section.textContent).toContain(cue.shortMessage)
      expect(section.textContent).toContain('こうすると あんぜん!')
      expect(section.textContent).toContain(cue.action)
    })

    it('includes the parent-facing summary and checkpoints from createARLearningContent', () => {
      const learning = createARLearningContent(trafficDanger)
      const section = buildDangerCardSection(trafficDanger, '1')

      expect(section.textContent).toContain('おうちのかたへ')
      expect(section.textContent).toContain(learning.summary)
      for (const checkpoint of learning.checkpoints) {
        expect(section.textContent).toContain(checkpoint)
      }
    })

    it('prefers server-generated learning content when present', () => {
      const withLearning = createMockDangerReport({
        ...trafficDanger,
        learning_summary: 'LLMが生成した保護者向け解説',
        learning_checkpoints: ['LLM生成チェック1', 'LLM生成チェック2'],
      })
      const section = buildDangerCardSection(withLearning, '1')

      expect(section.textContent).toContain('LLMが生成した保護者向け解説')
      expect(section.textContent).toContain('LLM生成チェック1')
    })

    it('renders level 4 with four stars and the strongest label (regression: level-4 bug)', () => {
      const level4 = createMockDangerReport({ ...trafficDanger, danger_level: 4 })
      const section = buildDangerCardSection(level4, '1')
      const html = section.outerHTML

      expect(section.textContent).toContain('★★★★ いちばんちゅうい')
      // 帯・強調色に赤(#ef4444)が使われている
      expect(/ef4444|rgb\(239,\s*68,\s*68\)/i.test(html)).toBe(true)
    })

    it('renders the marker label passed by the caller', () => {
      const section = buildDangerCardSection(trafficDanger, '0')
      expect(section.textContent).toContain('ちゅういポイント 0')
    })

    it('renders the selected photo with the report image when available', () => {
      const section = buildDangerCardSection(trafficDanger, '1')
      const img = section.querySelector('img')
      expect(img?.src).toBe(trafficDanger.image_url)
    })

    it('omits the photo frame when the danger has no image', () => {
      const noImage = createMockDangerReport({
        ...trafficDanger,
        image_url: null,
        processed_image_urls: null,
      })
      const section = buildDangerCardSection(noImage, '1')
      expect(section.querySelector('img')).toBeNull()
    })

    it('replaces a failed photo with an informative placeholder (broken-image graceful degradation)', () => {
      // 旧ストレージパスの画像が 400/404 を返すと、空の灰色枠のままだった。
      // error 発火時に「読み込めませんでした」プレースホルダへ差し替わることを検証。
      const section = buildDangerCardSection(trafficDanger, '1')
      const img = section.querySelector('img')
      expect(img).not.toBeNull()

      img!.dispatchEvent(new Event('error'))

      expect(section.querySelector('img')).toBeNull()
      const placeholder = section.querySelector('[data-photo-placeholder="broken"]')
      expect(placeholder).not.toBeNull()
      expect(placeholder?.textContent).toContain('よみこめませんでした')
    })
  })

  describe('buildChecklistSection', () => {
    it('renders one handwriting checkbox row per danger with the kid action', () => {
      const section = buildChecklistSection(mockDangerReportsNearRoute)
      const rows = section.querySelectorAll('[data-checklist-item]')

      expect(rows).toHaveLength(mockDangerReportsNearRoute.length)
      for (const danger of mockDangerReportsNearRoute) {
        const cue = createKidsHazardCue(danger)
        expect(section.textContent).toContain(danger.title)
        expect(section.textContent).toContain(cue.action)
      }
      expect(section.textContent).toContain('つうがくろマスター')
    })
  })

  describe('buildParentGuideSection', () => {
    it('renders the static how-to-use guide with positive phrasing examples', () => {
      const section = buildParentGuideSection()

      expect(section.textContent).toContain('このノートの使い方')
      expect(section.textContent).toContain('ここでは いったん止まろうね')
    })
  })

  describe('buildSchoolSummarySection', () => {
    it('contains only the Mapbox map image (no report photos) for privacy', () => {
      const report = createMockReport(mockDangerReportsNearRoute)
      const section = buildSchoolSummarySection(report, MOCK_TOKEN)
      const images = Array.from(section.querySelectorAll('img'))

      expect(images.length).toBeGreaterThan(0)
      for (const img of images) {
        expect(img.src).toContain('api.mapbox.com')
      }
    })

    it('omits danger descriptions for privacy but lists titles and star levels', () => {
      const report = createMockReport(mockDangerReportsNearRoute)
      const section = buildSchoolSummarySection(report, MOCK_TOKEN)
      const text = section.textContent ?? ''

      for (const danger of mockDangerReportsNearRoute) {
        expect(text).toContain(danger.title)
        if (danger.description) {
          expect(text).not.toContain(danger.description)
        }
      }
      expect(text).toContain('★★★☆')
    })
  })

  describe('buildReportSections', () => {
    it('assembles cover / map / cards / checklist / parent guide in order', () => {
      const report = createMockReport(mockDangerReportsNearRoute)
      const sections = buildReportSections(report, MOCK_TOKEN)
      const kinds = sections.map((section) => section.dataset.reportSection)

      expect(kinds).toEqual([
        'cover',
        'map',
        'danger-card',
        'danger-card',
        'danger-card',
        'checklist',
        'parent-guide',
      ])
    })

    it('appends the school summary only when includeSchoolSummary is set', () => {
      const report = createMockReport(mockDangerReportsNearRoute, {
        includeSchoolSummary: true,
      })
      const sections = buildReportSections(report, MOCK_TOKEN)
      expect(sections.at(-1)?.dataset.reportSection).toBe('school-summary')

      const withoutSummary = buildReportSections(
        createMockReport(mockDangerReportsNearRoute),
        MOCK_TOKEN
      )
      expect(
        withoutSummary.every(
          (section) => section.dataset.reportSection !== 'school-summary'
        )
      ).toBe(true)
    })

    it('keeps card/checklist numbering aligned with map pins when a danger has invalid coordinates', () => {
      // 地図ピンは「座標が正規化できた箇所」だけを順に採番する。
      // 生インデックスで採番すると、不正座標の報告が混じった時に番号がズレる(回帰)。
      const invalidCoords = createMockDangerReport({
        id: 'invalid-coords',
        title: '座標が壊れた報告',
        latitude: Number.NaN,
        longitude: Number.NaN,
      })
      const validCoords = createMockDangerReport({
        id: 'valid-coords',
        title: '有効な座標の報告',
      })

      const labels = assignDangerMarkerLabels([invalidCoords, validCoords])
      // 地図に載る箇所が先頭番号、載らない箇所は後ろに続く
      expect(labels.get('valid-coords')).toBe('1')
      expect(labels.get('invalid-coords')).toBe('2')

      const report = createMockReport([invalidCoords, validCoords])
      const sections = buildReportSections(report, MOCK_TOKEN)
      const validCard = sections.find(
        (section) => section.dataset.dangerId === 'valid-coords'
      )
      expect(validCard?.textContent).toContain('ちゅういポイント 1')
    })

    it('renders an empty-state section when there are no dangers', () => {
      const report = createMockReport([])
      const sections = buildReportSections(report, MOCK_TOKEN)
      const kinds = sections.map((section) => section.dataset.reportSection)

      expect(kinds).toContain('empty')
      expect(kinds).not.toContain('danger-card')
      expect(kinds).not.toContain('checklist')
    })
  })
})
