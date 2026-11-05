import { eq } from 'drizzle-orm'

import { getDb } from '../client'
import { contactMessages } from '../schema'

export type NewContactMessage = {
  id: string
  kind: 'inquiry' | 'improvement'
  message: string
  replyEmail?: string
}

/** お問い合わせを保存する(メール転送より先に呼ぶ。転送に失敗しても内容が残る) */
export async function insertContactMessage(input: NewContactMessage): Promise<{ createdAt: string }> {
  const [row] = await getDb()
    .insert(contactMessages)
    .values({
      id: input.id,
      kind: input.kind,
      message: input.message,
      replyEmail: input.replyEmail ?? null,
    })
    .returning({ createdAt: contactMessages.createdAt })
  return { createdAt: row.createdAt }
}

export async function markContactDelivery(
  id: string,
  status: 'sent' | 'failed' | 'skipped',
  error?: string,
): Promise<void> {
  await getDb()
    .update(contactMessages)
    .set({ deliveryStatus: status, deliveryError: error ? error.slice(0, 500) : null })
    .where(eq(contactMessages.id, id))
}
