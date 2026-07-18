import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const script = readFileSync(
  resolve(process.cwd(), "scripts/moderation-backtest.mjs"),
  "utf8",
)

describe("moderation-backtest CLI", () => {
  it("has a bounded sample size and processes reports serially", () => {
    expect(script).toContain("MAX_LIMIT")
    expect(script).toMatch(
      /for\s*\(\s*const report of reports(?:\s*\?\?\s*\[\])?\s*\)/,
    )
    expect(script).not.toContain("Promise.all(reports")
  })

  it("prints aggregates without logging report title or description", () => {
    expect(script).toContain("evaluateDangerModeration")
    expect(script).not.toMatch(/console\.(?:log|error)\([^)]*report\.(?:title|description)/)
  })
})
