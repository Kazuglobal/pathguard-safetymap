'use client'

export async function routeRequest(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store',
  })
  const data = await response.json().catch(() => { throw new Error('通信結果を確認できません。もう一度お試しください。') })
  if (!response.ok) throw new Error(data.error ?? '通信に失敗しました。')
  return data
}
