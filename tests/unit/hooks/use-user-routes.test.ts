/**
 * TDD Unit Tests: useUserRoutes Hook
 *
 * RED Phase: These tests should FAIL because the hook doesn't exist yet
 *
 * Target: hooks/use-user-routes.ts
 * Phase: 2.1 School Route Management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useUserRoutes } from '@/hooks/use-user-routes'
import {
  mockUser,
  mockRoutes,
  mockEmptyRoutes,
  mockPrimaryRoute,
  mockSingleRoute,
  mockCreateRouteInput,
  mockUpdateRouteInput,
  mockDatabaseError,
} from '../../fixtures/routes'

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
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        match: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        match: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  })),
}))

describe('useUserRoutes Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Initial State', () => {
    it('returns empty array when no routes', async () => {
      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.routes).toEqual([])
    })

    it('returns loading state initially', async () => {
      const { result } = renderHook(() => useUserRoutes())

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('does not fetch routes when user is not authenticated', async () => {
      const mockSupabase = {
        from: vi.fn(),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should not have called from() if user is not authenticated
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })

  describe('Fetching Routes', () => {
    it('fetches routes for authenticated user', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockRoutes, error: null })),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.routes).toHaveLength(3)
      expect(result.current.routes[0].name).toBe('通学路A（主要ルート）')
    })

    it('returns primary route first', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockRoutes, error: null })),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Primary route should be accessible
      expect(result.current.primaryRoute).toBeDefined()
      expect(result.current.primaryRoute?.is_favorite).toBe(true)
    })

    it('handles error when fetch fails', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({
                data: null,
                error: mockDatabaseError,
              })),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })
  })

  describe('Adding Routes', () => {
    it('addRoute creates new route', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          insert: vi.fn(() => Promise.resolve({ data: { id: 'new-route' }, error: null })),
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        const success = await result.current.addRoute(mockCreateRouteInput)
        expect(success).toBe(true)
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('user_routes')
    })

    it('addRoute requires authentication', async () => {
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

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        const success = await result.current.addRoute(mockCreateRouteInput)
        expect(success).toBe(false)
      })

      // Should have an authentication error
      expect(result.current.error).toContain('ログイン')
    })

    it('validates route name is not empty', async () => {
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
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        const invalidInput = { ...mockCreateRouteInput, name: '' }
        const success = await result.current.addRoute(invalidInput)
        expect(success).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })

    it('validates route has at least 2 points', async () => {
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
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        const invalidInput = {
          ...mockCreateRouteInput,
          route_geometry: {
            type: 'LineString' as const,
            coordinates: [[139.6800, 35.6800]], // Only 1 point
          },
        }
        const success = await result.current.addRoute(invalidInput)
        expect(success).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })
  })

  describe('Updating Routes', () => {
    it('updateRoute modifies existing route', async () => {
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: { id: 'route-1' }, error: null })),
        match: vi.fn(() => Promise.resolve({ data: { id: 'route-1' }, error: null })),
      }))

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockRoutes, error: null })),
            })),
          })),
          update: mockUpdate,
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        const success = await result.current.updateRoute('route-1', mockUpdateRouteInput)
        expect(success).toBe(true)
      })

      expect(mockUpdate).toHaveBeenCalled()
    })

    it('setPrimaryRoute updates primary flag', async () => {
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: { id: 'route-2' }, error: null })),
        match: vi.fn(() => Promise.resolve({ data: { id: 'route-2' }, error: null })),
      }))

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockRoutes, error: null })),
            })),
          })),
          update: mockUpdate,
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.setPrimaryRoute('route-2')
      })

      // Should update both the old primary (set to false) and the new primary (set to true)
      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  describe('Deleting Routes', () => {
    it('deleteRoute removes route', async () => {
      const mockDelete = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        match: vi.fn(() => Promise.resolve({ data: null, error: null })),
      }))

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockRoutes, error: null })),
            })),
          })),
          delete: mockDelete,
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        const success = await result.current.deleteRoute('route-2')
        expect(success).toBe(true)
      })

      expect(mockDelete).toHaveBeenCalled()
    })

    it('prevents deleting the only primary route', async () => {
      const singlePrimaryRoute = [mockRoutes[0]] // Only the primary route

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: singlePrimaryRoute, error: null })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
            match: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        const success = await result.current.deleteRoute('route-1')
        // Should prevent deletion of the only route or only primary route
        expect(success).toBe(false)
      })
    })
  })

  describe('Hook Return Values', () => {
    it('returns expected shape', async () => {
      const { result } = renderHook(() => useUserRoutes())

      // Check that the hook returns all expected properties
      expect(result.current).toHaveProperty('routes')
      expect(result.current).toHaveProperty('primaryRoute')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('addRoute')
      expect(result.current).toHaveProperty('updateRoute')
      expect(result.current).toHaveProperty('deleteRoute')
      expect(result.current).toHaveProperty('setPrimaryRoute')
      expect(result.current).toHaveProperty('refreshRoutes')

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('all mutation functions are callable', async () => {
      const { result } = renderHook(() => useUserRoutes())

      expect(typeof result.current.addRoute).toBe('function')
      expect(typeof result.current.updateRoute).toBe('function')
      expect(typeof result.current.deleteRoute).toBe('function')
      expect(typeof result.current.setPrimaryRoute).toBe('function')
      expect(typeof result.current.refreshRoutes).toBe('function')

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('Refresh Functionality', () => {
    it('refreshRoutes refetches data', async () => {
      let fetchCount = 0
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => {
                fetchCount++
                return Promise.resolve({ data: mockRoutes, error: null })
              }),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const initialFetchCount = fetchCount

      await act(async () => {
        result.current.refreshRoutes()
      })

      await waitFor(() => {
        expect(fetchCount).toBeGreaterThan(initialFetchCount)
      })
    })
  })

  describe('Route Name Validation', () => {
    it('validates route name length (max 100 characters)', async () => {
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
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      }

      vi.mocked(await import('@supabase/ssr')).createBrowserClient.mockReturnValue(mockSupabase as any)

      const { result } = renderHook(() => useUserRoutes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        const invalidInput = { ...mockCreateRouteInput, name: 'あ'.repeat(101) }
        const success = await result.current.addRoute(invalidInput)
        expect(success).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })
  })
})
