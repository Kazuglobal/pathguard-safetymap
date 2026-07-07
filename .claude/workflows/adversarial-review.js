export const meta = {
  name: 'adversarial-review',
  description: '直近の変更を4視点(正しさ/セキュリティ/回帰/簡潔さ)で並列レビューし、各指摘を敵対的に検証して CONFIRMED / PLAUSIBLE に振り分ける(mapsefe/20250615=PathGuardian専用・具体版)',
  whenToUse: '実装完了後の敵対的レビュー。コミット前・PR作成前に実行する。args に対象範囲(例: "git diff main...HEAD" / "app/report/page.tsx の変更")を渡せる。省略時は未コミットの変更全体。',
  phases: [
    { title: 'Review', detail: '4視点の並列レビューで指摘を収集' },
    { title: 'Verify', detail: '各指摘を反証スタンスで検証' },
  ],
}

const scope = (typeof args === 'string' && args.trim())
  ? args.trim()
  : '現在のリポジトリの未コミットの変更全体(git status と git diff で特定せよ)'

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'リポジトリルートからの相対パス' },
          line: { type: 'integer' },
          summary: { type: 'string', description: '欠陥の一文要約' },
          detail: { type: 'string', description: 'なぜ問題か。想定される入力・状態と誤った結果' },
        },
        required: ['file', 'summary', 'detail'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['CONFIRMED', 'PLAUSIBLE', 'REFUTED'] },
    reasoning: { type: 'string', description: '判定根拠。CONFIRMED なら再現手順を必ず含める' },
  },
  required: ['verdict', 'reasoning'],
}

const LENSES = [
  {
    key: 'correctness',
    prompt: `対象: ${scope}\n\nあなたは正しさ(correctness)専門のレビュアー。この変更が壊すケースを具体的な入力と手順で探せ。境界値、null/undefined、非同期の競合、エラーパスに注目。擁護は不要、欠陥のみ報告せよ。対象ファイルは必ず全文読むこと。`,
  },
  {
    key: 'security',
    prompt: `対象: ${scope}\n\nあなたはセキュリティ専門のレビュアー。PathGuardian(通学路安全プラットフォーム)固有の不変条件に照らして欠陥を探せ。以下を実際にコードを読んで確認し、逸脱があれば欠陥として報告すること(推測で判定しない):

- 危険レベル(1〜4)の表示は \`lib/report-generation/danger-level-presentation.ts\` の getDangerLevelPresentation() のみを経由すること。switch文等で1〜3だけを扱う実装(レベル4が「低」ラベル・黄色ピンになる退行バグ)が再発していないか。
- 地図ピンの採番は \`assignDangerMarkerLabels\`(lib/report-generation/report-map.ts)経由のみであること。dangers配列の生インデックスをラベルとして直接使うコードが増えていないか。
- 地域(prefecture)の読み書きは \`lib/user-region.ts\` の getStoredRegion/setStoredRegion が唯一の真実源であること。独自の localStorage キーを新設していないか。
- danger-reports バケット(非公開)の画像は \`lib/danger-report-image-access.ts\` の署名URLヘルパー経由のみで表示すること。getPublicUrl() 形式の生URLや保存済みURLをそのまま <img src> やAPIレスポンスに使っていないか。
- 危険報告の公開/非公開判定は \`PUBLIC_DANGER_REPORT_STATUSES\`(lib/danger-report-status.ts)経由であること。ステータス文字列のハードコード比較(例: status === "approved" のみ)で代替していないか。
- 不審者アラートは \`moderateSuspiciousAlertWithAi\`(lib/suspicious-alert-moderation-ai.ts)によるサーバ側LLM/Vision審査を経由すること(app/api/suspicious-alert/moderate/route.ts)。クライアント側のみの判定・審査なしの自動公開に戻すコードが混入していないか。
- 偽データ・偽実績(ダミー店舗商品・偽キャンペーンカルーセル等、2026-07-04の親向けUI刷新で撤去済み)を復活させていないか。
- Supabase の RLS ポリシー・Storage バケットの公開設定を緩める変更(非公開→公開化、SELECT ポリシーの対象拡大等)をしていないか。している場合、理由が明記されているか。
- 一般原則として、認可漏れ・入力バリデーション欠如・シークレット露出・インジェクション・IDOR・レート制限の穴も報告対象。`,
  },
  {
    key: 'regression',
    prompt: `対象: ${scope}\n\nあなたは回帰(regression)専門のレビュアー。以下はこのリポジトリで複数箇所から呼ばれる共有ロジックであり、契約(引数・戻り値・エラー時挙動)を変えると影響範囲が広い。変更がこれらに触れている場合は grep で全呼び出し元を洗い出し、契約が壊れていないか確認すること:

- assignDangerMarkerLabels / getDangerLevelPresentation(lib/report-generation/report-map.ts, danger-level-presentation.ts): report-sections.ts, route-danger-report-dialog.tsx, map-image-popup-content.tsx, submitted-report-preview.tsx, app/admin/dashboard/page.tsx, ProcessImageDialog.tsx, app/report/page.tsx, report-detail-modal.tsx, report-image-carousel.tsx, danger-report-detail-modal.tsx, app/mypage/page.tsx など16ファイル以上から参照されている。
- useDangerReportSignedImageUrl / useDangerReportSignedImageUrls(lib/danger-report-image-access.ts): 画像表示箇所全般から利用。戻り値が null になるケース(取得中/失敗時)の呼び出し側フォールバックが壊れていないか。
- buildFamilyShareSummary / buildFamilyShareAction / buildFamilyShareMapLabel(lib/report-generation/family-share-card.ts): 家族共有カード生成のフォールバック文言。空文字列・null入力時の既定文言が変わっていないか。

一般原則として、変更された関数・APIの他の呼び出し元、既存テスト、既存のユーザーフローが壊れていないかも確認すること。`,
  },
  {
    key: 'simplicity',
    prompt: `対象: ${scope}\n\nあなたは簡潔さ専門のレビュアー。不要な複雑さ、既存ヘルパーの再発明、800行超のファイル、4段超のネスト、mutation(イミュータブル原則違反)、残留デバッグ出力を探せ。特にこのリポジトリでは、地図ピン採番・危険レベル表示・画像アクセス・地域選択の各ロジックが既に一元化ヘルパーとして存在するため、それらを再実装していないかを重点的に見ること。動くが読めないコードも欠陥として報告せよ。`,
  },
]

phase('Review')
log(`対象範囲: ${scope}`)

const results = await pipeline(
  LENSES,
  (lens) => agent(
    `${lens.prompt}\n\n見つけた欠陥を findings として構造化して返せ。欠陥ゼロなら空配列でよい。確信のない指摘も含めてよい(後段で検証される)。最大8件、深刻な順。\n\n重要: あなたの役目は指摘を報告することだけで、ファイルの削除・変更は一切行わないこと。読み取り専用の調査(Read/Grep/Bash中の読み取りコマンド)に限定せよ。`,
    { label: `review:${lens.key}`, phase: 'Review', schema: FINDINGS_SCHEMA, isolation: 'worktree' },
  ),
  (review, lens) => {
    if (!review || review.findings.length === 0) return []
    return parallel(review.findings.map((f) => () =>
      agent(
        `次のコードレビュー指摘を反証(refute)せよ。対象: ${scope}\n\n指摘 [${lens.key}] ${f.file}${f.line ? ':' + f.line : ''}\n${f.summary}\n${f.detail}\n\n実際にファイルを読み、必要ならコマンドで確認し、この指摘が間違っている・実害がない可能性を全力で探せ。\n- 指摘が誤り/実害なしと示せたら REFUTED\n- 誤りとは示せないが再現手順まで確定できないなら PLAUSIBLE\n- 具体的な入力と手順で問題を再現できたら CONFIRMED(再現手順を reasoning に必ず書く)\n迷ったら PLAUSIBLE に倒せ。\n\n重要: あなたの役目は判定を返すことだけで、ファイルの削除・変更は一切行わないこと。読み取り専用の調査に限定せよ。`,
        { label: `verify:${lens.key}:${f.file}`, phase: 'Verify', schema: VERDICT_SCHEMA, isolation: 'worktree' },
      ).then((v) => ({ ...f, lens: lens.key, verdict: v ? v.verdict : 'PLAUSIBLE', reasoning: v ? v.reasoning : 'verifier unavailable' }))
    ))
  },
)

const all = results.flat().filter(Boolean)
const confirmed = all.filter((f) => f.verdict === 'CONFIRMED')
const plausible = all.filter((f) => f.verdict === 'PLAUSIBLE')
const refuted = all.filter((f) => f.verdict === 'REFUTED')

log(`CONFIRMED ${confirmed.length} / PLAUSIBLE ${plausible.length} / REFUTED ${refuted.length}`)

return {
  scope,
  confirmed,
  plausible,
  refutedCount: refuted.length,
  instruction: 'CONFIRMED は必ず修正して検証ゲート(verify-change スキル)を再度通すこと。PLAUSIBLE は判断の上で対応。',
}
