import { describe, expect, it } from 'vitest'

import { shouldShowFloatingPrompts, shouldShowMobileBottomNav, shouldShowPushPrompts, shouldShowSiteFooter } from '@/lib/navigation-visibility'

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

describe('shouldShowPushPrompts(通知のお願い。UIUX改装 項目37)', () => {
  it('マイページはいちばん上に同じカードを出すので、浮かべない', () => {
    expect(shouldShowPushPrompts('/mypage')).toBe(false)
  })

  it('浮かぶお願いを出さない画面では、通知のお願いも出さない', () => {
    for (const path of ['/safety-quest/hunter', '/map', '/lp', '/login']) {
      expect(shouldShowPushPrompts(path)).toBe(false)
    }
  })

  it('ふつうの画面には出す(よく似た名前の画面は区別する)', () => {
    for (const path of ['/landing', '/routes', '/report', '/mypagex']) {
      expect(shouldShowPushPrompts(path)).toBe(true)
    }
  })
})

describe('shouldShowSiteFooter(共通のフッター。UIUX改装 項目32)', () => {
  it('ふつうの画面と、ログイン系の画面には出す(ログイン系はナビを出さないが、フッターは出す)', () => {
    for (const path of ['/landing', '/routes', '/mypage', '/report', '/terms', '/privacy', '/contact', '/safety-quest', '/school-route-news', '/map-guide', '/login', '/register', '/forgot-password', '/reset-password']) {
      expect(shouldShowSiteFooter(path)).toBe(true)
    }
  })

  it('全画面の地図・ゲームの画面・自分のフッターを持つ紹介HPには出さない', () => {
    for (const path of ['/map', '/3d-route-poc', '/safety-quest/hunter', '/lp']) {
      expect(shouldShowSiteFooter(path)).toBe(false)
    }
  })
})
