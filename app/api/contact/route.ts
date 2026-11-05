import { NextRequest, NextResponse } from 'next/server'

import { forwardContactMail } from '@/lib/contact/contact-mail'
import { ContactSchema } from '@/lib/contact/contact-schema'
import { insertContactMessage, markContactDelivery } from '@/lib/db/repos/contact.repo'
import { checkContactRateLimit, rateLimitedResponse } from '@/lib/upstash-rate-limiter'

export const runtime = 'nodejs'

function clientKey(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

/** お問い合わせ・サービス改善要望を受け付け、運営者のメールへ転送する(未ログインでも送れる) */
export async function POST(request: NextRequest) {
  const rate = await checkContactRateLimit(`contact:${clientKey(request)}`)
  if (!rate.success) return rateLimitedResponse(rate.reset)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '不正なリクエストです' }, { status: 400 })
  }

  const parsed = ContactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '入力内容が正しくありません。内容(2000字まで)とメールアドレスを確認してください' }, { status: 400 })
  }
  const { kind, message, email, website } = parsed.data

  // 人には見えない欄に値があるのはボット。成功したように見せて、何も保存しない
  if (website) return NextResponse.json({ success: true })

  const id = crypto.randomUUID()

  let createdAt: string
  try {
    ;({ createdAt } = await insertContactMessage({ id, kind, message, replyEmail: email }))
  } catch (error) {
    console.error('contact insert failed:', error)
    return NextResponse.json({ error: '送信に失敗しました。時間をおいて、もう一度お試しください' }, { status: 500 })
  }

  // 保存できていれば、転送の成否にかかわらず利用者には「受け付けました」を返す(失敗は表に記録する)
  const result = await forwardContactMail(
    { id, kind, message, replyEmail: email, createdAt },
    {
      apiKey: process.env.RESEND_API_KEY,
      to: process.env.CONTACT_FORWARD_TO,
      from: process.env.CONTACT_FROM_EMAIL,
    },
  )
  if (result.status !== 'sent') {
    console.error(JSON.stringify({ event: 'contact_forward_not_sent', id, ...result }))
  }
  try {
    await markContactDelivery(
      id,
      result.status,
      result.status === 'failed' ? result.error : result.status === 'skipped' ? result.reason : undefined,
    )
  } catch (error) {
    console.error('contact delivery mark failed:', error)
  }

  return NextResponse.json({ success: true })
}
