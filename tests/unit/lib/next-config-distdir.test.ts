import path from "path"
import { pathToFileURL } from "url"

import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@sentry/nextjs", () => ({
  withSentryConfig: (config: unknown) => config,
}))

const configModuleUrl = pathToFileURL(path.resolve(process.cwd(), "next.config.mjs")).href
const originalNextDistDir = process.env.NEXT_DIST_DIR

async function loadConfig(nextDistDir?: string) {
  if (nextDistDir === undefined) {
    delete process.env.NEXT_DIST_DIR
  } else {
    process.env.NEXT_DIST_DIR = nextDistDir
  }

  vi.resetModules()

  return (await import(`${configModuleUrl}?t=${Date.now()}-${Math.random()}`)).default
}

afterEach(() => {
  if (originalNextDistDir === undefined) {
    delete process.env.NEXT_DIST_DIR
  } else {
    process.env.NEXT_DIST_DIR = originalNextDistDir
  }
})

describe("next config distDir", () => {
  it("defaults to .next when NEXT_DIST_DIR is not set", async () => {
    const config = await loadConfig()

    expect(config.distDir).toBe(".next")
  })

  it("uses NEXT_DIST_DIR when provided", async () => {
    const config = await loadConfig(".next-dev")

    expect(config.distDir).toBe(".next-dev")
  })
})
