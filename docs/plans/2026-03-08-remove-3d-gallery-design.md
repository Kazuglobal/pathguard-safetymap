# Remove 3D Gallery Design

**Goal:** アプリから 3D ギャラリー機能を完全に除去し、`/report` から到達できない状態にする。

## Scope

- `app/report/page.tsx` から 3D ギャラリーのタブとコンポーネント参照を削除する。
- 3D ギャラリー実装ファイルを物理削除する。
- 静的アセット `public/gallery.html` を削除する。

## Out of Scope

- 3D ルート PoC や World Labs 関連の別機能は変更しない。
- Supabase の `gallery_images` テーブルや Storage バケットは触らない。

## Validation

- `/report` の UI から `3Dギャラリー` が見えないことをテストで確認する。
- 関連テストと production build が通ることを確認する。
