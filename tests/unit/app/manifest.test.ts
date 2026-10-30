import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import manifest from '@/app/manifest'
import { BRAND } from '@/lib/brand'

describe('app/manifest.ts (PWAマニフェスト)', () => {
  const m = manifest()

  it('standalone表示・日本語・/landing起点で構成されている', () => {
    expect(m.display).toBe('standalone')
    expect(m.lang).toBe('ja')
    // "/" は /lp へ無条件リダイレクトされるため、起点はニュースフィードにする
    expect(m.start_url).toBe('/landing')
    expect(m.scope).toBe('/')
    expect(m.name).toContain('PathGuardian')
    expect(m.short_name).toBeTruthy()
  })

  it('theme_color が app/layout.tsx の viewport.themeColor と一致している(どちらもブランドの紙の色。UIUX改装 項目33)', () => {
    expect(m.theme_color).toBe(BRAND.themeColor)
    expect(BRAND.themeColor).toBe('#FBF5E9')
    expect(readFileSync(resolve(__dirname, '../../../app/layout.tsx'), 'utf8')).toContain('themeColor: BRAND.themeColor')
  })

  it('192/512 の any と maskable のアイコンが揃っている', () => {
    const icons = m.icons ?? []
    const bySrc = new Map(icons.map((i) => [i.src, i]))

    for (const src of [
      '/icon-192.png',
      '/icon-512.png',
      '/icon-maskable-192.png',
      '/icon-maskable-512.png',
    ]) {
      expect(bySrc.has(src), `${src} がマニフェストに登録されていること`).toBe(true)
    }

    expect(bySrc.get('/icon-maskable-192.png')?.purpose).toBe('maskable')
    expect(bySrc.get('/icon-maskable-512.png')?.purpose).toBe('maskable')
    expect(bySrc.get('/icon-192.png')?.sizes).toBe('192x192')
    expect(bySrc.get('/icon-512.png')?.sizes).toBe('512x512')
  })

  it('マニフェストが参照するアイコン実体が public/ に存在する', () => {
    const publicDir = resolve(__dirname, '../../../public')
    for (const icon of m.icons ?? []) {
      const file = resolve(publicDir, `.${icon.src}`)
      expect(existsSync(file), `${icon.src} の実体ファイルが存在すること`).toBe(true)
    }
  })
})
