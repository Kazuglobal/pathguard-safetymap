import { render, screen } from "@testing-library/react"

import { FamilyShareCard } from "@/components/report/family-share-card"

describe("FamilyShareCard", () => {
  it("renders a compact family share card with summary and map thumbnail", () => {
    render(
      <FamilyShareCard
        title="見通しの悪い交差点"
        summary="小学生の目線では車が急に見える"
        action="白線の内側を歩く"
        mapLabel="東京・千代田区"
        imageUrl="/hazard.png"
      />,
    )

    expect(screen.getByText("小学生の目線では車が急に見える")).toBeInTheDocument()
    expect(screen.getByText("白線の内側を歩く")).toBeInTheDocument()
  })
})
