# Platform Example UDF Namespacing

**Status:** Shipped
**Date:** 2026-03-08
**Type:** Bug Fix + Enhancement

---

## Summary

Stable, session-independent names for platform example UDF artifacts, plus per-session tagging for user-uploaded artifacts. Fixes a bug where example artifacts uploaded in a prior or different session were invisible in the Artifacts panel.

---

## Problem

The Artifacts panel filters artifacts by the current session's unique ID (`VITE_UNIQUE_ID`). Example setup functions named artifacts with a dynamic fun-name that embedded the session tag (e.g., `Loan Detail Extractor (wobbling-narwhal-f696969)`). This worked for the user who first uploaded the artifact but broke when:

1. **Multi-user shared environment**: User A (`aaa111`) uploads the artifact. User B (`f696969`) runs the same Quick Start — the artifact is reused by class (no re-upload), but its display name still contains `aaa111`. User B's panel filters for `f696969` → artifact invisible.
2. **User upload name collisions**: User-uploaded artifacts had no session tag, making per-session filtering unreliable.

---

## Changes

### `src/api/artifact-api.ts` — Filter update

Extended `listArtifacts()` filter to always include `platform-examples-*` artifacts regardless of session tag:

```typescript
// Before
return artifacts.filter(a => a.display_name?.includes(filterUniqueId));

// After
return artifacts.filter(a =>
  a.display_name?.startsWith('platform-examples-') ||
  a.display_name?.includes(filterUniqueId)
);
```

### `src/services/example-setup.ts` — Stable platform names

All six Quick Start example `uploadArtifact()` calls now use stable, session-independent display names:

| Old Name | New Name |
|----------|----------|
| `Loan Detail Extractor (${rid})` | `platform-examples-flink-kickstarter` |
| `Loan Detail UDF Python (${rid})` | `platform-examples-loan-python-udf` |
| `WeightedAvg UDF (${rid})` | `platform-examples-weighted-avg` |
| `Loan Validator UDF (${rid})` | `platform-examples-loan-validator` |
| `PII Mask UDF (${rid})` | `platform-examples-pii-mask` |
| `Credit Bureau Enrich UDF (${rid})` | `platform-examples-credit-bureau-enrich` |

Reuse-by-class logic was already in place; these names make it work correctly across sessions and users.

### `src/components/ArtifactsPanel/ArtifactList.tsx` — Platform badge

Artifact rows where `display_name.startsWith('platform-examples-')` show a purple `🔒 Platform` pill badge. Tooltip: "Managed by Flafka — shared across sessions".

### `src/components/ArtifactsPanel/ArtifactDetail.tsx` — Read-only platform artifacts

Platform artifacts (`display_name.startsWith('platform-examples-')`) show an informational note instead of the delete button:

> "Platform examples are managed by Flafka and cannot be deleted."

The delete confirmation overlay is also suppressed for platform artifacts.

### `src/components/ArtifactsPanel/UploadArtifact.tsx` — Session tag on user uploads

User-uploaded artifacts automatically receive the session tag as a suffix on `display_name`:

```
"My Custom UDF" → "My Custom UDF-f696969"
```

The suffix is only appended once — if the name already ends with `-{sessionTag}`, it's left unchanged.

---

## Behavior Summary

| Artifact Type | Name Pattern | Platform Badge | Delete Available | Filter Behavior |
|---|---|---|---|---|
| Platform example | `platform-examples-*` | Yes | No | Always visible |
| User upload | `{name}-{sessionTag}` | No | Yes | Session-scoped |
| Legacy user artifact | `{any name containing sessionTag}` | No | Yes | Session-scoped |

---

## Test Coverage

- `e2e/artifacts-panel.spec.ts` — 4 tests, all mocked (no real API calls, no JAR files committed):
  1. Platform artifact appears in list with Platform badge
  2. Platform artifact detail has no delete button
  3. User artifact detail has delete button
  4. Upload flow appends session tag to display name

---

## Upgrade Notes

- Platform artifacts already uploaded with old fun-name display names (e.g., `Loan Detail Extractor (wobbling-narwhal-f696969)`) will **not** automatically rename. They will still appear in the panel as long as the session tag matches. New Quick Start runs will create/rename using the stable `platform-examples-*` names going forward.
- The `platform-examples-` prefix is reserved. User-defined artifact names starting with this prefix would be treated as read-only in the UI.
