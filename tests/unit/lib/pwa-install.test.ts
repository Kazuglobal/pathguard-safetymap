import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  isIosDevice,
  isIosPushIncapableVersion,
  isStandaloneDisplayMode,
  shouldShowIosInstallGuide,
} from '@/lib/pwa-install'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
// iPadOS 13+ のデスクトップ表示モードは Mac を名乗る
const IPADOS_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const MAC_UA = IPADOS_DESKTOP_UA
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const originalMatchMedia = window.matchMedia

function defineNavigatorProp(prop: string, value: unknown) {
  Object.defineProperty(window.navigator, prop, {
    value,
    configurable: true,
  })
}

describe('isIosDevice', () => {
  it('iPhone / iPad の UA は true', () => {
    expect(isIosDevice(IPHONE_UA, 5)).toBe(true)
    expect(isIosDevice(IPAD_UA, 5)).toBe(true)
  })

  it('iPadOS デスクトップ表示(Mac UA + タッチ対応)は true', () => {
    expect(isIosDevice(IPADOS_DESKTOP_UA, 5)).toBe(true)
  })

  it('本物の Mac(タッチ非対応)は false', () => {
    expect(isIosDevice(MAC_UA, 0)).toBe(false)
  })

  it('Android / Windows は false', () => {
    expect(isIosDevice(ANDROID_UA, 5)).toBe(false)
    expect(isIosDevice(WINDOWS_UA, 0)).toBe(false)
  })
})

describe('isIosPushIncapableVersion', () => {
  const ua = (osVersion: string) =>
    `Mozilla/5.0 (iPhone; CPU iPhone OS ${osVersion} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1`

  it('Web Push非対応バージョン(16.4未満)は true', () => {
    expect(isIosPushIncapableVersion(ua('15_7'))).toBe(true)
    expect(isIosPushIncapableVersion(ua('16_3'))).toBe(true)
  })

  it('16.4以上は false', () => {
    expect(isIosPushIncapableVersion(ua('16_4'))).toBe(false)
    expect(isIosPushIncapableVersion(ua('17_5'))).toBe(false)
  })

  it('iPadOSデスクトップ表示(Mac UA)は Safari の Version トークンで判定する', () => {
    const desktopUa = (v: string) =>
      `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v} Safari/605.1.15`
    expect(isIosPushIncapableVersion(desktopUa('16.3'))).toBe(true)
    expect(isIosPushIncapableVersion(desktopUa('17.5'))).toBe(false)
  })

  it('バージョンが取れないUAは false(案内を出す側)に倒す', () => {
    expect(isIosPushIncapableVersion('Mozilla/5.0 (iPhone) UnknownBrowser')).toBe(false)
  })
})

describe('isStandaloneDisplayMode', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia
    defineNavigatorProp('standalone', undefined)
  })

  it('ブラウザタブ内(matchMedia不一致・standaloneなし)は false', () => {
    expect(isStandaloneDisplayMode()).toBe(false)
  })

  it('display-mode: standalone にマッチしたら true', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any
    expect(isStandaloneDisplayMode()).toBe(true)
  })

  it('iOS Safari の navigator.standalone が true なら true', () => {
    defineNavigatorProp('standalone', true)
    expect(isStandaloneDisplayMode()).toBe(true)
  })
})

describe('shouldShowIosInstallGuide', () => {
  const originalUserAgent = window.navigator.userAgent

  afterEach(() => {
    defineNavigatorProp('userAgent', originalUserAgent)
    defineNavigatorProp('maxTouchPoints', 0)
    defineNavigatorProp('standalone', undefined)
    window.matchMedia = originalMatchMedia
  })

  it('iPhone のブラウザ閲覧(非standalone)では true', () => {
    defineNavigatorProp('userAgent', IPHONE_UA)
    defineNavigatorProp('maxTouchPoints', 5)
    expect(shouldShowIosInstallGuide()).toBe(true)
  })

  it('iPhone でもホーム画面から standalone 起動していれば false', () => {
    defineNavigatorProp('userAgent', IPHONE_UA)
    defineNavigatorProp('maxTouchPoints', 5)
    defineNavigatorProp('standalone', true)
    expect(shouldShowIosInstallGuide()).toBe(false)
  })

  it('iOS 以外の端末では false', () => {
    defineNavigatorProp('userAgent', WINDOWS_UA)
    expect(shouldShowIosInstallGuide()).toBe(false)
  })

  it('Web Push非対応の古いiOS(16.4未満)では false — 案内しても通知は使えないため', () => {
    const oldIosUa =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1'
    defineNavigatorProp('userAgent', oldIosUa)
    defineNavigatorProp('maxTouchPoints', 5)
    expect(shouldShowIosInstallGuide()).toBe(false)
  })
})
