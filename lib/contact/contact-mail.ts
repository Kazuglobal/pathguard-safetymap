import {
  OPERATOR_EMAIL_FROM_ADDRESS,
  OPERATOR_EMAIL_FROM_NAME,
  OPERATOR_EMAIL_TO,
  sendOperatorEmail,
  type OperatorEmailBinding,
} from '@/lib/email/operator-mail'
import { CONTACT_KINDS, type ContactKind } from './contact-schema'

/** 運営者への転送先(CONTACT_FORWARD_TO で上書きできる) */
export const DEFAULT_CONTACT_FORWARD_TO = OPERATOR_EMAIL_TO
/** 送信元。Email Sending / Resend で認証したドメインのアドレスにする(CONTACT_FROM_EMAIL で上書きできる) */
export const DEFAULT_CONTACT_FROM = `${OPERATOR_EMAIL_FROM_NAME} <${OPERATOR_EMAIL_FROM_ADDRESS}>`

function parseFromHeader(raw?: string): { email: string; name: string } {
  const trimmed = raw?.trim()
  if (!trimmed) {
    return { email: OPERATOR_EMAIL_FROM_ADDRESS, name: OPERATOR_EMAIL_FROM_NAME }
  }
  const match = trimmed.match(/^(?:"?([^"<]+?)"?\s*)?<([^>]+)>$/)
  if (match) {
    return {
      email: match[2].trim() || OPERATOR_EMAIL_FROM_ADDRESS,
      name: match[1]?.trim() || OPERATOR_EMAIL_FROM_NAME,
    }
  }
  return { email: trimmed, name: OPERATOR_EMAIL_FROM_NAME }
}

export type ContactMailInput = {
  id: string
  kind: ContactKind
  message: string
  replyEmail?: string
  createdAt: string
}

export type ContactMailResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: 'not_configured' }
  | { status: 'failed'; error: string }

export function buildContactMail(input: ContactMailInput, env: { to?: string; from?: string }) {
  const label = CONTACT_KINDS[input.kind].label
  const lines = [
    `種類: ${label}`,
    `返信先: ${input.replyEmail ?? '(未入力)'}`,
    `受付ID: ${input.id}`,
    `受付日時: ${input.createdAt}`,
    '',
    '--- 内容 ---',
    input.message,
  ]
  return {
    from: env.from?.trim() || DEFAULT_CONTACT_FROM,
    to: [env.to?.trim() || DEFAULT_CONTACT_FORWARD_TO],
    subject: `【PathGuardian】${label}が届きました`,
    text: lines.join('\n'),
    // 返信先が入力されていれば、メールの「返信」で利用者に直接返せる
    ...(input.replyEmail ? { reply_to: input.replyEmail } : {}),
  }
}

/**
 * お問い合わせを運営者へ転送する。
 * Cloudflare Email Sending バインディングがあれば優先して無料送信し、無い（または失敗した）場合のみ
 * RESEND_API_KEY による Resend 送信へフォールバックする。どちらも無いときは skipped を返す。
 * 失敗しても例外は投げない(呼び出し側が保存済みの内容に結果を記録する)。
 */
export async function forwardContactMail(
  input: ContactMailInput,
  env: { apiKey?: string; to?: string; from?: string; binding?: OperatorEmailBinding },
  fetchImpl: typeof fetch = fetch,
): Promise<ContactMailResult> {
  const mail = buildContactMail(input, env)
  const apiKey = env.apiKey?.trim()

  if (env.binding) {
    const parsedFrom = parseFromHeader(env.from)
    const cfResult = await sendOperatorEmail(
      {
        subject: mail.subject,
        text: mail.text,
        replyTo: mail.reply_to,
      },
      {
        binding: env.binding,
        to: env.to,
        fromAddress: parsedFrom.email,
        fromName: parsedFrom.name,
      },
    )
    if (cfResult.status === 'sent') return { status: 'sent' }
    if (!apiKey) {
      return cfResult.status === 'failed'
        ? { status: 'failed', error: `cloudflare-email: ${cfResult.error}` }
        : { status: 'skipped', reason: 'not_configured' }
    }
  }

  if (!apiKey) return { status: 'skipped', reason: 'not_configured' }

  try {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // 再送しても二重に届かないよう、受付IDを冪等キーにする
        'Idempotency-Key': `contact-${input.id}`,
      },
      body: JSON.stringify(mail),
    })
    if (response.ok) return { status: 'sent' }
    const detail = (await response.text().catch(() => '')).slice(0, 300)
    return { status: 'failed', error: `resend ${response.status}: ${detail}` }
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'unknown error' }
  }
}
