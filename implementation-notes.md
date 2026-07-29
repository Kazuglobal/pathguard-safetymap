# Implementation Notes — PathGuardian 紹介HP(/lp)作成 (2026-07-08)

## Assumptions(置いた前提)
- [A1] HPは同リポジトリの `app/lp` に新設。既存 `/landing`・アプリ本体は不変更(ユーザー確認済み)
- [A2] 主対象者=保護者、目的=利用開始促進、日本語のみ(ユーザー確認済み)
- [A3] デザインはたんけんノートではなくプレミアム・モダン系。GSAP+Framer Motion、品質が出せる範囲でThree.js(ユーザー指示)
- [A4] 画像・紹介動画は実生成(課金承諾済み)。プロダクトモックは実アプリのスクリーンショットをデバイスフレームに収める方式を第一候補とする(生成モックより正確なため)
- [A5] 本番デプロイは行わずローカル検証まで(公開は別途確認)。※デプロイ項目は未選択のため保守的デフォルト維持
- [A6] editorial-ad-prompt-factory / page-expansion-director は環境に不在 → 同等役割を既存スキル(image-taste-frontend / high-end-visual-design等)+自前設計で代替(ユーザー確認済み)

## Decisions(代わりに下した判断)
- [D1] GSAPをdependenciesに追加する(未導入)。framer-motion / three / @react-three/fiber / drei は導入済みを利用
- [D2] 制作順: プロダクト分析→絵コンテ(storyboard-creator)→映像プロンプト(video-prompt-adapter)→画像/動画実生成→/lp実装→検証ゲート

## Deviations(元プロンプト・計画からの逸脱)
- [X1] 実生成先をHiggsfield→Gemini APIへ変更 / Higgsfieldがクレジット残0(freeプラン)で生成不能だったため、
       リポジトリで実績のある GEMINI_API_KEY(gemini-3.1-flash-image-preview / gemini-omni-flash-preview)で
       画像5点+動画7カットを実生成した / 品質面の問題なし。Higgsfieldでの再生成が必要なら要クレジット購入
- [X2] 絵コンテパネル画像(モノクロ線画)は生成せず、構図は言語化して動画プロンプトに消化(omni-flashアダプタの規則) /
       理由: パネルは中間生成物でHPに載らないため。パネルプロンプト一式はstoryboardファイルに保存済みで後から生成可能
- [X3] CUT01が安全フィルタで1回ブロック → 「見送りの手を振る」文脈明示に書き換えて成功
- [X4] CUT05(アプリUI)とCUT09(エンドカード)はAI生成でなく実アプリのスクリーンショット+HTMLレンダリングで制作(正確性・ブランド一貫のため)
- [X5] editorial-ad-prompt-factory / page-expansion-director 不在 → 広告コピー/ページ構成設計を自前で代替(ユーザー承認済み)

## 検証結果(2026-07-08)
- typecheck: エラー0 / vitest tests/components/lp: 10 passed / pnpm build: exit 0(全ルートコンパイル成功)
- Playwright実機スクリーンショット: デスクトップ7点+モバイル2点で全セクション表示確認(2回イテレーション)
- adversarial-review(code-reviewer新規コンテキスト): CONFIRMED 3件→全て修正
  (C1: JS無効時に本文不可視→CSS初期非表示を撤廃しGSAP fromToに一本化 / C2: LpHero・LpVideoテスト追加(10件に増強) / C3: 字幕VTT+track追加)。
  PLAUSIBLE 6件中4件修正(P1 clamp/P3 コントラスト/P4 key/P5 preload簡素化)、P2(framer-motion特性)・P6(年跨ぎ)は許容として見送り

---

# Implementation Notes — 改善#1: PWAマニフェスト+ホーム画面導線+通知開通 (2026-07-25)

対象: docs/GROWTH_GAP_ANALYSIS_2026-07-25.md の A-2(推奨順1位)

## Assumptions(置いた前提)
- [A1] start_url は `/landing`(ユーザー承認済み)。`/` は /lp へ無条件リダイレクトのため不適
- [A2] アイコン正式アートは Codex サブスク内で生成し API 課金しない(ユーザー指示)。
       それまで scripts/generate-pwa-icons.mjs の暫定SVG(シールド+通学路+ピン)で運用
- [A3] iOS実機での通知受信検証はデプロイ後にユーザー協力で実施(ローカルでは不可能)

## Decisions(下した判断)
- [D1] iOS向けA2HS案内(IosInstallPrompt)は PushPermissionPrompt と同じくログイン済みユーザーのみに表示。
       iOS非standaloneでは push state が 'unsupported' になるため両プロンプトは排他で同時表示されない
- [D2] SW登録は専用コンポーネント(ServiceWorkerRegistrar)で全訪問者に対して起動時に冪等実行

## 発見(分析ドキュメント未記載のバグ・修正済み)
- [F1] use-push-subscription の checkState が navigator.serviceWorker.ready を await していたため、
       SW未登録(=一度も購読していない新規ユーザー)では ready が永久に解決せず state='loading' 固定。
       → PushPermissionPrompt が一度も出ず、mypage の設定パネルも永久スケルトン。
       全プラットフォームで新規ユーザーの購読動線が死んでいた。
       修正: getRegistration() ベースへ変更+起動時SW登録。回帰テスト追加済み

## Deviations(計画からの逸脱)
- [X1] フルスイートで既存失敗1件を発見(tests/components/editorial-copy-alignment.test.tsx)。
       原因は本改善と無関係: 2026-07-18の日次ニュース更新(ef3b2fd6e)で最新記事が入れ替わったが、
       最新記事タイトルをハードコードしたテストが未更新のまま放置されていた。
       症状パッチ(期待値の書き換えのみ)でなく、期待値を getLandingNewsPreview(1)[0].title から
       導出する形に修正し、今後の日次更新で再発しないようにした

## 敵対的レビュー(新規コンテキストcode-reviewer)と対応(2026-07-25)
- CONFIRMED修正: ①回帰テストのreadyモックが解決済みPromiseで旧実装でも通る偽陽性
  → 永久pendingに変更+subscribeタイムアウトテスト追加 ②subscribe()にready無限待ちが残存
  → requestPermission先行(ユーザージェスチャ内)+Promise.raceで10sタイムアウト
  ③sw.js通知クリック既定URLが'/'(→/lpへ飛ぶ) → /landing ④editorialテストが
  getLandingNewsPreview同士の同語反復 → getAllNewsItemsからpublishedDate最新を独立導出
  ⑤registrar/LayoutProviderテスト皆無 → registrarテスト3件追加
- PLAUSIBLE修正: navigate()未制御reject対策(activate+clients.claim+openWindowフォールバック)/
  Androidインストール要件のfetchパススルーハンドラ/「Safariの」文言一般化/iOS16.4未満は案内抑制
- SUGGESTION採用: manifest id:"/"/appleWebApp metadata/badge-96.png(モノクロ)/maskable継ぎ目解消(専用SVG)
- 見送り(理由付き): apple-touch-icon上書き=意図的(プレースホルダー置換をユーザー承認済み)/
  iOS案内のログイン限定=D1の意図的判断(匿名向け露出は改善#2の公開ビューで再検討)/
  localStorage try/catchなし=既存push-permission-promptと同一パターンで一貫性優先

## 検証結果(2026-07-25 最終)
- レビュー対応後: 対象8ファイル48件緑 / tsc --noEmit エラー0 / next build exit 0
- フルスイート: 1671件中1670緑。残1件=tests/components/safety-quest-client.test.tsxの
  既知flaky(全体実行の負荷時のみタイムアウト、個別実行で18/18緑を確認)。本改善と無関係
- ビルド成果物で確認: ○ /manifest.webmanifest 静的生成、body内容が設計どおり、
  全ページに <link rel="manifest" href="/manifest.webmanifest"/> 自動注入
- 未実施: iOS/Android実機での A2HS→standalone起動→通知受信(デプロイ後チェックリストで実施)

## 学び(gotchas)
- ログインUIのPlaywrightクリックはReactハイドレーション完了前だと**無反応で失われる**。waitForSelector直後のクリック禁止、6s程度待つ
- ffmpegで静止PNGをoverlay+fadeする場合は `-loop 1` 必須(ないとt=0の完全透明フレームだけが使われテロップが消える)
- Gemini Omni Flash(video)は child の手が離れる等の表現が安全フィルタに当たりうる。家庭的文脈(school departure等)を明示すると通る

## 追加ラウンド2(2026-07-08 ユーザーフィードバック対応)
- [D3] 機能紹介動画は Remotion(tools/feature-video, 独立package.json)+Gemini Omni Flash b-roll のハイブリッドで制作。
       48秒/6機能/実アプリ画面+実生成クリップ。レンダーは system Chrome(--browser-executable)
- [D4] プライバシー対応: モック地図・動画内地図を東京駅・丸の内(中立地)で撮り直し。旧スクリーンショット(開発者生活圏)は差し替え済み
- [D5] AIぽさ除去: Three.js粒子を削除、ホログラム画像2点(feature-map-watch/og-image)を自然な写真に再生成、
       動画CUT06もホログラム無し版に差し替え
- [D6] デザインは getquoti.ai 参照×親子チックに刷新: Zen Maru Gothic 900見出し/クリーム#F3EFE4×チャコール#2B2723/
       ピル型フローティングナビ/ステッカー風カード(回転+オフセット影)/マーキー/課題カードデッキ
- [X6] PhoneFrameのアスペクト比バグ修正(枠のborder分で中身が左右クロップされ「見切れ」ていた→padding方式で390:844を内側に保持)
- [X7] Remotion初回レンダーはGoogle Fonts全ウェイト読込(610リクエスト)でタイムアウト→loadFontにweights/subsets指定で解決
- [X8] アプリの「現在地」ボタンは地図移動でなく「現在地で報告」フロー。撮影はウィザードを閉じてから行う手順に変更
- 検証(ラウンド2): tsc 0 / vitest lp 12 passed / pnpm build exit 0 / スクリーンショット(デスクトップ8+モバイル2)で全セクション確認

## 追加ラウンド3(2026-07-08 ユーザーフィードバック対応: 目玉機能・柏残存・見切れ)
- [X9] 「まだ柏の地図」の真因は **Next.js画像キャッシュ**(同名差し替えでは旧最適化画像が配信され続ける)。
       全モック/OG/ポスターを**新ファイル名に改名**してキャッシュバスト(phone-map-tokyo.png 等)。
       今後アセット差し替え時は必ず改名すること
- [D7] 目玉機能「写真でキケンを見える化」(hazard-game のAI画像解析)を新設:
       実アプリに写真をアップロード→AI解析(約45s)→検出ボックス描画+安全スコアの実画面を撮影し、
       HP専用セクション(LpPhotoAi)+機能ツアー動画のシーン01に採用
- [D8] 機能ツアーを9シーン59秒に拡張: 写真AI/危険マップ/事故ヒートマップ/ハザードマップ/みんなの報告一覧/
       3ステップ報告/不審者アラート/安全ニュース/レポート。動画も v2 名でキャッシュバスト
- [D9] 機能カード6種を再編(きけんハンター・PDFレポート→事故ヒートマップ・ハザードマップに置換。目玉は専用セクションへ)
- [X10] レイヤー撮影の学び: アプリの「現在地」ボタンは報告フロー(とじる→破棄→Escの3段閉じが必要)/
        検索ボックスの候補ドロップダウンはチップを塞ぐ/地図上の無闇なクリックは事故詳細パネルを開く
- [X11] 一覧の座標マスクはテキスト置換だとReact再レンダーで戻る → **親要素へのblurスタイル適用**で解決
- 検証(ラウンド3): tsc 0 / vitest lp 13 passed / pnpm build(実行中→コミット前に確認)

## Open Questions(未解決)
- [Q1] 公開(Vercel本番反映)のタイミング — ローカル検証完了後に別途確認
- [Q2] 紹介動画のBGM(現状は生成環境音のみ、HP埋め込みはミュート自動再生なので実害なし)

---

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

## Deviations(元プロンプト・計画からの逸脱)
- [X1] AR: 抑制フラグのゲート解除だけでは通常モードに抑制対象が存在しなかった /
       接近強調(isApproaching)自体を通常モードでも有効化した / 理由: 抑制チェックに意味を持たせるため。
       ar_hazard_approached の計測イベントは従来どおり親子モード限定を維持
- [X2] クラスタリング導入に伴い、座標不正(isValidCoordinatesがfalse)の報告をライブ地図の描画対象から除外 /
       理由: 重心計算にNaNが混入するため。従来はtry/catchで暗黙に描画中断していた

## 検証結果(2026-07-08)
- 4項目それぞれ: 実装→対象テスト緑→コミット済み(d53e656a0 / fad75801a / 7d0918a76 / 4ce411f40)
- 全体一括実行: 1288 passed / 5 failed。失敗5件は全て tests/unit/app/api/gemini-generate-image-route.test.ts で、
  c5c28af37..HEAD のdiffにgemini関連ファイルはゼロ(今回の変更と無関係の既存失敗)。スコープ外として未修正

## Adversarial Review(wf_f475ca96-369)の結果と対応
- **注意: 27エージェント中19がディスク満杯で失敗し、レビューは部分カバレッジ(8エージェント完了分)**。
  原因=前回レビュー(wf_994f13bc)のworktree残骸24個+今回分で計13GBがディスクを圧迫。
  残骸34個を git worktree remove で削除し12.6GB回復済み
- CONFIRMED 3件(全て品質・衛生面、ランタイムバグなし):
  - [修正] C1: accident-heatmap-layer の手書きprops同期ref → useEventCallback へ(規約準拠)
  - [修正] C3: AR抑制メッセージの2箇所重複 → ARSafetySuppressionNotice に共通化
  - [記録] C2: 改行コード正規化(CRLF/LF)が機能コミットに混入しdiffが最大18倍膨張。
    今後は改行正規化を独立コミットで行う。.gitattributes 追加は大規模正規化diffを
    伴うため別タスク化(勝手にやらない)
- 修正後: vitest 77 passed / tsc エラー0 (aeb8ff0fb)

## Deviations(追記3)
- [X3] レビューが部分カバレッジのまま完了扱いになった / 完了8エージェント分のCONFIRMEDを修正して先へ進む判断 /
       理由: ディスク要因は解消済みだが、全27の再実行はコスト大。指摘傾向(衛生面のみ・バグゼロ)から追加リスクは低いと評価

## Open Questions(未解決)
- [Q1] クラスタバッジの見た目(たんけんノートデザインへの馴染ませ方)は実装中に既存トークンから判断する
- [Q2] gemini-generate-image-route.test.ts の既存失敗5件(500 vs 200)は別タスクで根因調査が必要

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

---

## Implementation Notes — safety-quest分割フェーズ1 + dead codeクリーンアップ (2026-07-08)

指示書: .deepsec/fable5-instruction-safety-quest-client-split-phase1.md / .deepsec/dead-code-audit-2026-07-08.md
ブランチ: refactor/cleanup-2026-07-08(codex/danger-report-region-filter-stability の HEAD ab6935332 から分岐)

### Assumptions(置いた前提)
- [A1] shadcn/ui未使用在庫21ファイルは温存(ユーザー未回答のためデフォルト採用)
- [A2] 作業ツリーの既存未コミット変更(tsconfig.json, .claude/*)はコミットに含めない(対象ファイルのみ git add)
- [A3] vitestフル実行は間欠タイムアウトの既知問題があるため、削除バッチ毎の検証は typecheck+grep とし、フル vitest は分割後と全削除後の2回に集約

### Decisions(ユーザー回答で確定)
- [D1] 分割フェーズ1と dead code A群+D群を本ブランチで順に実行(2026-07-08 AskUserQuestion)
- [D2] C群(openai-image / push-settings-panel / accident-heatmap-control-layout)は温存
- [D3] lib/gemini-image-generator.ts は7/2移行の残骸として削除対象に含める

### Open Questions(未解決)
- [Q1] push-settings-panel.tsx は Push通知本番稼働中なのに未配線 — 配線し忘れか意図的か要製品判断
- [Q2] shadcn在庫を削除するなら radix系依存の棚卸しとセットで別途実施

---

# Implementation Notes — 未コミット変更全体の敵対的レビュー(/adversarial-review)と修正 (2026-07-29)

対象: 未コミット52ファイル全体(PWA改善#1 + 先行のマーカー刷新・生成APIレート制限導入・モデル整理等)

## 結果
- CONFIRMED 5件(実質3系統)/ PLAUSIBLE 3件 / REFUTED 4件(correctness+regression の2視点)
- security / simplicity の2視点は**セーフティ分類器にブロックされ未実施**(下記X1)。コミット後に
  worktree隔離ありで別途実施

## CONFIRMED / PLAUSIBLE への対応(全て修正・検証済み)
- [修正] danger-report-form: 解析中に写真を差し替えると manualAnalysisTriggered が残留し、
  新写真の解析+画像生成一式(有料API最大7呼び出し)がボタン押下なしに自動起動する
  (トリガーリセットを finally へ移した副作用。abort後は isActive()=false でリセットがスキップされる)。
  → handleOriginalImageSelect / handleRemoveOriginalImage でトリガー解除。
  回帰テスト追加+ミューテーション(修正行を除去→テスト失敗)で実効性確認済み
- [修正] マーカー当たり判定: 76×68箱の透明余白が近接ピンのタップを横取りし別レポートが開く
  (誤ユーザーへのポイント付与も発生)。→ pointer-events で当たり判定を可視ピン48×56に限定。
  CSS不変条件のトリップワイヤテスト追加。design-qa.md の記述も更新
- [修正] upstash-rate-limiter: ratelimit.limit() の reject が未捕捉で、Upstash障害時に
  画像生成API全体が500+生の内部エラーメッセージ漏えい(UpstashErrorはコマンドJSON込み)。
  → checkLimit 内で捕捉し fail-open。ユニットテスト新設(fail-open含む5件)
- [修正/PLAUSIBLE] image-gen制限 5回/60秒 → 15回/300秒。正規フローが1操作で複数回呼ぶ
  (手動解析=5連続、一括生成=9連続、直後の再生成)ため5/分では正規操作が429になり、
  batchGenerateAll はそれをサイレントスキップする。15/5分は正規バーストを許容しつつ
  持続乱用は旧設定(実効300回/時)より厳しい(180回/時)
- [修正/PLAUSIBLE] analyze-hazard の画像fetchに redirect:"manual" を追加+3xx/opaqueredirectを
  エラー化。リダイレクト先URLは validateImageUrl 検証を経ないSSRF経路だった。
  トリップワイヤテスト追加

## Deviations
- [X1] /adversarial-review をworktree隔離なしの一時版で起動した(空き1.36GB、worktree1個214MB×
  最大10並列で枯渇確実のため。プロンプトで読み取り専用を厳格化)。→ セーフティ分類器が
  security/simplicity の2エージェントをブロック。**学び: 事故後ポリシー「isolation:'worktree'既定化」は
  プロンプト強化では代替できない(明示のユーザー承認が要る)。以後は「先にローカルコミット→
  worktree隔離でレビュー」の順にする**(worktreeはHEADをチェックアウトするため未コミット変更が
  見えない問題も同時に解消する)
- [X2] レビュー実施前の残骸掃除: 空ディレクトリ .claude/worktrees/wf_527acbd4-178-32 を確認の上削除

## 既知の残課題(今回のdiff外・別対応)
- batchGenerateAll(danger-report-form)は非OK応答をサイレントスキップし「X/9件」と歯抜けになる
  だけでエラー表示がない(既存コード)。429対策は制限値側で緩和済みだが、失敗の可視化は別途
- SSRFはDNS名→プライベートIP解決の経路が redirect:manual では塞がらない。本命は
  VLM_ALLOWED_IMAGE_HOSTS の必須化(Supabase Storageホスト固定)+egress制限で、運用設定が必要

## 検証結果(2026-07-29 第1ラウンド)
- 対象6ファイル34テスト緑(新規: upstash-rate-limiter 5件 / トリップワイヤ4件 / フォーム回帰1件)
- ミューテーションテスト: フォーム回帰テストが旧実装で失敗することを確認(偽陽性でない)
- tsc --noEmit: エラー0

## 第2ラウンド: security / simplicity / fix-validation(2026-07-29)

X1 の学びどおり「先にローカルコミット → worktree 隔離でレビュー」の順で再実行し、
分類器ブロックを解消した。ただし**検証エージェント19件中17件がセッション上限で失敗**したため、
「CONFIRMED 0」は無罪放免を意味しない(未検証の指摘は自分でコードを読んで裁定した)。

### 対応した指摘(6件。いずれも自分でコードを読んで成立を確認)
- [修正] public/sw.js: 通知ペイロードの data.url を無検証で navigate/openWindow に渡していた
  → 自オリジンに限定(resolveNotificationUrl)。正規通知からフィッシングサイトを開ける経路を封鎖。
  sw.js を疑似 ServiceWorkerGlobalScope で実評価する機能テスト5件を新設
- [修正] app/api/hazard-game/analyze: レート制限が皆無のまま Vision モデルが
  gemini-2.5-flash → 3.5-flash(入出力10〜15倍単価)になっており、1アカウントで
  従量課金とポイント付与(increment_user_points)を無制限に回せた
  → 兄弟の hunter/analyze と同じ checkGeminiRateLimit(10回/分)を追加。テスト3件新設
- [修正] analyze-hazard の validateImageUrl: `host === "::1"` は WHATWG URL の hostname が
  `[::1]` を返すため**一度も一致しない**死に条件だった。角括弧を外して IPv6 を判定し、
  ULA(fc00::/7)・リンクローカル(fe80::/10)・IPv4-mapped・0.0.0.0/8 を追加
- [修正] analyze-hazard: content-length(取得先の自己申告)チェック後に arrayBuffer() で
  全量バッファしており、省略・過少申告でメモリ枯渇を誘発できた
  → readBodyWithCap で上限到達時に打ち切り
- [修正] クラスタマーカーにも当たり判定限定を適用(第1ラウンドの修正が個別ピンのみで不完全だった)
- [修正] textInImage(GPT Image 2 経路)は SCENE_PRESERVATION_GUARD_SUFFIX 非適用が意図的な設計
  (「余計な文字禁止」と矛盾するため。既存テストで固定)だが、その結果**匿名化と
  「未確認の子ども110番の家を描き足さない」ガードまで外れていた**
  → TEXT_ASSET_PRIVACY_GUARD_SUFFIX(文字禁止条項を除いた最小ガード)を新設し、
  元写真つきリクエストに付与。既存の「文字禁止を付けない」契約は維持

### 対応しなかった指摘と理由
- SSRF の残穴(私有IPへ解決するDNS名): コードだけでは塞げない。本命は
  VLM_ALLOWED_IMAGE_HOSTS を Supabase Storage ホストで必須化する運用設定 + egress 制限。
  値を知らないまま既定allowlistを有効化すると本番を壊すため運用課題として残す
- fail-open の全リミッター適用(設定ミス時に無警告で恒久無効化): docstring どおりの意図的設計。
  console.error は出る。監視は別施策
- danger-report-form 2094行の分割 / DANGER_TYPE 色・アイコンの第3定義源 /
  logApiUsage ボイラープレート3重 / callGeminiVision の位置引数: いずれも既存構造の
  リファクタで、レビュー修正とは別コミットにすべき規模
- コミット995257953にCRLF再出力が混在(規律違反): 既にコミット済みで、
  巻き戻すと差分がさらに増える。次回以降 .gitattributes 整備とセットで対応
- articles-v1-backup/ の誤情報(事故年次2019〜2023)保持: ユーザーの成果物であり削除しない。
  README に「流用しないこと」の警告が既にある

### フルスイートで発見した既存破損(X3)
- [X3] tests/components/editorial-copy-alignment.test.tsx の詳細ページテストが
  記事スラッグをハードコードしており、**日次ニュース更新 b082360d6(2026-07-26)が
  その記事を削除したため 404(notFound)で失敗**していた。X1 で直したのと同じ腐り方が
  同一ファイルの別テストにも残っていた形。期待値の書き換えでなく getBreakingNews() から
  導出する形に修正(注目バッジは isBreaking の記事にしか出ないため)。
  **学び: 日次更新されるコンテンツを参照するテストは、タイトルもスラッグも一切ハードコードしない**

### 検証結果(2026-07-29 第2ラウンド)
- 対象8ファイル62テスト緑(新規: sw通知クリック5件 / hazard-gameレート制限3件 /
  textInImageガード1件 / CSS・SSRFトリップワイヤ4件)
- tsc --noEmit: エラー0 / deno check supabase/functions/analyze-hazard/index.ts: エラー0
- フルスイート: 203ファイル1702件緑(X3修正後。既知flakyの safety-quest-client も今回は緑)

### Deviations(2026-07-08 実行結果)
- [X1] 最終フルvitestで gemini-generate-image-route.test.ts が5件失敗 / 削除5ファイルを一時復元して再実行しても同一失敗を確認 / 今回の変更と無関係の既存問題(@/lib/api-cost-calculator モックに calculateCost 未定義。関連3ファイルの最終コミットは7/5の493938f9e)。修正は本タスクのスコープ外として温存
- [X2] safety-quest-client.test.tsx の1件がフル実行時のみ失敗(負荷起因のflaky)/ 個別再実行で11/11緑を2回確認 / 既知の「フル実行間欠タイムアウト」と同класス

### 検証結果(2026-07-08 最終)
- typecheck: エラー0(分割後・各削除バッチ後・全削除後)
- vitest safety-quest-client: 11/11 緑(分割直後・全削除後の個別実行)
- vitest フル(tests/unit+tests/components): 1538 passed / 6 failed — 6件はすべて上記X1(既存)+X2(flaky、個別緑)
- 削除ファイルのbasename grep: 全バッチで残存参照ゼロを削除直前に確認

### 追記(2026-07-08): X1の既存テスト失敗を修正
- [D4] gemini-generate-image-route.test.ts の失敗5件は「7/5のroute改修(calculateCost使用開始)にモックが追従していない」テスト側の不備と判断し、@/lib/api-cost-calculator モックに calculateCost を追加(実装は無変更)。修正後 6/6 緑
- X1修正後のフル再実行: 1543 passed / 1 failed — 残る1件はX2のflaky(safety-quest長尺テスト、個別実行3回連続緑)。タイムアウト延長は禁止手段のため対処せず、フェーズ2でテスト追加する際にこの長尺テスト(7画面連続操作)の分割を推奨として残す

### 追記(2026-07-08): 分割フェーズ2完了
- [D5] サイド画面10個を components/safety-quest/*-screen.tsx へ逐語移動。本体1921→968行。画面ローカルデータ(teamMembers/collectionItems/heroCards)は使用画面に同梱
- [X3] フェーズ2適用スクリプトのlucide import置換regexがreact importに誤マッチし、useState importが一時消失 / 即時Edit修復し tsc 0エラー・テスト緑を確認 / 教訓: import書き換えは「from句まで含めた完全一致」でアンカーすること
- [X4] 長尺テスト分割は3分割では不足(アバター+図鑑+ルームがフル実行負荷でなおタイムアウト)→4分割で解消。11→15ケース、アサーション無変更
- 最終検証: tsc --noEmit エラー0 / vitest フル 1557/1557 全緑(flaky解消を確認)
- 残: フェーズ3(コアループ画面5個)で本体968→約400行の見込み

### 追記(2026-07-08): 分割フェーズ3完了 — 目標達成
- [D6] コアループ画面5個(AdventureMap+MapIllustration+StageNode/HazardChallenge+HazardMarker/QuizBattle/Rewards/Daily)を抽出。Screen型は components/safety-quest/screen-types.ts へ
- 本体 safety-quest-client.tsx: 968→385行(当初2277行から-83%、規約200-400行目安に到達)。抽出ファイル全て200行未満
- 検証: tsc --noEmit エラー0 / safety-quest 14/14緑 / フル実行は初回3failed→即時再実行で全緑(並行セッションがapp/lpを編集・実行中でマシン高負荷。実行時間111→190秒に悪化しており負荷起因flakeと判断)
- 残: renderedScreen useMemo依存配列の未使用points(挙動同一のため温存中)/ DailyScreenのポイント表示ハードコード — 分割完了につき別チケットで判断可

### 追記(2026-07-08): 残課題の処理完了
- [D7] テスト補強3件を追加(rewardKeys→コレクション解放の結線検証はローカル解放と区別するためsecretキーで実施 / ステージノード連動起動 / フィード取得失敗フォールバック)。全て既存挙動のカバレッジ化で即緑
- [D8] ポイント・コイン表示のハードコード解消をTDDで実施(RED→GREEN)。DailyScreenにpoints/coins props追加、本体ヘッダのコイン「120」固定をcoins stateに配線(coinsは加算されるのに一切表示されていなかった)。表示値が変わる仕様変更: ヘッダのコインは120→1,250(初期値)になる
- [D9] 死に変数foundCountを削除。useMemo依存のpointsはDailyScreen配線により正当化され、coinsを追加(温存していた要確認事項2件はこれで解消)
- 検証: safety-quest 18/18緑 / tsc 0 / フル実行は初回1failed→即時再実行で全緑(並行セッション負荷による既知flakeパターン)
- 残るOpen Questions: DailyScreen/ヘッダの「レベル 12」等の固定値はゲーミフィケーション設計(レベル制)自体が未実装のため対象外とした

## Deviations(2026-07-22: Vision移行 + GPT Image 2併用)
- [D10] 承認された「Gemini 3 Flash」への移行は、既定モデルを `gemini-3.5-flash`(GA)として実装。理由: 公式ドキュメント上 `gemini-3-flash` は preview のみで安定版が存在せず(preview IDは廃止リスク)、GA系列は 3.5 Flash($1.50/$9.00 per 1M)と 3.6 Flash($1.50/$7.50、2026-07-21 GAで実績1日)のみ。保守側として実績2ヶ月の3.5を既定にし、3.6へは GEMINI_VISION_MODEL 環境変数で無変更切替可能
- [D11] 移行スコープは承認どおり (a) きけんハンター+ハザードゲームのみ。callGeminiVision に第4引数 defaultModel を追加(後方互換)し、モデレーション(suspicious-alert)・生成画像検証(disaster-image-verification)は gemini-2.5-flash 既定を維持(2026-07-18設計書の「モデルを変えない」判断とも整合)
- [D12] hazard-game/analyze の使用量ログを実態に合わせ修正: model_name ハードコード→解決値、request_count 3→1(現行パイプラインは1コール)、estimated_cost 0.006→0.013(3.5 Flash単価)
- [X5] vitest が `.codex-worktrees/`(Codex残骸)と `.pnpm-store/`(プロジェクトスナップショット)内の旧仕様テストコピーを拾い58件の偽失敗 → vitest.config.ts の exclude に両ディレクトリを追加(既存の .claude/worktrees 除外と同パターン)。Glob/リポジトリ走査系のタイムアウトも同ディレクトリが原因
- GPT Image 2併用は /api/gemini/generate-image の明示フラグ `textInImage=true` として実装(プロンプト内容からの自動判定は、災害画像の「余計な文字禁止」ガードと矛盾する誤ルーティングが危険なため不採用)。OpenAI経路はガード付与なし・災害検証なし・openaiプロバイダでコスト実測ログ
- 検証: 影響6テストファイル 117/117 緑 / tsc --noEmit エラー0

### 追記(2026-07-22): adversarial-review の CONFIRMED 5件を修正
- [D13] スコープ漏れ修正: analyzeImagePipeline は safety-quest/private-practice とも共有のため、モデル指定を AnalyzeImageOptions.visionModelDefault へ移動。hazard-game ルートだけが REALTIME_VISION_DEFAULT_MODEL を渡し、レガシー位置引数形式・省略時は gemini-2.5-flash 既定に残留。deprecated analyzeImageForHazardsGemini も既定へ復帰。回帰テスト tests/unit/lib/gemini-hazard-model-scope.test.ts で恒久固定
- [D14] hazard-game のコスト定数ハードコード(0.013)を calculateCost({model: HAZARD_VISION_MODEL, 2500in/1000out}) に置換。GEMINI_VISION_MODEL 上書き時もモデル名とコストが自動整合
- [D15] generate-image: APIキー未設定(environment variable is not set / Missing GOOGLE_API_KEY)を 401 誤変換せず 503+汎用メッセージで返す(環境変数名の漏出も防止)
- [D16] generate-image に checkImageGenerationRateLimit(5req/分/ユーザー, prefix 'image-gen')を新設・適用。Gemini/GPT Image 2 両経路を保護
- [D17] hunter-ai のJSON再抽出リトライを callHunterVision(prompt+RETRY_SUFFIX, false) に集約(モデル引数の重複3→2箇所)
- PLAUSIBLE 3件は未対応で記録: (1) textInImage=true で匿名化ガード・機械検証を認証ユーザーがバイパス可能(generationMode未指定パスと同等の既存挙動だが、文字入り素材の用途拡大時はサーバ側許可制を検討) (2) hazard-game 1解析コスト約10倍+ポイント付与の組合せ悪用(レート制限は generate-image のみ新設。hazard-game は既存のまま) (3) OpenAI 生エラーメッセージのクライアント返却(503対応で最悪ケースは解消)
- レビュー用worktree .claude/worktrees/wf_14b8889d-c12-1 は git worktree remove で掃除済み。残骸 wf_527acbd4-178-32(git未登録ディレクトリ)は削除規律により未削除・要手動確認
- 検証: gemini-hazard-model-scope 4件含む影響7ファイル 123/123 緑 / tests/unit 全体 140ファイル・1252件 全緑 / tsc --noEmit エラー0
