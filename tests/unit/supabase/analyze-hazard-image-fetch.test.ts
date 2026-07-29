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

  it('IPv6 リテラルの角括弧を外して私有アドレスを判定する', () => {
    // WHATWG URL の hostname は "[::1]" を返すため、角括弧を外さないと IPv6 判定が効かない
    expect(source).toContain('isPrivateIpv6Address')
    expect(source).toMatch(/host\.startsWith\("\["\)/)
  })

  it('本文はサイズ上限で打ち切って読む(content-length の自己申告に依存しない)', () => {
    expect(source).toContain('readBodyWithCap')
    expect(source).not.toContain('await imageResponse.arrayBuffer()')
  })
})
