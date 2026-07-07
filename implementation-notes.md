# Implementation Notes — 見送り改善4項目の実装 (2026-07-08)

## Assumptions(置いた前提)
- [A1] クラスタリングはDOMマーカー維持で近接グループ化(Mapboxネイティブクラスタへの置換はしない。ユーザー回答で確定)
- [A2] AR通常モードの安全チェックは親子モードと同一閾値(精度50m/速度15km/h)・同一抑制動作(ユーザー回答で確定)
- [A3] 相互参照は既存詳細モーダルの拡張(事故統計セクションと同じ300m円で近隣報告を検索。地点統合パネルは作らない。ユーザー回答で確定)
- [A4] 審査結果通知は既存のweb-push基盤(app/api/push/*)に載せる
- [A5] speed=nullの端末ではAR抑制が発火しない現状挙動を許容(安全側への誤作動を作らないため)

## Decisions(代わりに下した判断)
- [D1] 実装順は小→大(AR→通知→相互参照→クラスタリング)。項目ごとに検証→コミット、最後に全体をadversarial-review
- [D2] サブエージェント並列化はしない(4項目は別ファイルだが、検証の交錯とworktreeマージのオーバーヘッドが利益を上回ると判断)

## Open Questions(未解決)
- [Q1] クラスタバッジの見た目(たんけんノートデザインへの馴染ませ方)は実装中に既存トークンから判断する

---

# Implementation Notes — 5安全情報系統の整合性バグ修正 (2026-07-07)

## Assumptions(置いた前提)
- [A1] 投稿フォーム(wizard/ui.tsx DangerLevelPicker)は1〜5入力のまま維持。表示・フィルタ側で1〜4にクランプして吸収(ユーザー回答で確定)
- [A2] レベル1の色が緑→黄に変わる視覚変更は受け入れ(ユーザー回答で確定)
- [A3] danger_levelにDB CHECK制約はない(migrations grepで未検出)。既存データに5が含まれる前提で扱う

## Decisions(代わりに下した判断)
- [D1] 統一範囲は6箇所: use-danger-markers.tsx / ar-display-utils.ts / report-detail-utils.ts(getDangerLevelColor,Label) / map-sidebar.tsx / dashboard/report-detail-modal.tsx(getDangerLevelClass,BorderColor) すべて(ユーザー回答で確定)
- [D2] サイドバーのレベルフィルタ「4」は生データ4と5の両方にマッチさせる(表示クランプと一貫)
- [D3] 優先度5(クラスタリング/AR個人モード安全チェック/相互参照UI)は今回スコープ外、別タスク化(ユーザー回答で確定)
- [D4] 並列サブエージェントは使わず逐次実装(map-sidebar.tsx と report-detail-utils.ts が複数項目にまたがり編集競合するため)

## Deviations(元プロンプト・計画からの逸脱)
- [X1] 元指示「レベル5は死んだ選択肢の可能性が高い→1〜4に合わせる」は前提誤り。
       調査で入力フォームが現役で5を生成中と判明 / フィルタ4=生データ4,5マッチ方式を選択 / 理由: データ移行不要で表示一貫性を達成

## Decisions(追記)
- [D5] danger-level-presentation.ts に badgeClass/borderAccentClass/surface を追加(1〜4クランプのロジックは不変)。重複6箇所を全て委譲化
- [D6] 人間による却下はDB行削除(dashboard-content.tsx handleReject)のため、投稿者が見うる却下は ai_moderation_status="rejected" のみ。getReportStatusPresentation は status×ai_moderation_status の組み合わせで導出
- [D7] status="resolved" も従来「審査中」誤表示だったため「解決済み」表示を追加(同じ2値化バグの一部として修正)
- [D8] map-sidebar のローカル getDangerTypeLabel(suspicious欠落)を report-detail-utils の共有版へ委譲。アイコンに UserX(suspicious)追加

## Deviations(追記)
- [X2] サイドバーの危険度バッジが生数値(5が出うる)を表示していたため★表示に変更 /
       aria-label も「危険度レベルN」→「あぶなさ {kidLabel}」に変更 / 理由: 表示1〜4クランプとの矛盾解消
- [X3] dashboard/report-detail-modal の「レベル N」バッジとインライン色分岐(緑〜赤の三項連鎖)も一元定義に置換 /
       理由: D1で確定した6箇所統一の一部

## Adversarial Review(wf_994f13bc-bfc)の結果と対応
CONFIRMED 17件 / PLAUSIBLE 1件。対応:
- [修正] C1/C10: 未更新テスト(report-detail-modal-comments.test.tsx:341)の期待値を★表示に更新
- [修正] C2/C7/C8/C11: getReportStatusPresentation が published を扱わず「審査中」誤表示+
  AI審査理由が公開分岐に漏れうる → PUBLIC_DANGER_REPORT_STATUSES 経由の判定に書き換え、
  管理者却下(status="rejected")も対応
- [修正] C3: translateDangerType に suspicious 追加(ARで英語生文字列が出ていた)
- [修正] C4/C12: dashboard/report-detail-modal のタイプラベル・状態バッジを共有版へ委譲
- [修正] C5: createReportSummary の byLevel を表示レベル(1〜4クランプ)で集計
  (レベル4と5が同ラベルバッジ2個に分裂していた)
- [修正] C6: vitest exclude に **/.claude/** 追加(レビュー用worktreeの姉妹コピー除外)
- [修正] C9: tailwind content に ./lib/** 追加(lib内定義のTailwindクラスがパージされる)
- [修正] C13: formatDangerLevelBadgeText を一元定義に追加し4箇所の再実装を委譲化
- [修正] C15: 死にコード化した getStatusLabel/getStatusBadgeClass ラッパーを削除
- [修正] P1: pending クエリにもタイプ・危険度・期間フィルタを適用(共通関数化)
- [見送り] C14: 危険タイプラベルの lib/ への移設(components間import解消)は別リファクタ
- [見送り] C16: map-sidebar のアイコンswitchのローカル実装(JSX/色を含むため現状維持)
- [見送り] C17: ar-display-utils の改行コード起因diffチャーン(実害なし)

## Deviations(追記2)
- [X4] use-danger-reports の期間フィルタは旧実装が new Date(0)(1970年)基準で実質no-opだった /
       now基準に修正 / 理由: フィルタ共通化(P1対応)の際に発見。1970年基準を保存する意味がない

## 検証結果(2026-07-07 最終)
- typecheck: エラー0
- vitest: 201 passed / 0 failed (14ファイル、map-container characterization 26件含む)
- adversarial-review: CONFIRMED 17件中14件修正・3件見送り(上記)、修正後に再検証済み

## Open Questions(未解決)
- [Q1] レベル5データの将来的な扱い(入力も4段階化するか)は別途製品判断待ち
- [Q2] vlm-analysis.ts の getRiskLevelLabel(1〜5、「低リスク」等)は別ドメイン(AIルート分析)として今回触れていない。danger_level と統一すべきかは別判断
