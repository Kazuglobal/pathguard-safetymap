// Cloudflare Workers Builds は、接続先 Worker（router の `pathguardian`）の名前とタグを
// WRANGLER_CI_OVERRIDE_NAME / WRANGLER_CI_MATCH_TAG として渡す。wrangler はこれを `--name` より優先するため、
// そのまま 14 個のサーバー Worker を deploy すると、すべて router に上書きされてしまう（2026-10-07 に発生）。
// サーバー Worker の deploy ではこの2つを外し、router の deploy ではそのまま残す。

export const CI_WORKER_OVERRIDE_VARIABLES = ['WRANGLER_CI_OVERRIDE_NAME', 'WRANGLER_CI_MATCH_TAG']

/** サーバー Worker を deploy するときの環境変数（CI の名前・タグ固定を外した新しいオブジェクト）。 */
export function serverWorkerDeployEnv(env) {
  const next = { ...env }
  for (const name of CI_WORKER_OVERRIDE_VARIABLES) delete next[name]
  return next
}
