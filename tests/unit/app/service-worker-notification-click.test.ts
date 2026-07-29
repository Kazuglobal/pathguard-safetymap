import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * public/sw.js は raw 配信される素の Service Worker スクリプトで import できないため、
 * ソースを読み込んで疑似 ServiceWorkerGlobalScope 上で評価し、登録された
 * notificationclick ハンドラの実挙動を検証する。
 * 評価対象はリポジトリ追跡下の固定ファイルのみで、外部入力は一切混ぜないこと。
 */
const SW_SOURCE = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf-8')
const ORIGIN = 'https://pathguardian.example'

type Handlers = Record<string, (event: unknown) => void>

function loadServiceWorker() {
  const handlers: Handlers = {}
  const openWindow = vi.fn(async () => ({}))
  const navigate = vi.fn(async () => null)
  const focus = vi.fn(async () => ({}))
  const matchAll = vi.fn(async () => [] as Array<Record<string, unknown>>)

  const clients = { matchAll, openWindow }
  const self = {
    location: { origin: ORIGIN },
    clients: { claim: vi.fn(async () => undefined) },
    registration: { showNotification: vi.fn(async () => undefined) },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers[type] = handler
    },
  }

  // eslint-disable-next-line no-new-func
  new Function('self', 'clients', SW_SOURCE)(self, clients)

  return { handlers, clients, openWindow, matchAll, navigate, focus }
}

/** notificationclick を発火し、waitUntil に渡された Promise の解決まで待つ */
async function clickNotification(
  sw: ReturnType<typeof loadServiceWorker>,
  data: unknown
) {
  const pending: Array<Promise<unknown>> = []
  sw.handlers.notificationclick({
    notification: { data, close: vi.fn() },
    waitUntil: (p: Promise<unknown>) => pending.push(p),
  })
  await Promise.all(pending)
}

describe('service worker notificationclick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('開いているタブが無ければ既定の /landing を開く', async () => {
    const sw = loadServiceWorker()

    await clickNotification(sw, {})

    expect(sw.openWindow).toHaveBeenCalledWith('/landing')
  })

  it('自オリジンの相対URLはそのまま遷移先に使う', async () => {
    const sw = loadServiceWorker()

    await clickNotification(sw, { url: '/mypage?tab=reports' })

    expect(sw.openWindow).toHaveBeenCalledWith(`${ORIGIN}/mypage?tab=reports`)
  })

  it('外部オリジンのURLは無視して /landing にフォールバックする — 通知経由のフィッシング遷移を防ぐ回帰テスト', async () => {
    const sw = loadServiceWorker()

    await clickNotification(sw, { url: 'https://evil.example/phish' })

    expect(sw.openWindow).toHaveBeenCalledWith('/landing')
    expect(sw.openWindow).not.toHaveBeenCalledWith('https://evil.example/phish')
  })

  it('URLとして解釈できない値でも例外を投げず /landing にフォールバックする', async () => {
    const sw = loadServiceWorker()

    await clickNotification(sw, { url: 12345 })

    expect(sw.openWindow).toHaveBeenCalledWith('/landing')
  })

  it('既存タブがある場合も検証済みURLで navigate する', async () => {
    const sw = loadServiceWorker()
    const existing = { url: `${ORIGIN}/map`, navigate: sw.navigate, focus: sw.focus }
    sw.matchAll.mockResolvedValueOnce([existing])

    await clickNotification(sw, { url: 'https://evil.example/phish' })

    expect(sw.navigate).toHaveBeenCalledWith('/landing')
    expect(sw.focus).toHaveBeenCalled()
  })
})
