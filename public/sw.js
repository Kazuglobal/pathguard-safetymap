// PathGuardian Service Worker
// Web Push API 受信 + 通知クリック処理

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
    icon: data.icon || '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
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

  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const existing = clientList.find((c) =>
          c.url.startsWith(self.location.origin)
        )
        if (existing) {
          existing.navigate(url)
          return existing.focus()
        }
        return clients.openWindow(url)
      })
  )
})
