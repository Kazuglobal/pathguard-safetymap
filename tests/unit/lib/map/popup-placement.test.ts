import { describe, expect, it } from 'vitest'

import { overlaySafeArea, popupAnchorForPoint, popupPanOffset } from '@/lib/map/popup-placement'

describe('popupAnchorForPoint', () => {
  it('opens below the point in the upper half and above it in the lower half', () => {
    expect(popupAnchorForPoint(100, 700)).toBe('top')
    expect(popupAnchorForPoint(349, 700)).toBe('top')
    expect(popupAnchorForPoint(350, 700)).toBe('bottom')
    expect(popupAnchorForPoint(650, 700)).toBe('bottom')
  })
})

describe('popupPanOffset', () => {
  const map = { top: 64, bottom: 784 } // ページ上の地図の上端・下端(px)
  const safe = { top: 150, bottom: 130 } // 検索欄・ボタン列の下端まで / 下部ボタンの上端まで

  it('does not move the map when the popup is clear of the overlays', () => {
    expect(popupPanOffset({ top: 300, bottom: 520 }, map, safe)).toBe(0)
  })

  it('moves the map down when the popup hides under the search bar and chips', () => {
    // 地図上端から150pxまでは検索欄・ボタン列。ポップアップ上端が地図上端から90pxなら60px足りない
    expect(popupPanOffset({ top: 154, bottom: 380 }, map, safe)).toBe(-60)
  })

  it('moves the map up when the popup hides behind the bottom buttons', () => {
    // 下の安全域の上端は 784-130=654。ポップアップ下端が700なら46px足りない
    expect(popupPanOffset({ top: 470, bottom: 700 }, map, safe)).toBe(46)
  })

  it('keeps the top of the popup visible when it is taller than the free space', () => {
    expect(popupPanOffset({ top: 100, bottom: 760 }, map, safe)).toBe(-114)
  })
})

describe('overlaySafeArea', () => {
  it('measures the space taken by the search bar and the bottom buttons, with a small gap', () => {
    const map = { top: 64, bottom: 784 }
    expect(overlaySafeArea(map, {
      top: [{ top: 76, bottom: 206 }],
      bottom: [{ top: 640, bottom: 690 }],
    })).toEqual({ top: 150, bottom: 152 })
  })

  it('ignores hidden overlays and returns zero when there are none', () => {
    expect(overlaySafeArea({ top: 0, bottom: 700 }, { top: [{ top: 0, bottom: 0 }], bottom: [] })).toEqual({ top: 0, bottom: 0 })
  })
})
