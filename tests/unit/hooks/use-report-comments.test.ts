/**
 * TDD Unit Tests: useReportComments Hook
 *
 * RED Phase: These tests should FAIL because the hook doesn't exist yet
 *
 * Target: hooks/use-report-comments.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useReportComments } from '@/hooks/use-report-comments'

// Mock Supabase client
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  })),
}))

// Mock user for authenticated tests
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
}

// Mock comment data
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
      email: 'user1@example.com',
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
      email: 'user2@example.com',
    },
  },
]

describe('useReportComments Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    it('returns loading state initially', () => {
      const { result } = renderHook(() => useReportComments('report-1'))

      expect(result.current.isLoading).toBe(true)
    })
  })

  describe('Fetching Comments', () => {
    it('fetches comments for a report', async () => {
      // Mock successful fetch
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockComments, error: null })),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useReportComments('report-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.comments).toHaveLength(2)
      expect(result.current.comments[0].content).toBe('Test comment 1')
    })

    it('handles error when fetch fails', async () => {
      // Mock failed fetch
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({
                data: null,
                error: { message: 'Database error' }
              })),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useReportComments('report-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.error).toContain('error')
    })
  })

  describe('Adding Comments', () => {
    it('addComment adds new comment', async () => {
      // Mock authenticated user
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          insert: vi.fn(() => Promise.resolve({ data: { id: 'new-comment' }, error: null })),
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useReportComments('report-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.addComment('New test comment')
      })

      // After adding, the hook should have called insert
      expect(mockSupabase.from).toHaveBeenCalledWith('report_comments')
    })

    it('addComment requires authentication', async () => {
      // Mock unauthenticated user
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useReportComments('report-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.addComment('Test comment')
      })

      // Should have an authentication error
      expect(result.current.error).toContain('ログイン')
    })

    it('refreshes comments after adding', async () => {
      let fetchCount = 0
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => {
                fetchCount++
                return Promise.resolve({ data: [], error: null })
              }),
            })),
          })),
          insert: vi.fn(() => Promise.resolve({ data: { id: 'new' }, error: null })),
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useReportComments('report-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const initialFetchCount = fetchCount

      await act(async () => {
        await result.current.addComment('New comment')
      })

      // Should have fetched again after adding
      expect(fetchCount).toBeGreaterThan(initialFetchCount)
    })
  })

  describe('Hook Return Values', () => {
    it('returns expected shape', async () => {
      const { result } = renderHook(() => useReportComments('report-1'))

      // Check that the hook returns all expected properties
      expect(result.current).toHaveProperty('comments')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('addComment')
      expect(result.current).toHaveProperty('refreshComments')
    })

    it('addComment is a function', async () => {
      const { result } = renderHook(() => useReportComments('report-1'))

      expect(typeof result.current.addComment).toBe('function')
    })

    it('refreshComments is a function', async () => {
      const { result } = renderHook(() => useReportComments('report-1'))

      expect(typeof result.current.refreshComments).toBe('function')
    })
  })

  describe('Report ID Validation', () => {
    it('does not fetch if reportId is empty', async () => {
      const mockSupabase = {
        from: vi.fn(),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useReportComments(''))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should not have called from() if reportId is empty
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('refetches when reportId changes', async () => {
      let fetchCount = 0
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => {
                fetchCount++
                return Promise.resolve({ data: [], error: null })
              }),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result, rerender } = renderHook(
        ({ reportId }) => useReportComments(reportId),
        { initialProps: { reportId: 'report-1' } }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const countAfterFirstFetch = fetchCount

      // Change reportId
      rerender({ reportId: 'report-2' })

      await waitFor(() => {
        expect(fetchCount).toBeGreaterThan(countAfterFirstFetch)
      })
    })
  })
})
