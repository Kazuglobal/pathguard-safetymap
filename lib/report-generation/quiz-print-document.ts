import type { PhotoQuizView } from '@/lib/hunter/routes/photo-quiz-schema'
import type { PrintDocument, PrintPurpose } from './print-document'

export function buildQuizPrintDocument(session: PhotoQuizView, options: {
  purpose: PrintPurpose; selectedIds: string[]; sharedTitle: string; placeNames: Record<string, string>; furigana: boolean; generatedAt: string
}): PrintDocument {
  const school = options.purpose === 'school'
  const learned = new Map(session.learned.map(item => [item.id, item]))
  const selected = [...new Set(options.selectedIds)].flatMap(id => learned.has(id) ? [learned.get(id)!] : [])
  return { purpose: options.purpose, title: school ? options.sharedTitle.trim() || 'みんなの通学路' : session.title,
    generatedAt: options.generatedAt, furigana: options.furigana,
    items: selected.map((item, index) => ({ id: item.id, number: index + 1,
      title: school ? options.placeNames[item.id]?.trim() || `たしかめる場所 ${index + 1}` : item.title,
      observation: school ? 'クイズで学んだ安全な行動を、みんなでたしかめましょう。' : item.observation ?? 'クイズで学んだ場所です。実際の道の様子を、親子でたしかめましょう。',
      action: item.action,
    })),
  }
}
