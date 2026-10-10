import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertProductionSource } from './production-source-guard.mjs'

const ci = { GITHUB_ACTIONS: 'true', GITHUB_WORKFLOW_REF: 'Kazuglobal/pathguard-safetymap/.github/workflows/cloudflare-production.yml@refs/heads/main' }

function git({ status = '', head = 'latest', main = 'latest' } = {}) {
  return (args) => args[0] === 'status' ? status
    : args[0] === 'fetch' ? ''
      : args[1] === 'HEAD' ? head : main
}
test('allows a clean checkout at current main', () => {
  assert.equal(assertProductionSource({ environment: ci, git: git() }), 'latest')
})
test('rejects uncommitted or untracked source changes', () => {
  for (const status of [' M lib/school-route-news.ts', '?? lib/new-news.ts']) {
    assert.throws(() => assertProductionSource({ environment: ci, git: git({ status }) }), /clean checkout/)
  }
})
test('rejects old branches and main advances during a build', () => {
  assert.throws(() => assertProductionSource({ environment: ci, git: git({ head: 'old' }) }), /latest origin\/main/)
})
test('rejects reusing an unverifiable prebuilt bundle', () => {
  assert.throws(() => assertProductionSource({ skipBuild: true, environment: ci, git: git() }), /fresh build/)
})

test('rejects local Wrangler deployment even for clean latest main', () => {
  assert.throws(() => assertProductionSource({ environment: {}, git: git() }), /Manual production deployment is disabled/)
})
test('rejects other workflows and branches', () => {
  for (const workflow of [
    'Kazuglobal/pathguard-safetymap/.github/workflows/cloudflare-preview.yml@refs/heads/main',
    'Kazuglobal/pathguard-safetymap/.github/workflows/cloudflare-production.yml@refs/heads/old-branch',
  ]) {
    assert.throws(() => assertProductionSource({ environment: { ...ci, GITHUB_WORKFLOW_REF: workflow }, git: git() }), /Manual production deployment is disabled/)
  }
})