import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useReportComments } from '@/hooks/use-report-comments'

const mocks = vi.hoisted(() => ({
  useSupabase: vi.fn(),
}))

vi.mock('@/components/providers/supabase-provider', () => ({
  useSupabase: mocks.useSupabase,
}))

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
}

const mockComments = [
  {
    id: 'comment-1',
    content: 'Test comment 1',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
    user_id: 'user-1',
    report_id: 'report-1',
    is_edited: false,
    parent_comment_id: null,
    profiles: {
      display_name: 'Test User 1',
    },
  },
  {
    id: 'comment-2',
    content: 'Test comment 2',
    created_at: '2025-01-15T11:00:00Z',
    updated_at: '2025-01-15T11:00:00Z',
    user_id: 'user-2',
    report_id: 'report-1',
    is_edited: false,
    parent_comment_id: null,
    profiles: {
      display_name: 'Test User 2',
    },
  },
]

function createSupabaseMock(options?: {
  comments?: unknown[]
  fetchError?: { message: string } | null
  user?: typeof mockUser | null
  insertError?: { message: string } | null
  onFetch?: () => void
}) {
  const order = vi.fn(() => {
    options?.onFetch?.()
    return Promise.resolve({
      data: options?.comments ?? [],
      error: options?.fetchError ?? null,
    })
  })
  const eq = vi.fn(() => ({ order }))
  const select = vi.fn(() => ({ eq }))
  const insert = vi.fn(() =>
    Promise.resolve({
      error: options?.insertError ?? null,
    })
  )
  const from = vi.fn(() => ({ select, insert }))
  const getUser = vi.fn(() =>
    Promise.resolve({ data: { user: options?.user ?? null }, error: null })
  )

  return {
    supabase: {
      from,
      auth: { getUser },
    },
    spies: {
      from,
      select,
      eq,
      order,
      insert,
      getUser,
    },
  }
}

describe('useReportComments Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const { supabase } = createSupabaseMock()
    mocks.useSupabase.mockReturnValue({ supabase })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Initial State', () => {
    it('returns empty array when no comments', async () => {
      const { result } = renderHook(() => useReportComments('report-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.comments).toEqual([])
    })

    it('returns loading state initially', async () => {
      const { result } = renderHook(() => useReportComments('report-1'))

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('Fetching Comments', () => {
    it('fetches comments for a report', async () => {
      const { supabase } = createSupabaseMock({ comments: mockComments })
      mocks.useSupabase.mockReturnValue({ supabase })

      const { result } = renderHook(() => useReportComments('report-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.comments).toHaveLength(2)
      expect(result.current.comments[0].content).toBe('Test comment 1')
    })

    it('handles error when fetch fails', async () => {
      const { supabase } = createSupabaseMock({
        fetchError: { message: 'Database error' },
      })
      mocks.useSupabase.mockReturnValue({ supabase })

      const { result } = renderHook(() => useReportComments('report-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toContain('Database error')
    })
  })

  describe('Adding Comments', () => {
    it('addComment adds new comment', async () => {
      const { supabase, spies } = createSupabaseMock({ user: mockUser })
      mocks.useSupabase.mockReturnValue({ supabase })

      const { result } = renderHook(() => useReportComments('report-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        const success = await result.current.addComment('New test comment')
        expect(success).toBe(true)
      })

      expect(spies.from).toHaveBeenCalledWith('report_comments')
      expect(spies.insert).toHaveBeenCalledWith({
        report_id: 'report-1',
        user_id: mockUser.id,
        content: 'New test comment',
      })
    })

    it('addComment requires authentication', async () => {
      const { supabase } = createSupabaseMock({ user: null })
      mocks.useSupabase.mockReturnValue({ supabase })

      const { result } = renderHook(() => useReportComments('report-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        const success = await result.current.addComment('Test comment')
        expect(success).toBe(false)
      })

      expect(result.current.error).toContain('ログイン')
    })

    it('refreshes comments after adding', async () => {
      let fetchCount = 0
      const { supabase } = createSupabaseMock({
        user: mockUser,
        onFetch: () => {
          fetchCount += 1
        },
      })
      mocks.useSupabase.mockReturnValue({ supabase })

      const { result } = renderHook(() => useReportComments('report-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const initialFetchCount = fetchCount

      await act(async () => {
        await result.current.addComment('New comment')
      })

      expect(fetchCount).toBeGreaterThan(initialFetchCount)
    })
  })

  describe('Hook Return Values', () => {
    it('returns expected shape', async () => {
      const { result } = renderHook(() => useReportComments('report-1'))

      expect(result.current).toHaveProperty('comments')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('isSubmitting')
      expect(result.current).toHaveProperty('addComment')
      expect(result.current).toHaveProperty('refreshComments')

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('mutation functions are callable', async () => {
      const { result } = renderHook(() => useReportComments('report-1'))

      expect(typeof result.current.addComment).toBe('function')
      expect(typeof result.current.refreshComments).toBe('function')

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('Report ID Validation', () => {
    it('does not fetch if reportId is empty', async () => {
      const { supabase, spies } = createSupabaseMock()
      mocks.useSupabase.mockReturnValue({ supabase })

      const { result } = renderHook(() => useReportComments(''))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(spies.from).not.toHaveBeenCalled()
    })

    it('refetches when reportId changes', async () => {
      let fetchCount = 0
      const { supabase } = createSupabaseMock({
        onFetch: () => {
          fetchCount += 1
        },
      })
      mocks.useSupabase.mockReturnValue({ supabase })

      const { result, rerender } = renderHook(
        ({ reportId }) => useReportComments(reportId),
        { initialProps: { reportId: 'report-1' } }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const countAfterFirstFetch = fetchCount

      rerender({ reportId: 'report-2' })

      await waitFor(() => {
        expect(fetchCount).toBeGreaterThan(countAfterFirstFetch)
      })
    })
  })
})
