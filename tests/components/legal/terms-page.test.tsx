import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import TermsPage from "@/app/terms/page"
import { BRAND } from "@/lib/brand"

describe("利用規約", () => {
  it("誰が提供するサービスかを書く(規約の「運営者」が誰か分かるように)", () => {
    const { container } = render(<TermsPage />)
    expect(container.textContent).toContain(
      `本サービスは、${BRAND.operator.name}(代表 ${BRAND.operator.representative}。以下「運営者」)が提供します。`,
    )
    expect(container.textContent).toContain("本サービスは、PathGuardian(代表 大舘和史。以下「運営者」)が提供します。")
  })

  it("準拠法と管轄の裁判所を書く(住所は出さずに「運営者の住所地」で決める)", () => {
    const { container } = render(<TermsPage />)
    const text = container.textContent ?? ""
    expect(text).toContain("本規約は日本法に準拠します")
    expect(text).toContain("運営者の住所地を管轄する地方裁判所を第一審の専属的合意管轄裁判所とします")
  })
})
