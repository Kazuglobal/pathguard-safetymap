"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MessageCircle, Send, Loader2 } from "lucide-react"
import Link from "next/link"
import { useReportComments, type ReportComment } from "@/hooks/use-report-comments"
import { formatRelativeTimestamp, getAuthorDisplayName } from "@/lib/comment-utils"

interface ReportCommentSectionProps {
  reportId: string
}

const MAX_COMMENT_LENGTH = 1000

function ReportCommentItem({ comment }: { comment: ReportComment }) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-4"
      data-testid="comment-item"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-medium text-gray-900"
            data-testid="comment-author"
          >
            {getAuthorDisplayName(comment.profiles)}
          </span>
          {comment.is_edited && (
            <span className="text-xs text-gray-400">(編集済み)</span>
          )}
        </div>
        <span
          className="text-xs text-gray-500"
          data-testid="comment-timestamp"
        >
          {formatRelativeTimestamp(comment.created_at)}
        </span>
      </div>
      <p
        className="mt-2 text-sm text-gray-700 whitespace-pre-wrap"
        data-testid="comment-content"
      >
        {comment.content}
      </p>
    </div>
  )
}

export function ReportCommentSection({ reportId }: ReportCommentSectionProps) {
  const [newComment, setNewComment] = useState("")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  const {
    comments,
    isLoading,
    error,
    isSubmitting,
    addComment,
  } = useReportComments(reportId)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setIsLoggedIn(!!user)
      } catch {
        setIsLoggedIn(false)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session?.user)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleSubmit = async () => {
    if (!newComment.trim()) return

    const success = await addComment(newComment)
    if (success) {
      setNewComment("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className="space-y-4"
      data-testid="comment-section"
      data-report-id={reportId}
      data-logged-in={isLoggedIn}
    >
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
      {isCheckingAuth ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : isLoggedIn ? (
        <div className="space-y-2">
          <Textarea
            placeholder="コメントを入力... (Ctrl+Enter で送信)"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
            className="min-h-[80px] resize-none"
            data-testid="comment-input"
            maxLength={MAX_COMMENT_LENGTH}
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
            <ReportCommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  )
}
