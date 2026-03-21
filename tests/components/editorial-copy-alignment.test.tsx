import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SchoolRouteNewsPage from "@/app/school-route-news/page"
import NewsDetailPage from "@/app/school-route-news/[slug]/page"
import SafeMagazinePage from "@/app/safe-magazine/page"
import { SchoolRouteNewsSection } from "@/components/landing/SchoolRouteNewsSection"

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: any) => <img {...props} />,
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}))

describe("editorial copy alignment", () => {
  it("renders the newest curated school route story in the landing news section", () => {
    render(<SchoolRouteNewsSection />)

    expect(
      screen.getByText("【全国】2026年9月から生活道路の法定速度を30km/hに引き下げ—通学路の安全対策が大きく前進")
    ).toBeInTheDocument()
  })

  it("renders the landing school route news badge as editorially curated", () => {
    render(<SchoolRouteNewsSection />)

    expect(screen.getByText("編集部選定")).toBeInTheDocument()
    expect(screen.queryByText("リアルタイム")).not.toBeInTheDocument()
  })

  it("renders the school route news page subtitle without realtime wording", () => {
    render(<SchoolRouteNewsPage />)

    expect(screen.getByText("編集部が選んだ通学路の安全トピック")).toBeInTheDocument()
    expect(screen.queryByText("全国の通学路に関するリアルタイムニュース")).not.toBeInTheDocument()
  })

  it("relabels breaking badges as curated highlights instead of速報", () => {
    render(<SchoolRouteNewsPage />)

    expect(screen.getByText("注目")).toBeInTheDocument()
    expect(screen.queryByText("速報")).not.toBeInTheDocument()
  })

  it("keeps the curated highlight label on the school route news detail page", async () => {
    render(
      await NewsDetailPage({
        params: Promise.resolve({ slug: "fukuoka-asakura-bicycle-accident-20260119" }),
      })
    )

    expect(screen.getByText("注目")).toBeInTheDocument()
    expect(screen.queryByText("速報")).not.toBeInTheDocument()
  })

  it("renders the safe magazine page subtitle as feature content", () => {
    render(<SafeMagazinePage />)

    expect(screen.getByText("通学路の安全に関する特集記事")).toBeInTheDocument()
    expect(screen.queryByText("通学路の安全に関する最新情報")).not.toBeInTheDocument()
  })
})
