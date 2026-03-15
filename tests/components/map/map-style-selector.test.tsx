import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import MapStyleSelector from "@/components/map/map-style-selector"

const DrawerContext = createContext<{ open: boolean; onOpenChange: (open: boolean) => void } | null>(null)

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
            id: "route",
            label: "通学路",
            description: "通学路を表示",
            selected: true,
            onSelect: vi.fn(),
          },
          {
            id: "danger",
            label: "危険・注意",
            description: "危険情報を表示",
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
    expect(screen.getByText("通学路")).toBeInTheDocument()
    expect(screen.getByText("危険・注意")).toBeInTheDocument()
    expect(screen.getAllByText("表示中").length).toBeGreaterThan(0)
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
    await user.click(screen.getByText("航空写真"))

    expect(onChange).toHaveBeenCalledWith("satellite-v9")
  })
})
