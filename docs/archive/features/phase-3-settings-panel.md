# Phase 3: Settings Panel

## Problem Statement
The settings gear icon in the app header (`src/App.tsx`) is rendered but has no `onClick` handler and does nothing when clicked. Users have no way to inspect the current environment configuration, API endpoints, or workspace statistics at runtime.

## Proposed Solution
Add a toggleable dropdown panel that opens below the gear icon when clicked. The panel is read-only and displays three sections of information:

1. **Environment** – cloud provider, region, compute pool ID
2. **API** – Flink REST endpoint (masked), org ID, environment ID
3. **Workspace** – statement count, total rows cached across all statements

Click-outside-to-close is handled via a `useEffect` event listener on `document`. No store changes required.

## Files to Modify
| File | Change |
|------|--------|
| `src/App.tsx` | Add `showSettings` state, wire gear button, render settings panel JSX |
| `src/App.css` | Add `.settings-panel`, `.settings-section`, `.settings-row`, `.settings-label`, `.settings-value` |

## Implementation Details

### App.tsx changes
- `import { useState, useEffect, useRef } from 'react'` (add `useState`, `useRef`)
- Local state: `const [showSettings, setShowSettings] = useState(false)`
- Ref: `const settingsPanelRef = useRef<HTMLDivElement>(null)` – attached to the panel wrapper div so click-outside can be detected
- Gear button: `onClick={() => setShowSettings(prev => !prev)}`
- `useEffect` closes panel on outside click: listen to `mousedown` on `document`, check `!settingsPanelRef.current?.contains(event.target)`
- Panel renders conditionally inside `header-right` div, absolutely positioned

### Data to display
- Cloud Provider: `env.cloudProvider.toUpperCase()`
- Region: `env.cloudRegion`
- Compute Pool ID: `env.computePoolId`
- Flink endpoint: `/api/flink` (masked, actual URL is a Vite proxy)
- Org ID: `env.orgId` (first 8 chars + `...` if long)
- Environment ID: `env.environmentId`
- Statement count: `statements.length`
- Total rows cached: `statements.reduce((sum, s) => sum + (s.results?.length ?? 0), 0)`

### Masking helper
```ts
const maskId = (id: string) => id.length > 12 ? `${id.slice(0, 8)}...` : id;
```

## Acceptance Criteria
- [ ] Gear button opens panel on click
- [ ] Gear button closes panel on second click (toggle)
- [ ] Clicking anywhere outside the panel closes it
- [ ] All three sections render with correct data from `env` and store
- [ ] Panel is z-index layered above all content
- [ ] No TypeScript errors (`npx tsc --noEmit` passes)

## Edge Cases
- Empty `orgId` / `environmentId`: display `—` (em dash) placeholder
- Long IDs: truncated with `...` suffix via `maskId`
- Zero rows: display `0` not empty string

## Commit Message
```
Phase 3: Settings panel with environment info

- Wire settings gear button to toggle info panel
- Show environment, API, and workspace details
- Click outside to close
```
