# ImageGen prompt set

Mode: built-in `image_gen`。各プロンプトは対象スクリーンショットを edit target とし、次を共通制約にした。

- Use case: `ui-mockup`
- Asset type: shippable 390px portrait mobile app screen
- Preserve PathGuardian “たんけんノート”: warm cream paper, forest green, safety orange, sun yellow, Zen Maru Gothic-like rounded Japanese type, chunky buttons, soft paper cards, existing navigation
- All tap targets at least 44px
- No gradients, no dark mode, no watermark, no browser chrome, no unrelated features

## 01 Report

Redesign `/report` so a first-time parent immediately sees exact CTA “危険を報告する”, a three-step trail “1 場所 → 2 写真・内容 → 3 確認”, and secondary action “現在地からはじめる”, while recent community reports remain below.

## 02 Route quiz

Replace the collapsed side strip with a vertical mobile layout: full-width map in the upper 52%, two large numbered pins, exact steps “① スタートをえらぶ” and “② ゴールをえらぶ”, helper “ちずを 2かい タップしてね”, and 56px CTA “クイズをはじめる”.

## 03 Map loading

Replace spinner-only loading with a faint map plus a compact paper card showing “地図を読み込み中 2/3” and “危険マーカーを準備しています”, segmented progress, actions “一覧で見る” and “もう一度ためす”, and a disabled report CTA with a reason.

## 04 Hunter

Replace the black photo area with a softly blurred neighborhood photo, exact progress “しゃしんを じゅんび中 2/3”, explanation “かおや なまえを かくしています”, disabled “もうすこし まってね”, and recovery actions “やりなおす” / “べつの写真をえらぶ”.

## 05 Register

Keep the compact registration form but show an orange inline duplicate-email error “このメールは登録ずみです”, immediate recovery “ログインへすすむ”, required chips, and a three-item password checklist. Keep Google/LINE secondary.

## 06 Leaderboard

Turn the empty state into a motivating first-step screen without fake rankings: Lupe mascot, exact copy “まだ みんなの記録がないよ”, CTA “最初の10ptを取りにいく”, and three point task chips.
