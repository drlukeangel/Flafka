# Phase 4 Track B — Flink Developer Stress Test Report
## Feature: Phase 12.3 Topic Management

**Agent**: Flink Developer (Sonnet)
**Run**: 1
**Date**: 2026-02-28
**Phase**: 4 Track B — Post-Acceptance Stress Test & Feedback

---

## Executive Summary

The Phase 12.3 Topic Management panel is functionally correct for the happy path and well-structured. The schema-panel mirror pattern was executed faithfully. However, the implementation has several bugs and design gaps that will bite users in production. The most serious issues involve a broken auth flow (credentials burned at module load time), a system-topic regex that misses `__confluent-*` variants, and a stale-closure bug in the delete flow. There are also meaningful UX friction points — particularly around the Create dialog's advanced section discoverability and the config table's inability to copy values.

Recommend addressing all CRITICAL and HIGH findings before Phase 12.4 begins.

---

## Findings

### CRITICAL

---

#### CRIT-1: Auth Header Burned at Module Load Time — Credential Rotation Impossible

**Description**: `kafka-rest-client.ts` calls `createKafkaAuthHeader()` at module initialization time (line 12-18), building the Authorization header once when the module is first imported. The Axios instance is created with that static header baked in. If `env.kafkaApiKey` or `env.kafkaApiSecret` is empty at startup (race condition, deferred config, or hot-reload), the header is set to `Basic :` and every subsequent request will fail with 401. More critically, there is no way to update the credentials without a full page reload.

The existing `confluent-client.ts` has the same pattern, but the Kafka client is newer and this pattern is documented as a known limitation. This makes the Kafka panel uniquely fragile during local development when `.env` changes without page reload.

**Severity**: CRITICAL
**Code Location**: `src/api/kafka-rest-client.ts:4-18`
```typescript
// CURRENT — static header burned at import time
export const kafkaRestClient: AxiosInstance = axios.create({
  baseURL: KAFKA_API_BASE,
  headers: {
    'Authorization': createKafkaAuthHeader(),  // <-- evaluated ONCE, never updated
    'Content-Type': 'application/json',
  },
});
```
**Suggested Fix**: Move auth header generation into the request interceptor so it is evaluated on every request:
```typescript
export const kafkaRestClient: AxiosInstance = axios.create({
  baseURL: KAFKA_API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

kafkaRestClient.interceptors.request.use(config => {
  config.headers['Authorization'] = createKafkaAuthHeader(); // fresh on each call
  console.log(`[Kafka REST] ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});
```
**Story Points**: 3 (High bug)

---

#### CRIT-2: System Topic Regex Misses `__confluent-*` Prefix Variant

**Description**: The filter regex in `topic-api.ts` line 9 is:
```
/^(_schemas.*|_confluent-.*|__confluent\..*)/
```

This catches `_schemas`, `_confluent-metrics`, and `__confluent.something` (double-underscore + dot). However, Confluent Cloud also creates topics with the prefix `__confluent-` (double-underscore + "confluent-"), e.g.:
- `__confluent-controlcenter-X` (Control Center internal topics)
- `__confluent-monitoring-*`

The pattern `__confluent\.` (with a literal dot) will NOT match `__confluent-controlcenter-...` (with a hyphen). These topics would leak into the user-facing list, causing confusion.

The PRD's AC-18 says: "topics matching the prefix pattern `^(_schemas|_confluent-.*)` are NOT shown". The regex implementation added `__confluent\..*` as an extra variant but missed the hyphen variant for double-underscore.

**Severity**: CRITICAL
**Code Location**: `src/api/topic-api.ts:9`
```typescript
// CURRENT — misses __confluent-* (double underscore + hyphen)
const SYSTEM_TOPIC_PATTERN = /^(_schemas.*|_confluent-.*|__confluent\..*)/;
```
**Suggested Fix**:
```typescript
// Catches all known Confluent system topic prefixes:
// _schemas*, _confluent-*, __confluent-*, __confluent.*
const SYSTEM_TOPIC_PATTERN = /^(_schemas.*|_confluent-.*|__confluent[-.].*)/ ;
```
**Story Points**: 5 (CRITICAL — data visibility bug)

---

#### CRIT-3: Delete Flow Has Double-Navigation Risk (selectedTopic Cleared Before loadTopics Resolves)

**Description**: In `TopicDetail.tsx` `handleDelete` (lines 362-381), the success path is:
```typescript
await deleteTopic(selectedTopic.topic_name);  // clears selectedTopic internally in store
addToast(...);
setShowDeleteConfirm(false);
clearSelectedTopic();   // called AGAIN — redundant but harmless
await loadTopics();     // panel now shows list view while topics reload
```

And in `workspaceStore.ts` `deleteTopic` (lines 916-920):
```typescript
await topicApi.deleteTopic(topicName);
get().clearSelectedTopic();  // immediately clears before loadTopics
await get().loadTopics();    // slow network call — panel switches to list mid-load
```

The component calls `clearSelectedTopic()` AND `loadTopics()` independently, but the store's `deleteTopic` action ALSO calls both. The result is:
1. Store's `deleteTopic` calls `clearSelectedTopic()` → panel snaps to list view
2. Component's `handleDelete` then calls `clearSelectedTopic()` again (harmless but redundant)
3. Component then calls `loadTopics()` again SEPARATELY from the store's call
4. **Two concurrent `loadTopics()` calls run in parallel** — the first resolves and sets `topicList`, then the second resolves and overwrites it again (race condition in the final state)

This is a double-refresh race condition. In production with slow networks, the second `loadTopics()` call (from the component) may resolve with stale data that overwrites the correct state from the store's call.

**Severity**: CRITICAL
**Code Location**: `src/components/TopicPanel/TopicDetail.tsx:362-381` + `src/store/workspaceStore.ts:916-920`
**Suggested Fix**: The store's `deleteTopic` should NOT call `clearSelectedTopic()` or `loadTopics()` — those are UI concerns. The store action should only delete. The component should orchestrate the post-delete flow:
```typescript
// store: deleteTopic — just the API call
deleteTopic: async (topicName) => {
  await topicApi.deleteTopic(topicName);
  // no clearSelectedTopic, no loadTopics — component drives UI
},

// component: handleDelete orchestrates UI
await deleteTopic(selectedTopic.topic_name);
addToast(...);
setShowDeleteConfirm(false);
clearSelectedTopic();
await loadTopics();
```
**Story Points**: 5 (CRITICAL — race condition with data corruption)

---

### HIGH

---

#### HIGH-1: `loadTopics()` on Mount Has No Race-Condition Guard for Rapid Panel Switching

**Description**: `TopicPanel.tsx` calls `loadTopics()` in a `useEffect` on mount (lines 28-32). If the user rapidly clicks between the "Topics" nav item and another panel (e.g., "Schemas"), the component mounts/unmounts rapidly. Each mount triggers a `loadTopics()` call that sets `topicLoading: true` in the store. When the component unmounts mid-load (user switched away), the in-flight API call continues and eventually resolves, writing `topicList` to the store with potentially stale data. The `useEffect` has no cleanup/cancellation.

The config-fetching in `TopicDetail.tsx` correctly uses a `requestIdRef` stale-response guard (lines 319-342). The panel-level `loadTopics` has no equivalent guard.

**Severity**: HIGH
**Code Location**: `src/components/TopicPanel/TopicPanel.tsx:28-32`
**Suggested Fix**: Use an AbortController or a mounted-ref guard in the useEffect, or ensure the store sets a request ID and discards stale responses. At minimum, add a cleanup function:
```typescript
useEffect(() => {
  if (!isConfigured) return;
  let cancelled = false;
  // Pass a cancellation token or use AbortController
  loadTopics();
  return () => { cancelled = true; };
}, [isConfigured, loadTopics]);
```
Alternatively, since `loadTopics` is global store state, ensure the store tracks the current request ID and discards older responses.
**Story Points**: 3 (High — intermittent data consistency bug)

---

#### HIGH-2: No Error Differentiation for 503 vs Network Timeout in `loadTopics`

**Description**: The error handling in `workspaceStore.ts` `loadTopics` (lines 860-877) differentiates 401 and 403 by HTTP status code, but for all other errors it falls through to:
```typescript
} else if (error instanceof Error) {
  errorMessage = error.message;  // returns raw axios message like "Request failed with status code 503"
} else if (error && typeof error === 'object' && !('response' in error)) {
  errorMessage = 'Cannot connect to Kafka REST endpoint.';
}
```

The `else if (error && typeof error === 'object' && !('response' in error))` branch is DEAD CODE for Axios errors. Axios always attaches a `response` property to the error object (even for network errors, it sets it to `undefined`, not absent). So the `'response' in error` check evaluates to `true` even for network errors because the property key exists — it's just `undefined`. This means the friendly "Cannot connect to Kafka REST endpoint." message is never shown. Network failures fall through to the `instanceof Error` branch, showing a raw Axios message like "Network Error".

**Severity**: HIGH
**Code Location**: `src/store/workspaceStore.ts:869-874`
```typescript
// BROKEN — 'response' in error is true for network errors (property exists but is undefined)
} else if (error && typeof error === 'object' && !('response' in error)) {
  errorMessage = 'Cannot connect to Kafka REST endpoint.';
}
```
**Suggested Fix**:
```typescript
// Check for falsy response (undefined), not absence of the key
} else if (axiosError.response === undefined || axiosError.response === null) {
  errorMessage = 'Cannot connect to Kafka REST endpoint.';
}
```
Or use Axios's `isAxiosError` + `error.code === 'ECONNABORTED'` pattern.
**Story Points**: 3 (High — user-facing error message is wrong in production)

---

#### HIGH-3: `deleteTopic` in Store Calls `clearSelectedTopic` Before `loadTopics` Resolves — UI Jumps to Empty List

**Description**: In `workspaceStore.ts` (line 918), `clearSelectedTopic()` is called synchronously before `loadTopics()` resolves. This means:
1. User clicks Delete, types topic name, confirms
2. API delete succeeds
3. `clearSelectedTopic()` fires → panel immediately snaps from detail view to list view
4. BUT `topicList` still contains the deleted topic (not yet refreshed)
5. `loadTopics()` then runs — during this call, the user sees the deleted topic briefly in the list
6. After `loadTopics()` resolves, the topic disappears

This creates a ghost-topic flash in the list. The deleted topic is visible for 200-500ms (API round-trip) after deletion is confirmed.

**Severity**: HIGH
**Code Location**: `src/store/workspaceStore.ts:916-920`
**Suggested Fix**: Either optimistically remove the topic from `topicList` before calling `loadTopics`, or navigate to list view only AFTER `loadTopics` resolves. The current behavior is particularly jarring because the topic the user just deleted appears again momentarily after they confirmed deletion.

Option A — optimistic removal:
```typescript
deleteTopic: async (topicName) => {
  await topicApi.deleteTopic(topicName);
  get().clearSelectedTopic();
  // Optimistically remove from list immediately
  set(state => ({ topicList: state.topicList.filter(t => t.topic_name !== topicName) }));
  await get().loadTopics(); // then reconcile with server state
},
```
**Story Points**: 3 (High — UX defect, deleted topic ghost-appears)

---

#### HIGH-4: `cleanup.policy` Badge Only Handles 'delete' and 'compact' — Misses 'delete,compact' (Combined)

**Description**: Kafka supports `cleanup.policy=delete,compact` — a topic that is both compacted AND time-bounded. The badge renderer in `TopicDetail.tsx` (lines 793-813) only handles exactly `'delete'` (blue badge) or anything else (orange badge, treated as compact):
```typescript
const isDelete = config.value === 'delete';
```
If `cleanup.policy` returns `"delete,compact"` (entirely valid), `isDelete` is `false`, so it renders an orange "compact" badge — incorrectly labeling the policy. The user sees "delete,compact" in the orange badge with compact styling, which is misleading.

**Severity**: HIGH
**Code Location**: `src/components/TopicPanel/TopicDetail.tsx:793-813`
**Suggested Fix**: Parse the value as a comma-separated list and render dual badges or a neutral style:
```typescript
if (config.name === 'cleanup.policy' && config.value && !isSensitive) {
  const policies = config.value.split(',').map(p => p.trim());
  displayValue = (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {policies.map(policy => (
        <span key={policy} style={{
          padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600,
          background: policy === 'delete' ? 'rgba(73,51,215,0.1)' : 'rgba(245,158,11,0.12)',
          color: policy === 'delete' ? 'var(--color-primary)' : 'var(--color-warning)',
        }}>
          {policy}
        </span>
      ))}
    </span>
  );
}
```
**Story Points**: 3 (High — incorrect data representation for a real Kafka config value)

---

#### HIGH-5: No Request Debouncing on Rapid Topic Switching — N+1 Config Fetches

**Description**: Every time `selectedTopic` changes, `TopicDetail.tsx` fires `fetchConfigs()` in a `useEffect` (lines 344-349). The stale-response guard (requestIdRef) prevents stale writes to state, but it does NOT cancel the in-flight HTTP request. If a user rapidly clicks through 10 topics in 1 second:
- 10 `getTopicConfigs` API calls are fired simultaneously
- 9 responses are silently discarded (stale guard)
- 10 concurrent network requests hit the Confluent REST API

For users with 1000+ topics and fast keyboard navigation, this creates significant server-side load and can trigger rate-limiting (HTTP 429). The Confluent Kafka REST API has per-key rate limits.

**Severity**: HIGH
**Code Location**: `src/components/TopicPanel/TopicDetail.tsx:321-342`
**Suggested Fix**: Use `AbortController` to cancel the previous in-flight fetch when a new topic is selected:
```typescript
const fetchConfigs = useCallback(async (signal?: AbortSignal) => {
  if (!selectedTopic) return;
  const myRequestId = ++requestIdRef.current;
  setConfigsLoading(true);
  setConfigsError(null);
  try {
    const data = await topicApi.getTopicConfigs(selectedTopic.topic_name /*, signal */);
    if (myRequestId !== requestIdRef.current) return;
    setConfigs(sortConfigs(data));
  } catch (err) {
    if ((err as Error).name === 'CanceledError') return; // aborted
    // ... error handling
  }
}, [selectedTopic]);
```
**Story Points**: 5 (High — server-side rate limiting risk, especially with keyboard navigation)

---

### MEDIUM

---

#### MED-1: `formatRetentionMs` Has Incorrect Rounding for "Days + Hours" — Shows "7d " with Trailing Space

**Description**: In `TopicDetail.tsx` (lines 53-58), the formatter:
```typescript
if (days > 0) return `${days}d ${hours > 0 ? hours + 'h' : ''}`.trim();
```
The `.trim()` handles the trailing space when `hours === 0`, but the template literal creates `"7d "` (with a trailing space) BEFORE `.trim()` is called. This works correctly for the final output but the interim string is slightly fragile — if the regex or concatenation logic changes, the trailing space could leak.

More importantly: `retention.ms = 604800000` is exactly 7 days → `days=7, hours=0, minutes=0, seconds=0`. The check at line 52 catches this: `if (days > 0 && hours === 0 && minutes === 0 && seconds === 0) return '${days}d'`. So "7d" renders correctly. However, `retention.ms = 90061000` (25h 1m 1s) → `days=1, hours=1, minutes=1, seconds=1`. The formatter returns `"1d 1h"` — dropping the minutes and seconds entirely. This is misleading for intermediate retention values.

For a Flink developer wanting to know exactly what their retention window is, "1d 1h" when the actual value is 25h 1m 1s is slightly imprecise. The raw ms value is always shown, so the human-readable annotation is just a hint — but it should be accurate.

**Severity**: MEDIUM
**Code Location**: `src/components/TopicPanel/TopicDetail.tsx:47-58`
**Story Points**: 2 (Medium — cosmetic accuracy issue for intermediate values)

---

#### MED-2: No Virtualization for 1000+ Topics — Will Freeze Browser

**Description**: `TopicList.tsx` renders all filtered topics as DOM nodes (lines 281-356). With 1000+ topics, this creates 1000+ DOM elements simultaneously. At 1000 topics:
- Each row is ~5 DOM elements (div + icon + span + span + chevron)
- Total: ~5000 DOM nodes for topic list alone
- On Chrome with default settings: initial paint takes ~300ms, scroll becomes janky at ~60fps

The PRD's edge case table acknowledges this: "Topics list has 1000+ topics — List renders with virtual scrolling (or at minimum, no browser freeze)". The implementation chose to defer virtualization and render all rows. The app has `@tanstack/react-virtual` in its dependencies (noted as "unused" in CLAUDE.md), ready to integrate.

This is not theoretical — Confluent Cloud customers regularly have 500-2000 topics per cluster, especially in multi-team environments.

**Severity**: MEDIUM
**Code Location**: `src/components/TopicPanel/TopicList.tsx:280-429`
**Suggested Fix**: Integrate `@tanstack/react-virtual` for the topic list. The pattern is already established in the codebase (Phase 5.2 virtual scrolling). At minimum, add a warning comment and open a tracking ticket. The component's `overflowY: auto` container is already correctly structured for virtualization.
**Story Points**: 8 (Medium-Major enhancement — critical for large clusters)

---

#### MED-3: `canCreate` Check Uses `topicName.trim().length > 0` But Validation Does Not Trim

**Description**: In `CreateTopic.tsx` (line 192), the `canCreate` condition checks:
```typescript
topicName.trim().length > 0
```
But `validateTopicName()` (lines 35-43) does NOT trim the input:
```typescript
function validateTopicName(name: string): string | null {
  if (!name) return 'Topic name is required.';  // !name is falsy check, not trim
  ...
  if (!TOPIC_NAME_PATTERN.test(name))
    return 'Only letters, numbers...';  // spaces fail the regex
}
```

If a user types `"  "` (spaces only), `topicName.trim().length` is 0, so `canCreate` is `false` and the button stays disabled. But the validation error shown is `null` (because `!"  "` is `false`) — so the user sees no validation error and no clear explanation for why the button is disabled.

Edge case: If a user types `" orders"` (leading space), `topicName.trim().length > 0` is `true`, but `validateTopicName` correctly rejects it (space fails regex). So `canCreate` is `false` and the error is shown correctly. The spaces-only case is the problem.

**Severity**: MEDIUM
**Code Location**: `src/components/TopicPanel/CreateTopic.tsx:190-197`
**Suggested Fix**: Either validate trimmed-empty as `'Topic name is required.'` or change `canCreate` to use `topicName.length > 0` (without trim) so the regex validation fires for space-only input and shows a proper error.
**Story Points**: 2 (Medium — confusing blank-button UX for space-only input)

---

#### MED-4: `handleCreate` Silently Ignores Validation Errors — No User Feedback If Called Programmatically

**Description**: In `CreateTopic.tsx` (lines 155-186), `handleCreate` validates the topic name:
```typescript
const error = validateTopicName(topicName);
if (error) {
  return;  // <-- silently returns, no state update
}
```
If `handleCreate` is triggered while `nameValidationError !== null`, it just returns with no user feedback. The Create button is correctly disabled when `!canCreate`, so this path is not reachable via normal UI interaction — but it's reachable via keyboard events (e.g., Enter key on the form if the focus trap malfunctions) or programmatic calls in tests.

More practically, the validation error for `topicName.trim().length > 0` edge case (MED-3 above) means the "Topic Name is required" error message is never shown for space-only input. The return with no feedback compounds MED-3.

**Severity**: MEDIUM
**Code Location**: `src/components/TopicPanel/CreateTopic.tsx:155-161`
**Story Points**: 1 (Low — defensive coding gap, rarely user-visible)

---

#### MED-5: `retention.ms` Input Accepts Decimal Numbers — API Will Reject Them

**Description**: In `CreateTopic.tsx` (lines 469-479), the retention input is:
```typescript
<input
  id="create-topic-retention"
  type="number"
  value={retentionMs}
  onChange={(e) => setRetentionMs(e.target.value)}
  min={-1}
  style={inputStyle}
/>
```
HTML `type="number"` allows decimal values like `1.5` or `604800000.7`. The submit handler does:
```typescript
retentionMs: retentionMs ? parseInt(retentionMs, 10) : undefined,
```
`parseInt('604800000.7', 10)` → `604800000` (silently truncated). But more problematically, `parseInt('1.5', 10)` → `1` — which is then sent to the API as `"1"` ms retention. The user typed 1.5 seconds and got 1 millisecond. No validation error is shown.

More importantly, `parseInt('abc', 10)` → `NaN`, and `retentionMs ? NaN : undefined` evaluates to `undefined` (since `NaN` is falsy). So invalid string input (possible if the browser allows non-numeric input) is silently dropped — which is actually the correct behavior. But decimal truncation without warning is a UX issue.

**Severity**: MEDIUM
**Code Location**: `src/components/TopicPanel/CreateTopic.tsx:172,469-479`
**Suggested Fix**: Use `step="1"` on the input and validate that `retentionMs` is a positive integer (or -1):
```typescript
<input type="number" min={-1} step="1" ... />
// In validation: if (retentionMs && !Number.isInteger(parseFloat(retentionMs))) { error }
```
**Story Points**: 2 (Medium — silent data truncation)

---

#### MED-6: No Timeout Configuration on Kafka REST Client — Requests Can Hang Indefinitely

**Description**: `kafka-rest-client.ts` creates the Axios instance with no `timeout` option. The existing `confluent-client.ts` also has no timeout, but Kafka REST API calls can be particularly slow (especially for large topic lists or slow cluster connections). An indefinitely-hanging request means `topicLoading` stays `true` forever, blocking the UI.

**Severity**: MEDIUM
**Code Location**: `src/api/kafka-rest-client.ts:12-18`
**Suggested Fix**:
```typescript
export const kafkaRestClient: AxiosInstance = axios.create({
  baseURL: KAFKA_API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // 30s — Kafka REST API can be slow
});
```
**Story Points**: 2 (Medium — reliability issue on slow networks)

---

#### MED-7: Config Value Column Has `maxWidth: 0` with `overflow: hidden` — Long Values Silently Truncated with No Tooltip Trigger

**Description**: In `TopicDetail.tsx` (line 850), the value `<td>` has `maxWidth: 0`. This is the CSS trick to allow `text-overflow: ellipsis` on a table cell, but the `title` attribute (tooltip) is set on the inner `<span>`, not the `<td>`. For the special-rendered values (`retention.ms` compound node, `cleanup.policy` badge), the `title` is:
```typescript
title={typeof displayValue === 'string' ? displayValue : config.value ?? ''}
```
When `displayValue` is a React node (not a string), `title` falls back to `config.value ?? ''`. For `retention.ms`, `config.value` is the raw ms string (e.g., `"604800000"`), not the human-readable `"7d"`. The tooltip shows `604800000` instead of `7d`. This is confusing — the user sees "604800000 7d" but the tooltip (which should reveal the full value) shows `604800000`.

Additionally, `maxWidth: 0` on the `<td>` causes some browsers (notably Firefox) to collapse the column entirely unless explicit width is set elsewhere in the table.

**Severity**: MEDIUM
**Code Location**: `src/components/TopicPanel/TopicDetail.tsx:840-866`
**Story Points**: 2 (Medium — tooltip shows wrong value for key configs)

---

### LOW

---

#### LOW-1: `console.log` Interceptors Left in Production Code — Leaks Topic Names and Config Data

**Description**: `kafka-rest-client.ts` has verbose `console.log` statements in both the request and response interceptors (lines 23, 33). In production, these log every topic name, partition count, config value, and API response to the browser console. Config responses can include sensitive data (Kafka SSL passwords, SASL credentials) even though the API marks them as `is_sensitive`.

```typescript
console.log(`[Kafka REST Response] ${response.status}`, response.data);
```
This logs the ENTIRE response body — including any configs with `is_sensitive: true`.

**Severity**: LOW (but with HIGH security implication in regulated environments)
**Code Location**: `src/api/kafka-rest-client.ts:22-34`
**Suggested Fix**: Guard with `import.meta.env.DEV`:
```typescript
if (import.meta.env.DEV) {
  console.log(`[Kafka REST Response] ${response.status}`);
  // Do NOT log response.data — it may contain sensitive configs
}
```
**Story Points**: 2 (Low bug, 1 security)

---

#### LOW-2: Back Navigation Does Not Restore Focus to Previously Selected Topic Row

**Description**: AC-6 states "the previously selected topic row receives focus" after using the back arrow. The current implementation of `clearSelectedTopic()` sets `selectedTopic: null` in the store, which causes `TopicPanel` to render `<TopicList />`. But nothing restores focus to the topic row that was selected. The user's focus jumps to the document body or the last-focused element.

For keyboard-first Flink developers (who navigate via Tab/Arrow keys), losing focus position after back-navigation forces them to Tab all the way back to the target row.

**Severity**: LOW
**Code Location**: `src/components/TopicPanel/TopicPanel.tsx:23` + `src/components/TopicPanel/TopicList.tsx`
**Suggested Fix**: Store the last-selected topic's `topic_name` in local state (not Zustand), then after `clearSelectedTopic()` use a `useEffect` in `TopicList` to focus the matching row:
```typescript
// In TopicList, accept lastSelectedTopicName prop
useEffect(() => {
  if (lastSelectedTopicName) {
    const idx = filteredTopics.findIndex(t => t.topic_name === lastSelectedTopicName);
    if (idx >= 0) setFocusedIndex(idx);
  }
}, []);
```
**Story Points**: 2 (Low — keyboard navigation gap from AC-6)

---

#### LOW-3: Delete Confirmation Dialog Title Renders Full Topic Name — Overflows at 249 Characters

**Description**: The delete confirmation dialog title in `TopicDetail.tsx` (line 157) renders:
```typescript
<h3>Delete {topicName}?</h3>
```
With a 249-character topic name (Kafka's maximum), this creates a very long title that will overflow the `maxWidth: 340` dialog box. The `<h3>` has no `overflow: hidden`, `text-overflow: ellipsis`, or wrapping constraint. It wraps to multiple lines and potentially overflows the dialog visually.

**Severity**: LOW
**Code Location**: `src/components/TopicPanel/TopicDetail.tsx:147-157`
**Suggested Fix**:
```typescript
<h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
  Delete {topicName}?
</h3>
```
Or wrap only the topic name portion with monospace + ellipsis.
**Story Points**: 1 (Low — cosmetic overflow for very long names)

---

#### LOW-4: CreateTopic Dialog Does Not Return Focus to Create Button on Close

**Description**: The PRD states "after close (success or cancel), focus returns to the Create button in TopicList". The current `CreateTopic.tsx` implementation has no `onClose` focus-return logic. The dialog closes and focus is dropped to `document.body`. For keyboard users, this requires re-tabbing from scratch.

**Severity**: LOW
**Code Location**: `src/components/TopicPanel/CreateTopic.tsx` — no focus-return logic
**Suggested Fix**: Pass a `triggerRef` prop from `TopicList` to `CreateTopic`, or use a DOM selector to find the create button and call `.focus()` in the `onClose` handler.
**Story Points**: 2 (Low — keyboard accessibility gap)

---

#### LOW-5: `getTopicDetail` API Function Is Unused — Dead Code

**Description**: `topic-api.ts` exports `getTopicDetail()` (lines 20-25), which fetches a single topic by name. This function is never called anywhere in the application. The panel uses the `KafkaTopic` object from the list (passed via Zustand `selectTopic`) and loads configs separately via `getTopicConfigs()`. `getTopicDetail()` is dead code.

This is not a bug, but it creates maintenance overhead — future developers may assume it's used and maintain it unnecessarily, or call it inadvertently creating redundant API calls.

**Severity**: LOW
**Code Location**: `src/api/topic-api.ts:20-25`
**Suggested Fix**: Either remove the function or add a JSDoc comment marking it as reserved for Phase 12.4 (partition detail view). The existing tests for `getTopicDetail` in `topic-api.test.ts` cover it thoroughly — those tests should be kept as documentation of expected behavior.
**Story Points**: 1 (Low — dead code cleanup)

---

#### LOW-6: Partition Count Badge Uses Inline Hex RGBA — Breaks Dark Mode Contrast

**Description**: The partition badge in `TopicDetail.tsx` (lines 426-439) uses hardcoded `rgba(73,51,215,0.1)` as the background — not a CSS custom property. In dark mode, this may provide insufficient contrast (10% opacity purple on a dark surface is nearly invisible). Similarly, the replication factor badge uses `rgba(34,197,94,0.1)` — raw hex, not CSS vars.

The cleanup.policy badge has the same issue (`rgba(73,51,215,0.1)` and `rgba(245,158,11,0.12)`).

All other panels use CSS custom properties for badge colors. The SchemaPanel uses similar badge patterns — check if SchemaDetail established a CSS var convention that was not carried over.

**Severity**: LOW
**Code Location**: `src/components/TopicPanel/TopicDetail.tsx:432, 452, 803, 808`
**Suggested Fix**: Add CSS custom properties `--badge-primary-bg`, `--badge-success-bg`, `--badge-warning-bg` and use them. Or verify that the values match what SchemaPanel uses and accept them as a project-wide pattern.
**Story Points**: 2 (Low — dark mode potential contrast issue)

---

## Performance Concerns

### PERF-1: 1000+ Topics — Unvirtualized List (Critical for Enterprise Clusters)

**File**: `src/components/TopicPanel/TopicList.tsx:280`

**Measurement estimate**:
- 1000 topic rows × ~5 DOM nodes each = ~5000 DOM nodes
- Chrome DOM mutation budget: ~1000 nodes/16ms for 60fps
- Estimated initial render: ~300ms (noticeable jank)
- Client-side search filter on 1000 items: ~2ms (acceptable — pure JavaScript, no DOM mutations)

**Recommendation**: Integrate `@tanstack/react-virtual` (already in dependencies). The container structure (`overflowY: auto`, flex column) is already virtualization-ready. This is the highest-ROI performance fix — it unblocks all enterprise use cases.

---

### PERF-2: Config Table Renders ~100+ Rows Without Virtualization

**File**: `src/components/TopicPanel/TopicDetail.tsx:747`

Kafka topics can have 100+ configuration entries (Confluent Cloud broker defaults expose all configs even if `is_default: true`). All configs are rendered as table rows simultaneously. At 100 rows, this is not a performance problem. At 200+ rows (full broker config export), it creates ~1000 DOM nodes for the config table alone. Not critical today, but should be tracked.

---

### PERF-3: Auth Header Re-Encoded on Every Request (After Fix for CRIT-1)

**File**: `src/api/kafka-rest-client.ts`

After fixing CRIT-1 (moving auth header to interceptor), `btoa()` is called on every request. `btoa()` is synchronous and fast, but it re-encodes the same static credential string repeatedly. A memoization wrapper would eliminate this:
```typescript
let cachedAuthHeader: string | null = null;
const getKafkaAuthHeader = (): string => {
  if (!cachedAuthHeader) {
    cachedAuthHeader = `Basic ${btoa(`${env.kafkaApiKey}:${env.kafkaApiSecret}`)}`;
  }
  return cachedAuthHeader;
};
```
This is a micro-optimization but clean.

---

## UX Friction Points

### UX-1: Advanced Section Discoverability — Most Users Will Never Set Retention

**Finding**: The "Advanced Options" section in CreateTopic is collapsed by default with a text button labeled "Advanced Options" + a chevron icon. This is correct design for reducing cognitive load. However, experienced Flink developers creating topics for Flink jobs ALWAYS need to set `retention.ms` — Flink stateful operations depend on topic retention being long enough to outlast the Flink job's processing lag. Hiding retention behind "Advanced" trains users to skip it.

**Suggestion**: Consider making `retention.ms` a visible field with a "Use broker default" checkbox. Or rename the section "Retention & Cleanup" to make it more discoverable. The "Advanced" label implies complexity, not common settings.

**Impact**: Medium — daily Flink developers will remember to expand Advanced, but new users will create topics with default retention that may be too short for their Flink workloads.

---

### UX-2: Config Table Has No Copy-on-Click for Values

**Finding**: The topic name in the detail view is clickable to copy (with a clipboard icon). Config values have NO copy mechanism. A Flink developer who needs to copy a config value (e.g., a Kafka client config to paste into their Flink job) must manually select text in the truncated cell. Given that values are truncated with ellipsis and the cell is small, text selection is difficult.

**Suggestion**: Add clipboard icon on row hover for config name and value columns, similar to the column-copy pattern in Phase 5.4.

**Impact**: High daily friction — every time a developer needs to reference a config value in their Flink SQL session properties.

---

### UX-3: Delete Confirmation Dialog Focus Starts on Cancel Button, Not the Input Field

**Finding**: `DeleteConfirm` focuses the Cancel button on mount (`cancelBtnRef.current?.focus()`). This is a good safety choice (accidental Enter on Delete button is prevented). However, the most likely next action for a user who INTENDS to delete is typing the topic name. They must Tab to the input before they can type.

**Suggestion**: Focus the confirmation input on mount, not the Cancel button. The Delete button being disabled until the name is typed provides sufficient safety. This reduces the actions required from 2 keyboard actions (Tab + type) to 1 (type immediately).

---

### UX-4: No "Query This Topic" Button — Forces Context Switch to SQL Editor

**Finding**: Phase 12.4 plans a "Query with Flink" button. However, even without that button, there is no way to copy a `SELECT` statement or topic name in a format ready for Flink SQL. The "Copy topic name" button copies just the name, but a Flink developer needs it in backtick-quoted form for their SQL: `` `my.topic.v1` ``.

**Suggestion**: Add a secondary copy action "Copy as Flink SQL" that copies `` `topic_name` `` with proper quoting. This can be done without Phase 12.4 changes.

---

### UX-5: No Partition Count or Message Count in List — Can't Spot Over/Under-Partitioned Topics at a Glance

**Finding**: The list shows `Np · RF:M` (partition count · replication factor). This is useful but incomplete. Experienced Flink developers immediately scan for topics with too few partitions (bottleneck for Flink parallelism) or the wrong RF. The current display works for this. However, there is no indication of topic activity (consumer lag, message count, throughput) — which would require additional API calls not in scope for this phase.

**Suggestion**: For Phase 12.4, consider adding `lag` or `message count` from the partitions endpoint. For this phase, the existing display is adequate.

---

### UX-6: Error Message for 503 Shows Raw Axios Message

**Finding**: Due to the dead-code branch identified in HIGH-2, network errors and 503 responses show raw Axios error messages like "Request failed with status code 503" instead of the intended "Cannot connect to Kafka REST endpoint." message. This is not developer-friendly and leaks implementation details.

---

## Enhancement Ideas

### ENH-1: "Insert Topic Name" Into Active SQL Editor (Phase 12.4 Preview)
**Description**: A "Use in SQL" button in TopicDetail that calls the shared `editorRegistry` to insert the topic name (backtick-quoted) at the cursor position in the active Monaco editor. This would bridge the Topic panel with the SQL workspace without requiring a full tab switch.
**Story Points**: 5 (Medium enhancement)

### ENH-2: Topic Health Indicators (Partition Count vs. Flink Parallelism Warning)
**Description**: Show a warning badge on topics where `partitions_count < 2` (typical minimum for production Flink). This is a Kafka domain best practice that Flink developers need to know.
**Story Points**: 5 (Medium enhancement)

### ENH-3: Config Search/Filter Within Detail View
**Description**: 100+ config rows are hard to scan. A filter input within the config table (e.g., type "ssl" to filter to SSL-related configs) would dramatically improve the experience for experienced users who know what they're looking for.
**Story Points**: 3 (Minor enhancement)

### ENH-4: Show Last Modified Timestamp on Topic Row
**Description**: If the Confluent REST API returns a `created_at` or `last_modified_at` field (it may not for all cluster types), showing the topic age in the list would help Flink developers identify stale topics to clean up.
**Story Points**: 2 (Minor enhancement — API availability dependent)

### ENH-5: Bulk Delete Topics (Multi-Select)
**Description**: Clusters accumulate test topics rapidly. A multi-select checkbox mode with bulk delete would be a significant time-saver. Out of scope for Phase 12.3 (one-at-a-time delete only), but high value.
**Story Points**: 13 (Major enhancement)

### ENH-6: Copy Config Value Button on Row Hover
**Description**: As noted in UX-2, config values need copy-on-click. Implement the same hover-reveal clipboard icon pattern as Phase 5.4 column copy.
**Story Points**: 3 (Minor enhancement)

### ENH-7: "Compact" Policy Warning When Creating — Data Loss Risk
**Description**: When the user selects `compact` as the cleanup policy in CreateTopic, show a warning callout: "Log compaction retains only the latest value per key. Messages with no key are never compacted and may accumulate indefinitely." This is a common Kafka footgun that Flink developers hit when they expect key-based compaction but have keyless messages.
**Story Points**: 2 (Minor enhancement)

---

## What Works Well

1. **Schema-panel mirror pattern is faithful**: The panel structure, header behavior, list/detail navigation, and state pattern are consistent with SchemaPanel. The design review's 5-reviewer approval was warranted.

2. **Stale-response guard in `fetchConfigs`**: The `requestIdRef` pattern in `TopicDetail.tsx` is clean and correct. It prevents the most common async bug in sequential async calls.

3. **Delete confirmation UX is strong**: Requiring exact topic name match is the correct approach for an irreversible action. The warning copy ("Active Flink queries referencing this topic may fail") is domain-accurate and genuinely useful.

4. **URL encoding is consistent**: All API calls correctly use `encodeURIComponent()` for topic names in URL path segments. Topic names with dots, hyphens, and underscores will work correctly.

5. **Config sorting (pinned retention.ms + cleanup.policy)**: Surfacing the two most critical configs at the top of the table is excellent domain knowledge applied correctly.

6. **`formatRetentionMs` handles the -1 infinite case**: The "Infinite" label for `retention.ms = -1` is correct and avoids the confusing "ms" suffix.

7. **System topic filtering prevents clutter**: The intent is correct — `__consumer_offsets`, `_schemas`, and `_confluent-*` should be hidden. The implementation just needs the regex fix (CRIT-2).

8. **Environment guard in TopicPanel**: The `isConfigured` check before calling `loadTopics()` is clean and the error state UI clearly explains what env vars are needed.

9. **CreateTopic form validation is correct for Kafka naming rules**: Max 249 chars, regex `[a-zA-Z0-9._-]+`, block `.` and `..` — these match Kafka's actual validation rules.

10. **Test coverage is thorough**: The `topic-api.test.ts` and `topicStore.test.ts` files cover the primary flows, URL encoding, and key error cases. The test marker system is consistently applied.

---

## Summary Table

| ID | Severity | Description | Story Points |
|----|----------|-------------|-------------|
| CRIT-1 | CRITICAL | Auth header burned at module load time | 3 |
| CRIT-2 | CRITICAL | System topic regex misses `__confluent-*` variant | 5 |
| CRIT-3 | CRITICAL | Double `loadTopics()` race condition after delete | 5 |
| HIGH-1 | HIGH | No unmount guard on `loadTopics` during rapid panel switching | 3 |
| HIGH-2 | HIGH | Dead code branch — network error message never shown | 3 |
| HIGH-3 | HIGH | Deleted topic ghost-appears in list after confirmed delete | 3 |
| HIGH-4 | HIGH | `cleanup.policy=delete,compact` rendered as compact-only badge | 3 |
| HIGH-5 | HIGH | Rapid topic switching fires N concurrent config fetches | 5 |
| MED-1 | MEDIUM | `formatRetentionMs` drops minutes/seconds for mixed durations | 2 |
| MED-2 | MEDIUM | No virtualization — 1000+ topics will freeze browser | 8 |
| MED-3 | MEDIUM | Space-only topic name shows no validation error | 2 |
| MED-4 | MEDIUM | `handleCreate` silently returns on validation error | 1 |
| MED-5 | MEDIUM | Decimal retention.ms silently truncated by `parseInt` | 2 |
| MED-6 | MEDIUM | No HTTP timeout on Kafka REST client | 2 |
| MED-7 | MEDIUM | Config value tooltip shows raw ms, not human-readable | 2 |
| LOW-1 | LOW | `console.log` leaks sensitive config data in production | 2 |
| LOW-2 | LOW | Back navigation doesn't restore focus to selected row | 2 |
| LOW-3 | LOW | Delete dialog title overflows for 249-char topic names | 1 |
| LOW-4 | LOW | CreateTopic does not return focus to Create button on close | 2 |
| LOW-5 | LOW | `getTopicDetail` is dead code — never called | 1 |
| LOW-6 | LOW | Partition/RF badges use hardcoded hex RGBA (dark mode risk) | 2 |
| **Total** | | | **57 pts** |

---

## Release 2 Recommendation

Based on severity and story points, the following grouping is recommended for Release 2 (26+ story points trigger a release batch):

**Priority 1 — Fix Before Phase 12.4 Starts** (Bugs only, ~22 pts):
- CRIT-1 (3), CRIT-2 (5), CRIT-3 (5), HIGH-2 (3), HIGH-3 (3), HIGH-4 (3)

**Priority 2 — Release 2 batch** (~35 pts — exceeds 25pt threshold):
- HIGH-1 (3), HIGH-5 (5), MED-2 (8), MED-3 (2), MED-5 (2), MED-6 (2), LOW-1 (2), ENH-2 (5), ENH-3 (3), ENH-6 (3)

**Priority 3 — Release 3** (remaining low items + major enhancements):
- MED-1, MED-7, LOW-2, LOW-3, LOW-4, LOW-5, LOW-6, ENH-1, ENH-4, ENH-5, ENH-7
