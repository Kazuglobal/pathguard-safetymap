import { describe, expect, it } from "vitest"

import {
  buildHazardImagePrompt,
  getHazardScenarioOptions,
} from "@/lib/hazard-scenarios"

describe("hazard scenarios", () => {
  it("returns only scenarios allowed for the current area context", () => {
    const options = getHazardScenarioOptions({
      hazardType: "flood",
      areaContext: "riverside",
    })

    expect(options.map((option) => option.key)).toContain("standard-riverside")
    expect(options.map((option) => option.key)).not.toContain("standard-coastal")
  })

  it("builds an English educational prompt from hazard context", () => {
    const prompt = buildHazardImagePrompt({
      hazardType: "flood",
      riskLevel: 3,
      depthMinMeters: 0.5,
      depthMaxMeters: 3,
      areaContext: "residential-school-route",
      scenarioKey: "standard-residential",
      locationLabel: "residential school route in Japan",
    })

    expect(prompt).toContain("Japanese residential school route")
    expect(prompt).toContain("0.5m to 3.0m")
    expect(prompt).toContain("educational safety illustration")
    expect(prompt).toContain("Do not show people in immediate danger")
  })
})
