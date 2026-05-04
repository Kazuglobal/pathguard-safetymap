"use client"

import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import type { KidsChecklistItem, KidsQuizAnswers } from "@/lib/ar-learning-quiz"
import type { ARLearningTourStatus } from "@/lib/ar-learning-tour"

interface LearningSessionState {
  schemaVersion: 1
  startedAt: string
  completedAt: string | null
  reviewedCount: number
  savedCount: number
  progress: Record<string, ARLearningTourStatus>
  checklist: KidsChecklistItem[]
  quizAnswers: KidsQuizAnswers
  quizScore: number
  quizTotal: number
  quizCompletedAt: string | null
}

type LearningSessionAction =
  | { type: "hydrate"; state: LearningSessionState }
  | { type: "mark"; reportId: string; status: ARLearningTourStatus }
  | { type: "set_checklist"; checklist: KidsChecklistItem[] }
  | { type: "toggle_checklist"; itemId: string; checked: boolean }
  | { type: "complete_quiz"; answers: KidsQuizAnswers; score: number; total: number }
  | { type: "reset" }

interface UseARLearningSessionInput {
  routeId: string
  sessionId?: string
  enabled?: boolean
}

const DB_NAME = "pathguardian-ar-learning"
const STORE_NAME = "sessions"
export const ACTIVE_AR_LEARNING_SESSION_ID = "active"

export function getARLearningSessionStorageKey(
  routeId: string,
  sessionId: string = ACTIVE_AR_LEARNING_SESSION_ID
): string {
  return `route-learning:${routeId}:${sessionId}`
}

function createInitialState(): LearningSessionState {
  return {
    schemaVersion: 1,
    startedAt: new Date().toISOString(),
    completedAt: null,
    reviewedCount: 0,
    savedCount: 0,
    progress: {},
    checklist: [],
    quizAnswers: {},
    quizScore: 0,
    quizTotal: 0,
    quizCompletedAt: null,
  }
}

function normalizeSessionState(state: Partial<LearningSessionState>): LearningSessionState {
  const progress = state.progress ?? {}

  return {
    schemaVersion: 1,
    startedAt: state.startedAt ?? new Date().toISOString(),
    completedAt: state.completedAt ?? null,
    reviewedCount:
      typeof state.reviewedCount === "number"
        ? state.reviewedCount
        : Object.values(progress).filter((status) => status === "reviewed").length,
    savedCount:
      typeof state.savedCount === "number"
        ? state.savedCount
        : Object.values(progress).filter((status) => status === "saved").length,
    progress,
    checklist: state.checklist ?? [],
    quizAnswers: state.quizAnswers ?? {},
    quizScore: state.quizScore ?? 0,
    quizTotal: state.quizTotal ?? 0,
    quizCompletedAt: state.quizCompletedAt ?? null,
  }
}

function reducer(state: LearningSessionState, action: LearningSessionAction): LearningSessionState {
  switch (action.type) {
    case "hydrate":
      return normalizeSessionState(action.state)
    case "mark": {
      const progress = {
        ...state.progress,
        [action.reportId]: action.status,
      }
      return {
        ...state,
        progress,
        reviewedCount: Object.values(progress).filter((status) => status === "reviewed").length,
        savedCount: Object.values(progress).filter((status) => status === "saved").length,
      }
    }
    case "set_checklist":
      return {
        ...state,
        checklist: action.checklist,
      }
    case "toggle_checklist":
      return {
        ...state,
        checklist: state.checklist.map((item) =>
          item.id === action.itemId ? { ...item, checked: action.checked } : item
        ),
      }
    case "complete_quiz":
      return {
        ...state,
        completedAt: state.completedAt ?? new Date().toISOString(),
        quizAnswers: action.answers,
        quizScore: action.score,
        quizTotal: action.total,
        quizCompletedAt: new Date().toISOString(),
      }
    case "reset":
      return createInitialState()
    default:
      return state
  }
}

function openSessionDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readSession(key: string): Promise<LearningSessionState | null> {
  if (typeof window === "undefined") return null

  if (!window.indexedDB) {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) : null
  }

  const db = await openSessionDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly")
    const request = transaction.objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve((request.result as LearningSessionState | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
}

async function writeSession(key: string, state: LearningSessionState): Promise<void> {
  if (typeof window === "undefined") return

  if (!window.indexedDB) {
    window.localStorage.setItem(key, JSON.stringify(state))
    return
  }

  const db = await openSessionDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    const request = transaction.objectStore(STORE_NAME).put(state, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export function useARLearningSession({ routeId, sessionId, enabled = true }: UseARLearningSessionInput) {
  const storageKey = useMemo(
    () => getARLearningSessionStorageKey(routeId, sessionId),
    [routeId, sessionId]
  )
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)
  const [hasHydrated, setHasHydrated] = useState(false)
  const hasLocalChangesRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      setHasHydrated(false)
      hasLocalChangesRef.current = false
      return
    }

    let cancelled = false
    setHasHydrated(false)
    hasLocalChangesRef.current = false

    readSession(storageKey)
      .then((stored) => {
        if (!cancelled) {
          if (stored) {
            dispatch({ type: "hydrate", state: normalizeSessionState(stored) })
          } else if (!hasLocalChangesRef.current) {
            dispatch({ type: "hydrate", state: createInitialState() })
          }
          setHasHydrated(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (!hasLocalChangesRef.current) {
            dispatch({ type: "hydrate", state: createInitialState() })
          }
          setHasHydrated(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled, storageKey])

  useEffect(() => {
    if (!enabled || !hasHydrated) return

    writeSession(storageKey, state).catch(() => {
      // Persistence is best-effort for the MVP.
    })
  }, [enabled, hasHydrated, state, storageKey])

  return {
    state,
    hasHydrated,
    markStop: (reportId: string, status: ARLearningTourStatus) => {
      hasLocalChangesRef.current = true
      dispatch({ type: "mark", reportId, status })
    },
    setChecklist: (checklist: KidsChecklistItem[]) => {
      hasLocalChangesRef.current = true
      dispatch({ type: "set_checklist", checklist })
    },
    toggleChecklistItem: (itemId: string, checked: boolean) => {
      hasLocalChangesRef.current = true
      dispatch({ type: "toggle_checklist", itemId, checked })
    },
    completeQuiz: (answers: KidsQuizAnswers, score: number, total: number) => {
      hasLocalChangesRef.current = true
      dispatch({ type: "complete_quiz", answers, score, total })
    },
    reset: () => {
      hasLocalChangesRef.current = true
      dispatch({ type: "reset" })
    },
  }
}
