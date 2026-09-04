# Cloudflare PRプレビュー

PRごとに14個のprivate backend Workerと1個のpublic router Workerを作成する。
本番のWorker、カスタムドメイン、D1/R2、cron、backup workflowは変更しない。
プレビュー用D1/R2はPR間で共有する。PRを閉じてもDB/画像は削除しない。

## 初回セットアップ

1. `wrangler.preview-resources.json` の専用D1/R2を用意する（この変更で作成済み）。
2. 専用D1へスキーマのみ適用する。本番データはコピーしない。

   ```sh
   pnpm exec wrangler d1 migrations apply DB --remote --config wrangler.preview-resources.json
   pnpm exec wrangler d1 migrations apply TRAFFIC_DB --remote --config wrangler.preview-resources.json
   ```

3. GitHub Environment `cloudflare-preview` に以下のsecretsを登録する。
   - `CLOUDFLARE_API_TOKEN`: 対象accountのWorkers Scripts編集、D1編集、R2編集。GitHubにのみ登録しチャットへ貼らない。
   - `CLOUDFLARE_ACCOUNT_ID`
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
   - `NEXT_PUBLIC_MEDIA_BASE_URL`: プレビュー画像専用R2 URL
   Environment variable `CLOUDFLARE_WORKERS_SUBDOMAIN` にWorkersサブドメイン（このaccountは `globalbunny`）を登録する。
   `NEXT_PUBLIC_SITE_URL` はworkflowがPR番号ごとに組み立てる（固定URLを別PRへ使い回さない）。

   CloudflareへのローカルOAuthログインはGitHub Actions用トークンの代わりにはならない。
   Environmentのrequired reviewer設定を推奨。fork PRにはデプロイしない。

## ローカルからのデプロイ

上記のpublic値と該当PRの `NEXT_PUBLIC_SITE_URL` だけを `.env.preview.local` に設定する。本番のenvファイルをコピーしない。
クリーンなチェックアウトを使用する。`.env.local` 等の通常のenvファイルや
`env.defaults.json` がある場合、ビルドは拒否する。継承されたprivate環境変数もビルドへ渡さない。

```sh
node --test scripts/cloudflare/preview-config.test.mjs
pnpm deploy:cloudflare-preview --preview=pr-186 --dry-run
pnpm deploy:cloudflare-preview --preview=pr-186
pnpm delete:cloudflare-preview --preview=pr-186 --dry-run
```

初回のservice binding循環を解決するため、routerに一時的な503レスポンスを配置してから
backend群、最終routerの順にデプロイする。途中失敗したら同じコマンドを再実行する。
GitHubの同一PRワークフローはconcurrencyで直列化する。

## 制約

- 空の専用DBなので本番の投稿・交通事故データは表示しない。
- スキーマ変更PRは専用D1との互換性を確認し、必要なマイグレーションを手動で調整する。
  PRごとのDDLは共有プレビューDBへ自動適用しない。
- `20260903155959_report_creation_rewards.sql` はWranglerのmigration query経由で
  `incomplete input` になったため、この専用DBでは `d1 execute --file` で適用し、
  4トリガーとreward_points列の存在を検証後に `d1_migrations` へ適用履歴を記録済み。
- Authのpublic設定を本番と共有する場合、ログイン先は既存Supabase Authのまま。
  アカウント登録・パスワード変更は本番Authにも影響するため行わない。
  完全な認証テストには別のSupabaseプロジェクトとredirect allowlistが必要。
- 本番のAI・LINE・push・Auth Admin・cronキーはコピーしない。これらの機能はこのプレビューでは検証対象外。
- 公開画像R2へ個人情報や本番画像を入れない。非公開画像用R2は非公開のまま。
- PR用Workerの削除は名前を検証して実施する。D1/R2は削除しない。
- Vercelの既存GitHub連携は変更しないため、そちらの失敗チェックは別途残り得る。

仕様: [Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)、
[Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)。
