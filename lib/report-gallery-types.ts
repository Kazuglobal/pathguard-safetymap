/**
 * Report Gallery & Social Feed Types
 * 危険報告ギャラリーと共有フィードの型定義
 */

// ============================================================================
// Basic Types
// ============================================================================

export type SharePlatform = 'twitter' | 'facebook' | 'line' | 'clipboard' | 'other'

export type NotificationType = 'like' | 'comment' | 'share' | 'bookmark'

// ============================================================================
// Database Tables
// ============================================================================

export interface ReportBookmark {
  id: string
  user_id: string
  report_id: string
  created_at: string
}

export interface ReportLike {
  id: string
  user_id: string
  report_id: string
  created_at: string
}

export interface ReportComment {
  id: string
  user_id: string
  report_id: string
  content: string
  parent_comment_id: string | null
  is_edited: boolean
  created_at: string
  updated_at: string
}

export interface ReportShare {
  id: string
  user_id: string | null
  report_id: string
  platform: SharePlatform
  created_at: string
}

export interface ReportNotification {
  id: string
  user_id: string
  report_id: string
  notification_type: NotificationType
  actor_user_id: string | null
  is_read: boolean
  created_at: string
}

// ============================================================================
// Statistics & Views
// ============================================================================

export interface ReportStats {
  report_id: string
  danger_type: string
  danger_level: number
  status: string
  created_at: string
  likes_count: number
  bookmarks_count: number
  comments_count: number
  shares_count: number
}

export interface DangerCategoryStats {
  danger_type: string
  total_reports: number
  weekly_reports: number
  monthly_reports: number
  avg_danger_level: number
  latest_report_at: string
  unique_likers: number
  unique_bookmarkers: number
  unique_commenters: number
}

export interface UserReportActivity {
  user_id: string
  reports_created: number
  likes_given: number
  bookmarks_created: number
  comments_posted: number
  shares_made: number
  last_activity_at: string
}

// ============================================================================
// Extended Types (with relations)
// ============================================================================

export interface ReportWithStats extends DangerReport {
  likes_count: number
  bookmarks_count: number
  comments_count: number
  shares_count: number
}

export interface CommentWithUser extends ReportComment {
  user?: {
    id: string
    email?: string
    user_metadata?: {
      full_name?: string
      avatar_url?: string
    }
  }
  replies?: CommentWithUser[]
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface CreateCommentRequest {
  report_id: string
  content: string
  parent_comment_id?: string | null
}

export interface UpdateCommentRequest {
  content: string
}

export interface CreateShareRequest {
  report_id: string
  platform: SharePlatform
}

export interface BookmarkResponse {
  isBookmarked: boolean
}

export interface LikeResponse {
  isLiked: boolean
}

// ============================================================================
// Function Response Types
// ============================================================================

export interface BookmarkedReport {
  id: string
  title: string
  description: string | null
  latitude: number
  longitude: number
  danger_type: string
  danger_level: number
  image_url: string | null
  created_at: string
  bookmarked_at: string
}

export interface TrendingReport {
  id: string
  title: string
  description: string | null
  latitude: number
  longitude: number
  danger_type: string
  danger_level: number
  image_url: string | null
  created_at: string
  engagement_score: number
}

// ============================================================================
// UI State Types
// ============================================================================

export interface ShareActionState {
  hasLiked: boolean
  hasBookmarked: boolean
  likesCount: number
  bookmarksCount: number
  commentsCount: number
  sharesCount: number
}

export interface CommentFormState {
  content: string
  parentCommentId: string | null
  isSubmitting: boolean
  error: string | null
}

// ============================================================================
// Filter & Sort Types
// ============================================================================

export interface ReportGalleryFilter {
  dangerType?: string
  dangerLevel?: number
  dateRange?: 'day' | 'week' | 'month' | 'all'
  hasImage?: boolean
  minEngagement?: number
}

export type ReportSortBy =
  | 'newest'
  | 'oldest'
  | 'most_liked'
  | 'most_commented'
  | 'most_shared'
  | 'trending'

export interface ReportGalleryOptions {
  filter?: ReportGalleryFilter
  sortBy?: ReportSortBy
  limit?: number
  offset?: number
}

// ============================================================================
// Supabase RPC Types
// ============================================================================

export interface ToggleBookmarkParams {
  p_user_id: string
  p_report_id: string
}

export interface ToggleLikeParams {
  p_user_id: string
  p_report_id: string
}

export interface GetTrendingReportsParams {
  p_limit?: number
  p_days?: number
}

export interface GetUserBookmarkedReportsParams {
  p_user_id: string
}

export interface GetReportCommentsParams {
  p_report_id: string
}

// ============================================================================
// Utility Types
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface SocialMetrics {
  likes: number
  bookmarks: number
  comments: number
  shares: number
  engagementRate: number
}

// ============================================================================
// Re-export DangerReport from types.ts for convenience
// ============================================================================

import type { DangerReport } from './types'
export type { DangerReport }
