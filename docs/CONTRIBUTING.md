# Contributing Guide

Guidelines for working in this codebase. Read this before writing any code.

---

## Code Style

- **TypeScript strict mode** is enabled. All code must be fully typed -- no `any` unless absolutely unavoidable.
- **ESLint** enforces style rules. Run `npm run lint` before committing and fix all warnings.
- **CSS custom properties** for all colors. Never hardcode hex values (`#fff`, `#333`, etc.). Use `var(--color-name)` from the theme variables defined in `:root` and `[data-theme="dark"]`. This ensures dark mode works without re-renders.
- **No emojis in code** -- not in comments, not in variable names, not in UI strings.
- **Imports** use the `@/` path alias (e.g., `import { env } from '@/config/environment'`).

---

## Git Rules

These are hard rules. Breaking them can cause permanent data loss.

- **Never stash.** No `git stash`, `git stash push`, `git stash pop`, or any variant. If you have uncommitted changes and need to switch context, stop and ask.
- **Never force-push.** No `git push --force` or `git push -f` without explicit instruction.
- **Never reset hard.** No `git reset --hard`, `git checkout -- .`, or `git restore .` without explicit instruction.
- **Never amend commits** (`git commit --amend`) without explicit instruction.
- **Never add `Co-Authored-By`** headers to commit messages.
- **Only commit when explicitly asked.** Do not auto-commit.

---

## Branch Naming

Use lowercase with hyphens:

```
feature/short-description    -- new features
bugfix/short-description     -- bug fixes
docs/short-description       -- documentation changes
```

---

## Testing Requirements

All new code must have tests. No exceptions.

### Marker Tags

Every `describe` block must include a marker tag in square brackets for targeted test execution:

```typescript
describe('[@my-feature] MyComponent', () => {
  it('should render correctly', () => { ... });
});
```

### Running Tests

```bash
npm test                              # watch mode
npm test -- -t "@my-feature" --run    # run specific marker, no watch
npm test -- -t "@store|@api" --run    # multiple markers
npm run test:coverage                 # coverage report
```

### Engine-Specific Test Markers
ksqlDB API tests use `@ksql-api` marker, ksqlDB engine tests use `@ksql-engine` marker, Flink engine tests use `@flink-engine` marker.

### Tier 1 vs Tier 2

- **Tier 1 (blocking):** Happy path and critical error scenarios. Must pass 100% before merge. Target 40-50% coverage.
- **Tier 2 (non-blocking):** Edge cases, concurrency, performance. Completed after shipping. Stubs are acceptable during initial development using `it.todo('description')`.

### Mocks

- Monaco Editor mock: `src/test/mocks/monaco.tsx` (renders as textarea in jsdom)
- API response factories: `src/test/mocks/api.ts` (`mockStatement()`, `mockResults()`, `mockStatementWithStatus()`)
- Global test setup: `src/test/setup.ts` (localStorage mock, env stubs, RTL cleanup)

---

## PR Checklist

Before requesting review, confirm:

- [ ] All tests pass (`npm test -- --run`)
- [ ] No lint errors (`npm run lint`)
- [ ] No hardcoded color values (use CSS custom properties)
- [ ] All interactive elements are keyboard accessible
- [ ] Feature works in both light and dark mode
- [ ] New test files include marker tags
- [ ] TypeScript compiles without errors (`npm run build`)

---

## File Organization

```
src/
  api/                          # API clients and request functions
  components/
    ComponentName/
      ComponentName.tsx         # component implementation
      ComponentName.css         # component styles
  config/
    environment.ts              # environment variable access
  store/
    workspaceStore.ts           # single Zustand store (all app state)
  types/
    index.ts                    # shared TypeScript interfaces and types
  utils/                        # pure utility functions
  test/
    setup.ts                    # global test setup
    mocks/                      # test mocks (Monaco, API factories)
  __tests__/
    api/                        # API function tests
    components/                 # component tests
    store/                      # store action tests
    utils/                      # utility function tests
```

---

## Common Patterns

### Adding a New Environment Variable

Three steps:

1. **Add to `.env.example`** with a descriptive comment and placeholder value.
2. **Add to `EnvironmentConfig` interface** in `src/config/environment.ts`. Use `?` suffix if optional.
3. **Add to `getEnv()` return object** in the same file, reading from `import.meta.env.VITE_YOUR_VAR`. Add to the `requiredVars` array if it is required.

### Adding a New API Client

1. **Create the client** in `src/api/` (e.g., `my-service-api.ts`). Use Axios with an auth interceptor following the pattern in `confluent-client.ts`.
2. **Add a proxy route** in `vite.config.ts` under `server.proxy`. Map a local path (e.g., `/api/my-service`) to the remote target URL. Include the `changeOrigin`, `rewrite`, and authorization header forwarding.
3. **Use the client** in store actions or components. Never use raw `fetch()` or standalone Axios instances.

### Adding a New Side Panel

1. **Add a NavItem** to the navigation rail in `src/components/NavRail/NavRail.tsx`. Give it an icon, label, and unique key.
2. **Create the component** in `src/components/YourPanel/YourPanel.tsx` with its own CSS file.
3. **Register in `App.tsx`** by importing the component and adding a conditional render block that checks `activeNavItem === 'your-key'`.
4. **Add tests** in `src/__tests__/components/YourPanel.test.tsx` with a marker tag.
