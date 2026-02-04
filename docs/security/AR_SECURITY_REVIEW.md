# AR機能セキュリティレビューレポート

**レビュー日**: 2026-02-04
**レビュー対象**: AR（拡張現実）機能全般
**レビュアー**: Claude Code

---

## 概要

PathGuard SafetyMapのAR機能に対するセキュリティレビューを実施しました。本レポートでは、発見されたセキュリティ上の良い実装と潜在的なリスク、および推奨される対策をまとめています。

---

## 1. レビュー対象ファイル

| ファイル | 概要 |
|---------|------|
| `components/map/ar-view.tsx` | メインARコンポーネント（カメラ・位置情報・センサーアクセス） |
| `lib/ar-image-utils.ts` | 画像URL検証ユーティリティ |
| `lib/gemini-hazard.ts` | Gemini API連携（画像解析） |
| `app/api/hazard-game/analyze/route.ts` | 画像解析API |
| `app/api/image/process/route.ts` | 画像処理・ストレージAPI |
| `hooks/use-hazard-game.ts` | クライアントサイド画像処理 |
| `tests/unit/lib/ar-image-utils.test.ts` | セキュリティテスト |

---

## 2. 良好なセキュリティ実装

### 2.1 画像URL検証（XSS対策）⭐

**ファイル**: `lib/ar-image-utils.ts:26-75`

```typescript
// 危険なプロトコルを拒否
if (
  lowerUrl.startsWith("javascript:") ||
  lowerUrl.startsWith("data:text/html") ||
  lowerUrl.startsWith("vbscript:") ||
  lowerUrl.startsWith("file:")
) {
  return false
}
```

**評価**: 優良

- JavaScript、VBScript、file:プロトコルをブロック
- `data:text/html`によるXSS攻撃を防止
- ホワイトリスト方式で許可されたドメインのみ許可
- 包括的なテストケースで検証済み

### 2.2 API認証

**ファイル**: `app/api/hazard-game/analyze/route.ts:23-33`

```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return NextResponse.json(
    { error: "認証が必要です" },
    { status: 401 }
  )
}
```

**評価**: 良好

- 全APIエンドポイントでSupabase認証を要求
- 適切なHTTPステータスコード（401）を返却

### 2.3 リクエストサイズ制限

**ファイル**: `app/api/hazard-game/analyze/route.ts:8,14-21`

```typescript
const MAX_REQUEST_SIZE = 25 * 1024 * 1024
if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
  return NextResponse.json(
    { error: `リクエストサイズが大きすぎます` },
    { status: 413 }
  )
}
```

**評価**: 良好

- DoS攻撃対策としてリクエストサイズを制限
- クライアント側でも3MB以下に圧縮

### 2.4 クライアントサイド画像圧縮

**ファイル**: `hooks/use-hazard-game.ts:56-146`

**評価**: 良好

- 大きな画像を自動圧縮してサーバー負荷を軽減
- Canvas APIによる安全な画像処理
- プログレッシブ圧縮でターゲットサイズ達成

### 2.5 エラーハンドリング

**評価**: 良好

- 詳細なエラー分類（認証、クォータ、レート制限）
- センシティブな情報をクライアントに露出しない設計

---

## 3. セキュリティリスクと推奨対策

### 3.1 高リスク

#### 3.1.1 APIキーのURL露出

**ファイル**: `lib/gemini-hazard.ts:267-268`

```typescript
const res = await fetch(
  `${GEMINI_API_URL}/models/${model}:generateContent?key=${apiKey}`,
```

**リスク**: APIキーがURLパラメータに含まれており、ログファイルやリファラーヘッダーで漏洩する可能性

**推奨対策**:
```typescript
// ヘッダーでAPIキーを送信
const res = await fetch(url, {
  headers: {
    "x-goog-api-key": apiKey,
    "Content-Type": "application/json"
  }
})
```

**優先度**: 高

---

#### 3.1.2 サービスロールキーの使用

**ファイル**: `app/api/image/process/route.ts:9,13-16`

```typescript
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey)
```

**リスク**: サービスロールキーはRLSをバイパスするため、認可漏れがあると全データにアクセス可能

**推奨対策**:
- reportIdの所有者検証を追加
- 可能であればユーザートークンを使用

**優先度**: 高

---

### 3.2 中リスク

#### 3.2.1 reportIdのバリデーション不足

**ファイル**: `app/api/image/process/route.ts:58,66-71`

```typescript
const reportId = formData.get("reportId") as string;
if (!reportId) { /* エラー */ }
// UUID形式の検証がない
```

**リスク**: 不正なreportIdによるNoSQL注入や意図しないレコードへのアクセス

**推奨対策**:
```typescript
import { z } from "zod"
const uuidSchema = z.string().uuid()
const parseResult = uuidSchema.safeParse(reportId)
if (!parseResult.success) {
  return new Response(JSON.stringify({ message: "Invalid reportId format" }), { status: 400 })
}
```

**優先度**: 中

---

#### 3.2.2 Base64画像のサイズ制限不足

**ファイル**: `lib/ar-image-utils.ts:56-59`

```typescript
// data:image/の場合は許可（Base64画像）
if (lowerUrl.startsWith("data:image/")) {
  return true  // サイズ制限なし
}
```

**リスク**: 極端に大きなBase64文字列によるメモリ消費攻撃

**推奨対策**:
```typescript
if (lowerUrl.startsWith("data:image/")) {
  const MAX_DATA_URL_LENGTH = 5 * 1024 * 1024 // 5MB
  return trimmedUrl.length <= MAX_DATA_URL_LENGTH
}
```

**優先度**: 中

---

#### 3.2.3 レート制限の欠如

**リスク**: APIエンドポイントにレート制限がなく、ブルートフォース攻撃やリソース枯渇攻撃の可能性

**推奨対策**:
- Vercel Edge Middlewareでレート制限を実装
- または `@upstash/ratelimit` を使用

```typescript
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
})
```

**優先度**: 中

---

### 3.3 低リスク

#### 3.3.1 位置情報のプライバシー

**ファイル**: `components/map/ar-view.tsx:270-275`

```typescript
{
  enableHighAccuracy: true,
  maximumAge: 2000,
  timeout: 10000,
}
```

**リスク**: 高精度位置情報の収集に関するプライバシーポリシーの明示がない

**推奨対策**:
- プライバシーポリシーへのリンクを追加
- 位置情報使用の目的を明示
- オプトアウト機能の提供

**優先度**: 低

---

#### 3.3.2 カメラストリームのクリーンアップ

**ファイル**: `components/map/ar-view.tsx:216-224`

**評価**: 実装済み（良好）

```typescript
return () => {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }
}
```

カメラストリームは適切にクリーンアップされています。

---

#### 3.3.3 CSPヘッダーの推奨

**リスク**: Content-Security-Policyヘッダーが設定されていない可能性

**推奨対策**: `next.config.js`でCSPを設定

```javascript
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      img-src 'self' *.supabase.co data:;
      script-src 'self' 'unsafe-eval';
      style-src 'self' 'unsafe-inline';
      connect-src 'self' *.supabase.co *.googleapis.com;
    `.replace(/\n/g, '')
  }
]
```

**優先度**: 低

---

## 4. テストカバレッジ

### 4.1 セキュリティテストの評価

**ファイル**: `tests/unit/lib/ar-image-utils.test.ts`

| テストカテゴリ | 状態 |
|--------------|------|
| XSS攻撃防止（javascript:, vbscript:） | ✅ 実装済み |
| data:text/html攻撃防止 | ✅ 実装済み |
| file:プロトコル防止 | ✅ 実装済み |
| 外部ホスト拒否 | ✅ 実装済み |
| 類似ドメイン攻撃 | ✅ 実装済み |
| 無効入力（null, undefined, 空文字） | ✅ 実装済み |

**評価**: 優良 - 画像URL検証のテストカバレッジは包括的

---

## 5. 推奨アクションサマリー

| 優先度 | 項目 | 対応 |
|-------|------|------|
| 🔴 高 | APIキーをURLからヘッダーに移動 | 即時対応推奨 |
| 🔴 高 | サービスロールキー使用時の所有者検証 | 即時対応推奨 |
| 🟡 中 | reportIdのUUID形式検証 | 計画的に対応 |
| 🟡 中 | Base64画像のサイズ制限 | 計画的に対応 |
| 🟡 中 | APIレート制限の実装 | 計画的に対応 |
| 🟢 低 | プライバシーポリシーの明示 | 将来的に対応 |
| 🟢 低 | CSPヘッダーの設定 | 将来的に対応 |

---

## 6. 結論

PathGuard SafetyMapのAR機能は、基本的なセキュリティ対策が適切に実装されています。特に画像URL検証によるXSS対策は優れた実装です。

ただし、以下の点については早急な対応を推奨します：
1. **APIキーの安全な送信方法への変更**
2. **サービスロールキー使用時の認可チェック強化**

これらの対策により、AR機能のセキュリティレベルをさらに向上させることができます。

---

*このレポートは2026-02-04時点のコードベースに基づいています。*
