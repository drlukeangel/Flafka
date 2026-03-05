import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SplitButton, type SplitButtonOption } from '../../components/SplitButton/SplitButton'

const makeOptions = (overrides?: Partial<SplitButtonOption>[]): SplitButtonOption[] => [
  { label: 'Option A', icon: <span data-testid="icon-a">A</span>, onClick: vi.fn(), ...overrides?.[0] },
  { label: 'Option B', icon: <span data-testid="icon-b">B</span>, onClick: vi.fn(), ...overrides?.[1] },
  { label: 'Option C', icon: <span data-testid="icon-c">C</span>, onClick: vi.fn(), disabled: true, ...overrides?.[2] },
]

describe('[@split-button] SplitButton', () => {
  let onClick: ReturnType<typeof vi.fn>
  let options: SplitButtonOption[]

  beforeEach(() => {
    vi.clearAllMocks()
    onClick = vi.fn()
    options = makeOptions()
  })

  describe('[@split-button] rendering', () => {
    it('renders main button with icon and label', () => {
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      expect(screen.getByTitle('Test')).toBeInTheDocument()
      expect(screen.getByText('Test')).toBeInTheDocument()
    })

    it('renders chevron button with aria attributes', () => {
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      const chevron = screen.getByTitle('More options')
      expect(chevron).toHaveAttribute('aria-haspopup', 'true')
      expect(chevron).toHaveAttribute('aria-expanded', 'false')
    })

    it('applies className variant', () => {
      const { container } = render(
        <SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} className="split-btn--run" />
      )
      expect(container.querySelector('.split-btn--run')).toBeInTheDocument()
    })
  })

  describe('[@split-button] main button click', () => {
    it('calls onClick when main button is clicked', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      await user.click(screen.getByTitle('Test'))
      expect(onClick).toHaveBeenCalledOnce()
    })

    it('does not call onClick when disabled', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} disabled />)
      await user.click(screen.getByTitle('Test'))
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('[@split-button] dropdown menu', () => {
    it('opens menu when chevron is clicked', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      await user.click(screen.getByTitle('More options'))
      expect(screen.getByRole('menu')).toBeInTheDocument()
      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
    })

    it('closes menu when chevron is clicked again', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      const chevron = screen.getByTitle('More options')
      await user.click(chevron)
      expect(screen.getByRole('menu')).toBeInTheDocument()
      await user.click(chevron)
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('calls option onClick and closes menu when option is clicked', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      await user.click(screen.getByTitle('More options'))
      await user.click(screen.getByText('Option A'))
      expect(options[0].onClick).toHaveBeenCalledOnce()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('does not call onClick for disabled options', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      await user.click(screen.getByTitle('More options'))
      const disabledItem = screen.getByText('Option C').closest('button')!
      expect(disabledItem).toBeDisabled()
    })

    it('closes menu on click outside', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <span data-testid="outside">outside</span>
          <SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />
        </div>
      )
      await user.click(screen.getByTitle('More options'))
      expect(screen.getByRole('menu')).toBeInTheDocument()
      fireEvent.mouseDown(screen.getByTestId('outside'))
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('closes menu on Escape key', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      await user.click(screen.getByTitle('More options'))
      expect(screen.getByRole('menu')).toBeInTheDocument()
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('updates aria-expanded when menu is open', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      const chevron = screen.getByTitle('More options')
      expect(chevron).toHaveAttribute('aria-expanded', 'false')
      await user.click(chevron)
      expect(chevron).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('[@split-button] keyboard navigation', () => {
    it('focuses first enabled item when menu opens', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      await user.click(screen.getByTitle('More options'))
      const menuItems = screen.getAllByRole('menuitem')
      expect(menuItems[0]).toHaveFocus()
    })

    it('ArrowDown moves focus to next enabled item', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      await user.click(screen.getByTitle('More options'))
      const menu = screen.getByRole('menu')
      const menuItems = screen.getAllByRole('menuitem')

      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      expect(menuItems[1]).toHaveFocus()
    })

    it('ArrowDown skips disabled items', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      await user.click(screen.getByTitle('More options'))
      const menu = screen.getByRole('menu')
      const menuItems = screen.getAllByRole('menuitem')

      // Move to Option B (index 1)
      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      expect(menuItems[1]).toHaveFocus()

      // ArrowDown should skip Option C (disabled) and wrap to Option A
      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      expect(menuItems[0]).toHaveFocus()
    })

    it('ArrowUp moves focus to previous enabled item', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      await user.click(screen.getByTitle('More options'))
      const menu = screen.getByRole('menu')
      const menuItems = screen.getAllByRole('menuitem')

      // Move to Option B first
      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      expect(menuItems[1]).toHaveFocus()

      // ArrowUp back to Option A
      fireEvent.keyDown(menu, { key: 'ArrowUp' })
      expect(menuItems[0]).toHaveFocus()
    })

    it('Enter activates focused menu item', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      await user.click(screen.getByTitle('More options'))
      const menu = screen.getByRole('menu')

      fireEvent.keyDown(menu, { key: 'Enter' })
      expect(options[0].onClick).toHaveBeenCalledOnce()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('Space activates focused menu item', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      await user.click(screen.getByTitle('More options'))
      const menu = screen.getByRole('menu')

      fireEvent.keyDown(menu, { key: ' ' })
      expect(options[0].onClick).toHaveBeenCalledOnce()
    })
  })

  describe('[@split-button] keyboard edge cases', () => {
    it('ArrowUp from first enabled item wraps to last enabled item', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} />)
      await user.click(screen.getByTitle('More options'))
      const menu = screen.getByRole('menu')
      const menuItems = screen.getAllByRole('menuitem')

      // Focus is on Option A (index 0). ArrowUp should wrap to last enabled = Option B (index 1, since C is disabled)
      fireEvent.keyDown(menu, { key: 'ArrowUp' })
      expect(menuItems[1]).toHaveFocus()
    })

    it('ArrowDown stays on current item when all other options are disabled', async () => {
      const user = userEvent.setup()
      const allDisabledExceptFirst: SplitButtonOption[] = [
        { label: 'Only', icon: <span>O</span>, onClick: vi.fn() },
        { label: 'Dis1', icon: <span>D1</span>, onClick: vi.fn(), disabled: true },
        { label: 'Dis2', icon: <span>D2</span>, onClick: vi.fn(), disabled: true },
      ]
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={allDisabledExceptFirst} />)
      await user.click(screen.getByTitle('More options'))
      const menu = screen.getByRole('menu')
      const menuItems = screen.getAllByRole('menuitem')

      expect(menuItems[0]).toHaveFocus()
      // ArrowDown: all remaining disabled, wraps to start, finds index 0 again
      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      expect(menuItems[0]).toHaveFocus()
    })

    it('ArrowUp stays on current item when all other options are disabled', async () => {
      const user = userEvent.setup()
      const allDisabledExceptFirst: SplitButtonOption[] = [
        { label: 'Only', icon: <span>O</span>, onClick: vi.fn() },
        { label: 'Dis1', icon: <span>D1</span>, onClick: vi.fn(), disabled: true },
        { label: 'Dis2', icon: <span>D2</span>, onClick: vi.fn(), disabled: true },
      ]
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={allDisabledExceptFirst} />)
      await user.click(screen.getByTitle('More options'))
      const menu = screen.getByRole('menu')
      const menuItems = screen.getAllByRole('menuitem')

      expect(menuItems[0]).toHaveFocus()
      fireEvent.keyDown(menu, { key: 'ArrowUp' })
      expect(menuItems[0]).toHaveFocus()
    })

    it('does not act on keydown when all options are disabled (focusedIndex is -1)', async () => {
      const user = userEvent.setup()
      const allDisabled: SplitButtonOption[] = [
        { label: 'Dis1', icon: <span>D1</span>, onClick: vi.fn(), disabled: true },
        { label: 'Dis2', icon: <span>D2</span>, onClick: vi.fn(), disabled: true },
      ]
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={allDisabled} />)
      await user.click(screen.getByTitle('More options'))
      const menu = screen.getByRole('menu')

      // focusedIndex should be -1, so handleMenuKeyDown returns early
      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      fireEvent.keyDown(menu, { key: 'Enter' })
      expect(allDisabled[0].onClick).not.toHaveBeenCalled()
      expect(allDisabled[1].onClick).not.toHaveBeenCalled()
    })

    it('renders empty menu when options array is empty', async () => {
      const user = userEvent.setup()
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={[]} />)
      await user.click(screen.getByTitle('More options'))
      const menu = screen.getByRole('menu')
      expect(menu).toBeInTheDocument()
      expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
    })

    it('Enter does not activate a disabled focused item', async () => {
      // Edge: if somehow focusedIndex pointed at a disabled item
      const user = userEvent.setup()
      const opts: SplitButtonOption[] = [
        { label: 'A', icon: <span>A</span>, onClick: vi.fn() },
        { label: 'B', icon: <span>B</span>, onClick: vi.fn(), disabled: true },
      ]
      render(<SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={opts} />)
      await user.click(screen.getByTitle('More options'))
      const menu = screen.getByRole('menu')

      // Move to B via ArrowDown — but B is disabled so it wraps to A
      fireEvent.keyDown(menu, { key: 'ArrowDown' })
      // Press Enter on focused item
      fireEvent.keyDown(menu, { key: 'Enter' })
      expect(opts[0].onClick).toHaveBeenCalledOnce()
    })
  })

  describe('[@split-button] chevronDisabled', () => {
    it('disables chevron independently when chevronDisabled is true', () => {
      render(
        <SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} chevronDisabled />
      )
      expect(screen.getByTitle('Test')).not.toBeDisabled()
      expect(screen.getByTitle('More options')).toBeDisabled()
    })

    it('chevron inherits disabled from main when chevronDisabled is not set', () => {
      render(
        <SplitButton icon={<span>IC</span>} label="Test" onClick={onClick} options={options} disabled />
      )
      expect(screen.getByTitle('Test')).toBeDisabled()
      expect(screen.getByTitle('More options')).toBeDisabled()
    })
  })
})
