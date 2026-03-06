# Phase 3: Custom Export Filenames for CSV Downloads

## Overview

Replace the generic `results.csv` filename used when exporting query results with a descriptive, context-aware filename that encodes the query index and a timestamp — and optionally the statement name when one is available.

## Problem Statement

All CSV exports currently produce a file named `results.csv`. When a user runs multiple queries in a session and exports several result sets, every file has the same name. This causes browser download conflicts, overwrites files without warning, and makes it impossible to identify which export corresponds to which query after the fact.

## Goals

- Each export produces a unique, human-readable filename.
- The filename encodes enough context (query position, time) to be useful without opening the file.
- When a statement has been given an explicit name, that name is used as the filename prefix.
- The change is backward-compatible; no existing props are removed.

## Non-Goals

- Changing the JSON export filename (out of scope for this phase).
- Persisting export history.
- Allowing the user to customise the filename at download time.

## Proposed Filename Format

```
query-{index+1}-{YYYYMMDD}-{HHmmss}.csv
```

Examples:
- `query-1-20260228-134500.csv`
- `query-3-20260228-091022.csv`

When a `statementName` is present on the statement:

```
{statementName}-{YYYYMMDD}-{HHmmss}.csv
```

Example:
- `sales-report-20260228-134500.csv`

### Timestamp generation

```ts
new Date().toISOString().replace(/[:-]/g, '').slice(0, 15)
// "20260228T134500" -> slice to "20260228T13450"
// Use replace on the full ISO string, then take YYYYMMDD + HHmmss = 15 chars
```

Exact expression used in code:

```ts
const ts = new Date().toISOString().replace(/[:-]/g, '').slice(0, 15);
// Result: "20260228T134500" — split at T to get date+time without separator
```

The final filename strips the `T` separator:

```ts
const [date, time] = ts.split('T');
const filename = `${prefix}-${date}-${time}.csv`;
```

## Implementation Plan

### Props change — `ResultsTable`

Add two optional props to `ResultsTableProps`:

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `statementIndex` | `number` | `0` | Zero-based index of the statement in the editor pane |
| `statementName` | `string \| undefined` | `undefined` | Optional user-defined name for the statement |

### Filename derivation logic

```ts
const getExportFilename = (ext: string): string => {
  const ts = new Date().toISOString().replace(/[:-]/g, '').slice(0, 15);
  const [date, time] = ts.split('T');
  const prefix = statementName
    ? statementName.replace(/\s+/g, '-').toLowerCase()
    : `query-${statementIndex + 1}`;
  return `${prefix}-${date}-${time}.${ext}`;
};
```

### Files changed

| File | Change |
|---|---|
| `src/components/ResultsTable/ResultsTable.tsx` | Add props, replace hardcoded `results.csv` filename |

## Acceptance Criteria

1. Exporting from the first query tab (no name) produces a file matching `query-1-YYYYMMDD-HHmmss.csv`.
2. Exporting from the third query tab produces `query-3-YYYYMMDD-HHmmss.csv`.
3. When the statement has `statementName = "sales report"`, the file is named `sales-report-YYYYMMDD-HHmmss.csv`.
4. The timestamp in the filename matches the wall-clock time at the moment of the click (within the same second).
5. `npx tsc --noEmit` passes with no new errors.
6. Existing callers that do not pass the new props continue to compile and produce `query-1-YYYYMMDD-HHmmss.csv` (default index 0).

## Open Questions

- Should JSON exports follow the same naming convention? (Deferred to a future phase.)
- Should the filename be sanitised for characters that are illegal on Windows/macOS? (Current implementation replaces spaces with hyphens and lowercases; further sanitisation can be added if edge cases arise.)
