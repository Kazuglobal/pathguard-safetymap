import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar'

function defineServiceWorker(value: unknown) {
  Object.defineProperty(window.navigator, 'serviceWorker', {
    value,
    configurable: true,
  })
}

describe('ServiceWorkerRegistrar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('マウント時に /sw.js を登録し、何も描画しない', () => {
    const register = vi.fn().mockResolvedValue({})
    defineServiceWorker({ register })

    const { container } = render(<ServiceWorkerRegistrar />)

    expect(container).toBeEmptyDOMElement()
    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  it('登録が失敗しても例外を投げずにログに残す', async () => {
    const register = vi.fn().mockRejectedValue(new Error('registration failed'))
    defineServiceWorker({ register })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ServiceWorkerRegistrar />)
    await new Promise((r) => setTimeout(r, 0))

    expect(errorSpy).toHaveBeenCalledWith('[sw] register error', expect.any(Error))
    errorSpy.mockRestore()
  })

  it('serviceWorker 非対応環境では何もせずクラッシュしない', () => {
    defineServiceWorker(undefined)
    // 'serviceWorker' in navigator は defineProperty 後も true になるため、
    // プロパティ自体を削除して非対応環境を再現する
    delete (window.navigator as { serviceWorker?: unknown }).serviceWorker

    expect(() => render(<ServiceWorkerRegistrar />)).not.toThrow()
  })
})
