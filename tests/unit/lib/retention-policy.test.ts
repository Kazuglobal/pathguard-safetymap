// @vitest-environment node
import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

import { RETENTION_DAYS } from '@/lib/retention/policy'

/**
 * 保持期間はプライバシーポリシーの表と同じ値を使う(UIUX改装 項目60)。
 * 画面の表は RETENTION_DAYS から作り、削除の処理も RETENTION_DAYS を読む(数字を書き写さない)
 */
const read = (file: string) => fs.readFileSync(file, 'utf8')

describe('保持期間はひとつの値から', () => {
  it('プライバシーポリシーの表は RETENTION_DAYS から作る', () => {
    const page = read('app/privacy/page.tsx')
    for (const key of Object.keys(RETENTION_DAYS)) expect(page, key).toContain(`RETENTION_DAYS.${key}`)
  })

  it('きけんハンターの写真の期限も、同じ値を使う(90 と書き写さない)', () => {
    const route = read('app/api/hunter/analyze/route.ts')
    expect(route).toContain('RETENTION_DAYS.hunterPhoto')
    expect(route).not.toMatch(/PHOTO_RETENTION_DAYS\s*=\s*\d+/)
  })

  it('保持期間の削除も同じ値を使う', () => {
    const repo = read('lib/db/repos/retention.repo.ts')
    for (const key of ['unpublishedReport', 'publishedReport', 'resolvedReport', 'staleSubscription', 'reportCreateHistory']) {
      expect(repo, key).toContain(`RETENTION_DAYS.${key}`)
    }
  })
})
