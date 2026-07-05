"use client"

/**
 * use-news-read-state.ts
 *
 * 通学路の安全ニュースの既読管理と「見守り継続日数」（穏やかなストリーク）。
 * localStorage のみで完結し、90日超の既読記録は自動剪定する
 * （本体データの保持期間ポリシーと同期）。
 */

import { useCallback, useEffect, useState } from "react"
import { toJstDateKey } from "@/lib/school-route-news-feed"

const READ_STORAGE_KEY = "pathguardian:news_read_slugs"
const VISIT_STORAGE_KEY = "pathguardian:news_visit_streak"
const RETENTION_DAYS = 90

type ReadLog = Record<string, string> // slug -> 既読日時(ISO)

interface VisitStreak {
  lastVisit: string // JST暦日キー YYYY-MM-DD
  streak: number
}

export interface NewsReadState {
  /** localStorage読込完了前はfalse（SSR/初回描画のちらつき防止に使う） */
  hydrated: boolean
  readSlugs: ReadonlySet<string>
  isRead: (slug: string) => boolean
  markRead: (slug: string) => void
  /** 連続でフィードを開いた日数（今日を含む）。途切れても1から再開 */
  streakDays: number
}

function pruneOldEntries(log: ReadLog, now: number): ReadLog {
  const cutoff = now - RETENTION_DAYS * 24 * 60 * 60 * 1000
  return Object.fromEntries(
    Object.entries(log).filter(([, iso]) => {
      const time = new Date(iso).getTime()
      return !Number.isNaN(time) && time >= cutoff
    })
  )
}

function loadReadLog(): ReadLog {
  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return pruneOldEntries(parsed as ReadLog, Date.now())
  } catch {
    return {}
  }
}

function saveReadLog(log: ReadLog): void {
  try {
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(log))
  } catch {
    // localStorage不可の環境では既読はセッション内のみ保持する
  }
}

function previousDateKey(dateKey: string): string {
  const time = Date.parse(`${dateKey}T00:00:00Z`)
  if (Number.isNaN(time)) return ""
  return new Date(time - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function updateVisitStreak(today: string): number {
  let stored: VisitStreak | null = null
  try {
    const raw = window.localStorage.getItem(VISIT_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VisitStreak>
      if (typeof parsed.lastVisit === "string" && typeof parsed.streak === "number") {
        stored = { lastVisit: parsed.lastVisit, streak: parsed.streak }
      }
    }
  } catch {
    stored = null
  }

  const next: VisitStreak =
    stored?.lastVisit === today
      ? stored
      : stored?.lastVisit === previousDateKey(today)
        ? { lastVisit: today, streak: stored.streak + 1 }
        : { lastVisit: today, streak: 1 }

  try {
    window.localStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 保存に失敗しても表示用の値は返す
  }
  return next.streak
}

export function useNewsReadState(): NewsReadState {
  const [hydrated, setHydrated] = useState(false)
  const [readLog, setReadLog] = useState<ReadLog>({})
  const [streakDays, setStreakDays] = useState(1)

  useEffect(() => {
    const log = loadReadLog()
    setReadLog(log)
    saveReadLog(log)
    setStreakDays(updateVisitStreak(toJstDateKey(new Date())))
    setHydrated(true)
  }, [])

  const markRead = useCallback((slug: string) => {
    setReadLog((prev) => {
      if (prev[slug]) return prev
      const next = { ...prev, [slug]: new Date().toISOString() }
      saveReadLog(next)
      return next
    })
  }, [])

  const isRead = useCallback((slug: string) => Boolean(readLog[slug]), [readLog])

  return {
    hydrated,
    readSlugs: new Set(Object.keys(readLog)),
    isRead,
    markRead,
    streakDays,
  }
}
