import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Toast } from '../../types'

// Mock the Zustand store so tests control toasts and removeToast directly
const mockRemoveToast = vi.fn()
let mockToasts: Toast[] = []

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    toasts: mockToasts,
    removeToast: mockRemoveToast,
  }),
}))

// Import after mock is registered
import ToastContainer from '../../components/ui/Toast'

describe('[@toast] Toast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToasts = []
  })

  it('should return null when toasts array is empty', () => {
    mockToasts = []
    const { container } = render(<ToastContainer />)

    expect(container.firstChild).toBeNull()
  })

  it('should render the correct icon for a success toast', () => {
    mockToasts = [{ id: 'toast-1', type: 'success', message: 'It worked!' }]
    const { container } = render(<ToastContainer />)

    expect(container.querySelector('.toast-success')).toBeInTheDocument()
    expect(screen.getByText('It worked!')).toBeInTheDocument()
  })

  it('should render the correct icon for an error toast', () => {
    mockToasts = [{ id: 'toast-2', type: 'error', message: 'Something broke' }]
    const { container } = render(<ToastContainer />)

    expect(container.querySelector('.toast-error')).toBeInTheDocument()
    expect(screen.getByText('Something broke')).toBeInTheDocument()
  })

  it('should render the correct icon for a warning toast', () => {
    mockToasts = [{ id: 'toast-3', type: 'warning', message: 'Watch out' }]
    const { container } = render(<ToastContainer />)

    expect(container.querySelector('.toast-warning')).toBeInTheDocument()
    expect(screen.getByText('Watch out')).toBeInTheDocument()
  })

  it('should render the correct icon for an info toast', () => {
    mockToasts = [{ id: 'toast-4', type: 'info', message: 'Just so you know' }]
    const { container } = render(<ToastContainer />)

    expect(container.querySelector('.toast-info')).toBeInTheDocument()
    expect(screen.getByText('Just so you know')).toBeInTheDocument()
  })

  it('should render message text', () => {
    mockToasts = [{ id: 'toast-5', type: 'success', message: 'Query executed successfully' }]
    render(<ToastContainer />)

    expect(screen.getByText('Query executed successfully')).toBeInTheDocument()
  })

  it('should call removeToast with the correct toast id when close button is clicked', async () => {
    const user = userEvent.setup()
    mockToasts = [{ id: 'toast-abc', type: 'info', message: 'Click me away' }]
    render(<ToastContainer />)

    const closeButtons = screen.getAllByRole('button')
    await user.click(closeButtons[0])

    expect(mockRemoveToast).toHaveBeenCalledTimes(1)
    expect(mockRemoveToast).toHaveBeenCalledWith('toast-abc')
  })

  it('should call removeToast with the correct id when multiple toasts are present', async () => {
    const user = userEvent.setup()
    mockToasts = [
      { id: 'first', type: 'success', message: 'First' },
      { id: 'second', type: 'error', message: 'Second' },
    ]
    render(<ToastContainer />)

    const closeButtons = screen.getAllByRole('button')
    // Click the close button on the second toast
    await user.click(closeButtons[1])

    expect(mockRemoveToast).toHaveBeenCalledWith('second')
  })
})
