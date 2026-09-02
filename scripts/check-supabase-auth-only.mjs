import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const roots = ['app', 'components', 'hooks', 'lib', 'scripts']
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])
const allowedAdminCallers = new Set([
  'lib/supabase-admin.ts',
  'app/api/auth/line/callback/route.ts',
])
const allowedSupabaseScripts = new Set(['scripts/create-test-users.ts'])
const allowedDataMigrationScripts = new Set([
  'scripts/migrate/backup-storage-via-wrangler.ts',
])
const failures = []

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const name = path.posix.join(directory.replaceAll('\\', '/'), entry.name)
    if (entry.isDirectory()) result.push(...await filesBelow(name))
    else if (extensions.has(path.extname(entry.name))) result.push(name)
  }
  return result
}

for (const root of roots) {
  for (const file of await filesBelow(root)) {
    const source = await readFile(file, 'utf8')
    const usesSupabaseClient = /(?:@supabase\/supabase-js|supabase-(?:client|server|admin)|useSupabase)/.test(source)
    const forbidden = [
      [/\.storage\s*\./, 'Supabase Storage'],
      [/\.functions\s*\./, 'Supabase Functions'],
      [/\.rpc\s*\(/, 'Supabase RPC'],
      [/supabase\.co\/storage\//, 'embedded Supabase Storage URL'],
    ]
    if (usesSupabaseClient) forbidden.push([/\b(?:supabase|admin|supabaseAdmin)\s*\.from\s*\(/, 'Supabase database query'])
    if (!allowedDataMigrationScripts.has(file)) {
      for (const [pattern, label] of forbidden) {
        if (pattern.test(source)) failures.push(`${file}: ${label}`)
      }
    }
    if (file !== 'scripts/check-supabase-auth-only.mjs' && /getSupabaseAdmin|supabaseAdmin/.test(source) && !allowedAdminCallers.has(file)) {
      failures.push(`${file}: Supabase Admin outside the Auth-only allowlist`)
    }
    if (file.startsWith('scripts/') && /@supabase\/supabase-js/.test(source) &&
        !allowedSupabaseScripts.has(file) && !allowedDataMigrationScripts.has(file)) {
      failures.push(`${file}: Supabase SDK script outside the Auth-only allowlist`)
    }
  }
}

try {
  const functionFiles = await filesBelow('supabase/functions')
  if (functionFiles.length) failures.push(`supabase/functions: ${functionFiles.length} deployed function source file(s) remain`)
} catch (error) {
  if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error
}

if (failures.length) {
  console.error('Supabase Auth-only boundary check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Supabase boundary verified: Auth SDK/Admin only; no DB, Storage, RPC, or Functions runtime usage.')
}
