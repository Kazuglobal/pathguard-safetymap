import { describe, expect, it } from "vitest"

import {
  buildKidsChecklist,
  generateKidsQuiz,
  gradeKidsQuiz,
} from "@/lib/ar-learning-quiz"
import { createMockDangerReport } from "@/tests/fixtures/dangers"

describe("ar-learning-quiz", () => {
  it("危険ポイント0件では汎用3問にフォールバックする", () => {
    const quiz = generateKidsQuiz([], { seed: "empty-route" })

    expect(quiz.questions).toHaveLength(3)
    expect(quiz.questions.every((question) => question.options.length === 3)).toBe(true)
  })

  it("危険ポイントが4件以上でも最大3問に制限し、同じseedで決定的に生成する", () => {
    const reports = [
      createMockDangerReport({ id: "traffic-1", danger_type: "traffic" }),
      createMockDangerReport({ id: "crime-1", danger_type: "crime" }),
      createMockDangerReport({ id: "disaster-1", danger_type: "disaster" }),
      createMockDangerReport({ id: "other-1", danger_type: "other" }),
    ]

    const first = generateKidsQuiz(reports, { seed: "route-1" })
    const second = generateKidsQuiz(reports, { seed: "route-1" })

    expect(first).toEqual(second)
    expect(first.questions).toHaveLength(3)
  })

  it("正答位置がseedで偏らず変化する", () => {
    const reports = [createMockDangerReport({ id: "traffic-1", danger_type: "traffic" })]
    const positions = new Set(
      Array.from({ length: 16 }, (_, index) =>
        generateKidsQuiz(reports, { seed: `seed-${index}` }).questions[0].options.findIndex(
          (option) => option.isCorrect
        )
      )
    )

    expect(positions.size).toBeGreaterThan(1)
  })

  it("回答を採点できる", () => {
    const quiz = generateKidsQuiz(
      [createMockDangerReport({ id: "traffic-1", danger_type: "traffic" })],
      { seed: "grade" }
    )
    const question = quiz.questions[0]
    const correctOption = question.options.find((option) => option.isCorrect)

    expect(correctOption).toBeTruthy()
    expect(gradeKidsQuiz(quiz, { [question.id]: correctOption!.id })).toEqual({
      score: 1,
      total: 1,
    })
  })

  it("チェックリストは危険種別に応じた項目を最大20件で生成する", () => {
    const checklist = buildKidsChecklist([
      createMockDangerReport({ id: "traffic-1", danger_type: "traffic" }),
      createMockDangerReport({ id: "crime-1", danger_type: "crime" }),
      createMockDangerReport({ id: "disaster-1", danger_type: "disaster" }),
    ])

    expect(checklist.length).toBeGreaterThanOrEqual(3)
    expect(checklist.length).toBeLessThanOrEqual(20)
    expect(checklist.map((item) => item.label)).toContain("車や自転車を見る方向を確認した")
    expect(checklist.map((item) => item.label)).toContain("困ったときに行ける場所を確認した")
  })
})
