import { readFileSync } from "node:fs"
import path from "node:path"

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import HunterLoading from "@/app/safety-quest/hunter/loading"

describe("きけんハンターの待ち画面(loading.tsx)", () => {
  // これが無いと、シートで「きけんハンターを はじめる」を押しても、ページの準備ができるまで
  // 前の画面のまま何も起きないように見えていた
  it("ひらがなの案内を、読み上げられる status として出す", () => {
    render(<HunterLoading />)

    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status).toHaveTextContent("きけんハンターを じゅんびしているよ…")
  })

  // 先読み・最初の表示を軽く保つ(framer-motion を使う theme.tsx を待ち画面に持ち込まない)
  it("サーバーコンポーネントのまま、framer-motion や theme.tsx を import しない", () => {
    const source = readFileSync(path.join(process.cwd(), "app/safety-quest/hunter/loading.tsx"), "utf8")
    const imports = source.split(/\r?\n/).filter((line) => line.startsWith("import "))

    expect(source).not.toMatch(/^["']use client["']/m)
    expect(imports.length).toBeGreaterThan(0)
    expect(imports.filter((line) => /framer-motion|safety-quest\/hunter\/theme/.test(line))).toEqual([])
  })
})
