<!--
【再構築メモ 2026-07-07】
このファイルは2026-07-07、ワークフロー実行中の暴走サブエージェントによって誤って
削除された。会話履歴には残っていなかったため、元の全文(6軸診断の詳細・T-01〜T-25の
チケット一覧全項目)は復元できていない。
以下は auto-memory `prerelease-review-2026-07-02.md` に残っていた「自分で裏取り済みの
Critical」の要約のみを元にした再構築であり、原本ではない。§5(本番実機でしか確定
できない項目)・§7の全チケット(T-01〜T-25)・UX/品質/ビルド検証軸の詳細は失われたまま。
再度フルの診断が必要な場合は release-readiness-review スキル等で診断をやり直すこと。
-->

# リリース前診断 2026-07-02(再構築版・不完全)

**結論: No-Go**

6並列サブエージェント(APIセキュリティ/DB・RLS/プライバシー/品質/UX/ビルド検証)でリリース前診断を実施。以下は自分で裏取り済みのCritical項目のみの再構築。

## 裏取り済みCritical

- **N1（解消済み）**: `danger_reports` の INSERT ポリシーにあった status 無制約は `20260704090000_restrict_danger_reports_insert_status.sql` で解消済み。さらに `20260718090000_add_danger_report_ai_moderation.sql` で、非adminが確定済みの `ai_moderation_status` を事前セットして審査・監査を迂回する経路も封鎖した。
- **N2**: `role` の `REVOKE UPDATE (role,email,id)` が versioned migration に無く legacy `database-migration-profiles-security-hardening.sql` のみに存在。versioned `20260505000000` はINSERTのみ強化。→本番で列権限次第で自己admin昇格の恐れ。
- **R2**: `image/process` に sharp なし、原本を公開バケットへ保存。EXIF未除去(危険レポート経路)。ハンター経路(`lib/hunter/storage.ts`)はwebp限定+非公開で対応済み。
- **R3/R6**: `/terms` `/privacy` `/contact` が不在(href="#")。`lib/openai.ts:114-115,271` にAPIキー断片のログ出力が残存(到達経路はtest-openaiのみ=本番403想定)。
- **S1**: Google APIキー(AIza〜)がgit履歴の2コミット(`955da900f`, `e7a6e640e`)に残存。現ツリーには無し。リポジトリは404(非公開)濃厚だが要ローテーション。

## 本番実機でしか確定できなかった項目(再構築不可・要再調査)

- versioned migration の適用状態
- profiles列権限(N2の成否)
- storageバケットのpublic/private実態
- UPSTASH/CRON_SECRET等の環境変数設定状況
- diaries/players/teamsテーブルの現行使用有無

## 関連

- [[suspicious-alert-moderation-clientside]] — 本件N1の具体的対応(サーバ側LLM/Vision審査への移行)
- [[hunter-dedicated-ai-redesign]] — きけんハンターは本診断でセキュリティ・プライバシーとも良好と確認済み

---

**注意**: このドキュメントは2026-07-02時点のスナップショットの、さらにその一部を再構築したものです。現在のコード状態を正としてではなく、当時何が指摘されたかの参考としてのみ扱ってください。上記Critical項目が現在も未解消かどうかは、このドキュメントだけでは判断できません(コード読み取りで再確認が必要)。
