import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { isMaintenanceWriteRequest } from '@/lib/maintenance'
import { verifyCronSecret } from '@/lib/cron-auth'

describe('migration maintenance guard', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('blocks mutation methods only while read-only mode is enabled', () => {
    expect(isMaintenanceWriteRequest('POST', 'read_only')).toBe(true)
    expect(isMaintenanceWriteRequest('DELETE', 'read_only')).toBe(true)
    expect(isMaintenanceWriteRequest('GET', 'read_only')).toBe(false)
    expect(isMaintenanceWriteRequest('POST', undefined)).toBe(false)
  })

  it('freezes cron writes before checking the bearer secret', () => {
    vi.stubEnv('MAINTENANCE_MODE', 'read_only')
    vi.stubEnv('CRON_SECRET', 'secret')
    const request = new NextRequest('https://app.example/api/cron/test', {
      headers: { Authorization: 'Bearer secret' },
    })

    expect(verifyCronSecret(request)?.status).toBe(503)
  })

  it('requires CRON_SECRET on Cloudflare without relying on VERCEL', () => {
    vi.stubEnv('MAINTENANCE_MODE', '')
    vi.stubEnv('CRON_SECRET', 'secret')
    vi.stubEnv('VERCEL', '')
    const wrong = new NextRequest('https://app.example/api/cron/test', {
      headers: { Authorization: 'Bearer wrong' },
    })
    const valid = new NextRequest('https://app.example/api/cron/test', {
      headers: { Authorization: 'Bearer secret' },
    })

    expect(verifyCronSecret(wrong)?.status).toBe(401)
    expect(verifyCronSecret(valid)).toBeNull()
  })
})
