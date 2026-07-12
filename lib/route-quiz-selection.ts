export type QuizPoint = [number, number]

export type QuizPointSelection = {
  start: QuizPoint | null
  end: QuizPoint | null
}

/** 1回目をスタート、2回目をゴールとして固定する純粋な状態遷移。 */
export function selectNextQuizPoint(
  selection: QuizPointSelection,
  point: QuizPoint,
): QuizPointSelection {
  if (!selection.start) return { start: point, end: null }
  if (!selection.end) return { start: selection.start, end: point }
  return selection
}

export function canStartRouteQuiz(selection: QuizPointSelection): boolean {
  return Boolean(selection.start && selection.end)
}
