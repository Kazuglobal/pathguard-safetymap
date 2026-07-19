import { describe, expect, it } from "vitest"

import { buildSystemASimulationJobs } from "@/lib/system-a-simulation"

describe("buildSystemASimulationJobs", () => {
  it.each([null, "", "   "])("omits flood when its prompt is %j", (floodPrompt) => {
    const jobs = buildSystemASimulationJobs({
      earthquake: "earthquake prompt",
      typhoon: "typhoon prompt",
      flood: floodPrompt,
      fire: "fire prompt",
    })

    expect(jobs.map((job) => job.situation)).toEqual([
      "earthquake",
      "typhoon",
      "fire",
    ])
    expect(jobs.some((job) => job.prompt === "null")).toBe(false)
  })

  it("keeps flood when a non-empty server prompt is available", () => {
    const jobs = buildSystemASimulationJobs({
      earthquake: "earthquake prompt",
      typhoon: "typhoon prompt",
      flood: "flood prompt",
      fire: "fire prompt",
    })

    expect(jobs.map((job) => job.situation)).toEqual([
      "earthquake",
      "typhoon",
      "flood",
      "fire",
    ])
  })
})
