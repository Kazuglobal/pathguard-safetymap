import { describe, expect, it } from 'vitest'

import { serverWorkerDeployEnv } from '@/scripts/cloudflare/ci-worker-env.mjs'

describe('serverWorkerDeployEnv', () => {
  it('removes the Workers Builds name/tag override so each server Worker keeps its own --name', () => {
    const env = {
      WRANGLER_CI_OVERRIDE_NAME: 'pathguardian',
      WRANGLER_CI_MATCH_TAG: 'abc123',
      CLOUDFLARE_ACCOUNT_ID: 'account',
      PATH: '/usr/bin',
    }

    expect(serverWorkerDeployEnv(env)).toEqual({ CLOUDFLARE_ACCOUNT_ID: 'account', PATH: '/usr/bin' })
  })

  it('does not mutate the original environment (router deploy still uses the CI override)', () => {
    const env = { WRANGLER_CI_OVERRIDE_NAME: 'pathguardian', WRANGLER_CI_MATCH_TAG: 'abc123' }

    serverWorkerDeployEnv(env)

    expect(env).toEqual({ WRANGLER_CI_OVERRIDE_NAME: 'pathguardian', WRANGLER_CI_MATCH_TAG: 'abc123' })
  })

  it('is a no-op outside Workers Builds', () => {
    expect(serverWorkerDeployEnv({ HOME: '/home/user' })).toEqual({ HOME: '/home/user' })
  })
})
