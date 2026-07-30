import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 危険マーカーの当たり判定は「見えている形」に限定すること。
 * マーカーの箱は可視ピンより大きく、透明余白が当たり判定を持つと近接ピンのタップを
 * 横取りして別レポートの詳細が開く(誤った user_id へのポイント付与も発生する)。
 *
 * **実挙動の検証は `node scripts/verify-marker-hit-area.mjs`**(実ブラウザでヒットテスト)。
 * jsdom はヒットテストを再現できないため、ここでは実挙動が依存する
 * CSS の構造だけを固定する。特に「SVGルートに auto を戻さないこと」は重要 ——
 * SVGルート要素は透明部分も含めて箱全体で当たり判定を取るため(Chrome実測)、
 * ルートに auto を付けると限定が丸ごと無効化される(過去に実際そうなっていた)。
 */
describe('danger-marker hit area (app/globals.css)', () => {
  const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf-8')

  const ruleBody = (selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(css)
    return match?.[1] ?? ''
  }

  it('マーカーのルート要素は当たり判定を持たない', () => {
    expect(ruleBody('.danger-marker')).toMatch(/pointer-events:\s*none/)
    expect(ruleBody('.danger-cluster-marker')).toMatch(/pointer-events:\s*none/)
  })

  it('ピンのSVGルートには auto を戻さない(戻すと箱全体が当たり判定に復活する)', () => {
    expect(ruleBody('.danger-pin-shape')).toMatch(/pointer-events:\s*none/)
    expect(ruleBody('.danger-cluster-pin')).toMatch(/pointer-events:\s*none/)
  })

  it('当たり判定はSVG内側の図形と、可視のクラスタ要素だけに戻す', () => {
    expect(ruleBody('.danger-pin-shape > *')).toMatch(/pointer-events:\s*auto/)
    expect(css).toMatch(
      /\.danger-cluster-pin\s*>\s*\*,\s*\.danger-cluster-categories,\s*\.danger-cluster-count\s*\{[^}]*pointer-events:\s*auto/
    )
  })
})
