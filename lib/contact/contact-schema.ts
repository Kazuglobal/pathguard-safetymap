import { z } from 'zod'

/** お問い合わせの種類。画面の選択肢・API・メールの件名で同じ値を使う */
export const CONTACT_KINDS = {
  inquiry: { label: 'お問い合わせ', hint: 'ご質問・不具合のご報告など' },
  improvement: { label: 'サービス改善要望', hint: '「こうなったら使いやすい」というご意見' },
} as const

export type ContactKind = keyof typeof CONTACT_KINDS

export const CONTACT_MESSAGE_MAX = 2000

/** 空文字の返信先は「なし」として扱う */
const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .optional()
  .transform((value) => (value ? value : undefined))
  .pipe(z.string().email().optional())

export const ContactSchema = z.object({
  kind: z.enum(['inquiry', 'improvement']),
  message: z.string().trim().min(1).max(CONTACT_MESSAGE_MAX),
  email: optionalEmail,
  /** 人には見えない欄。ここに値が入っていたらボットとみなす */
  website: z.string().max(200).optional(),
})

export type ContactInput = z.infer<typeof ContactSchema>

/** /contact?type=improvement のような URL から種類を決める(不明な値は「お問い合わせ」) */
export function contactKindFromParam(value: string | string[] | undefined): ContactKind {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === 'improvement' ? 'improvement' : 'inquiry'
}
