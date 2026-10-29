// PathGuardian Service Worker
// Web Push API 受信 + 通知クリック処理

// 有効化後、既に開いているタブも即座に制御下へ置く。
// claim しないと初回登録セッションのタブが未制御のままになり、
// notificationclick の WindowClient.navigate() が TypeError で reject する
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Android Chrome の PWA インストール可能要件(fetchハンドラを持つSW)を満たすための
// パススルー。respondWith を呼ばないためネットワーク挙動は一切変えない。
// オフライン対応(キャッシュ戦略)は別施策(成長ギャップ分析 B-3)で実装する
self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: '通知', body: event.data.text() }
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    // badge はモノクロ想定のためカラーアイコンを流用しない
    badge: '/badge-96.png',
    tag: data.tag || 'pathguardian',
    data: data.data || {},
    requireInteraction: data.data?.type === 'danger_reports',
  }

  event.waitUntil(
    self.registration.showNotification(data.title || '通知', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // 既定の遷移先は manifest の start_url と同じ /landing。
  // '/' は製品紹介LPへ強制リダイレクトされるため使わない
  const url = event.notification.data?.url ?? '/landing'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const existing = clientList.find((c) =>
          c.url.startsWith(self.location.origin)
        )
        if (existing) {
          // 未制御クライアントへの navigate() は reject するため、
          // 失敗時は新規ウィンドウで開き直す
          return existing
            .navigate(url)
            .then((navigated) => (navigated ?? existing).focus())
            .catch(() => clients.openWindow(url))
        }
        return clients.openWindow(url)
      })
  )
})
