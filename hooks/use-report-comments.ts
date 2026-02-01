"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createBrowserClient } from "@supabase/ssr"

export interface ReportComment {
  id: string
  content: string
  created_at: string
  updated_at: string
  user_id: string
  report_id: string
  is_edited: boolean
  parent_comment_id: string | null
  profiles: {
    display_name: string | null
    email: string | null
  } | null
}

export function useReportComments(reportId: string) {
  const [comments, setComments] = useState<ReportComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabaseRef = useRef(
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  )
  const supabase = supabaseRef.current

  const fetchComments = useCallback(async () => {
    if (!reportId) {
      setComments([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from("report_comments")
        .select(
          `
          id,
          content,
          created_at,
          updated_at,
          user_id,
          report_id,
          is_edited,
          parent_comment_id,
          profiles:user_id (
            display_name,
            email
          )
        `
        )
        .eq("report_id", reportId)
        .order("created_at", { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      // Transform the data to match our interface
      // Supabase returns profiles as an array, but we expect a single object
      const transformedData = (data || []).map((comment: any) => ({
        ...comment,
        profiles: Array.isArray(comment.profiles)
          ? comment.profiles[0] || null
          : comment.profiles,
      })) as ReportComment[]

      setComments(transformedData)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "コメントの取得に失敗しました"
      )
    } finally {
      setIsLoading(false)
    }
  }, [reportId, supabase])

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
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setError("ログインが必要です")
          return false
        }

        const { error: insertError } = await supabase
          .from("report_comments")
          .insert({
            report_id: reportId,
            user_id: user.id,
            content: content.trim(),
          })

        if (insertError) {
          setError(insertError.message)
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
    [reportId, supabase, fetchComments]
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
