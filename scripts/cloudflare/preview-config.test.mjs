import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createPreviewConfig, previewName, previewPublicNames, previewSecretNames, previewSecrets, previewBuildEnvironment, forbiddenBuildFiles } from './preview-config.mjs'
import { isSensitiveBuildVariable } from './secret-policy.mjs'

const base = {
  name: 'pathguardian', main: 'custom-worker.ts',
  routes: [{ pattern: 'production.example' }], triggers: { crons: ['* * * * *'] },
  workflows: [{ name: 'backup' }], secrets: { required: ['D1_BACKUP_API_TOKEN'] },
  vars: { D1_DATABASE_ID: 'production-id' },
  assets: { directory: '.open-next/assets', binding: 'ASSETS' },
  services: [{ binding: 'CORE', service: 'pathguardian-core' }, { binding: 'WORKER_SELF_REFERENCE', service: 'pathguardian' }],
  d1_databases: [{ database_id: 'production-id' }],
  r2_buckets: [{ bucket_name: 'pg-media-public' }],
}
const resources = {
  account_id: 'account',
  d1_databases: [{ binding: 'DB', database_name: 'pathguardian-preview', database_id: 'preview-id', migrations_dir: 'lib/db/migrations' }],
  r2_buckets: [{ binding: 'MEDIA_PUBLIC', bucket_name: 'pg-preview-media-public' }],
}
test('names are PR-scoped and invalid / ambiguous IDs fail closed', () => {
  assert.equal(previewName('pathguardian', 'pr-186'), 'pathguardian-pr-186')
  for (const id of ['', 'main', 'PR-1', 'pr-01', 'pr-0', '../pr-1', 'pr-1;rm', 'pr-99999999999']) {
    assert.throws(() => previewName('pathguardian', id))
  }
})
test('router has only isolated bindings and no operational production configuration', () => {
  const config = createPreviewConfig(base, resources, 'pr-186', process.cwd(), true)
  assert.equal(config.workers_dev, true)
  assert.equal(config.services[0].service, 'pathguardian-core-pr-186')
  assert.equal(config.services[1].service, 'pathguardian-pr-186')
  assert.equal(config.d1_databases[0].database_id, 'preview-id')
  assert.equal(config.r2_buckets[0].bucket_name, 'pg-preview-media-public')
  for (const key of ['routes', 'triggers', 'workflows', 'secrets', 'vars']) assert.equal(config[key], undefined)
  assert.equal(base.services[0].service, 'pathguardian-core')
})
test('backend Worker cannot be accessed directly over workers.dev', () => {
  const config = createPreviewConfig(base, resources, 'pr-186', process.cwd())
  assert.equal(config.workers_dev, false)
  assert.equal(config.preview_urls, false)
  assert.equal(config.assets, undefined)
})
test('production D1 and R2 bindings are rejected', () => {
  assert.throws(() => createPreviewConfig(base, { ...resources, d1_databases: [{ ...resources.d1_databases[0], database_id: 'production-id' }] }, 'pr-186', process.cwd()))
  assert.throws(() => createPreviewConfig(base, { ...resources, r2_buckets: [{ bucket_name: 'pg-media-public' }] }, 'pr-186', process.cwd()))
})
test('only explicit public values and preview-only server secrets are propagated', () => {
  const allowedNames = [...previewPublicNames, ...previewSecretNames]
  const env = Object.fromEntries(allowedNames.map((name) => [name, `preview-${name}`]))
  const secrets = previewSecrets({ ...env, SUPABASE_SERVICE_ROLE_KEY: 'production-private', D1_REST_API_TOKEN: 'production-private' })
  assert.deepEqual(secrets, env)
  assert.throws(() => previewSecrets({}))
})

test('preview build rejects local production files and removes inherited credentials', () => {
  const env = Object.fromEntries([...previewPublicNames, ...previewSecretNames].map((name) => [name, 'value']))
  for (const file of forbiddenBuildFiles) assert.throws(() => previewBuildEnvironment(env, [file]))
  const buildEnv = previewBuildEnvironment({ ...env, PATH: '/bin', CLOUDFLARE_API_TOKEN: 'private', OPENAI_API_KEY: 'private', NODE_OPTIONS: '--import=unexpected' }, [])
  assert.equal(buildEnv.PATH, '/bin')
  assert.equal(buildEnv.CI, 'true')
  assert.equal(buildEnv.CLOUDFLARE_API_TOKEN, undefined)
  assert.equal(buildEnv.OPENAI_API_KEY, undefined)
  assert.equal(buildEnv.NODE_OPTIONS, undefined)
  for (const name of previewSecretNames) assert.equal(buildEnv[name], 'value')
})

test('Upstash credentials are treated as sensitive build values', () => {
  assert.equal(isSensitiveBuildVariable('UPSTASH_REDIS_REST_URL'), true)
  assert.equal(isSensitiveBuildVariable('UPSTASH_REDIS_REST_TOKEN'), true)
  assert.equal(isSensitiveBuildVariable('CRON_SECRET'), true)
  assert.equal(isSensitiveBuildVariable('NEXT_PUBLIC_SUPABASE_ANON_KEY'), false)
})

test('preview workflow reads distinct preview-only secret names', () => {
  const workflow = readFileSync('.github/workflows/cloudflare-preview.yml', 'utf8')
  assert.match(workflow, /secrets\.PREVIEW_UPSTASH_REDIS_REST_URL/)
  assert.match(workflow, /secrets\.PREVIEW_UPSTASH_REDIS_REST_TOKEN/)
  assert.match(workflow, /secrets\.PREVIEW_CRON_SECRET/)
  assert.doesNotMatch(workflow, /secrets\.UPSTASH_REDIS_REST_(?:URL|TOKEN)/)
  assert.doesNotMatch(workflow, /secrets\.CRON_SECRET/)
})
