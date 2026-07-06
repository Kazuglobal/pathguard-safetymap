/**
 * Unit Tests: Danger Level Presentation
 *
 * レベル1〜4の表示定義（子ども向けラベル・星・色・バッジ）の一元化モジュール。
 * レベル4が「低」扱いになるバグ（最危険が最安全に見える）の再発防止網を兼ねる。
 *
 * Target: lib/report-generation/danger-level-presentation.ts
 */

import { describe, it, expect } from 'vitest'
import {
  getDangerLevelPresentation,
  DANGER_LEVEL_MAX,
} from '@/lib/report-generation/danger-level-presentation'

describe('danger-level-presentation', () => {
  describe('getDangerLevelPresentation', () => {
    it('returns level 1 presentation (きをつけて / ★☆☆☆ / yellow)', () => {
      const p = getDangerLevelPresentation(1)
      expect(p.level).toBe(1)
      expect(p.kidLabel).toBe('きをつけて')
      expect(p.stars).toBe('★☆☆☆')
      expect(p.colorHex).toBe('#eab308')
      expect(p.pinColor).toBe('eab308')
      expect(p.badgeVariant).toBe('outline')
    })

    it('returns level 2 presentation (ちゅうい / ★★☆☆ / amber)', () => {
      const p = getDangerLevelPresentation(2)
      expect(p.level).toBe(2)
      expect(p.kidLabel).toBe('ちゅうい')
      expect(p.stars).toBe('★★☆☆')
      expect(p.colorHex).toBe('#f59e0b')
      expect(p.badgeVariant).toBe('secondary')
    })

    it('returns level 3 presentation (とてもちゅうい / ★★★☆ / orange)', () => {
      const p = getDangerLevelPresentation(3)
      expect(p.level).toBe(3)
      expect(p.kidLabel).toBe('とてもちゅうい')
      expect(p.stars).toBe('★★★☆')
      expect(p.colorHex).toBe('#f97316')
      expect(p.badgeVariant).toBe('destructive')
    })

    it('returns level 4 presentation (いちばんちゅうい / ★★★★ / red) — regression for the level-4 bug', () => {
      const p = getDangerLevelPresentation(4)
      expect(p.level).toBe(4)
      expect(p.kidLabel).toBe('いちばんちゅうい')
      expect(p.stars).toBe('★★★★')
      expect(p.colorHex).toBe('#ef4444')
      expect(p.pinColor).toBe('ef4444')
      expect(p.badgeVariant).toBe('destructive')
      expect(p.kidPhrase).toContain('おうちのひと')
    })

    it('clamps out-of-range levels instead of falling back to the safest look', () => {
      expect(getDangerLevelPresentation(0).level).toBe(1)
      expect(getDangerLevelPresentation(-1).level).toBe(1)
      expect(getDangerLevelPresentation(5).level).toBe(4)
      expect(getDangerLevelPresentation(99).level).toBe(4)
    })

    it('clamps non-finite levels to level 1', () => {
      expect(getDangerLevelPresentation(Number.NaN).level).toBe(1)
      expect(getDangerLevelPresentation(Number.POSITIVE_INFINITY).level).toBe(4)
    })

    it('provides a kid phrase for every level', () => {
      for (let level = 1; level <= DANGER_LEVEL_MAX; level += 1) {
        const p = getDangerLevelPresentation(level)
        expect(p.kidPhrase.length).toBeGreaterThan(0)
        expect(p.stars).toHaveLength(4)
      }
    })

    it('keeps pinColor consistent with colorHex (hash-less hex for Mapbox pins)', () => {
      for (let level = 1; level <= DANGER_LEVEL_MAX; level += 1) {
        const p = getDangerLevelPresentation(level)
        expect(`#${p.pinColor}`).toBe(p.colorHex)
      }
    })
  })
})
