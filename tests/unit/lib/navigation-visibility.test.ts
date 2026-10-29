import { describe, expect, it } from 'vitest'

import { shouldShowFloatingPrompts, shouldShowMobileBottomNav, shouldShowSiteFooter } from '@/lib/navigation-visibility'

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

describe('shouldShowSiteFooter(共通のフッター。UIUX改装 項目32)', () => {
  it('ふつうの画面には出す', () => {
    for (const path of ['/landing', '/routes', '/mypage', '/report', '/terms', '/privacy', '/contact', '/safety-quest', '/school-route-news', '/map-guide']) {
      expect(shouldShowSiteFooter(path)).toBe(true)
    }
  })

  it('全画面の地図・ゲームの画面・自分のフッターを持つ紹介HP・ログイン系の画面には出さない', () => {
    for (const path of ['/map', '/3d-route-poc', '/safety-quest/hunter', '/lp', '/login', '/register', '/forgot-password', '/reset-password']) {
      expect(shouldShowSiteFooter(path)).toBe(false)
    }
  })
})
