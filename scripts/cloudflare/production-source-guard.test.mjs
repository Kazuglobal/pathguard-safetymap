import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertProductionSource } from './production-source-guard.mjs'

function git({ status = '', head = 'latest', main = 'latest' } = {}) {
  return (args) => args[0] === 'status' ? status
    : args[0] === 'fetch' ? ''
      : args[1] === 'HEAD' ? head : main
}
test('allows a clean checkout at current main', () => {
  assert.equal(assertProductionSource({ git: git() }), 'latest')
})
test('rejects uncommitted or untracked source changes', () => {
  for (const status of [' M lib/school-route-news.ts', '?? lib/new-news.ts']) {
    assert.throws(() => assertProductionSource({ git: git({ status }) }), /clean checkout/)
  }
})
test('rejects old branches and main advances during a build', () => {
  assert.throws(() => assertProductionSource({ git: git({ head: 'old' }) }), /latest origin\/main/)
})
test('rejects reusing an unverifiable prebuilt bundle', () => {
  assert.throws(() => assertProductionSource({ skipBuild: true, git: git() }), /fresh build/)
})
