import path from 'node:path'

export function previewName(name, id) {
  if (!/^pr-[1-9][0-9]{0,9}$/.test(id)) throw new Error('Expected --preview=pr-<positive PR number>')
  if (!/^pathguardian(?:-[a-z0-9-]+)?$/.test(name)) throw new Error('Unexpected Worker name')
  return `${name}-${id}`
}

export function createPreviewConfig(base, resources, id, root, isRouter = false) {
  const productionIds = new Set((base.d1_databases ?? []).map((db) => db.database_id))
  const productionBuckets = new Set((base.r2_buckets ?? []).map((bucket) => bucket.bucket_name))
  for (const db of resources.d1_databases) {
    if (!db.database_name.endsWith('-preview') || productionIds.has(db.database_id)) {
      throw new Error('Preview must not bind to production D1')
    }
  }
  for (const bucket of resources.r2_buckets) {
    if (!bucket.bucket_name.startsWith('pg-preview-') || productionBuckets.has(bucket.bucket_name)) {
      throw new Error('Preview must not bind to production R2')
    }
  }
  // Allowlist config fields: no routes, cron, workflow, backup token or production vars.
  return {
    name: previewName(isRouter ? 'pathguardian' : base.name, id),
    account_id: resources.account_id,
    main: path.resolve(root, base.main),
    compatibility_date: base.compatibility_date,
    compatibility_flags: base.compatibility_flags,
    minify: true,
    workers_dev: isRouter,
    preview_urls: false,
    ...(isRouter ? { assets: { ...base.assets, directory: path.resolve(root, base.assets.directory) } } : {}),
    services: base.services.map((service) => ({ ...service, service: previewName(service.service, id) })),
    d1_databases: resources.d1_databases.map((db) => ({ ...db, migrations_dir: path.resolve(root, db.migrations_dir) })),
    r2_buckets: resources.r2_buckets,
    images: base.images,
    observability: base.observability,
  }
}

// Deliberately exclude all server-side production credentials, including cron, push and Auth Admin.
export const previewPublicNames = [
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN', 'NEXT_PUBLIC_MEDIA_BASE_URL', 'NEXT_PUBLIC_SITE_URL',
]

export function previewSecrets(env) {
  for (const name of previewPublicNames) {
    if (!env[name]?.trim()) throw new Error(`Preview requires ${name}`)
  }
  return Object.fromEntries(previewPublicNames.map((name) => [name, env[name]]))
}

export const forbiddenBuildFiles = ['.env', '.env.local', '.env.production', '.env.production.local', 'env.defaults.json']

export function previewBuildEnvironment(env, existingFiles) {
  if (existingFiles.some((file) => forbiddenBuildFiles.includes(file))) {
    throw new Error('Build previews in a clean checkout without production env files or env.defaults.json')
  }
  const systemKeys = new Set(['PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC', 'PATHEXT', 'LANG', 'LC_ALL'])
  return {
    ...Object.fromEntries(Object.entries(env).filter(([key]) => systemKeys.has(key.toUpperCase()))),
    ...previewSecrets(env),
    CI: 'true',
  }
}
