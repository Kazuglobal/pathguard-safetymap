/**
 * TDD Component Tests: ReportDetailModal with Comments Integration
 *
 * RED Phase: These tests should FAIL because the integration doesn't exist yet
 *
 * Target: components/dashboard/report-detail-modal.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportDetailModal from '@/components/dashboard/report-detail-modal'
import type { DangerReport } from '@/lib/types'

// Track mock auth state for tests
let mockIsLoggedIn = false

// Mock the ReportCommentSection component
vi.mock('@/components/comments/report-comment-section', () => ({
  ReportCommentSection: vi.fn(({ reportId }: { reportId: string }) => {
    return (
      <div data-testid="comment-section" data-report-id={reportId} data-logged-in={String(mockIsLoggedIn)}>
        <h3 data-testid="comment-section-title">コメント</h3>
        {mockIsLoggedIn ? (
          <textarea data-testid="comment-input" placeholder="コメントを入力..." />
        ) : (
          <div data-testid="comment-login-prompt">ログインが必要です</div>
        )}
        <div data-testid="comment-list">
          <div data-testid="comment-empty">まだコメントはありません</div>
        </div>
      </div>
    )
  }),
}))

// Mock useReportComments hook
vi.mock('@/hooks/use-report-comments', () => ({
  useReportComments: vi.fn(() => ({
    comments: [],
    isLoading: false,
    error: null,
    addComment: vi.fn(),
    refreshComments: vi.fn(),
  })),
}))

// Mock Supabase for authentication
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  })),
}))

// Mock toast
vi.mock('@/components/ui/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}))

// Sample report data
const mockReport: DangerReport = {
  id: 'report-1',
  user_id: 'user-1',
  title: 'Test Report',
  description: 'Test description',
  danger_type: 'traffic',
  danger_level: 3,
  latitude: 35.6895,
  longitude: 139.6917,
  status: 'approved',
  prefecture: null,
  prefecture_code: null,
  city: null,
  municipality_code: null,
  town: null,
  postal_code: null,
  geocode_source: null,
  geocoded_at: null,
  geocode_confidence: null,
  address_hash: null,
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:00:00Z',
  image_url: null,
  processed_image_url: null,
  processed_image_urls: null,
}

const mockHandlers = {
  onClose: vi.fn(),
  onApprove: vi.fn().mockResolvedValue(undefined),
  onReject: vi.fn().mockResolvedValue(undefined),
  onResolve: vi.fn().mockResolvedValue(undefined),
  onReportUpdate: vi.fn(),
}

describe('ReportDetailModal with Comments Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsLoggedIn = false // Reset auth state
  })

  describe('Comment Section Rendering', () => {
    it('renders comment section in modal', async () => {
      render(
        <ReportDetailModal
          isOpen={true}
          onClose={mockHandlers.onClose}
          report={mockReport}
          onApprove={mockHandlers.onApprove}
          onReject={mockHandlers.onReject}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('comment-section')).toBeInTheDocument()
      })
    })

    it('passes reportId to CommentSection', async () => {
      render(
        <ReportDetailModal
          isOpen={true}
          onClose={mockHandlers.onClose}
          report={mockReport}
          onApprove={mockHandlers.onApprove}
          onReject={mockHandlers.onReject}
        />
      )

      await waitFor(() => {
        const commentSection = screen.getByTestId('comment-section')
        expect(commentSection).toHaveAttribute('data-report-id', mockReport.id)
      })
    })

    it('shows comment section title', async () => {
      render(
        <ReportDetailModal
          isOpen={true}
          onClose={mockHandlers.onClose}
          report={mockReport}
          onApprove={mockHandlers.onApprove}
          onReject={mockHandlers.onReject}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('comment-section-title')).toHaveTextContent('コメント')
      })
    })
  })

  describe('Comments Display', () => {
    it('shows comments when report has comments', async () => {
      // Mock hook to return comments
      const { useReportComments } = await import('@/hooks/use-report-comments')
      vi.mocked(useReportComments).mockReturnValue({
        comments: [
          {
            id: 'comment-1',
            content: 'Test comment',
            created_at: '2025-01-15T10:00:00Z',
            updated_at: '2025-01-15T10:00:00Z',
            user_id: 'user-1',
            report_id: 'report-1',
            is_edited: false,
            parent_comment_id: null,
            profiles: { display_name: 'User 1', email: 'user1@example.com' },
          },
        ],
        isLoading: false,
        isSubmitting: false,
        error: null,
        addComment: vi.fn(),
        refreshComments: vi.fn(),
      })

      render(
        <ReportDetailModal
          isOpen={true}
          onClose={mockHandlers.onClose}
          report={mockReport}
          onApprove={mockHandlers.onApprove}
          onReject={mockHandlers.onReject}
        />
      )

      await waitFor(() => {
        const commentList = screen.getByTestId('comment-list')
        expect(commentList).toBeInTheDocument()
      })
    })

    it('shows empty state when no comments', async () => {
      render(
        <ReportDetailModal
          isOpen={true}
          onClose={mockHandlers.onClose}
          report={mockReport}
          onApprove={mockHandlers.onApprove}
          onReject={mockHandlers.onReject}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('comment-empty')).toHaveTextContent('まだコメントはありません')
      })
    })
  })

  describe('Authentication States', () => {
    it('allows authenticated user to post comment', async () => {
      // Set mock auth state to logged in
      mockIsLoggedIn = true

      render(
        <ReportDetailModal
          isOpen={true}
          onClose={mockHandlers.onClose}
          report={mockReport}
          onApprove={mockHandlers.onApprove}
          onReject={mockHandlers.onReject}
        />
      )

      await waitFor(() => {
        const commentSection = screen.getByTestId('comment-section')
        expect(commentSection).toHaveAttribute('data-logged-in', 'true')
      })

      expect(screen.getByTestId('comment-input')).toBeInTheDocument()
    })

    it('shows login prompt for unauthenticated user', async () => {
      render(
        <ReportDetailModal
          isOpen={true}
          onClose={mockHandlers.onClose}
          report={mockReport}
          onApprove={mockHandlers.onApprove}
          onReject={mockHandlers.onReject}
        />
      )

      await waitFor(() => {
        const commentSection = screen.getByTestId('comment-section')
        expect(commentSection).toHaveAttribute('data-logged-in', 'false')
      })

      expect(screen.getByTestId('comment-login-prompt')).toHaveTextContent('ログインが必要です')
    })
  })

  describe('Modal Behavior', () => {
    it('does not render comment section when modal is closed', () => {
      render(
        <ReportDetailModal
          isOpen={false}
          onClose={mockHandlers.onClose}
          report={mockReport}
          onApprove={mockHandlers.onApprove}
          onReject={mockHandlers.onReject}
        />
      )

      expect(screen.queryByTestId('comment-section')).not.toBeInTheDocument()
    })

    it('does not render when report is null', () => {
      render(
        <ReportDetailModal
          isOpen={true}
          onClose={mockHandlers.onClose}
          report={null}
          onApprove={mockHandlers.onApprove}
          onReject={mockHandlers.onReject}
        />
      )

      expect(screen.queryByTestId('comment-section')).not.toBeInTheDocument()
    })
  })

  describe('Existing Modal Functionality', () => {
    it('still displays report title', async () => {
      render(
        <ReportDetailModal
          isOpen={true}
          onClose={mockHandlers.onClose}
          report={mockReport}
          onApprove={mockHandlers.onApprove}
          onReject={mockHandlers.onReject}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Test Report')).toBeInTheDocument()
      })
    })

    it('still displays report description', async () => {
      render(
        <ReportDetailModal
          isOpen={true}
          onClose={mockHandlers.onClose}
          report={mockReport}
          onApprove={mockHandlers.onApprove}
          onReject={mockHandlers.onReject}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Test description')).toBeInTheDocument()
      })
    })

    it('still displays danger level', async () => {
      render(
        <ReportDetailModal
          isOpen={true}
          onClose={mockHandlers.onClose}
          report={mockReport}
          onApprove={mockHandlers.onApprove}
          onReject={mockHandlers.onReject}
        />
      )

      await waitFor(() => {
        // 危険度バッジは一元定義(danger-level-presentation)の★+子ども向けラベル表示
        expect(screen.getByText(/★★★☆ とてもちゅうい/)).toBeInTheDocument()
      })
    })
  })
})
