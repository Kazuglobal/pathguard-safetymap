import 'server-only'
import { HAZARD_CURRICULUM } from './curriculum'
import { routePhotoUrl } from './notes'
import type { PhotoQuizAnswer, PhotoQuizChoice, PhotoQuizItem, PhotoQuizStage, PhotoQuizView } from './photo-quiz-schema'

interface QuizQuestion { prompt: string; choices: PhotoQuizChoice[]; correctId: string; explanation: string }
export interface QuizLesson {
  item: PhotoQuizItem; reason: QuizQuestion; action: QuizQuestion; outcome: string;
  found: boolean; hintUsed: boolean; reasonCorrect: boolean; actionCorrect: boolean; mistakes: number;
}
export interface PhotoQuizState {
  title: string; schoolYear: number; lessons: QuizLesson[]; index: number; stage: PhotoQuizStage;
  feedback?: { correct: boolean; text: string };
}
export class QuizInputError extends Error {}

export function buildPhotoQuizState(title: string, schoolYear: number, items: PhotoQuizItem[]): PhotoQuizState {
  if (items.length < 1 || items.length > 3) throw new QuizInputError('1〜3か所を選んでください。')
  const lessons = items.map(item => {
    const template = HAZARD_CURRICULUM.find(hazard => hazard.id === item.templateId)
    if (!template) throw new QuizInputError('問題の種類を確認してください。')
    function question(kind: 'reason' | 'action'): QuizQuestion {
      const source = template!.questions[kind]
      const candidates = schoolYear <= 2 ? source.choices.filter(choice => choice.id === source.correctId || choice.id === source.choices.find(other => other.id !== source.correctId)?.id) : source.choices
      let correctId = ''
      const choices = candidates.map((choice, index) => {
        const id = crypto.randomUUID(); if (choice.id === source.correctId) correctId = id
        let text = choice.text
        if (kind === 'reason' && schoolYear >= 5) {
          const predictions = template!.questions.prediction
          const prediction = choice.id === source.correctId ? predictions.choices.find(value => value.id === predictions.correctId)! : predictions.choices.filter(value => value.id !== predictions.correctId)[index % 2]
          text = `${prediction.text}。${choice.text}`
        }
        return { id, text }
      })
      // Stable for a saved session, unpredictable between sessions.
      for (let i = choices.length - 1; i > 0; i--) {
        const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
        ;[choices[i], choices[j]] = [choices[j], choices[i]]
      }
      const prompt = schoolYear <= 2 ? kind === 'reason' ? 'どうして、きをつけるのかな？' : 'どうしたら、あんぜんかな？'
        : schoolYear <= 4 ? source.prompt
        : kind === 'reason' ? schoolYear <= 6 ? '何が起こりそう？ 予測と理由を選ぼう。' : '見えない範囲も考えて、予測と理由が合うものを選ぼう。'
        : schoolYear <= 6 ? '予測した危険を避けるには、どう行動する？' : '状況が変わっても安全を確かめられる行動はどれ？'
      return { prompt, choices, correctId, explanation: kind === 'reason' ? choices.find(choice => choice.id === correctId)!.text : template!.outcome }
    }
    return { item, reason: question('reason'), action: question('action'), outcome: template.outcome,
      found: false, hintUsed: false, reasonCorrect: false, actionCorrect: false, mistakes: 0 }
  })
  return { title, schoolYear, lessons, index: 0, stage: 'find' }
}

export function applyPhotoQuizAnswer(previous: PhotoQuizState, answer: PhotoQuizAnswer): PhotoQuizState {
  const state = structuredClone(previous)
  if (state.stage === 'complete') throw new QuizInputError('この学習は完了しています。')
  const lesson = state.lessons[state.index]
  if (answer.kind === 'next') {
    if (state.stage !== 'feedback') throw new QuizInputError('この問題をたしかめてから進んでください。')
    state.index++; state.stage = state.index === state.lessons.length ? 'complete' : 'find'; delete state.feedback; return state
  }
  if (state.stage === 'find') {
    if (answer.kind === 'hint') {
      lesson.hintUsed = true
      state.feedback = { correct: false, text: '写真の中の、囲んだ場所に注目してみよう。' }
      return state
    }
    if (answer.kind !== 'point' || !answer.point) throw new QuizInputError('写真で気になる場所を選んでください。')
    const { x, y, width, height } = lesson.item.region
    const hit = answer.point.x >= x && answer.point.x <= x + width && answer.point.y >= y && answer.point.y <= y + height
    if (!hit) { lesson.mistakes++; state.feedback = { correct: false, text: 'ほかにも気になるところがあるかな？ 写真をもう一度見てみよう。' }; return state }
    lesson.found = true; state.stage = 'reason'; delete state.feedback; return state
  }
  if ((state.stage !== 'reason' && state.stage !== 'action') || answer.kind !== 'choice') throw new QuizInputError('現在の問題に答えてください。')
  const question = lesson[state.stage]
  if (!question.choices.some(choice => choice.id === answer.choiceId)) throw new QuizInputError('選択肢を確認してください。')
  if (answer.choiceId !== question.correctId) {
    lesson.mistakes++; state.feedback = { correct: false, text: `もう一度考えてみよう。${question.explanation}` }; return state
  }
  if (state.stage === 'reason') { lesson.reasonCorrect = true; state.stage = 'action'; state.feedback = { correct: true, text: question.explanation } }
  else { lesson.actionCorrect = true; state.stage = 'feedback'; state.feedback = { correct: true, text: lesson.outcome } }
  return state
}

export function photoQuizView(state: PhotoQuizState, identity: Pick<PhotoQuizView, 'id' | 'version' | 'courseId' | 'revision' | 'scenario'>): PhotoQuizView {
  const lesson = state.lessons[state.index]
  const question = lesson && (state.stage === 'reason' || state.stage === 'action') ? lesson[state.stage] : undefined
  return {
    ...identity, title: state.title, schoolYear: state.schoolYear, index: state.index, total: state.lessons.length,
    stage: state.stage, feedback: state.feedback,
    ...(lesson ? { item: {
      id: lesson.item.id, title: state.stage === 'find' ? `たしかめる場所 ${state.index + 1}` : lesson.item.title,
      photoUrl: routePhotoUrl(identity.courseId, lesson.item.sceneId, lesson.item.photoIndex),
      hypothetical: lesson.item.hypothetical,
      ...(lesson.found || lesson.hintUsed ? { region: lesson.item.region, observed: lesson.item.observed } : {}),
    } } : {}),
    ...(question ? { question: { prompt: question.prompt, choices: question.choices } } : {}),
    learned: state.lessons.filter(value => value.actionCorrect && value.reasonCorrect).map(value => ({ id: value.item.id, title: value.item.title, observation: value.item.observed, action: value.action.choices.find(choice => choice.id === value.action.correctId)!.text })),
  }
}
