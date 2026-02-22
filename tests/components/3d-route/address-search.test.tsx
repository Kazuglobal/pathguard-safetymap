import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AddressSearch from '@/components/3d-route/address-search'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('AddressSearch', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('座標不正な候補はドロップダウンに表示しない', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse([
          { place_name: 'invalid item' },
          { place_name: 'valid item', center: [139.7006, 35.6585] },
        ])
      )
    )

    render(<AddressSearch onSelect={vi.fn()} />)
    const input = screen.getByPlaceholderText('住所・場所を検索...')

    fireEvent.change(input, { target: { value: 'tokyo' } })

    await waitFor(() => {
      expect(screen.getByText('valid item')).toBeInTheDocument()
    })
    expect(screen.queryByText('invalid item')).not.toBeInTheDocument()
  })

  it('古い検索レスポンスは新しい結果を上書きしない', async () => {
    const first = createDeferred<Response>()
    const second = createDeferred<Response>()
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    vi.stubGlobal('fetch', fetchMock)

    render(<AddressSearch onSelect={vi.fn()} />)
    const input = screen.getByPlaceholderText('住所・場所を検索...')

    fireEvent.change(input, { target: { value: 'to' } })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(input, { target: { value: 'tok' } })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    second.resolve(
      jsonResponse([{ place_name: 'new-result', center: [139.8, 35.7] }])
    )
    await waitFor(() => {
      expect(screen.getByText('new-result')).toBeInTheDocument()
    })

    first.resolve(
      jsonResponse([{ place_name: 'old-result', center: [139.6, 35.6] }])
    )
    await waitFor(() => {
      expect(screen.queryByText('old-result')).not.toBeInTheDocument()
    })
    expect(screen.getByText('new-result')).toBeInTheDocument()
  })
})
