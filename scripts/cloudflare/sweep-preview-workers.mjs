/**
 * Cloudflare アカウント上の PR プレビュー由来 Worker (`pathguardian*-pr-<PR番号>`) を棚卸しし、
 * クローズ済み PR の残骸のみを安全に削除するスクリプト。
 *
 * 使い方:
 *   node scripts/cloudflare/sweep-preview-workers.mjs           # 棚卸しのみ（読み取り専用）
 *   node scripts/cloudflare/sweep-preview-workers.mjs --delete  # クローズ済み PR の残骸を削除
 */

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
const cfToken = process.env.CLOUDFLARE_API_TOKEN?.trim()
const ghToken = process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()
const repo = process.env.GITHUB_REPOSITORY?.trim() || 'Kazuglobal/pathguard-safetymap'
const shouldDelete = process.argv.includes('--delete')

if (!accountId || !cfToken) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required')
}
if (!ghToken) {
  throw new Error('GH_TOKEN or GITHUB_TOKEN is required to check PR status')
}

const PREVIEW_WORKER_RE = /^pathguardian(?:-[a-z0-9-]+)?-pr-([1-9][0-9]*)$/

async function cfRequest(method, path) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${cfToken}`,
      'content-type': 'application/json',
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success === false) {
    const detail = (body.errors ?? []).map((e) => `${e.code ?? ''}: ${e.message ?? ''}`).join('; ')
    const error = new Error(`Cloudflare API ${method} ${path} failed (${response.status})${detail ? `: ${detail}` : ''}`)
    error.status = response.status
    throw error
  }
  return body.result
}

async function listAllWorkers() {
  const scripts = await cfRequest('GET', '/workers/scripts')
  return Array.isArray(scripts) ? scripts.map((s) => s.id).filter(Boolean).sort() : []
}

async function getPrState(prNumber) {
  const response = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
    headers: {
      authorization: `Bearer ${ghToken}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'pathguardian-preview-sweep',
    },
  })
  if (response.status === 404) return 'not_found'
  if (!response.ok) return `error_${response.status}`
  const body = await response.json()
  return body.state === 'closed' ? 'closed' : body.state === 'open' ? 'open' : 'unknown'
}

const allWorkers = await listAllWorkers()
const byPr = new Map()
const nonPreview = []

for (const name of allWorkers) {
  const match = name.match(PREVIEW_WORKER_RE)
  if (!match) {
    nonPreview.push(name)
    continue
  }
  const prNumber = Number(match[1])
  if (!byPr.has(prNumber)) byPr.set(prNumber, [])
  byPr.get(prNumber).push(name)
}

const prNumbers = [...byPr.keys()].sort((a, b) => a - b)
const prStates = new Map()
for (const pr of prNumbers) {
  prStates.set(pr, await getPrState(pr))
}

const toDelete = []
const keptPrs = []
const deletedPrs = []

console.log(`アカウント上の Worker 総数: ${allWorkers.length}`)
console.log(`本番・非プレビュー Worker (${nonPreview.length} 個): ${nonPreview.join(', ') || '(なし)'}`)
console.log(`プレビュー由来 Worker: ${allWorkers.length - nonPreview.length} 個 / ${prNumbers.length} PR 分\n`)

for (const pr of prNumbers) {
  const workers = byPr.get(pr)
  const state = prStates.get(pr)
  console.log(`  PR #${String(pr).padStart(4, ' ')} | ${String(workers.length).padStart(2, ' ')} Worker | ${state}`)
  if (state === 'closed') {
    deletedPrs.push(pr)
    toDelete.push(...workers)
  } else {
    keptPrs.push(pr)
  }
}

console.log(`\n削除対象（closed PR）: ${deletedPrs.length} PR / ${toDelete.length} Worker`)
console.log(`保持対象（open または不明 PR）: ${keptPrs.length} PR (${keptPrs.join(', ') || 'なし'})`)

if (!shouldDelete) {
  console.log('\n[inventory mode] 削除は実行していません。')
  process.exit(0)
}

if (toDelete.length === 0) {
  console.log('\n削除対象のプレビュー残骸はありませんでした。')
  process.exit(0)
}

let deletedCount = 0
let skippedCount = 0
let failedCount = 0

for (const name of toDelete) {
  if (!PREVIEW_WORKER_RE.test(name)) {
    throw new Error(`Safety guard refused to delete non-preview Worker: ${name}`)
  }
  try {
    await cfRequest('DELETE', `/workers/scripts/${encodeURIComponent(name)}?force=true`)
    deletedCount += 1
    if (deletedCount % 25 === 0 || deletedCount === toDelete.length) {
      console.log(`削除進捗: ${deletedCount}/${toDelete.length}`)
    }
  } catch (error) {
    if (error.status === 404) {
      skippedCount += 1
    } else {
      failedCount += 1
      console.error(`削除失敗: ${name}: ${error.message}`)
    }
  }
}

const remaining = await listAllWorkers()
console.log(`\n=== クリーンアップ結果 ===`)
console.log(`削除成功: ${deletedCount} / 既削除スキップ: ${skippedCount} / 失敗: ${failedCount}`)
console.log(`残りのアカウント Worker 総数: ${remaining.length}`)

if (failedCount > 0) process.exit(1)
