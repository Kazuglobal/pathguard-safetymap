import { describe, expect, it } from "vitest"

import {
  appendImageGenerationContext,
  buildSystemASimulationJobs,
  settleSystemASimulationBatch,
} from "@/lib/system-a-simulation"

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

describe("settleSystemASimulationBatch", () => {
  it("keeps successful images when another simulation is rejected", async () => {
    const result = await settleSystemASimulationBatch([
      Promise.resolve("earthquake-image"),
      Promise.reject(new Error("flood rejected")),
      Promise.resolve("fire-image"),
    ])

    expect(result.values).toEqual(["earthquake-image", "fire-image"])
    expect(result.errors).toHaveLength(1)
  })
})

describe("appendImageGenerationContext", () => {
  it("adds the server-validated situation and coordinates", () => {
    const form = new FormData()
    appendImageGenerationContext(form, "flood", [140.74, 40.82])

    expect(Object.fromEntries(form.entries())).toEqual({
      situation: "flood",
      longitude: "140.74",
      latitude: "40.82",
    })
  })
})
