# Testing Guide

## Quick Start

```bash
# Run tests in watch mode
npm test

# Run all tests once
npm run test:run

# Run only tests matching a marker
npm test -- -t "@store"          # only store tests
npm test -- -t "@api"            # only API tests
npm test -- -t "@phase-9"        # only phase-9 tests

# Run with coverage
npm run test:coverage

# Open Vitest UI (interactive browser)
npm run test:ui
```

## Framework

- **Test Runner**: Vitest v4 (Vite-native)
- **Component Testing**: React Testing Library
- **DOM Environment**: jsdom
- **Mocking**: Monaco Editor (textarea fallback), API responses

## Test Structure

Test files are located in `src/__tests__/` organized by feature:

```
src/__tests__/
├── api/
│   └── flink-api.test.ts
├── store/
│   └── workspaceStore.test.ts
└── components/
    └── ResultsTable.test.tsx
```

## Test Markers for QA

All test `describe` blocks **MUST** include markers for subset execution:

```typescript
describe('[@store] [@core] workspaceStore', () => {
  describe('[@store] addStatement', () => {
    it('should add a new statement', () => { ... })
  })
})

describe('[@api] flink-api', () => {
  describe('[@api] executeSQL', () => {
    it('should execute SQL', () => { ... })
  })
})

describe('[@phase-9-empty-state] OnboardingHint', () => {
  describe('[@phase-9-empty-state] rendering', () => {
    it('should show hint on first visit', () => { ... })
  })
})
```

### Running Tests by Marker

QA uses test markers to validate only changed code:

```bash
# Run only tests for specific marker
npm test -- -t "@store" --run

# Run tests for multiple markers
npm test -- -t "@phase-9|@api" --run

# Run tests marked as @changed (for in-progress work)
npm test -- -t "@changed" --run
```

## Mocks

### Monaco Editor

Located at `src/test/mocks/monaco.tsx` — renders as a textarea in tests since Monaco requires canvas.

### API Responses

Located at `src/test/mocks/api.ts` — provides factories for consistent test data:

```typescript
import { mockStatement, mockResults, mockStatementWithStatus } from '@/test/mocks/api'

// Create a mock statement
const stmt = mockStatement()

// Create with specific status
const running = mockStatementWithStatus('RUNNING')

// Create with overrides
const custom = mockStatement({
  name: 'my-stmt',
  status: { phase: 'COMPLETED' }
})
```

## Global Setup

Located at `src/test/setup.ts`:

- Imports `@testing-library/jest-dom` for DOM matchers
- Mocks `localStorage` (reset before each test for Zustand persist)
- Stubs `import.meta.env` with test-safe values
- Cleans up after each test

## Common Testing Patterns

### Testing Store Actions

```typescript
import { useWorkspaceStore } from '@/store/workspaceStore'

describe('[@store] actions', () => {
  it('should add statement', () => {
    const store = useWorkspaceStore.getState()
    store.addStatement('SELECT 1')

    const updated = useWorkspaceStore.getState()
    expect(updated.statements).toHaveLength(1)
  })
})
```

### Testing API Functions

```typescript
import { vi } from 'vitest'
import { confluentClient } from '@/api/confluent-client'
import { executeSQL } from '@/api/flink-api'

vi.mock('@/api/confluent-client')

describe('[@api] executeSQL', () => {
  it('should execute SQL', async () => {
    vi.mocked(confluentClient.post).mockResolvedValueOnce({
      data: { name: 'stmt-1', status: { phase: 'PENDING' } }
    })

    const result = await executeSQL('SELECT 1')
    expect(result.name).toBe('stmt-1')
  })
})
```

### Testing Components

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyComponent from '@/components/MyComponent'

describe('[@component] MyComponent', () => {
  it('should render', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)

    expect(screen.getByText('Hello')).toBeInTheDocument()

    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Clicked!')).toBeInTheDocument()
  })
})
```

## QA Checklist

Before marking code as "QA approved":

1. **Test Markers**: All new code has `[@feature-name]` markers in describe blocks
2. **Coverage**: Core logic (store, API, important components) is tested
3. **Subset Execution**: `npm test -- -t "@feature-name" --run` runs only relevant tests
4. **Edge Cases**: Error states, boundary conditions, async behavior covered
5. **Mocking**: External dependencies (API, localStorage) are properly mocked
6. **No Flakes**: Tests pass consistently (run multiple times)

## Troubleshooting

### Tests hang or timeout
- Check for unresolved promises in mocked API calls
- Verify mock setup in `beforeEach` hook
- Use `timeout` option on long-running tests: `it('...', async () => {...}, 10000)`

### "Cannot find module" errors
- Verify mock setup (especially `src/test/mocks/` files)
- Check path aliases in `vite.config.ts` match `tsconfig.json`
- Clear `node_modules/.vite/` and re-run if configs changed

### Component tests not rendering
- Check if component uses Monaco or other DOM-heavy libraries
- Add mocks to `src/test/mocks/` and update `vite.config.ts` alias
- Test the mocked version (e.g., textarea instead of Monaco)

## Resources

- [Vitest Docs](https://vitest.dev/)
- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
