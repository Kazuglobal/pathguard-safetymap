import { describe, expect, it, vi } from 'vitest'

import {
  buildContactMail,
  DEFAULT_CONTACT_FORWARD_TO,
  forwardContactMail,
} from '@/lib/contact/contact-mail'
import { ContactSchema, contactKindFromParam } from '@/lib/contact/contact-schema'

const input = {
  id: 'abc',
  kind: 'improvement' as const,
  message: '地図の文字を大きくしてほしい',
  replyEmail: 'parent@example.com',
  createdAt: '2026-11-05T00:00:00.000Z',
}

describe('お問い合わせメール', () => {
  it('既定の転送先は運営者のアドレス。返信先があれば reply_to に入る', () => {
    const mail = buildContactMail(input, {})
    expect(mail.to).toEqual([DEFAULT_CONTACT_FORWARD_TO])
    expect(DEFAULT_CONTACT_FORWARD_TO).toBe('globalbunny77@gmail.com')
    expect(mail.reply_to).toBe('parent@example.com')
    expect(mail.subject).toContain('サービス改善要望')
    expect(mail.text).toContain(input.message)
  })

  it('返信先が無ければ reply_to を付けない', () => {
    expect(buildContactMail({ ...input, replyEmail: undefined }, {})).not.toHaveProperty('reply_to')
  })

  it('RESEND_API_KEY が無いときは送らず skipped を返す', async () => {
    const fetchImpl = vi.fn()
    await expect(forwardContactMail(input, {}, fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      status: 'skipped',
      reason: 'not_configured',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('Resend に Bearer と冪等キーを付けて送り、成功なら sent', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    const result = await forwardContactMail(input, { apiKey: 'k' }, fetchImpl as unknown as typeof fetch)
    expect(result).toEqual({ status: 'sent' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer k')
    expect(init.headers['Idempotency-Key']).toBe('contact-abc')
  })

  it('Resend のエラー応答・通信エラーは例外にせず failed を返す', async () => {
    const bad = vi.fn().mockResolvedValue(new Response('nope', { status: 403 }))
    await expect(forwardContactMail(input, { apiKey: 'k' }, bad as unknown as typeof fetch)).resolves.toMatchObject({ status: 'failed' })
    const down = vi.fn().mockRejectedValue(new Error('network'))
    await expect(forwardContactMail(input, { apiKey: 'k' }, down as unknown as typeof fetch)).resolves.toEqual({ status: 'failed', error: 'network' })
  })
})

describe('お問い合わせの入力検証', () => {
  it('内容が必須。メールは空でもよいが、書くなら形式を確認する', () => {
    expect(ContactSchema.safeParse({ kind: 'inquiry', message: '  ' }).success).toBe(false)
    expect(ContactSchema.safeParse({ kind: 'inquiry', message: 'こんにちは', email: '' }).success).toBe(true)
    expect(ContactSchema.safeParse({ kind: 'inquiry', message: 'こんにちは', email: 'not-an-email' }).success).toBe(false)
    expect(ContactSchema.safeParse({ kind: 'other', message: 'x' }).success).toBe(false)
    expect(ContactSchema.safeParse({ kind: 'inquiry', message: 'あ'.repeat(2001) }).success).toBe(false)
  })

  it('種類は URL の type から決め、不明な値は「お問い合わせ」', () => {
    expect(contactKindFromParam('improvement')).toBe('improvement')
    expect(contactKindFromParam('x')).toBe('inquiry')
    expect(contactKindFromParam(undefined)).toBe('inquiry')
  })
})
