import { describe, expect, it } from 'vitest'

import {
  D1_EXPORT_MAX_POLLS,
  d1ExportPollDelaySeconds,
  d1ExportTotalWaitSeconds,
} from '../../../cloudflare/d1-backup-schedule'

// Workers Free: 50 external subrequests per Workflow instance.
const FREE_EXTERNAL_SUBREQUESTS_PER_INSTANCE = 50

describe('D1 backup polling schedule', () => {
  it('leaves room for step retries inside the Workers Free subrequest budget', () => {
    const happyPath = 1 /* start */ + D1_EXPORT_MAX_POLLS + 1 /* download */
    expect(FREE_EXTERNAL_SUBREQUESTS_PER_INSTANCE - happyPath).toBeGreaterThanOrEqual(15)
  })

  it('waits long enough for a slow export instead of spending the budget in a minute', () => {
    expect(d1ExportTotalWaitSeconds()).toBeGreaterThanOrEqual(20 * 60)
  })

  it('backs off between polls and caps the delay at one minute', () => {
    expect(d1ExportPollDelaySeconds(1)).toBe(5)
    expect(d1ExportPollDelaySeconds(2)).toBe(10)
    expect(d1ExportPollDelaySeconds(4)).toBe(30)
    expect(d1ExportPollDelaySeconds(10)).toBe(60)
    for (let attempt = 1; attempt < D1_EXPORT_MAX_POLLS; attempt += 1) {
      expect(d1ExportPollDelaySeconds(attempt + 1)).toBeGreaterThanOrEqual(d1ExportPollDelaySeconds(attempt))
    }
  })
})
