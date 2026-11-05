import { CONTACT_KINDS, type ContactKind } from './contact-schema'

/** 運営者への転送先(CONTACT_FORWARD_TO で上書きできる) */
export const DEFAULT_CONTACT_FORWARD_TO = 'globalbunny77@gmail.com'
/** 送信元。Resend で認証したドメインのアドレスにする(CONTACT_FROM_EMAIL で上書きできる) */
export const DEFAULT_CONTACT_FROM = 'PathGuardian <noreply@path-guardian.com>'

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
 * Resend でお問い合わせを運営者へ転送する。キー(RESEND_API_KEY)が無いときは送らずに skipped を返す。
 * 失敗しても例外は投げない(呼び出し側が保存済みの内容に結果を記録する)。
 */
export async function forwardContactMail(
  input: ContactMailInput,
  env: { apiKey?: string; to?: string; from?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ContactMailResult> {
  const apiKey = env.apiKey?.trim()
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
      body: JSON.stringify(buildContactMail(input, env)),
    })
    if (response.ok) return { status: 'sent' }
    const detail = (await response.text().catch(() => '')).slice(0, 300)
    return { status: 'failed', error: `resend ${response.status}: ${detail}` }
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'unknown error' }
  }
}
