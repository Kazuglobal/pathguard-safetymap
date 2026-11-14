import fs from "node:fs"
import path from "node:path"

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import HelpDialog from "@/components/map/help-dialog"
import { REPORT_PUBLISHED_POINTS } from "@/lib/gamification-levels"
import { PRODUCT_FACTS } from "@/lib/product-facts"

// 地図のヘルプ(UIUX改装 項目51)。タッチ操作を前提に、実際の画面に合わせて書く
describe("HelpDialog", () => {
  const renderOpen = (onReplayOnboarding = vi.fn()) => {
    render(<HelpDialog open={true} onOpenChange={vi.fn()} onReplayOnboarding={onReplayOnboarding} />)
    return onReplayOnboarding
  }

  it("covers the views, pins, filters and reporting", () => {
    renderOpen()

    for (const tab of ["見かた", "ピン", "しぼりこみ", "報告"]) {
      expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument()
    }
    // タッチ操作で説明する(マウス・クリック前提の説明を残さない)
    expect(screen.getByText(/指でなぞると動き/)).toBeInTheDocument()
    expect(screen.getByText(/通学路チェック/, { selector: "h4" })).toBeInTheDocument()
    expect(screen.getByText(/くわしい表示/, { selector: "h4" })).toBeInTheDocument()
  })

  it("does not describe mouse operations or invented point rules", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/map/help-dialog.tsx"), "utf8")
    expect(source).not.toMatch(/マウス|クリック|ヘッダーの青いボタン/)
    expect(source).not.toMatch(/\+10ポイント|\+3ポイント/)
  })

  // ポイント・レベル・バッジ・ランキングは画面に出さない(付与の仕組みとデータは残してある)
  it("has no points tab, and uses the same moderation and photo wording as the rest of the app", () => {
    renderOpen()

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["見かた", "ピン", "しぼりこみ", "報告"])
    expect(screen.queryByText(/ポイント|レベルが/)).toBeNull()

    // 画面には出さないが、付与の値は D1 のトリガーと同じに保つ
    const migration = fs.readFileSync(path.join(process.cwd(), "lib/db/migrations/20260903155959_report_creation_rewards.sql"), "utf8")
    expect(migration).toContain(`VALUES (NEW.user_id, ${REPORT_PUBLISHED_POINTS}, 1,`)

    const source = fs.readFileSync(path.join(process.cwd(), "components/map/help-dialog.tsx"), "utf8")
    expect(source).toContain("PRODUCT_FACTS.moderation.adult")
    expect(source).toContain("PRODUCT_FACTS.photo.adult")
    expect(PRODUCT_FACTS.moderation.adult.length).toBeGreaterThan(0)
  })

  it("opens the first-time guide separately, closing the help first", () => {
    const onOpenChange = vi.fn()
    const onReplayOnboarding = vi.fn()
    render(<HelpDialog open={true} onOpenChange={onOpenChange} onReplayOnboarding={onReplayOnboarding} />)

    fireEvent.click(screen.getByRole("button", { name: /はじめての案内をもう一度/ }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onReplayOnboarding).toHaveBeenCalledTimes(1)
  })
})
