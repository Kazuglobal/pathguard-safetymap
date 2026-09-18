import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

import { afterAll, describe, expect, it } from 'vitest'

const workingDirectory = mkdtempSync(path.join(tmpdir(), 'pathguardian-validate-env-'))
const script = path.resolve(process.cwd(), 'scripts/validate-env.js')
const required = {
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: 'pk.test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  NEXT_PUBLIC_MEDIA_BASE_URL: 'https://media.example.com',
  NEXT_PUBLIC_SITE_URL: 'https://www.example.com',
  UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-upstash-token-at-least-16',
  CRON_SECRET: 'test-cron-secret-at-least-32-characters',
}

function runValidate(overrides: Record<string, string | undefined> = {}) {
  const env = { ...process.env, ...required, ...overrides }
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete env[name]
  }
  return spawnSync(process.execPath, [script], {
    cwd: workingDirectory,
    env,
    encoding: 'utf8',
  })
}

afterAll(() => rmSync(workingDirectory, { recursive: true, force: true }))

describe('validate-env server secrets', () => {
  it('accepts all required public values and server secrets', () => {
    expect(runValidate().status).toBe(0)
  })

  it.each([
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'CRON_SECRET',
  ])('rejects a missing %s', (name) => {
    const result = runValidate({ [name]: undefined })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(name)
  })

  it('rejects blank server secrets', () => {
    expect(runValidate({ CRON_SECRET: '   ' }).status).toBe(1)
  })

  it.each([
    ['UPSTASH_REDIS_REST_TOKEN', 'short'],
    ['CRON_SECRET', 'short'],
  ])('rejects a short %s without printing its value', (name, value) => {
    const result = runValidate({ [name]: value })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${name} must be at least`)
    expect(result.stderr).not.toContain(`- ${value}`)
  })

  it('rejects a non-HTTPS Upstash URL without printing its value', () => {
    const value = 'http://private-host.invalid'
    const result = runValidate({ UPSTASH_REDIS_REST_URL: value })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('UPSTASH_REDIS_REST_URL must be an HTTPS URL')
    expect(result.stderr).not.toContain(value)
  })
})
