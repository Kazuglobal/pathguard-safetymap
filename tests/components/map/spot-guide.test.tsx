import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SpotGuide, type SpotGuideStep } from "@/components/map/spot-guide"

const STEPS: readonly SpotGuideStep[] = [
  { target: '[data-guide="one"]', title: "ひとつめ", body: "さいしょの説明" },
  { target: '[data-guide="missing"]', title: "無いもの", body: "画面に無い" },
  { target: '[data-guide="two"]', title: "ふたつめ", body: "つぎの説明", note: "立ち止まって使う" },
]

// jsdom は大きさを測れない(すべて 0)ので、案内が指す部品にだけ大きさを持たせる
function stubRects() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const visible = this.hasAttribute("data-guide") && !this.hasAttribute("data-collapsed")
    const size = visible ? { top: 40, left: 20, width: 120, height: 44 } : { top: 0, left: 0, width: 0, height: 0 }
    return { ...size, x: size.left, y: size.top, right: size.left + size.width, bottom: size.top + size.height, toJSON: () => size } as DOMRect
  })
}

function Screen({ onClose, withTargets = true }: { onClose: (reason: string) => void; withTargets?: boolean }) {
  return (
    <>
      {withTargets && (
        <>
          <button data-guide="one">検索</button>
          <button data-guide="two">報告</button>
        </>
      )}
      <SpotGuide open steps={STEPS} label="画面の案内" onClose={onClose} />
    </>
  )
}

describe("SpotGuide", () => {
  beforeEach(() => {
    stubRects()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("最初の手順を出し、照らす枠を部品の位置に合わせる", () => {
    render(<Screen onClose={vi.fn()} />)

    const dialog = screen.getByRole("dialog", { name: "画面の案内" })
    expect(dialog).toHaveTextContent("ひとつめ")
    expect(dialog).toHaveTextContent("1 / 2")
    // 部品(top 40 / left 20 / 120×44)を、まわり 6px ぶん大きく囲む
    expect(screen.getByTestId("spot-guide-spot")).toHaveStyle({ top: "34px", left: "14px", width: "132px", height: "56px" })
  })

  it("「つぎへ」で進み、画面に無い手順は飛ばし、最後は「わかった」で終わる", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Screen onClose={onClose} />)

    await user.click(screen.getByRole("button", { name: "つぎへ" }))

    const dialog = screen.getByRole("dialog", { name: "画面の案内" })
    expect(dialog).toHaveTextContent("ふたつめ")
    expect(dialog).toHaveTextContent("立ち止まって使う")
    expect(dialog).toHaveTextContent("2 / 2")
    expect(dialog).not.toHaveTextContent("無いもの")

    await user.click(screen.getByRole("button", { name: "わかった" }))
    expect(onClose).toHaveBeenCalledWith("done")
  })

  it("「スキップ」と Esc でやめられる", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Screen onClose={onClose} />)

    await user.click(screen.getByRole("button", { name: "スキップ" }))
    expect(onClose).toHaveBeenLastCalledWith("skipped")

    await user.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onClose).toHaveBeenLastCalledWith("skipped")
  })

  it("Esc をほかの画面(ARのとじる)に渡さない", async () => {
    const user = userEvent.setup()
    const outer = vi.fn()
    document.addEventListener("keydown", outer)
    render(<Screen onClose={vi.fn()} />)

    await user.keyboard("{Escape}")

    expect(outer).not.toHaveBeenCalled()
    document.removeEventListener("keydown", outer)
  })

  it("照らせる部品が1つも無いときは、何も出さず empty で知らせる", () => {
    const onClose = vi.fn()
    render(<Screen onClose={onClose} withTargets={false} />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onClose).toHaveBeenCalledWith("empty")
  })

  it("とじているあいだは何も出さない", () => {
    render(
      <>
        <button data-guide="one">検索</button>
        <SpotGuide open={false} steps={STEPS} label="画面の案内" onClose={vi.fn()} />
      </>,
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("scrollIntoView の手順は、照らす前に部品を見える位置まで送る", () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    render(
      <>
        <button data-guide="one">3D</button>
        <SpotGuide
          open
          steps={[{ target: '[data-guide="one"]', title: "3D", body: "立体で見る", scrollIntoView: true }]}
          label="画面の案内"
          onClose={vi.fn()}
        />
      </>,
    )

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "center" })
  })

  it("visibleInMiddleOnly の手順は、画面のまんなかに見えている部品が無ければ飛ばす", () => {
    // stubRects の部品は top 40(画面の上のほう)。まんなかの帯には無い
    const onClose = vi.fn()
    render(
      <>
        <button data-guide="one">ピン</button>
        <SpotGuide
          open
          steps={[{ target: '[data-guide="one"]', title: "ピンをタップ", body: "中身が出る", visibleInMiddleOnly: true }]}
          label="画面の案内"
          onClose={onClose}
        />
      </>,
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onClose).toHaveBeenCalledWith("empty")
  })

  it("Tab は吹き出しの中のボタンだけを回す", async () => {
    const user = userEvent.setup()
    render(<Screen onClose={vi.fn()} />)

    expect(screen.getByRole("button", { name: "つぎへ" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "スキップ" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "つぎへ" })).toHaveFocus()
  })
})
