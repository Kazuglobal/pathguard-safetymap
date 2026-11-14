import { describe, expect, it } from "vitest"

import {
  AR_GUIDE_SETTINGS_STEP,
  AR_GUIDE_SHEET_STEPS,
  AR_GUIDE_TABS_STEP,
  buildARGuideSteps,
  getARGuideIdsSeen,
} from "@/lib/spot-guide-steps"

// ARの下のシートは、選んでいるタブのぶんしか画面に無い。もう一方のタブのシートを「見た」ことにしない
describe("AR guide steps", () => {
  it("はじめての案内は、切りかえ・いまのタブのシート・設定の順", () => {
    expect(buildARGuideSteps("risk", true)).toEqual([
      AR_GUIDE_TABS_STEP,
      AR_GUIDE_SHEET_STEPS.risk.step,
      AR_GUIDE_SETTINGS_STEP,
    ])
    expect(buildARGuideSteps("report", true)[1]).toBe(AR_GUIDE_SHEET_STEPS.report.step)
  })

  it("もう一方のタブをはじめて開いたときは、そのシートの手順だけ", () => {
    expect(buildARGuideSteps("report", false)).toEqual([AR_GUIDE_SHEET_STEPS.report.step])
    expect(buildARGuideSteps("risk", false)).toEqual([AR_GUIDE_SHEET_STEPS.risk.step])
  })

  it("2つのシートは別の部品を指し、別に覚える", () => {
    expect(AR_GUIDE_SHEET_STEPS.risk.step.target).not.toBe(AR_GUIDE_SHEET_STEPS.report.step.target)
    expect(AR_GUIDE_SHEET_STEPS.risk.id).toBe("ar-risk-sheet")
    expect(AR_GUIDE_SHEET_STEPS.report.id).toBe("ar-report-sheet")
  })

  it("実際に照らした手順のぶんだけ、見たと記録する", () => {
    const shownOnRiskTab = buildARGuideSteps("risk", true).map((step) => step.target)
    expect(getARGuideIdsSeen(shownOnRiskTab)).toEqual(["ar", "ar-risk-sheet"])

    // シートが画面に無くて飛ばされたとき(位置が遅い・報告が0件)は、シートを見たことにしない
    expect(getARGuideIdsSeen([AR_GUIDE_TABS_STEP.target, AR_GUIDE_SETTINGS_STEP.target])).toEqual(["ar"])

    // もう一方のタブで、シートだけ見たとき
    expect(getARGuideIdsSeen([AR_GUIDE_SHEET_STEPS.report.step.target])).toEqual(["ar-report-sheet"])
    expect(getARGuideIdsSeen([])).toEqual([])
  })
})
