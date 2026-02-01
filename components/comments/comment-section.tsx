"use client"

import { useState, useEffect, useCallback } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CommentItem, type Comment } from "./comment-item"
import { MessageCircle, Send, Loader2 } from "lucide-react"
import Link from "next/link"

interface CommentSectionProps {
  spotId: string
  isLoggedIn?: boolean
}

const MAX_COMMENT_LENGTH = 1000

export function CommentSection({ spotId, isLoggedIn = false }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchComments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from("comments")
        .select(
          `
          id,
          content,
          created_at,
          is_official,
          user_id,
          spot_id,
          profiles:user_id (
            display_name,
            email
          )
        `
        )
        .eq("spot_id", spotId)
        .order("created_at", { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setComments(data || [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "コメントの取得に失敗しました"
      )
    } finally {
      setIsLoading(false)
    }
  }, [spotId, supabase])

  useEffect(() => {
    if (spotId) {
      fetchComments()
    }
  }, [spotId, fetchComments])

  const handleSubmit = async () => {
    if (!newComment.trim()) {
      setError("コメントを入力してください")
      return
    }

    if (newComment.length > MAX_COMMENT_LENGTH) {
      setError(`コメントは${MAX_COMMENT_LENGTH}文字以内で入力してください`)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("ログインが必要です")
        return
      }

      const { error: insertError } = await supabase.from("comments").insert({
        spot_id: spotId,
        user_id: user.id,
        content: newComment.trim(),
        is_official: false,
      })

      if (insertError) {
        setError(insertError.message)
        return
      }

      setNewComment("")
      await fetchComments()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "コメントの投稿に失敗しました"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-4" data-testid="comment-section">
      <h3
        className="flex items-center gap-2 text-lg font-semibold text-gray-900"
        data-testid="comment-section-title"
      >
        <MessageCircle className="h-5 w-5" />
        コメント
        {comments.length > 0 && (
          <span className="text-sm font-normal text-gray-500">
            ({comments.length}件)
          </span>
        )}
      </h3>

      {error && (
        <Alert variant="destructive" data-testid="comment-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Comment input */}
      {isLoggedIn ? (
        <div className="space-y-2">
          <Textarea
            placeholder="コメントを入力... (Ctrl+Enter で送信)"
            value={newComment}
            onChange={(e) => {
              setNewComment(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
            className="min-h-[80px] resize-none"
            data-testid="comment-input"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {newComment.length}/{MAX_COMMENT_LENGTH}
            </span>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !newComment.trim()}
              size="sm"
              data-testid="comment-submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  送信中...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  送信
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center"
          data-testid="comment-login-prompt"
        >
          <p className="text-sm text-gray-600">
            コメントを投稿するには{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              ログイン
            </Link>{" "}
            が必要です
          </p>
        </div>
      )}

      {/* Comment list */}
      <div className="space-y-3" data-testid="comment-list">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : comments.length === 0 ? (
          <div
            className="py-8 text-center text-sm text-gray-500"
            data-testid="comment-empty"
          >
            まだコメントはありません
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  )
}
