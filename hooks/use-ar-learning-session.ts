"use client"

import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import type { ARLearningTourStatus } from "@/lib/ar-learning-tour"

interface LearningSessionState {
  startedAt: string
  reviewedCount: number
  savedCount: number
  progress: Record<string, ARLearningTourStatus>
}

type LearningSessionAction =
  | { type: "hydrate"; state: LearningSessionState }
  | { type: "mark"; reportId: string; status: ARLearningTourStatus }
  | { type: "reset" }

interface UseARLearningSessionInput {
  routeId: string
  sessionId?: string
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
    startedAt: new Date().toISOString(),
    reviewedCount: 0,
    savedCount: 0,
    progress: {},
  }
}

function reducer(state: LearningSessionState, action: LearningSessionAction): LearningSessionState {
  switch (action.type) {
    case "hydrate":
      return action.state
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

export function useARLearningSession({ routeId, sessionId }: UseARLearningSessionInput) {
  const storageKey = useMemo(
    () => getARLearningSessionStorageKey(routeId, sessionId),
    [routeId, sessionId]
  )
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)
  const [hasHydrated, setHasHydrated] = useState(false)
  const hasLocalChangesRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    setHasHydrated(false)
    hasLocalChangesRef.current = false

    readSession(storageKey)
      .then((stored) => {
        if (!cancelled) {
          if (stored) {
            dispatch({ type: "hydrate", state: stored })
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
  }, [storageKey])

  useEffect(() => {
    if (!hasHydrated) return

    writeSession(storageKey, state).catch(() => {
      // Persistence is best-effort for the MVP.
    })
  }, [hasHydrated, state, storageKey])

  return {
    state,
    hasHydrated,
    markStop: (reportId: string, status: ARLearningTourStatus) => {
      hasLocalChangesRef.current = true
      dispatch({ type: "mark", reportId, status })
    },
    reset: () => {
      hasLocalChangesRef.current = true
      dispatch({ type: "reset" })
    },
  }
}
