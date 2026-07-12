import { describe, expect, it } from "vitest"
import { canStartRouteQuiz, selectNextQuizPoint } from "@/lib/route-quiz-selection"

describe("route quiz point selection", () => {
  it("uses the first tap as start and the second tap as end", () => {
    const first = selectNextQuizPoint({ start: null, end: null }, [139.7, 35.6])
    const second = selectNextQuizPoint(first, [139.8, 35.7])

    expect(first).toEqual({ start: [139.7, 35.6], end: null })
    expect(second).toEqual({ start: [139.7, 35.6], end: [139.8, 35.7] })
    expect(canStartRouteQuiz(second)).toBe(true)
  })

  it("does not overwrite both selected points on later taps", () => {
    const complete = { start: [139.7, 35.6] as [number, number], end: [139.8, 35.7] as [number, number] }
    expect(selectNextQuizPoint(complete, [140, 36])).toEqual(complete)
  })
})
