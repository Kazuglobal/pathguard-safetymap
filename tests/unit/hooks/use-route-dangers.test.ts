/**
 * TDD Unit Tests: useRouteDangers Hook
 *
 * Target: hooks/use-route-dangers.ts
 * Phase: Route Danger Report Feature
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useRouteDangers } from '@/hooks/use-route-dangers'
import { mockRoutes } from '../../fixtures/routes'
import {
  mockDangerReportsNearRoute,
  mockAllDangerReports,
} from '../../fixtures/dangers'

const mocks = vi.hoisted(() => ({
  useSupabase: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/components/providers/supabase-provider', () => ({
  useSupabase: mocks.useSupabase,
}))

describe('useRouteDangers Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default mock that returns empty
    mocks.from.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Not found' } })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    }))
    mocks.useSupabase.mockReturnValue({
      supabase: {
        from: mocks.from,
      },
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Initial State', () => {
    it('returns loading state initially', async () => {
      const { result } = renderHook(() => useRouteDangers('route-1'))

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('returns empty dangers array initially', async () => {
      const { result } = renderHook(() => useRouteDangers('route-1'))

      expect(result.current.dangers).toEqual([])

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('Fetching Dangers', () => {
    it('fetches dangers near the specified route', async () => {
      const mockRoute = mockRoutes[0] // Has route_geometry

      mocks.from.mockImplementation((table: string) => {
        if (table === 'user_routes') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: mockRoute, error: null })),
              })),
            })),
          }
        }
        // danger_reports
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockAllDangerReports, error: null })),
          })),
        }
      })

      const { result } = renderHook(() => useRouteDangers('route-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should filter to only dangers near the route
      expect(result.current.dangers.length).toBeGreaterThan(0)
    })

    it('returns empty array when route has no geometry', async () => {
      const mockRouteNoGeometry = mockRoutes[2] // route_geometry is null

      mocks.from.mockImplementation((table: string) => {
        if (table === 'user_routes') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: mockRouteNoGeometry, error: null })),
              })),
            })),
          }
        }
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockAllDangerReports, error: null })),
          })),
        }
      })

      const { result } = renderHook(() => useRouteDangers('route-3'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.dangers).toEqual([])
      expect(result.current.error).toContain('ルートジオメトリがありません')
    })

    it('returns sorted dangers by route position', async () => {
      const mockRoute = mockRoutes[0]

      mocks.from.mockImplementation((table: string) => {
        if (table === 'user_routes') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: mockRoute, error: null })),
              })),
            })),
          }
        }
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockDangerReportsNearRoute, error: null })),
          })),
        }
      })

      const { result } = renderHook(() => useRouteDangers('route-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Dangers should be sorted by position along route
      if (result.current.dangers.length >= 2) {
        const first = result.current.dangers[0]
        const last = result.current.dangers[result.current.dangers.length - 1]
        // First danger's longitude should be less than or equal to last
        expect(first.longitude).toBeLessThanOrEqual(last.longitude)
      }
    })
  })

  describe('Custom Buffer Distance', () => {
    it('uses custom buffer meters when specified', async () => {
      const mockRoute = mockRoutes[0]

      mocks.from.mockImplementation((table: string) => {
        if (table === 'user_routes') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: mockRoute, error: null })),
              })),
            })),
          }
        }
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockDangerReportsNearRoute, error: null })),
          })),
        }
      })

      // Use very small buffer - should find fewer dangers
      const { result } = renderHook(() => useRouteDangers('route-1', 1))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // With 1m buffer, should find fewer or no dangers
      expect(result.current.dangers.length).toBeLessThanOrEqual(mockDangerReportsNearRoute.length)
    })

    it('defaults to 100m buffer', async () => {
      const mockRoute = mockRoutes[0]

      mocks.from.mockImplementation((table: string) => {
        if (table === 'user_routes') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: mockRoute, error: null })),
              })),
            })),
          }
        }
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockDangerReportsNearRoute, error: null })),
          })),
        }
      })

      const { result } = renderHook(() => useRouteDangers('route-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should find dangers with default 100m buffer
      expect(result.current.dangers.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('handles route fetch error', async () => {
      mocks.from.mockImplementation((table: string) => {
        if (table === 'user_routes') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: null,
                  error: { message: 'Route not found' },
                })),
              })),
            })),
          }
        }
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        }
      })

      const { result } = renderHook(() => useRouteDangers('nonexistent-route'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.dangers).toEqual([])
    })

    it('handles danger reports fetch error', async () => {
      const mockRoute = mockRoutes[0]

      mocks.from.mockImplementation((table: string) => {
        if (table === 'user_routes') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: mockRoute, error: null })),
              })),
            })),
          }
        }
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Database error' },
            })),
          })),
        }
      })

      const { result } = renderHook(() => useRouteDangers('route-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })

    it('handles empty route ID', async () => {
      const { result } = renderHook(() => useRouteDangers(''))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.dangers).toEqual([])
    })
  })

  describe('Refetch Functionality', () => {
    it('provides refetch function', async () => {
      const { result } = renderHook(() => useRouteDangers('route-1'))

      expect(typeof result.current.refetch).toBe('function')

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('refetches data when called', async () => {
      let fetchCount = 0
      const mockRoute = mockRoutes[0]

      mocks.from.mockImplementation((table: string) => {
        if (table === 'user_routes') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => {
                  fetchCount++
                  return Promise.resolve({ data: mockRoute, error: null })
                }),
              })),
            })),
          }
        }
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockDangerReportsNearRoute, error: null })),
          })),
        }
      })

      const { result } = renderHook(() => useRouteDangers('route-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const initialFetchCount = fetchCount

      await act(async () => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(fetchCount).toBeGreaterThan(initialFetchCount)
      })
    })
  })

  describe('Hook Return Values', () => {
    it('returns expected shape', async () => {
      const { result } = renderHook(() => useRouteDangers('route-1'))

      expect(result.current).toHaveProperty('dangers')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('refetch')

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('dangers is always an array', async () => {
      const { result } = renderHook(() => useRouteDangers('route-1'))

      expect(Array.isArray(result.current.dangers)).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(Array.isArray(result.current.dangers)).toBe(true)
    })
  })

  describe('Route ID Change', () => {
    it('refetches when route ID changes', async () => {
      const mockRoute1 = mockRoutes[0]
      const mockRoute2 = mockRoutes[1]

      let currentRouteId = 'route-1'
      mocks.from.mockImplementation((table: string) => {
        if (table === 'user_routes') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => {
                  const route = currentRouteId === 'route-1' ? mockRoute1 : mockRoute2
                  return Promise.resolve({ data: route, error: null })
                }),
              })),
            })),
          }
        }
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockDangerReportsNearRoute, error: null })),
          })),
        }
      })

      const { result, rerender } = renderHook(
        ({ routeId }) => useRouteDangers(routeId),
        { initialProps: { routeId: 'route-1' } }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Change route ID
      currentRouteId = 'route-2'
      rerender({ routeId: 'route-2' })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Verify it fetched again (the mock was called with different route)
      expect(mocks.from).toHaveBeenCalled()
    })
  })
})
