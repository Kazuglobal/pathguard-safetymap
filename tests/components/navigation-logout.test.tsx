/**
 * TDD Component Tests: Navigation Logout Functionality
 *
 * RED Phase: These tests should FAIL because the logout button doesn't exist in the UI yet
 *
 * Target: components/ui/navigation.tsx
 * Feature: Logout button visible when user is authenticated
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Navigation } from '@/components/ui/navigation'

// Ensure ResizeObserver/IntersectionObserver are proper constructors
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any
  global.IntersectionObserver = class IntersectionObserver {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: readonly number[] = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  } as any
})

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/map',
}))

// Mock framer-motion to avoid DOM warnings
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, layoutId, initial, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock notification bell
vi.mock('@/components/notifications/notification-bell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

// Mock admin check
vi.mock('@/lib/admin', () => ({
  isAdminUser: () => false,
}))

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
}

describe('Navigation Logout Functionality', () => {
  const mockOnLogout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('When user is authenticated', () => {
    it('renders a logout button', () => {
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const logoutButton = screen.getByTestId('logout-button')
      expect(logoutButton).toBeInTheDocument()
    })

    it('logout button has accessible label', () => {
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const logoutButton = screen.getByTestId('logout-button')
      expect(logoutButton).toHaveAccessibleName(/ログアウト/i)
    })

    it('calls onLogout when logout button is clicked', async () => {
      const user = userEvent.setup()
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const logoutButton = screen.getByTestId('logout-button')
      await user.click(logoutButton)

      expect(mockOnLogout).toHaveBeenCalledTimes(1)
    })

    it('displays logout icon', () => {
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const logoutButton = screen.getByTestId('logout-button')
      expect(logoutButton).toBeInTheDocument()
    })

  })

  describe('When user is NOT authenticated', () => {
    it('does NOT render a logout button', () => {
      render(<Navigation user={undefined} onLogout={mockOnLogout} />)

      const logoutButton = screen.queryByTestId('logout-button')
      expect(logoutButton).not.toBeInTheDocument()
    })

    it('renders login and register buttons instead', () => {
      render(<Navigation user={undefined} onLogout={mockOnLogout} />)

      expect(screen.getByText('ログイン')).toBeInTheDocument()
      expect(screen.getByText('新規登録')).toBeInTheDocument()
    })
  })

  describe('Logout button behavior', () => {
    it('does not call onLogout without user interaction', () => {
      render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      expect(mockOnLogout).not.toHaveBeenCalled()
    })
  })

  describe('Mobile bottom nav labels', () => {
    it('uses mobileLabel when provided while keeping full aria label', () => {
      const { container } = render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const mypageBottomLink = container.querySelector('a[aria-label="マイページ"]')
      expect(mypageBottomLink).toBeInTheDocument()
      expect(mypageBottomLink).toHaveTextContent('マイ')
      expect(mypageBottomLink).not.toHaveTextContent('マイページ')
    })

    it('falls back to label when mobileLabel is not provided', () => {
      const { container } = render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const mapBottomLink = container.querySelector('a[aria-label="マップ"]')
      expect(mapBottomLink).toBeInTheDocument()
      expect(mapBottomLink).toHaveTextContent('マップ')
    })

    it('applies one-line truncation styles to bottom nav labels', () => {
      const { container } = render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const mypageBottomLink = container.querySelector('a[aria-label="マイページ"]')
      const label = mypageBottomLink?.querySelector('span:last-child')
      expect(label).toBeInTheDocument()
      expect(mypageBottomLink).toHaveClass('min-w-0')
      expect(label).toHaveClass('block', 'max-w-[72px]', 'truncate', 'whitespace-nowrap', 'text-center')
    })
  })
})
