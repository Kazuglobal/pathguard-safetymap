import { describe, expect, it } from "vitest"

import { extractHunterJson } from "@/lib/hunter/ai-json"

describe("extractHunterJson", () => {
  it("parses a plain JSON object", () => {
    const r = extractHunterJson('{"a":1,"b":"x"}')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ a: 1, b: "x" })
  })

  it("strips ```json code fences", () => {
    const r = extractHunterJson('```json\n{"version":"hunter-1","ok":true}\n```')
    expect(r.ok).toBe(true)
    expect(r.value).toMatchObject({ version: "hunter-1", ok: true })
  })

  it("ignores a preamble and trailing prose around the object", () => {
    const r = extractHunterJson('はい、結果です:\n{"dangerPoints":[]}\n以上です。')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ dangerPoints: [] })
  })

  it("extracts the first complete object and ignores braces inside strings", () => {
    const r = extractHunterJson('{"note":"a } b","n":2} trailing {x}')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ note: "a } b", n: 2 })
  })

  it("repairs truncation at an element boundary (unclosed array+object)", () => {
    const r = extractHunterJson(
      '{"version":"hunter-1","dangerPoints":[{"kind":"blind_corner"},',
    )
    expect(r.ok).toBe(true)
    expect(r.value).toMatchObject({
      version: "hunter-1",
      dangerPoints: [{ kind: "blind_corner" }],
    })
  })

  it("repairs an unterminated string", () => {
    const r = extractHunterJson('{"version":"hunter-1","note":"abc')
    expect(r.ok).toBe(true)
    expect(r.value).toMatchObject({ version: "hunter-1", note: "abc" })
  })

  it("repairs a dangling key with no value", () => {
    const r = extractHunterJson('{"a":1,"b":')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ a: 1 })
  })

  it("returns ok:false for input with no JSON object", () => {
    expect(extractHunterJson("just some text").ok).toBe(false)
    expect(extractHunterJson("").ok).toBe(false)
    expect(extractHunterJson(null as unknown as string).ok).toBe(false)
  })
})
