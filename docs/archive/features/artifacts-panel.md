# Artifacts Panel — Feature Documentation

## Overview
The Artifacts Panel allows developers to browse, upload, and delete Flink JAR artifacts (UDFs) deployed to Confluent Cloud directly from the SQL workspace. The primary developer action is generating a `CREATE FUNCTION ... USING JAR 'confluent-artifact://...'` statement from an artifact.

## API Integration
- **Endpoint**: `https://api.confluent.cloud/artifact/v1/flink-artifacts`
- **Auth**: Cloud API keys (Basic Auth) — same credentials as `fcpmClient` (`VITE_CLOUD_API_KEY` / `VITE_CLOUD_API_SECRET`)
- **Proxy**: Vite dev proxy at `/api/artifact` → `https://api.confluent.cloud/artifact`
- **Query params**: `cloud`, `region`, `environment`

### API Operations
| Operation | Method | Path |
|-----------|--------|------|
| List artifacts | GET | `/v1/flink-artifacts` |
| Get artifact | GET | `/v1/flink-artifacts/{id}` |
| Delete artifact | DELETE | `/v1/flink-artifacts/{id}` |
| Get presigned URL | POST | `/v1/presigned-upload-url` |
| Upload JAR | PUT | `{presigned_url}` (direct to cloud storage) |
| Create artifact | POST | `/v1/flink-artifacts` |

## Architecture

### Files Created
| File | Purpose |
|------|---------|
| `src/api/artifact-client.ts` | Axios client with per-request auth interceptor (60s timeout) |
| `src/api/artifact-api.ts` | `listArtifacts`, `getArtifact`, `createArtifact`, `deleteArtifact`, `getPresignedUploadUrl`, `uploadJarToPresignedUrl` |
| `src/components/ArtifactsPanel/ArtifactsPanel.tsx` | Root container with env guard, list/detail toggle |
| `src/components/ArtifactsPanel/ArtifactList.tsx` | Searchable list with keyboard nav, upload button |
| `src/components/ArtifactsPanel/ArtifactDetail.tsx` | Metadata, SQL snippet, versions, delete |
| `src/components/ArtifactsPanel/UploadArtifact.tsx` | 3-step upload modal with progress bar |

### Files Modified
| File | Change |
|------|--------|
| `src/types/index.ts` | Added `FlinkArtifact`, `FlinkArtifactVersion`, `FlinkArtifactListResponse`, `PresignedUploadUrlResponse`, `CreateArtifactRequest`. Added `'artifacts'` to `NavItem` union. |
| `vite.config.ts` | Added `/api/artifact` proxy rule |
| `src/store/workspaceStore.ts` | Added artifact state + actions (runtime-only, not persisted) |
| `src/components/NavRail/NavRail.tsx` | Added `FiPackage` Artifacts item in Data section |
| `src/App.tsx` | Imported `ArtifactsPanel`, added conditional render |
| `src/data/helpTopics.ts` | Added Artifacts help topics |

## Store State (runtime-only, NOT persisted)
```typescript
artifactList: FlinkArtifact[]       // loaded from API
selectedArtifact: FlinkArtifact | null
artifactLoading: boolean
artifactUploading: boolean
uploadProgress: number | null       // 0-100 during upload
artifactError: string | null
```

## Key Feature: SQL Snippet Generation
The ArtifactDetail component generates a ready-to-use `CREATE FUNCTION` template:
```sql
CREATE FUNCTION <function_name>
  AS 'com.example.MyUdf'
  USING JAR 'confluent-artifact://cfa-abc123/ver-1';
```
- Version dropdown updates the version ID in real-time
- **Copy** button copies to clipboard
- **Insert at cursor** button uses `editorRegistry.insertTextAtCursor()` to insert into the focused Monaco editor

## Upload Flow (3 Steps)
1. **Request presigned URL** — POST to `/v1/presigned-upload-url` (indeterminate spinner)
2. **Upload JAR** — PUT to presigned cloud storage URL with `onUploadProgress` (real % progress bar)
3. **Create artifact** — POST to `/v1/flink-artifacts` with `upload_id` (indeterminate spinner)

Cancel during upload uses `AbortController` with a confirmation sub-dialog.

## Delete Flow
- Name-confirm gate: user must type the exact artifact `display_name`
- Warning: "Deleting this artifact will invalidate all functions that reference it."
- Optimistic delete with rollback on 409 (artifact in use)

## Environment Guard
Panel requires `VITE_CLOUD_API_KEY` and `VITE_CLOUD_API_SECRET`. If missing, displays a warning message with setup instructions.

## Navigation
- NavRail: FiPackage icon in Data section, positioned after "Database Objects" and before "Schemas"
- Clicking the nav item toggles the side panel (same pattern as Topics, Schemas)

## Phase 2 Updates (2026-03-08)

See [docs/features/platform-example-udf-namespacing.md](../../features/platform-example-udf-namespacing.md) for full details.

- **Platform artifact naming** (`src/services/example-setup.ts`): All Quick Start UDF artifacts now use stable `platform-examples-*` display names instead of session-scoped fun-names. Fixes visibility bug in shared/multi-user environments.
- **Filter update** (`src/api/artifact-api.ts`): `listArtifacts()` always passes artifacts with `display_name.startsWith('platform-examples-')` regardless of `filterUniqueId`.
- **Platform badge** (`src/components/ArtifactsPanel/ArtifactList.tsx`): Purple lock + "Platform" pill shown on platform artifact rows.
- **Read-only platform delete** (`src/components/ArtifactsPanel/ArtifactDetail.tsx`): Delete section replaced with "Platform examples are managed by Flafka and cannot be deleted." for `platform-examples-*` artifacts.
- **User upload session tagging** (`src/components/ArtifactsPanel/UploadArtifact.tsx`): `display_name` automatically receives `-{sessionTag}` suffix on creation.

## Still Deferred
- Upload New Version (version management)
- Tree Navigator bidirectional linking
