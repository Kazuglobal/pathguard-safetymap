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

const viewport = vi.hoisted(() => ({ isMobile: false }))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => viewport.isMobile }))

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
vi.mock('framer-motion', () => {
  const strip =
    (Tag: any) =>
    function MotionStub({
      children,
      layoutId,
      initial,
      animate,
      exit,
      transition,
      whileTap,
      whileHover,
      variants,
      custom,
      ...props
    }: any) {
      return <Tag {...props}>{children}</Tag>
    }
  return {
    motion: {
      div: strip('div'),
      span: strip('span'),
      button: strip('button'),
      svg: strip('svg'),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useReducedMotion: () => false,
  }
})

// Mock notification bell
vi.mock('@/components/notifications/notification-bell', () => ({
  NotificationBell: ({ isLoggedIn }: { isLoggedIn?: boolean }) => <div data-testid="notification-bell" data-enabled={String(isLoggedIn)} />,
}))

// Mock ReportBottomSheet
vi.mock('@/components/report/report-bottom-sheet', () => ({
  ReportBottomSheet: ({ open }: any) => open ? <div data-testid="report-bottom-sheet" /> : null,
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

  // ホームと地図のスマホでは上のナビが隠れる。そのときはホームのヘッダーのベルだけが通知を読む(UIUX改装 項目37)
  describe('Notification bell', () => {
    it('does not run the hidden top-nav bell on a phone when the top nav is hidden', () => {
      viewport.isMobile = true
      render(<Navigation user={mockUser} onLogout={mockOnLogout} hideTopNavMobile />)
      expect(screen.getByTestId('notification-bell')).toHaveAttribute('data-enabled', 'false')
      viewport.isMobile = false
    })

    it('runs the top-nav bell on other screens and on wide screens', () => {
      viewport.isMobile = true
      const { unmount } = render(<Navigation user={mockUser} onLogout={mockOnLogout} />)
      expect(screen.getByTestId('notification-bell')).toHaveAttribute('data-enabled', 'true')
      unmount()
      viewport.isMobile = false
      render(<Navigation user={mockUser} onLogout={mockOnLogout} hideTopNavMobile />)
      expect(screen.getByTestId('notification-bell')).toHaveAttribute('data-enabled', 'true')
    })
  })

  describe('Mobile bottom nav labels', () => {
    it('renders the my page tab link(「活動」から「マイページ」へ。UIUX改装 項目7)', () => {
      const { container } = render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const activityBottomLink = container.querySelector('a[aria-label="マイページ"]')
      expect(activityBottomLink).toBeInTheDocument()
      expect(activityBottomLink).toHaveTextContent('マイページ')
      expect(container.querySelector('a[aria-label="活動"]')).toBeNull()
    })

    it('shows the same label as the desktop nav in the bottom tab bar', () => {
      const { container } = render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const mapBottomLink = container.querySelector('a[aria-label="マップ"]')
      expect(mapBottomLink).toBeInTheDocument()
      expect(mapBottomLink).toHaveTextContent('マップ')
    })

    it('applies one-line truncation styles to bottom nav labels', () => {
      const { container } = render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const activityBottomLink = container.querySelector('a[aria-label="マイページ"]')
      const label = activityBottomLink?.querySelector('span:last-child')
      expect(label).toBeInTheDocument()
      expect(activityBottomLink).toHaveClass('min-w-0')
      expect(label).toHaveClass('block', 'max-w-[72px]', 'truncate', 'whitespace-nowrap', 'text-center')
    })

    it('renders the 「知らせる・さがす」 action button (not a link) in bottom nav, in two lines(UIUX改装 項目5)', () => {
      const { container } = render(<Navigation user={mockUser} onLogout={mockOnLogout} />)

      const reportButton = container.querySelector('button[aria-label="知らせる・さがす"]')
      expect(reportButton).toBeInTheDocument()
      // 1行では幅に入らないので2行に分ける(読み上げは aria-label の1つの名前)
      expect(reportButton).toHaveTextContent('知らせる・さがす')
      expect(reportButton?.querySelectorAll('span.whitespace-nowrap')).toHaveLength(2)
    })
  })
})
