import { readFile, writeFile } from 'node:fs/promises'

function argument(name) {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

const accountId = argument('account-id')
const databaseId = argument('database-id')
if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) throw new Error('Use --account-id=<32 hex characters>')
if (!databaseId || !/^[a-f0-9-]{36}$/i.test(databaseId)) throw new Error('Use --database-id=<D1 UUID>')

const configPath = 'wrangler.jsonc'
let config = await readFile(configPath, 'utf8')
config = config.replace(/("database_id"\s*:\s*")[a-f0-9-]{36}("\s*,)/i, `$1${databaseId}$2`)
config = config.replace(/("CLOUDFLARE_ACCOUNT_ID"\s*:\s*")[^"]+("\s*,)/, `$1${accountId}$2`)
config = config.replace(/("D1_DATABASE_ID"\s*:\s*")[a-f0-9-]{36}("\s*)/, `$1${databaseId}$2`)
if (config.includes('00000000-0000-0000-0000-000000000000') || config.includes('REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID')) {
  throw new Error('Not all Cloudflare sentinels were replaced')
}
await writeFile(configPath, config, 'utf8')
console.log('wrangler.jsonc Cloudflare resource identifiers updated')
