"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageCircle, Send, User } from "lucide-react"

interface Comment {
  id: string
  author: string
  content: string
  createdAt: string
}

interface CommentSectionProps {
  spotId: string
  isLoggedIn: boolean
}

export function CommentSection({ spotId, isLoggedIn }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!newComment.trim() || !isLoggedIn) return

    setIsSubmitting(true)

    // Add comment locally (in a real app, this would save to the database)
    const comment: Comment = {
      id: `${spotId}-${Date.now()}`,
      author: "あなた",
      content: newComment.trim(),
      createdAt: new Date().toISOString(),
    }

    setComments((prev) => [comment, ...prev])
    setNewComment("")
    setIsSubmitting(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-700">
        <MessageCircle className="h-5 w-5" />
        <h3 className="font-semibold">コメント</h3>
        {comments.length > 0 && (
          <span className="text-sm text-slate-500">({comments.length})</span>
        )}
      </div>

      {isLoggedIn ? (
        <div className="space-y-2">
          <Textarea
            placeholder="コメントを入力..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] resize-none"
            disabled={isSubmitting}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!newComment.trim() || isSubmitting}
            >
              <Send className="mr-1.5 h-4 w-4" />
              送信
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
          コメントを投稿するには
          <a href="/login" className="mx-1 text-sky-600 hover:underline">
            ログイン
          </a>
          してください。
        </div>
      )}

      {comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                  <User className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {comment.author}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(comment.createdAt)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500 py-4">
          まだコメントはありません。最初のコメントを投稿しましょう!
        </p>
      )}
    </div>
  )
}
