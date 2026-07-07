/**
 * Unit Tests: assignDangerMarkerLabels
 *
 * 危険箇所ID→マーカーラベルの採番。地図ピンは先頭36件(MAP_MARKER_LIMIT)のみ
 * 1文字ラベルで描画されるため、36件を超えても番号が重複しないことを保証する
 * (旧実装は37件目以降が全て 'z' に潰れ、カード/チェックリストの番号が重複していた)。
 *
 * Target: lib/report-generation/report-map.ts
 */

import { describe, it, expect } from 'vitest'
import { assignDangerMarkerLabels } from '@/lib/report-generation/report-map'
import { createMockDangerReport } from '../../../fixtures/dangers'

describe('assignDangerMarkerLabels', () => {
  it('assigns unique labels even when dangers exceed the 36-pin limit', () => {
    // 有効座標の危険箇所を40件(>36)作る
    const dangers = Array.from({ length: 40 }, (_, i) =>
      createMockDangerReport({ id: `danger-${i}` })
    )

    const labels = assignDangerMarkerLabels(dangers)

    expect(labels.size).toBe(40)
    // 全ラベルが一意(重複なし) ← これが回帰対象
    const values = [...labels.values()]
    expect(new Set(values).size).toBe(40)
    // 先頭36件は1文字ラベル、37件目以降は連番("37"..)
    expect(labels.get('danger-35')).toBe('z') // 36番目 = 末尾の1文字
    expect(labels.get('danger-36')).toBe('37') // 37番目 = 連番
    expect(labels.get('danger-39')).toBe('40')
  })

  it('keeps the original 1..z labels for the first 36 dangers', () => {
    const dangers = Array.from({ length: 12 }, (_, i) =>
      createMockDangerReport({ id: `d-${i}` })
    )
    const labels = assignDangerMarkerLabels(dangers)

    expect(labels.get('d-0')).toBe('1')
    expect(labels.get('d-8')).toBe('9')
    expect(labels.get('d-9')).toBe('0') // 10番目
    expect(labels.get('d-10')).toBe('a')
  })
})
