import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChildRouteDashboard } from "@/components/landing/child-route-dashboard"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}))

describe("ChildRouteDashboard", () => {
  it("renders the weekly quick-check headline and cards", () => {
    render(
      <ChildRouteDashboard
        childName="さくら"
        quickChecks={[
          { id: "today", title: "今日の注意地点", value: "2件", href: "/map" },
          { id: "share", title: "直近の共有カード", value: "昨夜 21:00", href: "/report" },
        ]}
      />,
    )

    expect(screen.getByRole("heading", { name: "今日の通学3分チェック" })).toBeInTheDocument()
    expect(screen.getByText(/さくらさん向け/)).toBeInTheDocument()
    expect(screen.getByText("今日の注意地点")).toBeInTheDocument()
    expect(screen.getByText("直近の共有カード")).toBeInTheDocument()
  })
})
