/**
 * TDD Component Tests: RouteManager Component
 *
 * RED Phase: These tests should FAIL because the component doesn't exist yet
 *
 * Target: components/map/route-manager.tsx
 * Phase: 2.1 School Route Management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouteManager } from '@/components/map/route-manager'
import {
  mockRoutes,
  mockEmptyRoutes,
  mockSingleRoute,
  mockPrimaryRoute,
  mockCreateRouteInput,
} from '../fixtures/routes'

// Mock useUserRoutes hook
vi.mock('@/hooks/use-user-routes', () => ({
  useUserRoutes: vi.fn(() => ({
    routes: [],
    primaryRoute: null,
    isLoading: false,
    error: null,
    addRoute: vi.fn(),
    updateRoute: vi.fn(),
    deleteRoute: vi.fn(),
    setPrimaryRoute: vi.fn(),
    refreshRoutes: vi.fn(),
  })),
}))

// Mock toast
vi.mock('@/components/ui/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}))

describe('RouteManager Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders route manager container', async () => {
      render(<RouteManager />)

      expect(screen.getByTestId('route-manager')).toBeInTheDocument()
    })

    it('shows loading state while fetching routes', async () => {
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: [],
        primaryRoute: null,
        isLoading: true,
        error: null,
        addRoute: vi.fn(),
        updateRoute: vi.fn(),
        deleteRoute: vi.fn(),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      })

      render(<RouteManager />)

      expect(screen.getByTestId('route-manager-loading')).toBeInTheDocument()
    })

    it('shows empty state when no routes exist', async () => {
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: mockEmptyRoutes,
        primaryRoute: null,
        isLoading: false,
        error: null,
        addRoute: vi.fn(),
        updateRoute: vi.fn(),
        deleteRoute: vi.fn(),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      })

      render(<RouteManager />)

      expect(screen.getByTestId('route-manager-empty')).toBeInTheDocument()
    })

    it('renders route list when routes exist', async () => {
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: mockRoutes,
        primaryRoute: mockPrimaryRoute,
        isLoading: false,
        error: null,
        addRoute: vi.fn(),
        updateRoute: vi.fn(),
        deleteRoute: vi.fn(),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      })

      render(<RouteManager />)

      expect(screen.getByTestId('route-list')).toBeInTheDocument()
      expect(screen.getAllByTestId('route-card')).toHaveLength(3)
    })

    it('shows add route button', async () => {
      render(<RouteManager />)

      expect(screen.getByTestId('add-route-button')).toBeInTheDocument()
    })
  })

  describe('Route Display', () => {
    beforeEach(async () => {
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: mockRoutes,
        primaryRoute: mockPrimaryRoute,
        isLoading: false,
        error: null,
        addRoute: vi.fn(),
        updateRoute: vi.fn(),
        deleteRoute: vi.fn(),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      })
    })

    it('displays route names', async () => {
      render(<RouteManager />)

      const routeNames = screen.getAllByTestId('route-name')
      expect(routeNames[0]).toHaveTextContent('通学路A（主要ルート）')
    })

    it('shows primary badge on primary route', async () => {
      render(<RouteManager />)

      expect(screen.getByTestId('primary-badge')).toBeInTheDocument()
    })

    it('displays route distance', async () => {
      render(<RouteManager />)

      const distances = screen.getAllByTestId('route-distance')
      expect(distances.length).toBeGreaterThan(0)
    })

    it('displays estimated time', async () => {
      render(<RouteManager />)

      const times = screen.getAllByTestId('route-time')
      expect(times.length).toBeGreaterThan(0)
    })
  })

  describe('Route Selection', () => {
    beforeEach(async () => {
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: mockRoutes,
        primaryRoute: mockPrimaryRoute,
        isLoading: false,
        error: null,
        addRoute: vi.fn(),
        updateRoute: vi.fn(),
        deleteRoute: vi.fn(),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      })
    })

    it('highlights selected route', async () => {
      const onRouteSelect = vi.fn()
      render(<RouteManager onRouteSelect={onRouteSelect} />)

      const routeCards = screen.getAllByTestId('route-card')
      await userEvent.click(routeCards[0])

      await waitFor(() => {
        expect(routeCards[0]).toHaveClass('selected')
      })
    })

    it('calls onRouteSelect when route is clicked', async () => {
      const onRouteSelect = vi.fn()
      render(<RouteManager onRouteSelect={onRouteSelect} />)

      const routeCards = screen.getAllByTestId('route-card')
      await userEvent.click(routeCards[0])

      expect(onRouteSelect).toHaveBeenCalledTimes(1)
      expect(onRouteSelect).toHaveBeenCalledWith(mockRoutes[0])
    })
  })

  describe('Adding Routes', () => {
    it('opens route creation mode when add button clicked', async () => {
      render(<RouteManager />)

      await userEvent.click(screen.getByTestId('add-route-button'))

      expect(screen.getByTestId('route-creation-panel')).toBeInTheDocument()
    })

    it('shows instructions for route creation', async () => {
      render(<RouteManager />)

      await userEvent.click(screen.getByTestId('add-route-button'))

      // Should show instructions about clicking on map
      expect(screen.getByText(/地図をクリック|マップ上で/i)).toBeInTheDocument()
    })

    it('allows entering route name', async () => {
      render(<RouteManager />)

      await userEvent.click(screen.getByTestId('add-route-button'))

      const nameInput = screen.getByTestId('route-name-input')
      await userEvent.type(nameInput, 'テスト通学路')

      expect(nameInput).toHaveValue('テスト通学路')
    })

    it('calls addRoute when save is clicked', async () => {
      const mockAddRoute = vi.fn().mockResolvedValue(true)
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: [],
        primaryRoute: null,
        isLoading: false,
        error: null,
        addRoute: mockAddRoute,
        updateRoute: vi.fn(),
        deleteRoute: vi.fn(),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      })

      render(<RouteManager />)

      await userEvent.click(screen.getByTestId('add-route-button'))

      const nameInput = screen.getByTestId('route-name-input')
      await userEvent.type(nameInput, 'テスト通学路')

      const latInput = screen.getByTestId('route-point-lat-input')
      const lngInput = screen.getByTestId('route-point-lng-input')
      const addPointButton = screen.getByTestId('add-point-button')

      await userEvent.type(latInput, '35.6895')
      await userEvent.type(lngInput, '139.6917')
      await userEvent.click(addPointButton)

      await userEvent.type(latInput, '35.6900')
      await userEvent.type(lngInput, '139.7000')
      await userEvent.click(addPointButton)

      await userEvent.click(screen.getByTestId('save-route-button'))

      await waitFor(() => {
        expect(mockAddRoute).toHaveBeenCalled()
      })
    })

    it('exits creation mode when cancel clicked', async () => {
      render(<RouteManager />)

      await userEvent.click(screen.getByTestId('add-route-button'))
      expect(screen.getByTestId('route-creation-panel')).toBeInTheDocument()

      await userEvent.click(screen.getByTestId('cancel-route-button'))

      expect(screen.queryByTestId('route-creation-panel')).not.toBeInTheDocument()
    })
  })

  describe('Editing Routes', () => {
    beforeEach(async () => {
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: mockRoutes,
        primaryRoute: mockPrimaryRoute,
        isLoading: false,
        error: null,
        addRoute: vi.fn(),
        updateRoute: vi.fn().mockResolvedValue(true),
        deleteRoute: vi.fn(),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      })
    })

    it('shows edit button on route card', async () => {
      render(<RouteManager />)

      const editButtons = screen.getAllByTestId('edit-route-button')
      expect(editButtons.length).toBeGreaterThan(0)
    })

    it('opens edit mode when edit clicked', async () => {
      render(<RouteManager />)

      const editButtons = screen.getAllByTestId('edit-route-button')
      await userEvent.click(editButtons[0])

      expect(screen.getByTestId('route-edit-panel')).toBeInTheDocument()
    })

    it('calls updateRoute when save is clicked in edit mode', async () => {
      const mockUpdateRoute = vi.fn().mockResolvedValue(true)
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: mockRoutes,
        primaryRoute: mockPrimaryRoute,
        isLoading: false,
        error: null,
        addRoute: vi.fn(),
        updateRoute: mockUpdateRoute,
        deleteRoute: vi.fn(),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      })

      render(<RouteManager />)

      const editButtons = screen.getAllByTestId('edit-route-button')
      await userEvent.click(editButtons[0])

      const nameInput = screen.getByTestId('route-name-input')
      await userEvent.clear(nameInput)
      await userEvent.type(nameInput, '更新した通学路')

      await userEvent.click(screen.getByTestId('save-route-button'))

      await waitFor(() => {
        expect(mockUpdateRoute).toHaveBeenCalledWith(
          mockRoutes[0].id,
          expect.objectContaining({ name: '更新した通学路' })
        )
      })
    })
  })

  describe('Deleting Routes', () => {
    beforeEach(async () => {
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: mockRoutes,
        primaryRoute: mockPrimaryRoute,
        isLoading: false,
        error: null,
        addRoute: vi.fn(),
        updateRoute: vi.fn(),
        deleteRoute: vi.fn().mockResolvedValue(true),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      })
    })

    it('shows delete button on route card', async () => {
      render(<RouteManager />)

      const deleteButtons = screen.getAllByTestId('delete-route-button')
      expect(deleteButtons.length).toBeGreaterThan(0)
    })

    it('shows confirmation dialog when delete clicked', async () => {
      render(<RouteManager />)

      const deleteButtons = screen.getAllByTestId('delete-route-button')
      await userEvent.click(deleteButtons[0])

      expect(screen.getByTestId('delete-confirmation-dialog')).toBeInTheDocument()
    })

    it('calls deleteRoute when confirmed', async () => {
      const mockDeleteRoute = vi.fn().mockResolvedValue(true)
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: mockRoutes,
        primaryRoute: mockPrimaryRoute,
        isLoading: false,
        error: null,
        addRoute: vi.fn(),
        updateRoute: vi.fn(),
        deleteRoute: mockDeleteRoute,
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      })

      render(<RouteManager />)

      const deleteButtons = screen.getAllByTestId('delete-route-button')
      await userEvent.click(deleteButtons[1]) // Delete second route (not primary)

      await userEvent.click(screen.getByTestId('confirm-delete-button'))

      await waitFor(() => {
        expect(mockDeleteRoute).toHaveBeenCalledWith(mockRoutes[1].id)
      })
    })

    it('closes dialog when cancel clicked', async () => {
      render(<RouteManager />)

      const deleteButtons = screen.getAllByTestId('delete-route-button')
      await userEvent.click(deleteButtons[0])

      expect(screen.getByTestId('delete-confirmation-dialog')).toBeInTheDocument()

      await userEvent.click(screen.getByTestId('cancel-delete-button'))

      expect(screen.queryByTestId('delete-confirmation-dialog')).not.toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('shows error message when error occurs', async () => {
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: [],
        primaryRoute: null,
        isLoading: false,
        error: '通学路の取得に失敗しました',
        addRoute: vi.fn(),
        updateRoute: vi.fn(),
        deleteRoute: vi.fn(),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      })

      render(<RouteManager />)

      expect(screen.getByTestId('route-manager-error')).toBeInTheDocument()
      expect(screen.getByText(/通学路の取得に失敗しました/)).toBeInTheDocument()
    })

    it('calls refreshRoutes when retry clicked', async () => {
      const mockRefresh = vi.fn()
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: [],
        primaryRoute: null,
        isLoading: false,
        error: '通学路の取得に失敗しました',
        addRoute: vi.fn(),
        updateRoute: vi.fn(),
        deleteRoute: vi.fn(),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: mockRefresh,
      })

      render(<RouteManager />)

      await userEvent.click(screen.getByTestId('retry-button'))

      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  describe('Map Integration', () => {
    beforeEach(async () => {
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: [],
        primaryRoute: null,
        isLoading: false,
        error: null,
        addRoute: vi.fn(),
        updateRoute: vi.fn(),
        deleteRoute: vi.fn(),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      })
    })

    it('renders map container', async () => {
      render(<RouteManager />)

      expect(screen.getByTestId('route-map-container')).toBeInTheDocument()
    })

    it('shows undo point button in creation mode', async () => {
      render(<RouteManager />)

      await userEvent.click(screen.getByTestId('add-route-button'))

      expect(screen.getByTestId('undo-point-button')).toBeInTheDocument()
    })
  })

  describe('Validation', () => {
    beforeEach(async () => {
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockReturnValue({
        routes: [],
        primaryRoute: null,
        isLoading: false,
        error: null,
        addRoute: vi.fn(),
        updateRoute: vi.fn(),
        deleteRoute: vi.fn(),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      })
    })

    it('shows validation error when route name is empty', async () => {
      render(<RouteManager />)

      // Click add route button to enter creation mode
      const addButton = screen.getByTestId('add-route-button')
      await userEvent.click(addButton)

      // Wait for creation panel to appear
      await waitFor(() => {
        expect(screen.getByTestId('route-creation-panel')).toBeInTheDocument()
      })

      // Click save with empty name
      await userEvent.click(screen.getByTestId('save-route-button'))

      // Check for validation error
      await waitFor(() => {
        expect(screen.getByText(/ルート名を入力/i)).toBeInTheDocument()
      })
    })

    it('shows error from hook when addRoute fails', async () => {
      let hookError: string | null = null
      const mockAddRoute = vi.fn().mockImplementation(async () => {
        hookError = 'ルートには2つ以上のポイントが必要です'
        return false
      })
      const { useUserRoutes } = await import('@/hooks/use-user-routes')
      vi.mocked(useUserRoutes).mockImplementation(() => ({
        routes: [],
        primaryRoute: null,
        isLoading: false,
        error: hookError,
        addRoute: mockAddRoute,
        updateRoute: vi.fn(),
        deleteRoute: vi.fn(),
        setPrimaryRoute: vi.fn(),
        refreshRoutes: vi.fn(),
      }))

      const { rerender } = render(<RouteManager />)

      await userEvent.click(screen.getByTestId('add-route-button'))

      const nameInput = screen.getByTestId('route-name-input')
      await userEvent.type(nameInput, 'テスト')

      const latInput = screen.getByTestId('route-point-lat-input')
      const lngInput = screen.getByTestId('route-point-lng-input')
      const addPointButton = screen.getByTestId('add-point-button')

      await userEvent.type(latInput, '35.6895')
      await userEvent.type(lngInput, '139.6917')
      await userEvent.click(addPointButton)

      await userEvent.type(latInput, '35.6900')
      await userEvent.type(lngInput, '139.7000')
      await userEvent.click(addPointButton)

      await userEvent.click(screen.getByTestId('save-route-button'))

      // Rerender to reflect the updated error state
      rerender(<RouteManager />)

      // Error from hook should be displayed
      expect(screen.getByText(/ポイント|地点/i)).toBeInTheDocument()
    })
  })
})
