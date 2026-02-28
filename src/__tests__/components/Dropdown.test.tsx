import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dropdown from '../../components/Dropdown/Dropdown'

const OPTIONS = ['Apple', 'Banana', 'Cherry']

/** Return the .dropdown-options container (only present when the menu is open). */
function getOptionsContainer(): HTMLElement {
  return document.querySelector('.dropdown-options') as HTMLElement
}

describe('[@dropdown] Dropdown', () => {
  let onChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    onChange = vi.fn()
  })

  // 1. Closed state: label, current value, chevron icon
  it('renders label, current value and chevron icon when closed', () => {
    render(<Dropdown label="Fruit" value="Apple" options={OPTIONS} onChange={onChange} />)

    expect(screen.getByText('Fruit')).toBeInTheDocument()
    // The trigger button wraps the value span; it must exist and show the current value
    const trigger = screen.getByRole('button', { name: /apple/i })
    expect(trigger).toBeInTheDocument()
    expect(within(trigger).getByText('Apple')).toBeInTheDocument()
    // Menu must NOT be open
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  // 2. Click trigger: opens dropdown menu (toggle behavior)
  it('opens the dropdown menu when the trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<Dropdown label="Fruit" value="Apple" options={OPTIONS} onChange={onChange} />)

    const trigger = screen.getByRole('button', { name: /apple/i })
    await user.click(trigger)

    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    const opts = getOptionsContainer()
    expect(within(opts).getByText('Banana')).toBeInTheDocument()
    expect(within(opts).getByText('Cherry')).toBeInTheDocument()
  })

  it('closes the dropdown menu when the trigger is clicked a second time', async () => {
    const user = userEvent.setup()
    render(<Dropdown label="Fruit" value="Apple" options={OPTIONS} onChange={onChange} />)

    const trigger = screen.getByRole('button', { name: /apple/i })
    await user.click(trigger)
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()

    await user.click(trigger)
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  // 3. Search input: appears when open, filters options case-insensitively
  it('shows a search input that filters options case-insensitively', async () => {
    const user = userEvent.setup()
    render(<Dropdown label="Fruit" value="Apple" options={OPTIONS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /apple/i }))
    await user.type(screen.getByPlaceholderText('Search...'), 'ban')

    const opts = getOptionsContainer()
    expect(within(opts).getByText('Banana')).toBeInTheDocument()
    expect(within(opts).queryByText('Apple')).not.toBeInTheDocument()
    expect(within(opts).queryByText('Cherry')).not.toBeInTheDocument()
  })

  it('filters options case-insensitively with uppercase input', async () => {
    const user = userEvent.setup()
    render(<Dropdown label="Fruit" value="Apple" options={OPTIONS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /apple/i }))
    await user.type(screen.getByPlaceholderText('Search...'), 'CHERRY')

    const opts = getOptionsContainer()
    expect(within(opts).getByText('Cherry')).toBeInTheDocument()
    expect(within(opts).queryByText('Apple')).not.toBeInTheDocument()
    expect(within(opts).queryByText('Banana')).not.toBeInTheDocument()
  })

  // 4. Select option: calls onChange, closes menu, clears search
  it('calls onChange with the selected option value when an option is clicked', async () => {
    const user = userEvent.setup()
    render(<Dropdown label="Fruit" value="Apple" options={OPTIONS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /apple/i }))
    await user.click(within(getOptionsContainer()).getByRole('button', { name: /banana/i }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Banana')
  })

  it('closes the menu after selecting an option', async () => {
    const user = userEvent.setup()
    render(<Dropdown label="Fruit" value="Apple" options={OPTIONS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /apple/i }))
    await user.click(within(getOptionsContainer()).getByRole('button', { name: /banana/i }))

    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  it('clears the search input after selecting an option', async () => {
    const user = userEvent.setup()
    render(<Dropdown label="Fruit" value="Apple" options={OPTIONS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /apple/i }))
    await user.type(screen.getByPlaceholderText('Search...'), 'ban')
    await user.click(within(getOptionsContainer()).getByRole('button', { name: /banana/i }))

    // The component is prop-driven; value prop is still "Apple" after onChange fires.
    // Reopen via the trigger (still labelled "Apple") to confirm search was cleared.
    await user.click(screen.getByRole('button', { name: /apple/i }))
    expect(screen.getByPlaceholderText('Search...')).toHaveValue('')
  })

  // 5. "No results found": shown when filter matches nothing
  it('shows "No results found" when the search filter matches no options', async () => {
    const user = userEvent.setup()
    render(<Dropdown label="Fruit" value="Apple" options={OPTIONS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /apple/i }))
    await user.type(screen.getByPlaceholderText('Search...'), 'xyz')

    const opts = getOptionsContainer()
    expect(within(opts).getByText('No results found')).toBeInTheDocument()
    expect(within(opts).queryByText('Apple')).not.toBeInTheDocument()
    expect(within(opts).queryByText('Banana')).not.toBeInTheDocument()
    expect(within(opts).queryByText('Cherry')).not.toBeInTheDocument()
  })

  // 6. disabled prop: prevents opening when true
  it('does not open the menu when the disabled prop is true', async () => {
    const user = userEvent.setup()
    render(<Dropdown label="Fruit" value="Apple" options={OPTIONS} onChange={onChange} disabled />)

    const trigger = screen.getByRole('button', { name: /apple/i })
    expect(trigger).toBeDisabled()

    await user.click(trigger)

    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  // 7. Outside click: closes dropdown (mousedown on document.body)
  it('closes the dropdown when a mousedown event fires outside the component', async () => {
    const user = userEvent.setup()
    render(<Dropdown label="Fruit" value="Apple" options={OPTIONS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /apple/i }))
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()

    // The handler listens on 'mousedown'; fire it on document.body (outside the dropdown)
    fireEvent.mouseDown(document.body)

    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  it('clears the search term when closed by an outside click', async () => {
    const user = userEvent.setup()
    render(<Dropdown label="Fruit" value="Apple" options={OPTIONS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /apple/i }))
    await user.type(screen.getByPlaceholderText('Search...'), 'ban')

    fireEvent.mouseDown(document.body)

    // Reopen and confirm search was cleared
    await user.click(screen.getByRole('button', { name: /apple/i }))
    expect(screen.getByPlaceholderText('Search...')).toHaveValue('')
  })

  // 8. Select the same value: still calls onChange
  it('calls onChange even when the currently selected value is re-selected', async () => {
    const user = userEvent.setup()
    render(<Dropdown label="Fruit" value="Apple" options={OPTIONS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /apple/i }))

    // Find the "Apple" option button inside the options list (not the trigger button)
    const appleOption = within(getOptionsContainer()).getByRole('button', { name: /apple/i })
    await user.click(appleOption)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Apple')
  })
})
