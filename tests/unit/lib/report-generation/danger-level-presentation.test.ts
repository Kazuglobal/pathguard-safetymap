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

    it('provides Tailwind classes for every level (badge/border-accent/surface)', () => {
      for (let level = 1; level <= DANGER_LEVEL_MAX; level += 1) {
        const p = getDangerLevelPresentation(level)
        expect(p.badgeClass).toMatch(/^bg-\w+-100 text-\w+-800 border-\w+-200$/)
        expect(p.borderAccentClass).toMatch(/^border-l-\w+-500$/)
        expect(p.surface.bg).toMatch(/^bg-\w+-50$/)
        expect(p.surface.text).toMatch(/^text-\w+-800$/)
        expect(p.surface.border).toMatch(/^border-\w+-200$/)
        expect(p.surface.band).toMatch(/^bg-\w+-500$/)
      }
    })

    it('never uses green for any level (a danger report must not look safe)', () => {
      for (let level = 1; level <= DANGER_LEVEL_MAX; level += 1) {
        const p = getDangerLevelPresentation(level)
        const allClasses = [
          p.badgeClass,
          p.borderAccentClass,
          p.surface.bg,
          p.surface.text,
          p.surface.border,
          p.surface.band,
        ].join(' ')
        expect(allClasses).not.toMatch(/green|lime|emerald/)
        expect(p.colorHex).not.toBe('#22c55e')
      }
    })

    it('uses the same hue family within a level (badge/accent/surface do not mix hues)', () => {
      for (let level = 1; level <= DANGER_LEVEL_MAX; level += 1) {
        const p = getDangerLevelPresentation(level)
        const hue = p.badgeClass.match(/^bg-(\w+)-100/)?.[1]
        expect(hue).toBeTruthy()
        expect(p.borderAccentClass).toBe(`border-l-${hue}-500`)
        expect(p.surface.bg).toBe(`bg-${hue}-50`)
        expect(p.surface.band).toBe(`bg-${hue}-500`)
      }
    })
  })
})
