/**
 * TDD Component Tests: RouteCard Component
 *
 * RED Phase: These tests should FAIL because the component doesn't exist yet
 *
 * Target: components/routes/route-card.tsx
 * Phase: 2.1 School Route Management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouteCard } from '@/components/routes/route-card'
import {
  mockSingleRoute,
  mockPrimaryRoute,
  mockRouteLongDistance,
  mockRouteShortDistance,
} from '../fixtures/routes'

describe('RouteCard Component', () => {
  const defaultProps = {
    route: mockSingleRoute,
    isSelected: false,
    onClick: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onSetPrimary: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('displays route name', () => {
      render(<RouteCard {...defaultProps} />)

      expect(screen.getByTestId('route-name')).toHaveTextContent(mockSingleRoute.name)
    })

    it('displays route description', () => {
      render(<RouteCard {...defaultProps} />)

      expect(screen.getByTestId('route-description')).toHaveTextContent(
        mockSingleRoute.description || ''
      )
    })

    it('displays distance in meters', () => {
      render(<RouteCard {...defaultProps} route={mockRouteShortDistance} />)

      const distanceElement = screen.getByTestId('route-distance')
      expect(distanceElement).toHaveTextContent(/450.*m/i)
    })

    it('displays distance in km for routes over 1000m', () => {
      render(<RouteCard {...defaultProps} route={mockRouteLongDistance} />)

      const distanceElement = screen.getByTestId('route-distance')
      expect(distanceElement).toHaveTextContent(/2\.5.*km/i)
    })

    it('displays estimated time', () => {
      render(<RouteCard {...defaultProps} />)

      const timeElement = screen.getByTestId('route-time')
      expect(timeElement).toHaveTextContent(/11.*分/i)
    })

    it('shows primary badge when is_favorite is true', () => {
      render(<RouteCard {...defaultProps} route={mockPrimaryRoute} />)

      expect(screen.getByTestId('primary-badge')).toBeInTheDocument()
    })

    it('does not show primary badge when is_favorite is false', () => {
      const nonPrimaryRoute = { ...mockSingleRoute, is_favorite: false }
      render(<RouteCard {...defaultProps} route={nonPrimaryRoute} />)

      expect(screen.queryByTestId('primary-badge')).not.toBeInTheDocument()
    })

    it('adds selected styling when isSelected is true', () => {
      render(<RouteCard {...defaultProps} isSelected={true} />)

      const card = screen.getByTestId('route-card')
      expect(card).toHaveClass('selected')
    })

    it('does not add selected styling when isSelected is false', () => {
      render(<RouteCard {...defaultProps} isSelected={false} />)

      const card = screen.getByTestId('route-card')
      expect(card).not.toHaveClass('selected')
    })
  })

  describe('Interactions', () => {
    it('calls onClick when card is clicked', async () => {
      const onClick = vi.fn()
      render(<RouteCard {...defaultProps} onClick={onClick} />)

      await userEvent.click(screen.getByTestId('route-card'))

      expect(onClick).toHaveBeenCalledTimes(1)
      expect(onClick).toHaveBeenCalledWith(mockSingleRoute)
    })

    it('calls onEdit when edit button clicked', async () => {
      const onEdit = vi.fn()
      render(<RouteCard {...defaultProps} onEdit={onEdit} />)

      await userEvent.click(screen.getByTestId('edit-route-button'))

      expect(onEdit).toHaveBeenCalledTimes(1)
      expect(onEdit).toHaveBeenCalledWith(mockSingleRoute)
    })

    it('calls onDelete when delete button clicked', async () => {
      const onDelete = vi.fn()
      render(<RouteCard {...defaultProps} onDelete={onDelete} />)

      await userEvent.click(screen.getByTestId('delete-route-button'))

      expect(onDelete).toHaveBeenCalledTimes(1)
      expect(onDelete).toHaveBeenCalledWith(mockSingleRoute)
    })

    it('calls onSetPrimary when set primary button clicked', async () => {
      const onSetPrimary = vi.fn()
      const nonPrimaryRoute = { ...mockSingleRoute, is_favorite: false }
      render(<RouteCard {...defaultProps} route={nonPrimaryRoute} onSetPrimary={onSetPrimary} />)

      await userEvent.click(screen.getByTestId('set-primary-button'))

      expect(onSetPrimary).toHaveBeenCalledTimes(1)
      expect(onSetPrimary).toHaveBeenCalledWith(nonPrimaryRoute)
    })

    it('edit button click does not trigger card onClick', async () => {
      const onClick = vi.fn()
      const onEdit = vi.fn()
      render(<RouteCard {...defaultProps} onClick={onClick} onEdit={onEdit} />)

      await userEvent.click(screen.getByTestId('edit-route-button'))

      expect(onEdit).toHaveBeenCalledTimes(1)
      expect(onClick).not.toHaveBeenCalled()
    })

    it('delete button click does not trigger card onClick', async () => {
      const onClick = vi.fn()
      const onDelete = vi.fn()
      render(<RouteCard {...defaultProps} onClick={onClick} onDelete={onDelete} />)

      await userEvent.click(screen.getByTestId('delete-route-button'))

      expect(onDelete).toHaveBeenCalledTimes(1)
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has correct role', () => {
      render(<RouteCard {...defaultProps} />)

      const card = screen.getByTestId('route-card')
      expect(card).toHaveAttribute('role', 'article')
    })

    it('is keyboard focusable', () => {
      render(<RouteCard {...defaultProps} />)

      const card = screen.getByTestId('route-card')
      expect(card).toHaveAttribute('tabIndex', '0')
    })

    it('buttons have accessible labels', () => {
      render(<RouteCard {...defaultProps} />)

      const editButton = screen.getByTestId('edit-route-button')
      const deleteButton = screen.getByTestId('delete-route-button')

      expect(editButton).toHaveAccessibleName()
      expect(deleteButton).toHaveAccessibleName()
    })

    it('can be activated with Enter key', async () => {
      const onClick = vi.fn()
      render(<RouteCard {...defaultProps} onClick={onClick} />)

      const card = screen.getByTestId('route-card')
      card.focus()
      await userEvent.keyboard('{Enter}')

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('can be activated with Space key', async () => {
      const onClick = vi.fn()
      render(<RouteCard {...defaultProps} onClick={onClick} />)

      const card = screen.getByTestId('route-card')
      card.focus()
      await userEvent.keyboard(' ')

      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge Cases', () => {
    it('handles null description gracefully', () => {
      const routeWithNullDescription = { ...mockSingleRoute, description: null }
      render(<RouteCard {...defaultProps} route={routeWithNullDescription} />)

      // Should not throw and description element should handle null
      const descriptionElement = screen.queryByTestId('route-description')
      expect(descriptionElement).toBeInTheDocument()
    })

    it('handles null distance gracefully', () => {
      const routeWithNullDistance = { ...mockSingleRoute, distance_meters: null }
      render(<RouteCard {...defaultProps} route={routeWithNullDistance} />)

      const distanceElement = screen.getByTestId('route-distance')
      expect(distanceElement).toBeInTheDocument()
    })

    it('handles null time gracefully', () => {
      const routeWithNullTime = { ...mockSingleRoute, estimated_time_minutes: null }
      render(<RouteCard {...defaultProps} route={routeWithNullTime} />)

      const timeElement = screen.getByTestId('route-time')
      expect(timeElement).toBeInTheDocument()
    })

    it('hides set primary button when already primary', () => {
      render(<RouteCard {...defaultProps} route={mockPrimaryRoute} />)

      expect(screen.queryByTestId('set-primary-button')).not.toBeInTheDocument()
    })
  })
})
