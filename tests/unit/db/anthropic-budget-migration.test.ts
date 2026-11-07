import { afterEach, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'

describe('20261107090000_anthropic_budget', () => {
  let database: TestDatabase | undefined

  afterEach(() => {
    database?.sqlite.close()
    database = undefined
  })

  it('adds a budget row for Claude (anthropic) next to the existing providers, so admins can set it', () => {
    database = createTestDatabase()
    const rows = database.sqlite
      .prepare('select api_provider, monthly_budget_usd, alert_threshold_percent from api_budget_settings order by api_provider')
      .all()
    expect(rows).toEqual([
      { api_provider: 'anthropic', monthly_budget_usd: 100, alert_threshold_percent: 80 },
      { api_provider: 'gemini', monthly_budget_usd: 100, alert_threshold_percent: 80 },
      { api_provider: 'mapbox', monthly_budget_usd: 50, alert_threshold_percent: 80 },
      { api_provider: 'openai', monthly_budget_usd: 100, alert_threshold_percent: 80 },
    ])
  })
})
