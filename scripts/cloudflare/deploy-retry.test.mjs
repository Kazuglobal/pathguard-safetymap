import test from 'node:test'
import assert from 'node:assert/strict'
import { isTransientSubdomainFailure, isTransientDeployFailure, transientRetryDelayMs, MAX_TRANSIENT_RETRIES } from './deploy-retry.mjs'

const uploadRace = `✘ [ERROR] A request to the Cloudflare API (/accounts/***/workers/scripts/pathguardian-safety-quest-pr-288/subdomain) failed.

  This Worker does not exist on your account. [code: 10007]
`
const unknownError = `✘ [ERROR] A request to the Cloudflare API (/accounts/***/workers/scripts/pathguardian-ai-vision-pr-288/subdomain) failed.

  An unknown error has occurred. If this error persists, please file a report. [code: 10013]
`

test('アップロード直後の subdomain の失敗を一時的と見なす', () => {
  assert.equal(isTransientSubdomainFailure(uploadRace), true)
  assert.equal(isTransientSubdomainFailure(unknownError), true)
})

test('subdomain 以外の失敗や別のコードは再試行しない', () => {
  assert.equal(isTransientSubdomainFailure('✘ [ERROR] Authentication error [code: 10000]'), false)
  assert.equal(isTransientSubdomainFailure(uploadRace.replace('10007', '10021')), false)
  assert.equal(isTransientSubdomainFailure('A request to the Cloudflare API (/accounts/x/workers/scripts/y/settings) failed. [code: 10007]'), false)
  assert.equal(isTransientSubdomainFailure(''), false)
  assert.equal(isTransientSubdomainFailure(undefined), false)
})

test('反映待ち中の wrangler の落ち方も試し直す', () => {
  const crash = "✘ [ERROR] Cannot read properties of null (reading 'tag')"
  assert.equal(isTransientDeployFailure(crash), true)
  assert.equal(isTransientSubdomainFailure(crash), false)
  assert.equal(isTransientDeployFailure(uploadRace), true)
  assert.equal(isTransientDeployFailure("✘ [ERROR] Cannot read properties of null (reading 'name')"), false)
  assert.equal(isTransientDeployFailure('✘ [ERROR] Authentication error [code: 10000]'), false)
})

test('待ち時間は回ごとに伸び、回数は限られる', () => {
  assert.equal(transientRetryDelayMs(0), 10000)
  assert.equal(transientRetryDelayMs(1), 20000)
  assert.equal(MAX_TRANSIENT_RETRIES, 3)
})
