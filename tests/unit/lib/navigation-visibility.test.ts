import { describe, expect, it } from 'vitest'

import { shouldShowFloatingPrompts, shouldShowMobileBottomNav } from '@/lib/navigation-visibility'

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

describe('shouldShowFloatingPrompts', () => {
  it('does not cover the kids game, the full-screen map, the LP or the auth screens', () => {
    for (const path of ['/safety-quest', '/safety-quest/hunter', '/map', '/lp', '/login', '/register', '/forgot-password', '/reset-password']) {
      expect(shouldShowFloatingPrompts(path)).toBe(false)
    }
  })

  it('shows them on regular screens (and does not match look-alike prefixes)', () => {
    for (const path of ['/landing', '/routes', '/mypage', '/map-guide', '/lpx']) {
      expect(shouldShowFloatingPrompts(path)).toBe(true)
    }
  })
})
