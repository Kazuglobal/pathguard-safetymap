import { describe, it, expect } from "vitest"
import { UserX } from "lucide-react"
import {
  getDangerTypeLabel,
  getDangerTypeIcon,
} from "@/components/danger-report/detail/report-detail-utils"

describe("report-detail-utils suspicious type", () => {
  it("maps 'suspicious' to the 不審者情報 label", () => {
    expect(getDangerTypeLabel("suspicious")).toBe("不審者情報")
  })

  it("maps 'suspicious' to the UserX icon", () => {
    expect(getDangerTypeIcon("suspicious")).toBe(UserX)
  })

  it("keeps existing types intact", () => {
    expect(getDangerTypeLabel("traffic")).toBe("交通危険")
    expect(getDangerTypeLabel("unknown-type")).toBe("unknown-type")
  })
})
