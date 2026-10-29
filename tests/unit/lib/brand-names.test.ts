// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { BRAND, pageTitle } from '@/lib/brand'

/**
 * 名前のセット(PathGuardian / 通学路みまもりアプリ / きけんハンター)以外の名前や、そろえた呼び名の旧い言い方が
 * 画面のコードに残っていないかを確かめる(UIUX改装 項目1・3・25・41 の受け入れ条件)。
 */
const BANNED = [
  '通学路安全マップ',
  'SafetyMap',
  'AI安全マップ',
  'PathGuard Press',
  '安全マガジン',
  'v0.dev',
  '通学ルート',
  '見守りノート',
  '安全ノート',
]

const ROOTS = ['app', 'components', 'lib', 'hooks']
/** 記事の本文のデータ(毎日の更新の PR とぶつかるので、ここでは触らない) */
const EXCLUDED_FILES = new Set([
  path.normalize('lib/safe-magazine.ts'),
  path.normalize('lib/school-route-news.ts'),
])

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  })
}

describe('名前のセット以外の名前を画面のコードに残さない', () => {
  it('旧名・旧い呼び名が残っていない', () => {
    const hits: string[] = []
    for (const file of ROOTS.flatMap(sourceFiles)) {
      if (EXCLUDED_FILES.has(path.normalize(file))) continue
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
      lines.forEach((line, index) => {
        for (const word of BANNED) if (line.includes(word)) hits.push(`${file}:${index + 1} 「${word}」`)
      })
    }
    expect(hits).toEqual([])
  })

  it('タイトルの書式は「ページ名 | PathGuardian」、ページ名が無ければ既定のタイトル', () => {
    expect(pageTitle('マイページ')).toBe('マイページ | PathGuardian')
    expect(pageTitle(null)).toBe('PathGuardian｜通学路みまもりアプリ')
    expect([BRAND.name, BRAND.descriptor, BRAND.kidsUmbrella]).toEqual(['PathGuardian', '通学路みまもりアプリ', 'きけんハンター'])
  })

  it('ページの metadata にサイト名を重ねて書かない(書式はルートの layout が付ける)', () => {
    const doubled: string[] = []
    for (const file of sourceFiles('app')) {
      if (!/(page|layout)\.tsx$/.test(file) || path.normalize(file) === path.normalize('app/layout.tsx')) continue
      const text = fs.readFileSync(file, 'utf8')
      for (const match of text.matchAll(/^\s*title:\s*["'`]([^"'`]*)["'`]/gm)) {
        if (/\|\s*PathGuardian|PathGuardian\s*[-|｜]/.test(match[1] ?? '')) doubled.push(`${file}: ${match[1]}`)
      }
    }
    expect(doubled).toEqual([])
  })
})
