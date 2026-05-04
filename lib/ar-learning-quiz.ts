import type { DangerReport } from "@/lib/types"

export interface KidsChecklistItem {
  id: string
  label: string
  checked: boolean
}

export interface KidsQuizOption {
  id: string
  label: string
  isCorrect: boolean
}

export interface KidsQuizQuestion {
  id: string
  hazardId: string | null
  prompt: string
  explanation: string
  options: KidsQuizOption[]
}

export interface KidsQuiz {
  seed: string
  questions: KidsQuizQuestion[]
}

export type KidsQuizAnswers = Record<string, string>

interface QuestionTemplate {
  id: string
  prompt: string
  correct: string
  incorrect: string[]
  explanation: string
}

const MAX_QUIZ_QUESTIONS = 3

const CHECKLIST_BASE: KidsChecklistItem[] = [
  { id: "stop-position", label: "危ない場所で止まる場所を確認した", checked: false },
  { id: "look-directions", label: "車や自転車を見る方向を確認した", checked: false },
  { id: "ask-for-help", label: "困ったときに行ける場所を確認した", checked: false },
]

const CHECKLIST_BY_TYPE: Record<string, KidsChecklistItem> = {
  traffic: { id: "traffic-car-stop", label: "車が止まったことを確認した", checked: false },
  pedestrian: { id: "pedestrian-road-edge", label: "車道からはなれて歩く場所を確認した", checked: false },
  construction: { id: "construction-detour", label: "工事中に通る道を確認した", checked: false },
  crime: { id: "crime-safe-place", label: "困ったときに行ける場所を確認した", checked: false },
  disaster: { id: "disaster-safe-route", label: "雨の日や災害時に戻れる道を確認した", checked: false },
}

const QUESTION_TEMPLATES: Record<string, QuestionTemplate> = {
  traffic: {
    id: "traffic",
    prompt: "見通しが悪い交差点では、まず何をする？",
    correct: "止まって左右を見る",
    incorrect: ["走ってわたる", "スマホを見る"],
    explanation: "車や自転車が来ていないか、止まってから確認します。",
  },
  pedestrian: {
    id: "pedestrian",
    prompt: "歩道がせまい道では、どこを歩く？",
    correct: "車道からはなれて歩く",
    incorrect: ["車道の近くを歩く", "友だちと横に広がる"],
    explanation: "車や自転車とぶつからないように、端に寄りすぎず歩きます。",
  },
  construction: {
    id: "construction",
    prompt: "工事で道がせまいときは、どうする？",
    correct: "安全な通り道を大人と確認する",
    incorrect: ["急いで走り抜ける", "工事の近くで遊ぶ"],
    explanation: "いつもの道でも、工事中は歩く場所が変わることがあります。",
  },
  crime: {
    id: "crime",
    prompt: "こわいと感じたときは、どこへ行く？",
    correct: "大人がいる明るい場所へ行く",
    incorrect: ["ひとりで暗い道へ行く", "知らない人について行く"],
    explanation: "お店や家など、助けを呼べる場所を覚えておきます。",
  },
  disaster: {
    id: "disaster",
    prompt: "雨の日や災害のときは、どうする？",
    correct: "むりに通らず安全な道を選ぶ",
    incorrect: ["水たまりに入って進む", "暗い場所へ急ぐ"],
    explanation: "いつもと違う日は、戻れる道や避難しやすい方向を確認します。",
  },
  other: {
    id: "other",
    prompt: "危ないかもしれない場所では、まず何をする？",
    correct: "立ち止まってまわりを見る",
    incorrect: ["何も見ずに進む", "ふざけながら歩く"],
    explanation: "安全な場所で止まると、まわりをよく見られます。",
  },
}

function normalizeDangerType(type: string | null | undefined): keyof typeof QUESTION_TEMPLATES {
  if (type === "traffic" || type === "crime" || type === "disaster" || type === "construction") {
    return type
  }
  if (type === "pedestrian") return "pedestrian"
  return "other"
}

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createRandom(seed: string): () => number {
  let state = hashSeed(seed) || 1
  return () => {
    state = Math.imul(1664525, state) + 1013904223
    return (state >>> 0) / 4294967296
  }
}

function shuffleDeterministic<T>(items: T[], seed: string): T[] {
  const random = createRandom(seed)
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function createQuestion(
  template: QuestionTemplate,
  hazardId: string | null,
  seed: string
): KidsQuizQuestion {
  const optionLabels = shuffleDeterministic(
    [template.correct, ...template.incorrect],
    `${seed}:${template.id}:options`
  )

  return {
    id: `${hazardId ?? "generic"}:${template.id}`,
    hazardId,
    prompt: template.prompt,
    explanation: template.explanation,
    options: optionLabels.map((label, index) => ({
      id: `${template.id}:option-${index}`,
      label,
      isCorrect: label === template.correct,
    })),
  }
}

export function buildKidsChecklist(reports: DangerReport[]): KidsChecklistItem[] {
  const items = new Map(CHECKLIST_BASE.map((item) => [item.id, item]))

  for (const report of reports) {
    const item = CHECKLIST_BY_TYPE[normalizeDangerType(report.danger_type)]
    if (item) {
      items.set(item.id, item)
    }
  }

  return [...items.values()].slice(0, 20)
}

export function generateKidsQuiz(
  reports: DangerReport[],
  options: { seed: string }
): KidsQuiz {
  const seed = options.seed

  if (reports.length === 0) {
    return {
      seed,
      questions: ["traffic", "pedestrian", "other"].map((type) =>
        createQuestion(QUESTION_TEMPLATES[type], null, seed)
      ),
    }
  }

  const selectedReports = shuffleDeterministic(reports, `${seed}:reports`)
  const selectedTypes = new Set<string>()
  const questions: KidsQuizQuestion[] = []

  for (const report of selectedReports) {
    const type = normalizeDangerType(report.danger_type)
    if (selectedTypes.has(type)) continue

    selectedTypes.add(type)
    questions.push(createQuestion(QUESTION_TEMPLATES[type], report.id, seed))

    if (questions.length >= Math.min(MAX_QUIZ_QUESTIONS, reports.length)) {
      break
    }
  }

  return { seed, questions }
}

export function gradeKidsQuiz(
  quiz: KidsQuiz,
  answers: KidsQuizAnswers
): { score: number; total: number } {
  const score = quiz.questions.filter((question) => {
    const selectedOptionId = answers[question.id]
    return question.options.some((option) => option.id === selectedOptionId && option.isCorrect)
  }).length

  return {
    score,
    total: quiz.questions.length,
  }
}
