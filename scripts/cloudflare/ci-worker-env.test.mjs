import { test } from 'node:test'
import assert from 'node:assert/strict'

import { serverWorkerDeployEnv } from './ci-worker-env.mjs'

test('removes the Workers Builds name/tag override so each server Worker keeps its own --name', () => {
  const env = {
    WRANGLER_CI_OVERRIDE_NAME: 'pathguardian',
    WRANGLER_CI_MATCH_TAG: 'abc123',
    CLOUDFLARE_ACCOUNT_ID: 'account',
    PATH: '/usr/bin',
  }

  const result = serverWorkerDeployEnv(env)

  assert.deepEqual(result, { CLOUDFLARE_ACCOUNT_ID: 'account', PATH: '/usr/bin' })
})

test('does not mutate the original environment (router deploy still uses the CI override)', () => {
  const env = { WRANGLER_CI_OVERRIDE_NAME: 'pathguardian', WRANGLER_CI_MATCH_TAG: 'abc123' }

  serverWorkerDeployEnv(env)

  assert.equal(env.WRANGLER_CI_OVERRIDE_NAME, 'pathguardian')
  assert.equal(env.WRANGLER_CI_MATCH_TAG, 'abc123')
})

test('is a no-op outside Workers Builds', () => {
  assert.deepEqual(serverWorkerDeployEnv({ HOME: '/home/user' }), { HOME: '/home/user' })
})
