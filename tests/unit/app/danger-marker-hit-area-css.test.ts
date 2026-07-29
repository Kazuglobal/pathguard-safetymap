import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 回帰テスト: 危険マーカーの当たり判定は可視ピンのみに限定すること。
 *
 * .danger-marker の外形(76×68px)は左右に広い透明余白を持ち、そのまま
 * 当たり判定にすると近接ピンのタップを横取りして別レポートの詳細が開く
 * (誤った user_id へのポイント付与も発生する)。jsdom ではヒットテストを
 * 再現できないため、CSS の不変条件をテキストレベルで固定する。
 */
describe('danger-marker hit area (app/globals.css)', () => {
  const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf-8')

  it('.danger-marker 本体は pointer-events: none で当たり判定を持たない', () => {
    expect(css).toMatch(/\.danger-marker\s*\{[^}]*pointer-events:\s*none/)
  })

  it('.danger-pin-shape(可視ピン)だけが pointer-events: auto で当たり判定を持つ', () => {
    expect(css).toMatch(/\.danger-pin-shape\s*\{[^}]*pointer-events:\s*auto/)
  })
})
