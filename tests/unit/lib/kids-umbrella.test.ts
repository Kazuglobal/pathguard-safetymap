// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * 子ども向けの遊びの画面は、見出しの上に傘の名前「きけんハンター」を出す(UIUX改装 項目8)。
 * 表記は components/brand/kids-umbrella-label.tsx の1か所。画面ごとに書き分けない。
 */
const KIDS_PLAY_SCREENS = [
  'app/hazard-game/hazard-game-client.tsx',
  'app/route-quiz/page.tsx',
  'app/safety-quest/safety-quest-client.tsx',
  'app/missions/page.tsx',
  'app/badges/page.tsx',
  'app/leaderboard/page.tsx',
]

describe('きけんハンターの傘の名前(UIUX改装 項目8)', () => {
  it.each(KIDS_PLAY_SCREENS)('%s は見出しの上に KidsUmbrellaLabel を出す', (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8')

    expect(source).toContain('from "@/components/brand/kids-umbrella-label"')
    expect(source).toMatch(/<KidsUmbrellaLabel[\s/>]/)
  })

  it('セーフティクエストのメニューに、作るときの仮の見出し(UI 01/02/03)を残さない', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/safety-quest/safety-quest-client.tsx'), 'utf8')

    expect(source).not.toMatch(/UI 0[123]/)
  })
})
