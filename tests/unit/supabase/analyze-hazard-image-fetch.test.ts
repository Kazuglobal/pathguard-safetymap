import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 回帰テスト: analyze-hazard エッジファンクションの画像取得は
 * リダイレクトを追従しないこと。
 *
 * リダイレクト先 URL は validateImageUrl の検証(https 強制・プライベート IP
 * 拒否・allowlist)を経ないため、追従を許すと攻撃者サーバの 302 で内部
 * エンドポイントへ誘導される SSRF 経路になる。index.ts は Deno 専用で
 * vitest から import できないため、不変条件をテキストレベルで固定する。
 */
describe('analyze-hazard image fetch (supabase/functions/analyze-hazard/index.ts)', () => {
  const source = readFileSync(
    join(process.cwd(), 'supabase', 'functions', 'analyze-hazard', 'index.ts'),
    'utf-8'
  )

  it('fetch(imageUrl) は redirect: "manual" でリダイレクトを追従しない', () => {
    expect(source).toMatch(/fetch\(imageUrl,\s*\{[^}]*redirect:\s*"manual"/)
  })

  it('リダイレクト応答(opaqueredirect / 3xx)をエラーとして扱うガードがある', () => {
    expect(source).toContain('opaqueredirect')
    expect(source).toContain('Redirected image URLs are not supported')
  })

  it('ホスト判定は url-guard.ts に委譲する(実挙動テストは analyze-hazard-url-guard.test.ts)', () => {
    // 判定ロジックを index.ts に直書きすると Deno 依存で vitest から実行できず、
    // ソース文字列の照合しか書けない = 判定が死んでいても検出できない
    expect(source).toContain('./url-guard.ts')
    expect(source).not.toMatch(/function\s+isPrivateOrLoopbackHost/)
  })

  it('本文はサイズ上限で打ち切って読む(content-length の自己申告に依存しない)', () => {
    expect(source).toContain('readBodyWithCap')
    expect(source).not.toContain('await imageResponse.arrayBuffer()')
  })
})
