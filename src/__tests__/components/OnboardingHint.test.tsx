import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingHint } from '../../components/OnboardingHint/OnboardingHint'

describe('[@onboarding-hint] OnboardingHint', () => {
  let onDismiss: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onDismiss = vi.fn()
  })

  it('should render the "Getting Started" heading', () => {
    render(<OnboardingHint onDismiss={onDismiss} />)

    expect(screen.getByText('Getting Started')).toBeInTheDocument()
  })

  it('should render all 3 tip list items', () => {
    render(<OnboardingHint onDismiss={onDismiss} />)

    expect(screen.getByText(/Ctrl\+Enter/)).toBeInTheDocument()
    expect(screen.getByText(/SHOW TABLES/)).toBeInTheDocument()
    expect(screen.getByText(/catalog and database/i)).toBeInTheDocument()

    const listItems = screen.getAllByRole('listitem')
    expect(listItems).toHaveLength(3)
  })

  it('should call onDismiss when the dismiss button is clicked', async () => {
    const user = userEvent.setup()
    render(<OnboardingHint onDismiss={onDismiss} />)

    const dismissButton = screen.getByRole('button', { name: /dismiss hint/i })
    await user.click(dismissButton)

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
