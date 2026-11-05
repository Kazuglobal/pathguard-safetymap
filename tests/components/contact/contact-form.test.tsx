import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ContactForm } from '@/components/contact/contact-form'

afterEach(() => vi.restoreAllMocks())

describe('ContactForm', () => {
  it('内容が空のあいだは送れない', () => {
    render(<ContactForm />)
    expect(screen.getByRole('button', { name: '送信する' })).toBeDisabled()
  })

  it('種類・内容・返信先を /api/contact に送り、成功したら受付メッセージを出す', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"success":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ContactForm initialKind="improvement" />)

    fireEvent.change(screen.getByLabelText(/^内容/), { target: { value: '夜の道を明るく表示して' } })
    fireEvent.change(screen.getByLabelText(/^返信先のメールアドレス/), { target: { value: 'a@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '送信する' }))

    await waitFor(() => expect(screen.getByTestId('contact-sent')).toBeInTheDocument())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/contact')
    expect(JSON.parse(init.body)).toMatchObject({ kind: 'improvement', message: '夜の道を明るく表示して', email: 'a@example.com', website: '' })
  })

  it('サーバーがエラーを返したら、そのメッセージを出して内容は消さない', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"リクエストが多すぎます"}', { status: 429 })))
    render(<ContactForm />)
    fireEvent.change(screen.getByLabelText(/^内容/), { target: { value: 'テスト' } })
    fireEvent.click(screen.getByRole('button', { name: '送信する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('リクエストが多すぎます')
    expect(screen.getByLabelText(/^内容/)).toHaveValue('テスト')
  })
})
