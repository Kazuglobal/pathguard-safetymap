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
    // ポイントは投稿の時点ではなく、承認(公開)のあとにもらえると伝える。値は D1 のトリガーと同じ定数から出す
    expect(source).toContain('承認後に${REPORT_PUBLISHED_POINTS}ptを獲得できます')
    expect(source).not.toContain('title: "ポイント獲得"')
  })
})
