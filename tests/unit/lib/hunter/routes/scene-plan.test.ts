import { describe, expect, it } from 'vitest'
import { buildScenePlan, type RoutePhoto } from '@/lib/hunter/routes/scene-plan'

const photo = (id: string, sceneId: string, extra: Partial<RoutePhoto> = {}): RoutePhoto => ({
  id, sceneId, included: true, maskingReviewed: true, ...extra,
})

describe('buildScenePlan', () => {
  it('keeps the user-confirmed route order and separates distant scenes', () => {
    expect(buildScenePlan([photo('b', 'crossing'), photo('a', 'crossing'), photo('c', 'canal')])).toEqual([
      { sceneId: 'crossing', photoIds: ['b', 'a'] }, { sceneId: 'canal', photoIds: ['c'] },
    ])
  })
  it('excludes home photos before validating or preparing generation', () => {
    const result = buildScenePlan([photo('home', '', { included: false, maskingReviewed: false }), photo('a', 'school')])
    expect(result).toEqual([{ sceneId: 'school', photoIds: ['a'] }])
    expect(JSON.stringify(result)).not.toContain('home')
  })
  it('rejects unreviewed masking', () => {
    expect(() => buildScenePlan([photo('a', 'school', { maskingReviewed: false })])).toThrow()
  })
  it('requires a scene assignment rather than guessing from photo position', () => {
    expect(() => buildScenePlan([photo('a', '')])).toThrow()
  })
  it('rejects repeated noncontiguous scene groups instead of silently changing route order', () => {
    expect(() => buildScenePlan([photo('a', 'one'), photo('b', 'two'), photo('c', 'one')])).toThrow()
  })
  it('rejects empty inputs and duplicate photo references', () => {
    expect(() => buildScenePlan([])).toThrow()
    expect(() => buildScenePlan([photo('a', 'one'), photo('a', 'one')])).toThrow()
  })
  it('does not mutate the input', () => {
    const input = Object.freeze([Object.freeze(photo('a', 'one'))])
    expect(buildScenePlan(input)[0].photoIds).toEqual(['a'])
  })
})
