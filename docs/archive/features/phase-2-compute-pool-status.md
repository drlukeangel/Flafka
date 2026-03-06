# Feature: Compute Pool Status in Header

**Phase:** 2.5
**Date:** 2026-02-28
**Status:** Planned

---

## User Story

As a developer using the Flink SQL Workspace, I want to see the current status of my compute pool in the header so that I know at a glance whether the pool is ready to run queries.

**Acceptance Criteria:**
- A colored dot appears in the header next to the compute pool name
- Green dot = RUNNING or PROVISIONED (pool is ready)
- Yellow dot = PROVISIONING (pool is starting up)
- Red dot = DELETING or other error states
- Gray dot = status unknown or not yet loaded
- CFU count is displayed when available (e.g. "RUNNING · 4 CFU")
- Status refreshes automatically every 30 seconds
- If the API call fails, the app does not break - it shows "Unknown" instead

---

## Reference

From `docs/roadmap/03-confluent-ui-features.md`:
> **Status:** Green dot + "Running" (compute pool status)

This mirrors the Confluent Cloud UI which displays a "Running" indicator with a green dot in the workspace header.

---

## API

### Endpoint

```
GET /fcpm/v2/compute-pools/{compute_pool_id}?environment={environment_id}
```

Uses `orgId` and `environmentId` from environment config. The full URL is proxied through the existing `/api/flink` prefix.

### Response Shape (relevant fields)

```json
{
  "id": "lfcp-abc123",
  "spec": {
    "max_cfu": 10
  },
  "status": {
    "phase": "RUNNING",
    "current_cfu": 4
  }
}
```

### Phase Values

| Phase | Meaning | Display Color |
|-------|---------|---------------|
| `RUNNING` | Pool is active and processing | Green |
| `PROVISIONED` | Pool is provisioned and ready | Green |
| `PROVISIONING` | Pool is starting up | Yellow |
| `DELETING` | Pool is being deleted | Red |
| Other / error | Unknown or failed state | Red |
| `null` | Not yet loaded | Gray |

---

## New API Function: `getComputePoolStatus()`

**File:** `src/api/flink-api.ts`

```typescript
export interface ComputePoolStatus {
  phase: string;
  currentCfu: number;
}

export const getComputePoolStatus = async (): Promise<ComputePoolStatus | null>
```

- Calls `GET /fcpm/v2/compute-pools/${env.computePoolId}?environment=${env.environmentId}`
- Parses `status.phase` and `status.current_cfu` from the response
- Returns `{ phase, currentCfu }` on success
- Returns `null` on any error (does not throw)

---

## Store Changes

**File:** `src/store/workspaceStore.ts`

### New State

```typescript
computePoolPhase: string | null;   // default: null
computePoolCfu: number | null;     // default: null
```

These fields are **NOT persisted** - they are runtime-only and fetched fresh on load.

### New Action

```typescript
loadComputePoolStatus: () => Promise<void>
```

- Calls `getComputePoolStatus()` from the API module
- On success: sets `computePoolPhase` and `computePoolCfu`
- On failure: sets `computePoolPhase` to `'UNKNOWN'`, `computePoolCfu` to `null`
- Does not show a toast - failure is silent (non-critical)

---

## Header Display

**File:** `src/App.tsx`

Replace the static `Compute Pool: {id}` text in the header center with a dynamic status component:

```
[FiCpu icon] [colored dot] RUNNING · 4 CFU
```

- `useEffect` on mount: call `loadComputePoolStatus()`
- `setInterval` every 30 seconds: call `loadComputePoolStatus()`
- Clean up interval on component unmount via `useEffect` return function

### Display Logic

```
phase === 'RUNNING' || 'PROVISIONED'  → green dot + phase text
phase === 'PROVISIONING'              → yellow dot + "PROVISIONING"
phase === 'DELETING' || other         → red dot + phase text
phase === null                        → gray dot + "Loading..."
phase === 'UNKNOWN'                   → gray dot + "Unknown"
CFU available                         → append " · N CFU"
```

---

## CSS Changes

**File:** `src/App.css`

### New Classes

```css
.compute-pool-status      /* flex container for icon + dot + text */
.pool-status-dot          /* 8px circle, inline-block */
.pool-status-dot.running  /* green background */
.pool-status-dot.provisioning  /* yellow/amber background */
.pool-status-dot.error    /* red background */
.pool-status-dot.unknown  /* gray background */
```

---

## Auto-refresh

- Polling interval: **30 seconds**
- Implemented via `setInterval` in `App.tsx` `useEffect`
- Interval is cleared in the `useEffect` cleanup function to prevent memory leaks
- No loading spinner during refresh - the existing value stays visible while refreshing

---

## Error Handling

- If `getComputePoolStatus()` throws or returns null, the store sets `computePoolPhase = 'UNKNOWN'`
- The header displays "Unknown" with a gray dot
- No error toast is shown (this is a background status check, not a user-initiated action)
- The rest of the application continues to function normally

---

## Out of Scope

- Clicking the status to open a detail panel (future enhancement)
- CFU usage graphs or history (future enhancement)
- Alerting when pool enters DELETING state (future enhancement)
