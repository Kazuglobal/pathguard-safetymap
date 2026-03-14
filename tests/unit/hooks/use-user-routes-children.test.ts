import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUserRoutes } from '@/hooks/use-user-routes'
import { mockUser } from '../../fixtures/routes'

const mocks = vi.hoisted(() => ({
  useSupabase: vi.fn(),
  insert: vi.fn(),
}))

vi.mock('@/components/providers/supabase-provider', () => ({
  useSupabase: mocks.useSupabase,
}))

describe('useUserRoutes child management', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.insert.mockResolvedValue({ data: null, error: null })
    mocks.useSupabase.mockReturnValue({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      id: 'route-1',
                      user_id: mockUser.id,
                      name: 'さくらの通学路',
                      description: null,
                      start_lat: 35.68,
                      start_lng: 139.76,
                      end_lat: 35.69,
                      end_lng: 139.77,
                      start_address: '自宅',
                      end_address: '学校',
                      route_geometry: null,
                      distance_meters: 800,
                      estimated_time_minutes: 10,
                      is_favorite: true,
                      child_id: 'child-sakura',
                      child_name: 'さくら',
                      created_at: '2026-03-14T00:00:00Z',
                      updated_at: '2026-03-14T00:00:00Z',
                    },
                    {
                      id: 'route-2',
                      user_id: mockUser.id,
                      name: '共通の通学路',
                      description: null,
                      start_lat: 35.68,
                      start_lng: 139.76,
                      end_lat: 35.69,
                      end_lng: 139.77,
                      start_address: '自宅',
                      end_address: '学校',
                      route_geometry: null,
                      distance_meters: 900,
                      estimated_time_minutes: 12,
                      is_favorite: false,
                      child_id: null,
                      child_name: null,
                      created_at: '2026-03-14T00:00:00Z',
                      updated_at: '2026-03-14T00:00:00Z',
                    },
                  ],
                  error: null,
                })
              ),
            })),
          })),
          insert: mocks.insert,
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
          getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      },
    })
  })

  it('builds child profiles including shared routes', async () => {
    const { result } = renderHook(() => useUserRoutes())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.childProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'all', label: 'すべて', routeCount: 2 }),
        expect.objectContaining({ id: 'child-sakura', label: 'さくら', routeCount: 1 }),
        expect.objectContaining({ id: 'shared', label: '共通', routeCount: 1 }),
      ])
    )
  })

  it('passes child identifier fields when creating a route', async () => {
    const { result } = renderHook(() => useUserRoutes())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.addRoute({
        name: 'だいちの通学路',
        start_lat: 35.68,
        start_lng: 139.76,
        end_lat: 35.69,
        end_lng: 139.77,
        start_address: '自宅',
        end_address: '学校',
        child_id: 'child-daichi',
        child_name: 'だいち',
      } as any)
    })

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        child_id: 'child-daichi',
        child_name: 'だいち',
      })
    )
  })
})
