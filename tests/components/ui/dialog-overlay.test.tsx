import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// tests/setup.ts はダイアログを差し替えているので、ここでは本物を使う
vi.unmock("@/components/ui/dialog")

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

function overlay(): Element | null {
  return document.querySelector(".bg-black\\/80")
}

describe("DialogContent の背景の幕", () => {
  it("overlayClassName で幕の高さ(z)を上げられる(報告の全画面 z-80 の上に重ねるため)", () => {
    render(
      <Dialog open>
        <DialogContent className="z-[90]" overlayClassName="z-[90]">
          <DialogTitle>写真の顔とナンバーを隠す</DialogTitle>
          <DialogDescription>説明</DialogDescription>
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByRole("dialog").className).toContain("z-[90]")
    expect(overlay()?.className).toContain("z-[90]")
    expect(overlay()?.className).not.toContain("z-[70]")
  })

  it("指定しなければ、これまでどおり z-70", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>タイトル</DialogTitle>
          <DialogDescription>説明</DialogDescription>
        </DialogContent>
      </Dialog>,
    )

    expect(overlay()?.className).toContain("z-[70]")
  })
})
