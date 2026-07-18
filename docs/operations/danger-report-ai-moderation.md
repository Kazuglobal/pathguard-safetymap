# 危険箇所レポート AI一次審査 運用ランブック

更新日: 2026-07-18

## リリースノート

- traffic / crime / disaster / suspicious / other の危険箇所レポートを、AI一次審査で `approved` / `needs_review` / `escalated` に振り分ける。
- 自動却下は行わない。画像付き投稿は初期フェーズでは自動公開しない。
- suspicious も共通パイプラインへ移行し、自動承認にはAI呼び出しの成功を必須とした。APIキー未設定、タイムアウト、壊れた応答などのフォールバック時は `needs_review` へ送る。
- 投稿者向け案内文: 「投稿後、おおむね数分以内に公開または確認中の状態になります。AI一次審査に失敗しても投稿は失われず、管理者の確認に回ります。」

## 反映とロールアウト

1. `supabase/migrations/20260718090000_add_danger_report_ai_moderation.sql` を適用する。適用前チェックが未知の既存ステータスを検出した場合は停止するため、先にデータを確認する。
2. `CRON_SECRET` とGemini APIキーを設定する。
3. `DANGER_REPORT_AI_MODERATION_MODE=off` のままデプロイし、cron認証と管理画面を確認する。
4. `pnpm moderation:backtest -- --limit 100` を並列度1で実行する。危険側誤り0件かつapprove再現率30%以上の場合だけ次へ進む。
5. `shadow` で2週間または100件以上を収集し、危険側誤り率1%未満を確認する。
6. 条件を満たした場合だけ `live` へ切り替える。精度劣化時はまず `shadow` へ戻す。

環境変数の既定値は `off`。値が不正な場合も `off` として扱う。

## 監視

5分ごとのスイーパーは次の条件で管理者へpushする。

- 直近24時間のfallback率が30%を超える
- pendingかつAI未審査の滞留が50件を超える

通知を受けたら、管理画面のエスカレーション／要確認キュー、`danger_report_moderation_log`、Gemini APIキーと利用制限を確認する。投稿本文は監査ログやconsoleへ出力しない。

## コスト前提

2026-07-18確認時点のGemini Developer API標準料金では、`gemini-2.5-flash` は100万トークンあたり入力 $0.30、出力（thinking tokenを含む）$2.50。

テキスト1件を入力1,500・出力100トークンとすると約 $0.00070、1万件で約 $7。画像審査やthinking token、再試行分は別途加算されるため、実運用では監査ログの件数・latency・fallback率と請求額を月次で突合する。

料金は変更されるため、ロールアウト前に公式料金表を再確認する:
https://ai.google.dev/gemini-api/docs/pricing
