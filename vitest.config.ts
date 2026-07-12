import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.next-dev/**",
      "**/.next-dev-codex/**",
      "**/.worktrees/**",
      // レビュー用ワークツリー(adversarial-review等)は .claude/worktrees/ に
      // 作られる。除外しないと全体実行時に旧仕様のままの姉妹コピーで大量失敗する
      "**/.claude/**",
      "**/playwright-report/**",
      "**/test-results/**",
      // *.spec.ts は Playwright 専用(全ファイルが @playwright/test を import)。
      // vitest のデフォルト include に拾われるとファイルレベルで失敗する
      "**/*.spec.ts",
    ],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
})
