# Feature Implementation Workflow (Phases A, B, C)

These three phases are executed sequentially during Phase 2 of the orchestration workflow. They cover design, implementation, validation, and shipping.

---

## Phase A: DESIGN (Before ANY code is written)

### A1. TECHNICAL PRD (Haiku subagent)

Write technical PRD to `docs/features/{feature-name}.md` with: problem statement, proposed solution, files to modify, API changes, type changes, acceptance criteria, edge cases.

PRD must also include a **Test Coverage Plan** with tiers clearly labeled per [docs/TESTING-STRATEGY.md](../TESTING-STRATEGY.md):
- **Tier 1 (BLOCKING):** Happy path + critical error scenarios (must pass before ship)
- **Tier 2 (ASYNC):** Edge cases, concurrency, performance (completed in Track C post-ship)

### A2. DESIGN REVIEW (5 parallel reviewers)

All must approve before proceeding:

1. **Principal Architect** — system design fit, REST compliance
   - **Design Review Checklist:**
     - System design: Does this fit existing architecture? Scalability concerns? Coupling risks?
     - **REST API Compliance** (if APIs created/modified):
       - HTTP verbs correct: GET (retrieve), POST (create), PUT/PATCH (update), DELETE (remove)
       - URL structure: RESTful paths (`/api/resource`, `/api/statements/{id}`, NOT `/api/getResource`)
       - Request payloads: Well-formed JSON, proper `Content-Type` headers
       - Response payloads: Consistent structure, proper status codes (200, 201, 400, 401, 404, 5xx)
       - Idempotency: GET requests never have side effects
       - Confluent Flink SQL API contract: If using Confluent APIs, verify alignment with official docs
     - State management: Zustand patterns, persistence config, selector design
     - Separation of concerns: API layer, business logic, components cleanly separated
   - **Output:** "APPROVE" or "NEEDS CHANGES" with specific feedback

2. **Principal Engineer** — implementation approach
   - Code patterns, edge cases, error handling, type safety, testing strategy
   - **Output:** "APPROVE" or "NEEDS CHANGES" with specific feedback

3. **QA Manager** — test coverage plan validation
   - Tier 1/Tier 2 breakdown adequate? Coverage targets realistic?
   - **Output:** "APPROVE" or "NEEDS CHANGES" with specific feedback

4. **UX/IA/Accessibility Reviewer** — user journey, discoverability, accessibility
   - **Output:** "APPROVE" or "NEEDS CHANGES" with specific feedback

5. **SR Flink/Kafka Engineer** — domain usefulness
   - Real-world Flink/Kafka workflow fit? Enhancement opportunities? Simplification possibilities?
   - **Output:** "APPROVE" or "NEEDS CHANGES" with specific feedback

### A3. REVISE (if needed)

If any reviewer flags issues, revise PRD/tests/design and re-review affected sections until all 5 approve.

---

## Phase B: IMPLEMENT (After design approval)

### B1. IMPLEMENT (Parallel subagents, split by file ownership)

- **CRITICAL: Split work by file ownership, NOT by severity or item count**
- Max 3-4 parallel impl agents at once
- **No two agents may touch the same file** — this is the hard constraint
- Each agent owns a set of files and implements ALL items touching those files

**File Ownership Splitting Strategy:**
1. **Group items by which files they modify** (read the bug/enhancement list, map each to files)
2. **Assign file groups to agents** so no file appears in two agents' scope:
   - Agent 1: API layer files (`*-client.ts`, `*-api.ts`, store actions)
   - Agent 2: Component group A (`ComponentA/*.tsx` + its tests)
   - Agent 3: Component group B (`ComponentB/*.tsx` + its tests)
   - Agent 4: Shared files (`types/index.ts`, `workspaceStore.ts` state additions) — runs first if others depend on it
3. **Tests follow the component** — the agent that changes a source file also updates its tests
4. **Shared file bottleneck**: If `workspaceStore.ts` or `types/index.ts` is touched by multiple items, ONE agent handles all store/type changes. Other agents work on component-only changes that don't touch shared files.
5. **Launch all agents in parallel** in a single message (not sequentially)

**Example split for a combined release sprint:**
| Agent | Files Owned | Items |
|-------|-------------|-------|
| API + Store | `kafka-rest-client.ts`, `topic-api.ts`, `workspaceStore.ts`, `types/index.ts` | CRIT-1, CRIT-2, HIGH-2, store bugs |
| TopicPanel | `TopicDetail.tsx`, `TopicList.tsx`, `CreateTopic.tsx`, `TopicPanel.tsx` + tests | CRIT-3, HIGH-3/4/5, MED items, LOW items |
| SchemaPanel | `SchemaPanel/` files + tests | All schema release items |
| New features | New files only (e.g., `PartitionTable.tsx`) | Major enhancements needing new files |

### B2. BROWSER TEST (Immediate - after EACH feature commit)

**Trigger:** Phase B1 implementation complete
**Responsible:** Opus (orchestrator) — NOT delegated
**Output:** Browser test screenshots + verdicts for ALL PRD scenarios

**Required Steps:**
1. Ensure dev server running (`npm run dev`)
2. Launch browser automation:
   - **Playwright** for automated testing with screenshots, OR
   - **Chrome Extension** for manual interaction with screenshot capture
3. **Test Coverage:** Test every scenario from PRD:
   - Happy path (normal operation)
   - All edge cases
   - Error scenarios (4xx/5xx, network failures)
   - Dark mode rendering
   - Light mode rendering
   - Keyboard navigation (if interactive)
4. **Screenshot Requirement (CRITICAL for QA Manager sign-off):**
   - Capture screenshot for EVERY test scenario (happy path, each edge case, each error, both modes)
   - Each screenshot shows: feature state, interaction, result
   - Include browser address bar (proves URL/context)
   - Document each: "Screenshot X shows [description]"
5. **Verdict:** Mark each scenario ✅ PASS or ❌ FAIL with error details
6. **Delivery:** Hand all screenshots + verdicts to QA Manager (Phase 2.5 input)
7. **If Bugs Found:** Stop. Launch fix agents. Re-test and re-screenshot after fix.

**Key:** QA Manager will sign off on these screenshots in Phase 2.5. Every PRD scenario must have a screenshot proving it works.

### B3. QA VALIDATE (Sonnet subagents)

After browser tests pass:

**Part A:** Test marker validation
- All new/modified code has test markers
- Tests runnable with marker subset
- All tests PASS (zero failures)

**Part B:** Code review
- Logic flow: trace execution paths, verify correctness
- Error handling: try/catch blocks, proper logging, user feedback
- Type safety: no unnecessary `any` types, API responses properly typed
- Patterns: follows existing codebase conventions
- Edge cases: all PRD scenarios handled correctly

**Part C:** API validation (if APIs created/modified)
- **REST Structure Compliance:**
  - ✅ HTTP verbs semantically correct: GET (retrieve, no side effects), POST (create), PUT/PATCH (update), DELETE (remove)
  - ✅ URL structure: RESTful paths (`/api/resource`, `/api/statements/{id}`, NOT `/api/getStatement` or `/api/resource?action=get`)
  - ✅ Request payloads: Well-formed JSON, correct `Content-Type: application/json` header
  - ✅ Response payloads: Consistent structure matching TypeScript interfaces in `src/types/index.ts`
  - ✅ Status codes semantically correct: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 5xx Server Error
  - ✅ Idempotency: GET/HEAD/PUT are safe and idempotent; POST is not idempotent
- **API Contract Validation:**
  - ✅ Request structure matches `src/api/flink-api.ts` function signatures
  - ✅ Request field names, types, required vs optional per Confluent Flink SQL API docs
  - ✅ Response types defined in `src/types/index.ts` with all properties covered
  - ✅ Error response shapes: status code, error message path, proper error handling
  - ✅ HTTP clients used: `confluentClient` for Flink SQL, `fcpmClient` for Cloud Management (NOT raw fetch)
- **Confluent Flink SQL Specific:**
  - ✅ Statement execution flow: POST `/statements` → GET `/statements/{id}` polling → GET `/statements/{id}/results`
  - ✅ Cursor pagination: proper cursor management, 5000-row buffer limit respected
  - ✅ Streaming results: handles cursor pagination, empty results, timeouts
  - ✅ Workspace/catalog operations: proper error handling for missing workspaces/tables
  - ✅ Credentials: Basic Auth correctly formatted, sensitive data not logged
- **API Test Coverage:**
  - ✅ Every new/modified API call has tests in `src/__tests__/`
  - ✅ Tests cover: success path, 4xx/5xx errors, network failures, edge cases from PRD
  - ✅ Request/response assertions verify structure matches contract
  - ✅ All tests use mocked responses from `src/test/mocks/api.ts` (no live API calls)

### B4. FIX (Haiku subagents)

Fix each bug found by QA, then re-QA.

### B5. UX REVIEW (Sonnet subagent)

Review: dark/light modes, consistency, accessibility (focus, aria, keyboard nav), polish.

### B6. FIX UX (Haiku subagents)

Fix UX issues, re-test in browser.

### B6.5. SENIOR QA TEST PLANNING (Sonnet subagent)

Separate tests by tier before B8:
- Tier 1: Must be completed in B8 (before shipping)
- Tier 2: Deferred to Track C (post-ship) — stubs created in B8

### B8. UPDATE TESTS (Haiku subagent)

- Implement all Tier 1 tests identified in B6.5
- Create Tier 2 stub files with `TODO` comments (not skipped, just empty)
- Run `npm test -- -t "tier1"` — MUST pass 100%
- Gate Rule: TPPM accepts ONLY if Tier 1 tests pass 100%
- Reference: [docs/TESTING-STRATEGY.md](../TESTING-STRATEGY.md)

---

## Phase C: SHIP

### C0. DOCUMENTATION REVIEW (Sonnet subagent)

Review code documentation clarity. Critical/Major gaps block commit.

### C1. FAQ/HOWTO (Haiku subagent)

Create user-facing FAQ from technical PRD. Store in `docs/faqs/{feature-name}.md`.

### C2. DOCS & COMMIT

Update PRD with implementation notes, verify FAQ complete, update README if needed.

---

## Key Rules

- **Design review is NOT optional** - All 5 reviewers must approve
- **Browser test every feature** - IMMEDIATELY after implementation. No batching.
- **Test markers = HARD BLOCKER** - All new code must have test markers. QA verifies markers exist, runs subset tests, confirms they pass.
- **Tier 1 tests must pass 100%** - Before Phase 2.5 approval
- **QA validates with screenshots** - Browser test screenshots are proof of functionality
- **UX review covers dark/light/accessibility** - No feature ships without full accessibility validation
- **Documentation review gates commit** - Code clarity is critical before shipping
