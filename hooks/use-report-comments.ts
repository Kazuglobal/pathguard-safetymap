"use client"

import { useState, useEffect, useCallback } from "react"

export interface ReportComment {
  id: string
  content: string
  created_at: string
  updated_at: string
  user_id: string | null
  report_id: string
  is_edited: boolean
  parent_comment_id: string | null
  profiles: {
    display_name: string | null
    email?: string | null
  } | null
}

export function useReportComments(reportId: string) {
  const [comments, setComments] = useState<ReportComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchComments = useCallback(async () => {
    if (!reportId) {
      setComments([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/comments`, {
        credentials: "same-origin",
      })
      if (!response.ok) {
        setError(`コメントの取得に失敗しました (${response.status})`)
        return
      }
      const payload = await response.json() as { comments?: ReportComment[] }
      setComments(payload.comments ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "コメントの取得に失敗しました"
      )
    } finally {
      setIsLoading(false)
    }
  }, [reportId])

  const addComment = useCallback(
    async (content: string) => {
      if (!content.trim()) {
        setError("コメントを入力してください")
        return false
      }

      if (content.length > 1000) {
        setError("コメントは1000文字以内で入力してください")
        return false
      }

      setIsSubmitting(true)
      setError(null)

      try {
        const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ content: content.trim() }),
        })
        if (!response.ok) {
          setError(response.status === 401 ? "ログインが必要です" : "コメントの投稿に失敗しました")
          return false
        }

        // Refresh comments after adding
        await fetchComments()
        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "コメントの投稿に失敗しました"
        )
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [reportId, fetchComments]
  )

  const refreshComments = useCallback(() => {
    return fetchComments()
  }, [fetchComments])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  return {
    comments,
    isLoading,
    error,
    isSubmitting,
    addComment,
    refreshComments,
  }
}
