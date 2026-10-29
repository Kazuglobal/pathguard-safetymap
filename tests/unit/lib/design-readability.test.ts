// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { tankenTokens } from '@/lib/design/tanken'

/**
 * 文字の読みやすさの決まり(UIUX改装 項目33)。
 *  - 文字の大きさは 12px 以上(管理者だけの3Dの試作と、まとめピンの丸の中の「件」は除く)
 *  - 薄い文字の色 inkSoft は、紙や白の上で 4.5:1 以上
 *  - inkFaint は線や飾りの色。文字の色(color)には使わない
 */
const ROOTS = ['app', 'components', 'hooks']
const EXCLUDED_DIRS = [path.normalize('app/3d-route-poc'), path.normalize('components/3d-route')]

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return EXCLUDED_DIRS.includes(path.normalize(full)) ? [] : sourceFiles(full)
    return /\.(tsx|ts|css)$/.test(entry.name) ? [full] : []
  })
}

function luminance(hex: string): number {
  const channel = (index: number) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

describe('文字の読みやすさ', () => {
  it('12px より小さい文字が残っていない', () => {
    const hits: string[] = []
    for (const file of ROOTS.flatMap(sourceFiles)) {
      const text = fs.readFileSync(file, 'utf8')
      const lines = text.split(/\r?\n/)
      lines.forEach((line, index) => {
        if (/text-\[(?:[5-9]|[5-9]\.5|10|10\.5|11|11\.5)px\]|fontSize: ['"](?:[5-9]|[5-9]\.5|10|10\.5|11|11\.5)px['"]/.test(line)) {
          hits.push(`${file}:${index + 1}`)
        }
      })
      if (file.endsWith('.css')) {
        for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
          if (match[1].includes('.danger-cluster-unit')) continue
          if (/font-size:\s*(?:9|10|11)(?:\.5)?px/.test(match[2])) hits.push(`${file}: ${match[1].trim()}`)
        }
      }
    }
    expect(hits).toEqual([])
  })

  it('inkSoft は紙・カード・白・淡い色の面の上で 4.5:1 以上', () => {
    const c = tankenTokens.color
    for (const background of [c.paper, c.paperDeep, c.card, '#FFFFFF', c.sunSoft, c.primarySoft, c.accentSoft, c.skySoft, c.dangerSoft]) {
      expect(contrast(c.inkSoft, background), `inkSoft on ${background}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('ハンターの画面の色と、tailwind の ink-soft も同じ色', () => {
    const hunterTheme = fs.readFileSync('components/safety-quest/hunter/theme.tsx', 'utf8')
    const tailwind = fs.readFileSync('tailwind.config.ts', 'utf8')
    expect(hunterTheme).toContain(`inkSoft: "${tankenTokens.color.inkSoft}"`)
    expect(tailwind).toContain(`soft: "${tankenTokens.color.inkSoft}"`)
  })

  it('明るい面の上の文字に、Tailwind の薄いグレー(gray-400 / slate-400。白の上で 2.5:1)を使っていない', () => {
    // 暗い面に出す AR の画面では、400 のほうが読みやすいので除く
    const darkSurfaces = ['ar-view.tsx', 'ar-settings-panel.tsx', 'ar-image-gallery.tsx'].map((name) => path.normalize(`components/map/${name}`))
    const hits: string[] = []
    for (const file of ROOTS.flatMap(sourceFiles)) {
      if (!file.endsWith('.tsx') || darkSurfaces.includes(path.normalize(file))) continue
      fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        if (/\btext-(?:gray|slate)-400\b/.test(line)) hits.push(`${file}:${index + 1}`)
      })
    }
    expect(hits).toEqual([])
  })

  it('inkFaint を文字の色に使っていない', () => {
    const hits: string[] = []
    for (const file of ROOTS.flatMap(sourceFiles)) {
      fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        if (/\bcolor: [^,}\n]*\.inkFaint\b/.test(line) || /const color = .*inkFaint/.test(line)) hits.push(`${file}:${index + 1}`)
      })
    }
    expect(hits).toEqual([])
  })
})
