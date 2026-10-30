# 事故地点の景色を Maps Embed API で表示

作成日: 2026-10-30。対象: `/map` の個別事故の吹き出し。

## 設計

- 既存の「現地の景色を見る」と `StreetViewTarget` を使い、新しい全画面 `AccidentSceneryDialog` を開く。AR と3D試作の既存ビューアは変更しない。
- Google 地図は `place`、景色は `streetview` の2つの iframe。地図のピン用に公式 Open Location Code ライブラリで11桁の Plus Code を端末内生成する。緯度経度を逆順にしない。
- PCは左右、スマホは上下。両枠とも最小200px四方。小さい画面はスクロール。閉じると iframe を破棄し、元の Mapbox のインスタンス・フィルター・吹き出しを維持する。
- 表示中は Mapbox と操作部を visibility:hidden / inert にし、Google の全画面は portal で別に表示する。フォーカスは開いたボタンへ戻す。
- ストリートビューは屋外・半径50m。事故当時の写真ではない旨と撮影位置のずれを明示する。事故地点のピンは固定。撮影日・距離・写真内の移動との同期は独自取得しない。
- 通信は利用者が開いたときだけ。画像の保存・加工・AIへの入力はしない。iframe の load を画像ありと判定しない。再読み込みで両枠を作り直す。

## 設定

- `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` を専用に使用する。既存の有料API用キーへのフォールバックはしない。
- 本番・プレビューのキーを分け、Maps Embed API と許可サイトだけに制限する。キー未設定でもビルドでき、景色画面だけ設定確認中と案内する。
- CSP の既存の `frame-src https://www.google.com` を利用。参照元は iframe の `strict-origin-when-cross-origin` でドメインだけを送信する。
- Google Maps の利用規約・プライバシーポリシーへのリンクと送信情報を規約・ポリシーに反映する。

## 検証・公開

- Vitest: Plus Code と座標、専用キー、2枠・事故情報・再読み込み・閉じる・地図の維持。既存ARビューアのテストも継続する。
- Node: プレビューのオプション設定、本番とプレビューの別キー名。
- ブラウザ: PC / スマホの配置、枠の寸法、フォーカス・閉じる、キー未設定、CSP、有料APIリクエストなし。
- 実キーを設定した隔離プレビューで実画像・地点ピン・画像なしの地点を確認する。iframe のクロスオリジン内容をアプリが読み取れる前提を置かない。
- 最新 main から作業し、PR・CIを経由する。本番は main の Cloudflare Production のみ。

公式資料: [Embed の料金](https://developers.google.com/maps/documentation/embed/usage-and-billing)、[埋め込み方法](https://developers.google.com/maps/documentation/embed/embedding-map)、[設定](https://developers.google.com/maps/documentation/embed/get-api-key)。

## 実装時の確認記録

- 2026-10-30: 最新 main `611f41785` から隔離 worktree で実装。関連 Vitest 10ファイル68件、プレビュー設定 Node テスト10件、アプリの `tsc --noEmit --incremental false` が成功。
- 実際の部品・CSSをChromiumで検証。1440×900 / 390×844 / 320×568 / 844×390で、枠は200px以上、横はみ出しなし、再読み込み・マウスとキーボードでの開閉・フォーカス復帰を確認。コンソールエラーと有料APIへのリクエストは0件。
- ブラウザ検証はGoogleのiframeにテスト用応答を返したもので、実画像の接続確認ではない。キー未設定・既存の有料キーへフォールバックしないことはコンポーネントテストで確認。
- GitHubの設定名のみを確認し、本番の `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` とプレビューの `PREVIEW_NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` は未登録。実画像・実際の地点ピン・画像なし地点の最終確認は、専用キーを登録してプレビューを再ビルドした後に行う。キーの値は読み取り・記録していない。
