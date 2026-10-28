// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// open-next.config.ts はページ・API を Worker ごとに手で振り分けている。
// 振り分けに載っていないルートは、本番で読み込めずに素の 500 を返す
// （2026-10-07、/api/traffic-accidents/hotspots で発生）。追加し忘れをここで止める。

const root = process.cwd()

// メタデータのファイル(app/manifest.ts など)もルートとしてビルドされる。page/route と同じく振り分けが要る
// (2026-10-29、PWA の manifest が振り分け漏れで本番 500 になる寸前だった)
const METADATA_ROUTE_FILES: Record<string, string> = {
  manifest: 'manifest.webmanifest/route',
  robots: 'robots.txt/route',
  sitemap: 'sitemap.xml/route',
}

function appRoutes(): string[] {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/^(page|route)\.(t|j)sx?$/.test(entry.name)) {
        found.push(path.relative(root, full).split(path.sep).join('/').replace(/\.(t|j)sx?$/, ''))
      } else {
        const metadata = entry.name.match(/^(manifest|robots|sitemap)\.(t|j)s$/)
        if (metadata) {
          const dirRel = path.relative(root, dir).split(path.sep).join('/')
          found.push(`${dirRel}/${METADATA_ROUTE_FILES[metadata[1]]}`)
        }
      }
    }
  }
  walk(path.join(root, 'app'))
  return found.sort()
}

function splitRoutes(): string[] {
  const config = readFileSync(path.join(root, 'open-next.config.ts'), 'utf8')
  return [...config.matchAll(/'(app\/[^']+)'/g)].map((match) => match[1])
}

describe('open-next.config.ts route split', () => {
  it('assigns every page and API route in app/ to a Worker', () => {
    const listed = new Set(splitRoutes())
    expect(appRoutes().filter((route) => !listed.has(route))).toEqual([])
  })

  it('assigns each route to only one Worker', () => {
    const routes = splitRoutes()
    expect(routes.filter((route, index) => routes.indexOf(route) !== index)).toEqual([])
  })

  it('does not list routes that no longer exist (Next.js built-ins like app/_not-found have no file)', () => {
    const existing = new Set(appRoutes())
    expect(splitRoutes().filter((route) => !route.startsWith('app/_') && !existing.has(route))).toEqual([])
  })
})
