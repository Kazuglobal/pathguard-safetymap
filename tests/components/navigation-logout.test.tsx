/**
 * TDD Component Tests: Navigation Logout Feature
 *
 * Target: components/ui/navigation.tsx
 * Feature: Logout button in navigation for authenticated users (desktop + mobile)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next/navigation
const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/map'),
  useRouter: vi.fn(() => ({
    push: mockRouterPush,
  })),
}))

// Mock framer-motion to avoid DOM warnings
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className }: any) => <div className={className}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock notification bell (uses hooks that need Supabase)
vi.mock('@/components/notifications/notification-bell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

// Mock admin check
vi.mock('@/lib/admin', () => ({
  isAdminUser: vi.fn(() => false),
}))

// Import after mocks are defined
import { Navigation } from '@/components/ui/navigation'

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01',
}

describe('Navigation Logout Feature', () => {
  const mockOnLogout = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnLogout.mockResolvedValue(undefined)
  })

  describe('Desktop logout button visibility', () => {
    it('shows logout button when user is logged in (desktop)', () => {
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const logoutButton = screen.getByTestId('logout-button')
      expect(logoutButton).toBeInTheDocument()
    })

    it('does NOT show logout button when user is NOT logged in', () => {
      render(<Navigation user={undefined} onLogout={mockOnLogout} />)

      const logoutButton = screen.queryByTestId('logout-button')
      expect(logoutButton).not.toBeInTheDocument()
    })

    it('displays "ログアウト" text on the desktop logout button', () => {
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const desktopButton = screen.getByTestId('logout-button')
      expect(desktopButton).toHaveTextContent('ログアウト')
    })
  })

  describe('Mobile logout button', () => {
    it('shows mobile logout button when user is logged in', () => {
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const mobileLogoutButton = screen.getByTestId('mobile-logout-button')
      expect(mobileLogoutButton).toBeInTheDocument()
    })

    it('does NOT show mobile logout button when user is NOT logged in', () => {
      render(<Navigation user={undefined} onLogout={mockOnLogout} />)

      const mobileLogoutButton = screen.queryByTestId('mobile-logout-button')
      expect(mobileLogoutButton).not.toBeInTheDocument()
    })

    it('calls onLogout when mobile logout button is clicked', async () => {
      const user = userEvent.setup()
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const mobileLogoutButton = screen.getByTestId('mobile-logout-button')
      await user.click(mobileLogoutButton)

      expect(mockOnLogout).toHaveBeenCalledTimes(1)
    })

    it('has proper aria-label on mobile logout button', () => {
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const mobileLogoutButton = screen.getByTestId('mobile-logout-button')
      expect(mobileLogoutButton).toHaveAttribute('aria-label', 'ログアウト')
    })
  })

  describe('Logout button interaction', () => {
    it('calls onLogout when logout button is clicked', async () => {
      const user = userEvent.setup()
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const logoutButton = screen.getByTestId('logout-button')
      await user.click(logoutButton)

      expect(mockOnLogout).toHaveBeenCalledTimes(1)
    })

    it('calls onLogout only once on rapid clicks', async () => {
      // Make onLogout take some time to simulate async operation
      mockOnLogout.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      const user = userEvent.setup()
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const logoutButton = screen.getByTestId('logout-button')
      await user.click(logoutButton)
      await user.click(logoutButton)
      await user.click(logoutButton)

      // Should only call once (disabled after first click while processing)
      expect(mockOnLogout).toHaveBeenCalledTimes(1)
    })

    it('disables button while logout is in progress', async () => {
      mockOnLogout.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      const user = userEvent.setup()
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const logoutButton = screen.getByTestId('logout-button')
      await user.click(logoutButton)

      expect(logoutButton).toBeDisabled()
    })

    it('redirects to /login after successful logout', async () => {
      const user = userEvent.setup()
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const logoutButton = screen.getByTestId('logout-button')
      await user.click(logoutButton)

      expect(mockRouterPush).toHaveBeenCalledWith('/login')
    })

    it('redirects to /login after mobile logout', async () => {
      const user = userEvent.setup()
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const mobileLogoutButton = screen.getByTestId('mobile-logout-button')
      await user.click(mobileLogoutButton)

      expect(mockRouterPush).toHaveBeenCalledWith('/login')
    })
  })

  describe('Logout button accessibility', () => {
    it('has proper aria-label for accessibility', () => {
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const logoutButton = screen.getByTestId('logout-button')
      expect(logoutButton).toHaveAttribute('aria-label', 'ログアウト')
    })

    it('is a button element', () => {
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const logoutButton = screen.getByTestId('logout-button')
      expect(logoutButton.tagName).toBe('BUTTON')
    })
  })
})
