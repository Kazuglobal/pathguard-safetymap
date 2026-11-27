// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

import { describe, expect, it } from 'vitest'

// Cloudflare Workers Paid (10 MiB compressed limit) ではアプリ全体を単一 Worker で動かす。
// 手動ルート分割を置かないことで振り分け漏れによる 500 を構造的に防ぎ、
// 本番・PR プレビューともに 1 デプロイ = 1 Worker に抑える。

const root = process.cwd()

function readWranglerConfig(): {
  name?: string
  services?: Array<{ binding: string; service: string }>
  d1_databases?: Array<{ binding: string; database_name: string }>
} {
  const source = readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8')
  const parsed = ts.parseConfigFileTextToJson('wrangler.jsonc', source)
  if (parsed.error) throw new Error('Cannot parse wrangler.jsonc')
  return parsed.config
}

describe('Cloudflare single-Worker configuration', () => {
  it('uses a single default OpenNext server function without manual route splitting', () => {
    const config = readFileSync(path.join(root, 'open-next.config.ts'), 'utf8')
    expect(config).not.toMatch(/config\.functions\s*=/)
    expect(config).not.toMatch(/OPENNEXT_TARGET/)
  })

  it('binds only WORKER_SELF_REFERENCE and includes both DB and TRAFFIC_DB on the single Worker', () => {
    const wrangler = readWranglerConfig()
    expect(wrangler.name).toBe('pathguardian')
    expect(wrangler.services).toEqual([
      { binding: 'WORKER_SELF_REFERENCE', service: 'pathguardian' },
    ])
    const d1Bindings = (wrangler.d1_databases ?? []).map((db) => db.binding).sort()
    expect(d1Bindings).toEqual(['DB', 'TRAFFIC_DB'])
  })
})
