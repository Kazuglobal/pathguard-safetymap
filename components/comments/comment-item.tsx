"use client"

import { Badge } from "@/components/ui/badge"
import { ShieldCheck } from "lucide-react"
import { formatRelativeTimestamp, getAuthorDisplayName } from "@/lib/comment-utils"

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
            {getAuthorDisplayName(comment.profiles)}
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
