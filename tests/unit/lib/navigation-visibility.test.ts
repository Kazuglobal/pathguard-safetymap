import { describe, expect, it } from 'vitest'

import { shouldShowMobileBottomNav } from '@/lib/navigation-visibility'

describe('shouldShowMobileBottomNav', () => {
  it('hides the bottom tab bar on the map so the map gets the full height', () => {
    expect(shouldShowMobileBottomNav('/map')).toBe(false)
  })

  it('keeps it on every other screen', () => {
    for (const path of ['/landing', '/routes', '/mypage', '/report', '/map-guide', '/3d-route-poc']) {
      expect(shouldShowMobileBottomNav(path)).toBe(true)
    }
  })
})
