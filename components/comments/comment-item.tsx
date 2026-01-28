"use client"

import { Badge } from "@/components/ui/badge"
import { ShieldCheck } from "lucide-react"

export interface Comment {
  id: string
  content: string
  created_at: string
  is_official: boolean
  user_id: string
  spot_id?: string
  profiles?: {
    display_name?: string
    email?: string
  } | null
}

interface CommentItemProps {
  comment: Comment
}

export function CommentItem({ comment }: CommentItemProps) {
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return "たった今"
    if (diffMins < 60) return `${diffMins}分前`
    if (diffHours < 24) return `${diffHours}時間前`
    if (diffDays < 7) return `${diffDays}日前`
    return date.toLocaleDateString("ja-JP")
  }

  const getAuthorName = () => {
    if (comment.profiles?.display_name) {
      return comment.profiles.display_name
    }
    if (comment.profiles?.email) {
      return comment.profiles.email.split("@")[0]
    }
    return "匿名ユーザー"
  }

  return (
    <div
      className={`rounded-lg border p-4 ${
        comment.is_official
          ? "border-blue-200 bg-blue-50"
          : "border-gray-200 bg-white"
      }`}
      data-testid="comment-item"
      data-official={comment.is_official}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-medium text-gray-900"
            data-testid="comment-author"
          >
            {getAuthorName()}
          </span>
          {comment.is_official && (
            <Badge
              variant="secondary"
              className="bg-blue-100 text-blue-700"
              data-testid="official-badge"
            >
              <ShieldCheck className="mr-1 h-3 w-3" />
              公式
            </Badge>
          )}
        </div>
        <span
          className="text-xs text-gray-500"
          data-testid="comment-timestamp"
        >
          {formatTimestamp(comment.created_at)}
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
