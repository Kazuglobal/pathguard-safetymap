import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"

vi.mock("next/script", () => ({
  default: ({ id, src, children, dangerouslySetInnerHTML }: { id?: string; src?: string; children?: string; dangerouslySetInnerHTML?: { __html: string } }) => (
    <script data-testid={id ?? "gtag-src"} data-src={src}>{children ?? dangerouslySetInnerHTML?.__html}</script>
  ),
}))

import { GoogleAnalytics } from "@/components/analytics/google-analytics"
import { readGaMeasurementId } from "@/lib/google-analytics"

describe("readGaMeasurementId", () => {
  it("G- で始まる測定IDだけを受け付ける", () => {
    expect(readGaMeasurementId("G-ABC123XYZ9")).toBe("G-ABC123XYZ9")
    expect(readGaMeasurementId(" G-ABC123XYZ9 ")).toBe("G-ABC123XYZ9")
    expect(readGaMeasurementId(undefined)).toBeNull()
    expect(readGaMeasurementId("")).toBeNull()
    expect(readGaMeasurementId("UA-12345-1")).toBeNull()
    expect(readGaMeasurementId("G-abc');alert(1);//")).toBeNull()
  })
})

describe("GoogleAnalytics", () => {
  it("測定IDがないときは何も読み込まない", () => {
    const { container } = render(<GoogleAnalytics measurementId={null} />)
    expect(container.querySelectorAll("script")).toHaveLength(0)
  })

  it("測定IDがあると gtag.js を読み込み、広告向けの機能を切って設定する", () => {
    const { container } = render(<GoogleAnalytics measurementId="G-ABC123XYZ9" />)
    const scripts = [...container.querySelectorAll("script")]
    expect(scripts[0]?.getAttribute("data-src")).toBe("https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ9")
    const init = scripts[1]?.textContent ?? ""
    expect(init).toContain("gtag('config', 'G-ABC123XYZ9'")
    expect(init).toContain("allow_google_signals: false")
    expect(init).toContain("allow_ad_personalization_signals: false")
  })
})
