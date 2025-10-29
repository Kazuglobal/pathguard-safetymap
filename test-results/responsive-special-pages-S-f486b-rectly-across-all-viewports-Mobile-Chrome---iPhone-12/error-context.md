# Page snapshot

```yaml
- main:
  - heading "通学路安全マップ" [level=1]
  - paragraph: 子供たちの安全な通学をサポートします
  - heading "ログイン" [level=3]
  - paragraph: アカウント情報を入力してログインしてください
  - text: メールアドレス
  - textbox "メールアドレス"
  - text: パスワード
  - textbox "パスワード": testpassword123
  - button "ログイン"
  - button "デモユーザーでログイン"
  - text: アカウントをお持ちでない場合は
  - link "登録":
    - /url: /register
  - text: してください
- button "Open Next.js Dev Tools":
  - img
- button "Open issues overlay": 1 Issue
- button "Collapse issues badge":
  - img
- alert
```