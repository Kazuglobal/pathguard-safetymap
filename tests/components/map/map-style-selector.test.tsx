import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import MapStyleSelector from "@/components/map/map-style-selector"

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: any) => <img {...props} />,
}))

const DrawerContext = createContext<{ open: boolean; onOpenChange: (open: boolean) => void } | null>(null)
const PopoverContext = createContext<{ open: boolean; onOpenChange: (open: boolean) => void } | null>(null)

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({
    children,
    open = false,
    onOpenChange = () => {},
  }: {
    children: ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => <DrawerContext.Provider value={{ open, onOpenChange }}>{children}</DrawerContext.Provider>,
  DrawerContent: ({ children }: { children: ReactNode }) => {
    const context = useContext(DrawerContext)
    return context?.open ? <div>{children}</div> : null
  },
  DrawerDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DrawerTrigger: ({ children }: { children: ReactNode }) => {
    const context = useContext(DrawerContext)

    if (!isValidElement(children)) return null

    const child = children as ReactElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>
    return cloneElement(child, {
      onClick: (event: MouseEvent<HTMLElement>) => {
        child.props.onClick?.(event)
        context?.onOpenChange(true)
      },
    })
  },
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({
    children,
    open = false,
    onOpenChange = () => {},
  }: {
    children: ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => <PopoverContext.Provider value={{ open, onOpenChange }}>{children}</PopoverContext.Provider>,
  PopoverContent: ({ children }: { children: ReactNode }) => {
    const context = useContext(PopoverContext)
    return context?.open ? <div data-testid="display-popover">{children}</div> : null
  },
  PopoverTrigger: ({ children }: { children: ReactNode }) => {
    const context = useContext(PopoverContext)

    if (!isValidElement(children)) return null

    const child = children as ReactElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>
    return cloneElement(child, {
      onClick: (event: MouseEvent<HTMLElement>) => {
        child.props.onClick?.(event)
        context?.onOpenChange(true)
      },
    })
  },
}))

describe("MapStyleSelector", () => {
  it("renders an explicit display trigger label", () => {
    render(
      <MapStyleSelector
        currentStyle="streets-v12"
        onChange={() => {}}
        compactLabel={false}
        buttonLabel="表示"
      />,
    )

    expect(screen.getByRole("button", { name: "表示" })).toBeInTheDocument()
  })

  it("opens grouped display content on mobile", async () => {
    const user = userEvent.setup()

    render(
      <MapStyleSelector
        currentStyle="streets-v12"
        onChange={() => {}}
        isMobile
        buttonLabel="表示"
        overlayOptions={[
          {
            id: "flood",
            label: "洪水",
            description: "洪水リスクのある地域を表示",
            selected: true,
            onSelect: vi.fn(),
          },
          {
            id: "tsunami",
            label: "津波",
            description: "津波想定を表示",
            selected: false,
            onSelect: vi.fn(),
          },
        ]}
      />,
    )

    expect(screen.queryByText("表示する情報")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "表示" }))

    expect(screen.getByText("表示する情報")).toBeInTheDocument()
    expect(screen.getByText("地図の見た目")).toBeInTheDocument()
    expect(screen.getByText("地図に重ねる情報")).toBeInTheDocument()
    expect(screen.getByText("洪水")).toBeInTheDocument()
    expect(screen.getByText("津波")).toBeInTheDocument()
    expect(screen.getAllByText("表示中").length).toBeGreaterThan(0)
  })

  it("shows preview images for all eight map styles", async () => {
    const user = userEvent.setup()

    render(
      <MapStyleSelector
        currentStyle="streets-v12"
        onChange={() => {}}
        isMobile
        buttonLabel="表示"
        overlayOptions={[
          {
            id: "heatmap",
            label: "事故ヒートマップ",
            description: "事故の集中地点を表示",
            selected: false,
            onSelect: vi.fn(),
          },
        ]}
      />,
    )

    await user.click(screen.getByRole("button", { name: "表示" }))

    expect(screen.getByRole("img", { name: "標準のプレビュー" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "衛星写真（最新）のプレビュー" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "航空写真のプレビュー" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "衛星+道路のプレビュー" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "ナビのプレビュー" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "ライトのプレビュー" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "ダークのプレビュー" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "アウトドアのプレビュー" })).toBeInTheDocument()
    expect(screen.getAllByRole("img")).toHaveLength(8)
  })

  it("uses the approved screenshot asset for the standard satellite preview", async () => {
    const user = userEvent.setup()

    render(
      <MapStyleSelector
        currentStyle="streets-v12"
        onChange={() => {}}
        isMobile
        buttonLabel="表示"
        overlayOptions={[
          {
            id: "heatmap",
            label: "事故ヒートマップ",
            description: "事故の集中地点を表示",
            selected: false,
            onSelect: vi.fn(),
          },
        ]}
      />,
    )

    await user.click(screen.getByRole("button", { name: "表示" }))

    expect(screen.getByRole("img", { name: "衛星写真（最新）のプレビュー" })).toHaveAttribute(
      "src",
      "/images/map-style-previews/スクリーンショット 2026-03-26 235329.png",
    )
  })

  it("keeps the blue selected style badge on one line with compact sizing", async () => {
    const user = userEvent.setup()

    render(
      <MapStyleSelector
        currentStyle="streets-v12"
        onChange={() => {}}
        isMobile
        buttonLabel="表示"
        overlayOptions={[
          {
            id: "heatmap",
            label: "事故ヒートマップ",
            description: "事故の集中地点を表示",
            selected: false,
            onSelect: vi.fn(),
          },
        ]}
      />,
    )

    await user.click(screen.getByRole("button", { name: "表示" }))

    const selectedStyleCard = screen.getByRole("button", {
      name: /標準.*道路と施設を見やすく表示します.*表示中/,
    })
    const badge = within(selectedStyleCard).getByText("表示中").closest("span")

    expect(badge).toHaveClass("whitespace-nowrap")
    expect(badge).toHaveClass("px-1.5")
    expect(badge).toHaveClass("text-[10px]")
  })

  it("opens grouped desktop content in a popover instead of menu semantics", async () => {
    const user = userEvent.setup()

    render(
      <MapStyleSelector
        currentStyle="streets-v12"
        onChange={() => {}}
        buttonLabel="表示"
        compactLabel={false}
        overlayOptions={[
          {
            id: "heatmap",
            label: "事故ヒートマップ",
            description: "事故の集中地点を表示",
            selected: false,
            onSelect: vi.fn(),
          },
        ]}
      />,
    )

    await user.click(screen.getByRole("button", { name: "表示" }))

    expect(screen.getByTestId("display-popover")).toBeInTheDocument()
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    expect(screen.getByText("表示する情報")).toBeInTheDocument()
  })

  it("still supports the simple style-only dropdown contract", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <MapStyleSelector
        currentStyle="streets-v12"
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole("button"))
    await user.click(screen.getByText("航空写真（旧）"))

    expect(onChange).toHaveBeenCalledWith("satellite-v9")
  })
})
