"use client"

import { useEffect } from "react"

// アプリ起動時に Service Worker を冪等登録する。
// 従来は購読ボタン押下時(use-push-subscription の subscribe)にしか登録されず、
// 未購読ユーザーは navigator.serviceWorker.ready が永久に解決しないため
// 通知許可プロンプトが一度も表示されなかった(state が 'loading' のまま固定)。
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[sw] register error", err)
    })
  }, [])

  return null
}
