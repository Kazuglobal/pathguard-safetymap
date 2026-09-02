import { NextResponse } from 'next/server'

import { AuthzError } from '@/lib/db/authz'

export function requiredNumber(params: URLSearchParams, name: string): number {
  const raw = params.get(name)
  if (raw == null || raw.trim() === '') throw new RangeError(`${name} is required`)
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`)
  return value
}

export function optionalNumber(params: URLSearchParams, name: string): number | undefined {
  const raw = params.get(name)
  if (raw == null || raw.trim() === '') return undefined
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`)
  return value
}

export function trueOrNull(params: URLSearchParams, name: string): boolean | null {
  return params.get(name) === 'true' ? true : null
}

export function routeError(error: unknown): NextResponse {
  if (error instanceof RangeError) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (error instanceof AuthzError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error('Traffic accident route failed:', error)
  return NextResponse.json({ error: '事故データの取得に失敗しました' }, { status: 500 })
}
