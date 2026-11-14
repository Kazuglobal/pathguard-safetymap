import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('danger report submission notification boundary', () => {
  it('never dispatches nearby-user push from the client submission hook', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'hooks', 'use-danger-report-submit.ts'),
      'utf8',
    )

    expect(source).not.toContain('/api/push/notify-danger-report')
    expect(source).toContain('/api/danger-report/moderate')
    // 送った時点では公開されていないと伝える。ポイントのことは画面に出さない
    expect(source).toContain('承認されると地図に公開されます')
    expect(source).not.toMatch(/ptを獲得|ポイントを獲得/)
    expect(source).not.toContain('title: "ポイント獲得"')
  })
})
