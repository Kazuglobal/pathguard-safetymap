# 不審者アラート 地図化機能（住所/エリア → 半径つき危険エリア円で強く視覚化）実装計画

> 作成日: 2026-06-28 / 状態: 承認済み（実装中）

## Context（背景・目的）

**解決したい課題：** 学校から「○○町付近で不審者目撃」等の不審者情報が配信されても、**どこなのか即座にわからない**。文字情報のままで場所が直感的に把握できないのが本質的な問題。

**ゴール：** 配信された住所/エリアを**最速で地図化**し、**半径つきの危険エリア円＋大きいパルスマーカー**で「どの辺りか」を一目で分かるよう**しっかり視覚化**する。さらに**ヒヤリハットと同様に「地図画像＋写真」つきで事例を掲載・SNS共有でき、コメント・リアクションもできる**ようにする。

**ユーザー確定方針：**
- データ源 = 保護者の手動投稿（既存 `danger_reports` を流用、`danger_type='suspicious'`）
- 位置指定 = 住所入力＋地図クリック両対応
- 視覚化 = **半径つき危険エリア円＋大きいパルスマーカー**（「付近」表現に合致、自動ズームで即座に把握）
- 投稿口 = **軽量な「不審者アラート」専用入力**（学校配信を最速で地図化）
- 共有 = 既存の共有カード（Web Share `shareFamilyShareCard`）を流用
- 公開 = 投稿直後は `pending` として投稿者本人に表示し、AI一次審査で低リスクなら `approved` に自動昇格。不確実・高リスクなものだけ管理者確認に回す。

**前提（調査済み）：** `danger_type` はDB制約のない自由文字列のため型追加にマイグレーション不要。`@turf/turf@7.2.0` が導入済みで `turf.circle()` によりメートル精度の円ポリゴンを生成可能。GLレイヤーの追加・再追加（style.load対応）の実装パターンは `components/map/accident-heatmap-layer.tsx` に既存。ジオコーディングは `GET /api/mapbox/geocode`（`components/3d-route/address-search.tsx` が利用例）。地図フォーカスは `flyToLocation`（map-container L765）、一時ハイライトは `showTemporaryAccidentMarker`（L769）。共有は `lib/report-generation/family-share-card.ts`。

---

## 実装内容

### 1. データモデル：半径の保存（最小マイグレーション）

円の半径を他の保護者にも同じ見え方で共有するため、`danger_reports` に半径列を追加する。

- 新規マイグレーション `supabase/migrations/<timestamp>_add_suspicious_alert_radius.sql`:
  - `alter table danger_reports add column if not exists alert_radius_m integer;`（nullable）
  - 半径の不正値・巨大値を防ぐため、`alert_radius_m is null or alert_radius_m in (200, 300, 500, 1000)` のCHECK制約を追加。
- `lib/database.types.ts` の `danger_reports` Row/Insert/Update に `alert_radius_m: number | null` を追加。
- `lib/types.ts` の `DangerReport` に `alert_radius_m?: number | null` を追加。
- `danger_type='suspicious'` は自由文字列のためDB変更不要。半径未指定時はクライアント既定 **300m**。

### 1.5. AI一次審査による公開フロー（管理者負担の削減）

不審者情報は即時性が重要だが、誤公開・個人情報・写真の写り込みリスクも高い。管理者が全件を目視する運用は重いため、AIで一次審査し、低リスク投稿だけ自動公開する。

- 投稿直後の `danger_reports.status` は原則 `pending`。投稿者本人には pending の間も地図上に表示する。
- AIチェックで低リスクと判定された投稿は `status='approved'` に自動昇格し、全保護者に表示する。
- AIが不確実・高リスクと判定した投稿は `pending` のまま、または `ai_moderation_status='needs_review'` として管理者確認に回す。
- 追加カラム（新規マイグレーションに含める）:
  - `ai_moderation_status text`（例: `pending | approved | needs_review | rejected`）
  - `ai_moderation_reason text null`
  - `ai_moderation_checked_at timestamptz null`
  - `ai_moderation_score numeric null`
- AIチェック対象:
  - メモ本文に個人名、電話番号、住所詳細、学校名＋人物特定情報が含まれないか。
  - 写真に顔、車のナンバー、表札、児童本人などが強く写っていないか。
  - 誹謗中傷、断定的な犯人扱い、差別表現がないか。
  - 位置が極端に不自然でないか。
  - 危険度・半径が妥当か。
- AI審査失敗時は自動承認せず、`needs_review` 相当として扱う。

### 2. 軽量「不審者アラート」専用入力フォーム（最速で地図化）

新規 `components/danger-report/suspicious-alert-form.tsx`（既存の重い `danger-report-form.tsx` とは別の軽量フォーム）。

- フィールド：**住所/エリア検索**（`AddressSearch` パターンを流用：`/api/mapbox/geocode?query=...&language=ja&country=jp&limit=5`）、**一言メモ**（任意・`title`/`description`へ）、**半径選択**（200/300/500/1000m、既定300m）、**写真添付**（任意・ヒヤリハット同様）、危険度は既定（例：4）で内部設定（任意で表示）。
- 写真は既存 `danger-report-form.tsx` の画像ハンドリング（MIMEスニッフ `validateImageFile`/`sniffImageMime`、10MB上限、クライアント圧縮）と `POST /api/image/process` パイプラインを流用し、`image_url`/`processed_image_urls` として保存（=ヒヤリハットと同じ扱い）。
- 住所候補選択時 → 親へ `onLocationPick([lon, lat])` を通知し、地図に**選択ピン＋プレビュー円**を即表示、`flyToLocation`/`fitBounds` で寄せる。
- 地図クリック/GPSでも中心点を指定可能（両対応。既存 `selectedLocation` フローを利用）。
- 送信ボタンは「地図にアラートを表示」。zod 軽量スキーマ（`lib/hunter/validation.ts` の手書きパターンに倣う）で住所/座標・半径を検証。

### 3. 半径つき危険エリア円のGLレイヤー（しっかり視覚化）

新規 `components/map/suspicious-alert-layer.tsx`（headless、`accident-heatmap-layer.tsx` を雛形に）。

- props: `{ map, reports: DangerReport[], isVisible, focusedId? }`。`danger_type==='suspicious'` の各レポートについて `turf.circle([lng,lat], (alert_radius_m ?? 300)/1000, { units:'kilometers', steps:64 })` で円ポリゴンを生成し `FeatureCollection` を構築。
- レイヤー：
  - `fill` レイヤー（半透明オレンジ `#F97316`、opacity ~0.18）＝危険エリア面。
  - `line` レイヤー（`#F97316`、width 2〜3、点線）＝エリア境界。
  - フォーカス中(`focusedId`)は opacity/width を強調。
- `addSource/addLayer` と `style.load` 再追加・クリーンアップは `accident-heatmap-layer.tsx` と同じ安全ヘルパー（`layerExists`/`safeRemoveLayer` 等）を踏襲。
- 既存の `danger-marker` レイヤー（DOMマーカー）と競合しないソース/レイヤーID（例 `suspicious-alert-source` / `-fill` / `-line`）。

### 4. 大きいパルス中心マーカー＋自動ズーム

- 中心点に**大きいパルスマーカー**（`UserX` アイコン）を表示。`app/globals.css` に `.suspicious-alert-marker`（`showTemporaryAccidentMarker` の `.accident-highlight-marker`/`accident-pulse` をモデルに、常時パルス＆やや大きめ）を追加。
- 作成直後・一覧/共有リンクから開いた時に `map.fitBounds(turf.bbox(circle), { padding: 80 })`（または `flyToLocation` + 半径に応じたズーム）で**円全体が画面に収まるよう自動フィット** → 「どの辺りか」が即座に分かる。
- マーカークリックで `DangerReportDetailModal` を開く（既存 `setSelectedReport`/`setIsDetailModalOpen` を流用）。

### 5. 地図コンテナへの統合（`components/map/map-container.tsx`）

- 既存の `danger_reports` 取得結果から `danger_type==='suspicious'` を抽出し `<SuspiciousAlertLayer map reports={...} isVisible focusedId={...} />` をマウント。
- 軽量送信ハンドラ `handleSuspiciousAlertSubmit`：`reverseGeocodeLocation` で `prefecture/city` を補完 → 初期 `status='pending'` で `supabase.from("danger_reports").insert({ danger_type:'suspicious', danger_level:既定, alert_radius_m, ai_moderation_status:'pending', title, description, latitude, longitude, ... })`（既存 `handleReportSubmit` L1665 の挿入ロジックを再利用/分岐）。挿入後 `fitBounds`。
- 挿入後にAI一次審査を起動し、低リスクなら `status='approved'`, `ai_moderation_status='approved'` に更新。不確実・高リスクなら `ai_moderation_status='needs_review'` または `rejected` に更新し、公開しない。
- フォームに `onLocationPick` を渡し、内部で `setSelectedLocation` + `flyToLocation`。

### 6. 投稿口（導線）

- `components/report/report-bottom-sheet.tsx`：現在「きけんハンター」のみ。**「不審者アラートを地図化」** の項目を追加し、`/map?suspiciousAlert=1` へ遷移する導線にする。きけんハンター導線は維持。
- `components/map/map-container.tsx` 側で `suspiciousAlert=1` を検知し、地図上の専用シートとして `suspicious-alert-form` を開く。住所検索・地図クリック・GPS・プレビュー円・`fitBounds` をすべて地図コンテナ文脈で扱う。

### 7. 事例の掲載・ラベル整備（型表示の追加）

`suspicious` を各表示ロジックに追加（ラベル「不審者情報」、色 `#F97316`、アイコン `UserX`）：

- `components/danger-report/detail/report-detail-utils.ts`：`getDangerTypeLabel`/`getDangerTypeIcon` に `suspicious` を追加（`UserX` import）。
- `app/report/page.tsx` `DANGER_TYPE_META`：`suspicious` エントリ追加（一覧・共有フィードに掲載）。
- `components/landing/HiyariHatReport.tsx` `DANGER_TYPE_LABELS`：`suspicious: "不審者情報"`。
- `components/map/map-container.tsx` の DOMマーカー アイコン分岐（L1428-1432）にも `suspicious → UserX` を追加（円とは別に通常マーカーも一応対応）。

### 8. SNS／家族共有（地図画像＋写真つき・既存カードを流用）

ヒヤリハット同様に「**地図の写真つき**」で共有できるよう、共有カードに**地図スナップショット画像**と**投稿写真**の両方を載せる。

- 静的地図画像：`generateOverviewMapUrl`（`lib/report-generation/route-danger-report.ts`）のMapbox Static Images URL生成パターンを流用/拡張し、アラート地点を中心に **中心ピン＋半径円（`path` オーバーレイ：turf円ポリゴンをencodePolyline）** を描いた `https://api.mapbox.com/styles/v1/.../static/...` 画像URLを生成（新規 `lib/suspicious-alert.ts` に `buildSuspiciousAlertStaticMapUrl()`）。
  - Static Images URLの長さ対策として、共有用の円は `steps` を32以下に抑える。
  - URLが長くなりすぎる場合や生成に失敗する場合は、中心ピンのみの静的地図にフォールバックする。
  - `buildSuspiciousAlertStaticMapUrl()` はフォールバック有無をテスト可能な形で分離する。
- `components/report/family-share-card.tsx`（`FamilyShareCard`）を拡張し、`mapImageUrl`（静的地図）と `photoImageUrl`（投稿写真）の**2枚**を表示できるようにする（地図 → 写真の縦並び。写真が無ければ地図のみ）。既存 `imageUrl` は後方互換が必要な場合のみ `photoImageUrl ?? imageUrl` として扱う。
- `lib/report-generation/family-share-card.ts` の `FamilyShareCardData` にも `mapImageUrl` / `photoImageUrl` を追加し、共有テキスト生成と `shareFamilyShareCard` 呼び出し側の型を合わせる。`waitForCardImages` は複数 `<img>` を待てるため、UI側で2画像を描画すれば読み込み待ちは流用できる。
- `components/danger-report/danger-report-detail-modal.tsx` に「家族・SNSに共有」ボタンを追加し、`shareFamilyShareCard({cardElement, card})`＋隠し `FamilyShareCard`（`forwardRef`）を利用。
- 共有テキストはエリアラベル（`formatAddress`/`buildFamilyShareMapLabel`）＋半径＋メモ＋注意喚起（`buildFamilyShareCardText`）。`navigator.share` 非対応時はPNGダウンロード＋クリップボード（既存フォールバック）。
- コメント・リアクションは `danger_reports` 共通機能で `suspicious` でも自動利用可（追加実装不要）。

---

## 変更/新規ファイル（主要）

| 目的 | ファイル |
|------|----------|
| 半径列マイグレーション | `supabase/migrations/<ts>_add_suspicious_alert_radius.sql`（新規） |
| AI一次審査カラム | `supabase/migrations/<ts>_add_suspicious_alert_radius.sql` または別マイグレーション（新規） |
| 型定義 | `lib/database.types.ts`, `lib/types.ts` |
| 軽量フォーム | `components/danger-report/suspicious-alert-form.tsx`（新規） |
| 円GLレイヤー | `components/map/suspicious-alert-layer.tsx`（新規） |
| 円ユーティリティ＋静的地図URL | `lib/suspicious-alert.ts`（新規・turf円/ bbox/ 既定半径/ Static Images URL） |
| 写真添付（画像処理流用） | `components/danger-report/suspicious-alert-form.tsx`（＋ `POST /api/image/process`） |
| 共有カード（地図＋写真2枚） | `components/report/family-share-card.tsx`, `lib/report-generation/family-share-card.ts` |
| 地図統合・送信・fitBounds | `components/map/map-container.tsx` |
| パルスマーカーCSS | `app/globals.css` |
| 投稿導線 | `components/report/report-bottom-sheet.tsx` |
| ラベル/アイコン/メタ | `report-detail-utils.ts`, `app/report/page.tsx`, `HiyariHatReport.tsx` |
| 共有ボタン | `components/danger-report/danger-report-detail-modal.tsx` |

## 再利用する既存資産
- ジオコーディング：`app/api/mapbox/geocode/route.ts` ＋ `components/3d-route/address-search.tsx`
- GLレイヤー雛形：`components/map/accident-heatmap-layer.tsx`（source/layer・style.load再追加・安全ヘルパー）
- 円生成：`@turf/turf`（`turf.circle` / `turf.bbox`）
- 静的地図画像：`generateOverviewMapUrl`（`lib/report-generation/route-danger-report.ts`）の Static Images URL生成パターン
- 写真：`danger-report-form.tsx` の画像検証/圧縮 ＋ `POST /api/image/process`（`image_url`/`processed_image_urls`）
- フォーカス/ハイライト：`flyToLocation` / `showTemporaryAccidentMarker`（`map-container.tsx`）
- 投稿保存：`handleReportSubmit` の挿入ロジック
- 共有：`lib/report-generation/family-share-card.ts`, `components/report/family-share-card.tsx`

---

## 検証（テスト手順）

1. マイグレーション適用（`alert_radius_m` 追加）後、`pnpm dev` で起動。
2. 報告メニューから「不審者アラートを地図化」を開く。
3. **住所/エリア入力**：「○○町」等を入力→候補選択で地図が該当地点へ自動フィットし、**半径つきオレンジ円＋大きいパルスマーカー**のプレビューが出ることを確認。半径を変えると円サイズが変わることを確認。地図クリック/GPSでも中心指定できること（両対応）。**写真を添付**できることを確認。
4. 送信 → `danger_reports` に `danger_type='suspicious'`, `alert_radius_m`, `ai_moderation_status='pending'`, 写真(`image_url`/`processed_image_urls`)付きで保存され、投稿者本人には pending として地図に表示され、`fitBounds` で全体が見えることを確認。
5. AI一次審査 → 低リスク投稿は `status='approved'`, `ai_moderation_status='approved'` になり、別ユーザーにも危険エリア円が表示されることを確認。不確実・高リスク投稿は `needs_review` または `rejected` になり、別ユーザーには表示されないことを確認。
6. 中心マーカー/一覧から詳細モーダルを開き、事例（写真・メモ・エリア・半径）が掲載、コメント・リアクションが使えることを確認。
7. **共有**：「家族・SNSに共有」で、共有カードに**地図スナップショット画像＋投稿写真の2枚**が描画され、Static Map円URLが長すぎる場合は中心ピンのみへフォールバックし、`navigator.share`（対応環境）/ PNG＋テキストコピー（非対応環境）が動くことを確認。
8. ランディング「ヒヤリハット報告」と `/report` 一覧に「不審者情報」ラベルで並ぶことを確認。
9. テスト：`turf.circle`→GeoJSON 生成・`alert_radius_m`既定値/DB制約相当のバリデーション・`getDangerTypeLabel('suspicious')`・共有カード2画像・Static Map URL長フォールバック・AI一次審査の低リスク/needs_review分岐のユニットテストを追加。既存（`tests/components/hiyari-hat-report.test.tsx`, `tests/unit/lib/report-generation/family-share-card.test.ts` 等）が緑であることを確認。

## 留意点
- 円は**全 suspicious レポート分**を描画すると過密になり得る。初期は「直近/表示範囲内」に限定、またはフォーカス中を強調しその他は薄く描画する方針（実装時に件数を見て調整、過度な間引きは `log`/コメントで明示）。
- `danger_type='suspicious'` の自由文字列追加はDB制約・既存プッシュ通知（全 danger_reports 対象）・RLSに影響なし。
- AI一次審査は管理者負担を下げるための補助。AI失敗時・不確実時は自動公開しない。
