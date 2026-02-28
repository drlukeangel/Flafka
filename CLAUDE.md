# CLAUDE.md - Project Instructions

## Project Overview
Flink SQL Workspace UI - A React app connecting to Confluent Cloud's Flink SQL API.
Stack: React + TypeScript + Vite + Zustand + Monaco Editor + Axios

## Development Commands
- `npm run dev` - Start dev server (Vite with proxy to Confluent Cloud)
- `npm run build` - Production build
- `npm run lint` - ESLint

## CRITICAL: Git Restrictions

**NEVER use `git stash` under any circumstances.**
- Do NOT run `git stash`, `git stash push`, `git stash pop`, `git stash drop`, or any stash variant
- Stashing silently buries uncommitted work and causes permanent data loss
- If you have uncommitted changes and need to switch context, stop and ask the user what to do

**NEVER run `git reset --hard`, `git checkout -- .`, or `git restore .`** without explicit user instruction.
- These destroy uncommitted work irreversibly

**NEVER force-push** (`git push --force` or `git push -f`) without explicit user instruction.

**NEVER amend commits** (`git commit --amend`) without explicit user instruction.

**NEVER add `Co-Authored-By: Claude` to commit messages.**

**Only commit when the user explicitly asks for a commit.**

---

## Multi-Agent Workflow (Phases 1-5) — Continuous Pipeline Model

This is the overarching orchestration framework that wraps all feature development. It ensures product quality, validates requirements, and drives continuous roadmap iteration.

**Core Principle:** TPPM gets ahead and writes PRDs while engineering builds, so there's always a signed-off feature ready to go. Engineering never waits for TPPM to finish the next PRD.

**Pipeline Visualization:**
```
Timeline ─────────────────────────────────────────────────────────────────
Feature A:  Phase 1 → Phase 2/3/4 (engineering) ← Phase 5 (roadmap sync)
            ↑                                       ↓
            └─ TPPM completes PRD                 TPPM synthesizes feedback
                ↓
Feature B:     ▓▓▓ Phase 1 (TPPM writes PRD) ▓▓▓ → Ready for Phase 2
                     ↓
                  Phase 2/3/4 starts immediately (no wait)
                     ↓
Feature C:          ▓▓▓ Phase 1 (TPPM writes) ▓▓▓ → Waiting in queue
```

**Key Flow:**
1. TPPM writes Feature B's PRD **while** engineering is building Feature A (Phases 2-4)
2. Feature A Phase 2-4 completes → Phase 5 happens
3. Feature B's Phase 1 is already signed off → Engineering immediately starts Feature B Phase 2 (no blocking wait)
4. Simultaneously, TPPM starts Feature C's Phase 1 PRD **while** engineering builds Feature B
5. Repeat

**Result:** Continuous feature delivery with zero idle time for engineering.

### Phase 1: PRD Definition & Sign-off (TPPM Gets Ahead)

**Trigger:** TPPM reviews next item in `roadmap.md` Prioritized Backlog (can happen while engineering is in Phases 2-4 of current feature)
**Responsible Agent:** Technical Principal Product Manager (TPPM)
**Output:** "PRD SIGN-OFF APPROVED" or "NEEDS CHANGES"
**Pipeline Model:** TPPM works on Feature N+1's PRD while engineering is implementing Feature N (Phases 2-4)

**Steps:**
1. TPPM reads the next highest-ranked item from `roadmap.md` Prioritized Backlog
2. TPPM writes or reviews the draft PRD (can use Haiku agent to draft, TPPM reviews)
3. TPPM validates:
   - Problem statement clarity
   - Functional acceptance criteria are testable and specific
   - Non-functional acceptance criteria defined (performance, UX, accessibility, scalability)
   - Edge cases identified and documented
4. TPPM writes all acceptance tests (both functional and non-functional) that will be used to validate the feature
5. TPPM explicitly signs off with **"PRD SIGN-OFF APPROVED"** — this unblocks Phase 2 when engineering is ready

**If NEEDS CHANGES:** TPPM works with Haiku agent to revise until approval.

**Key:** TPPM should complete Phase 1 PRD sign-off **before** current feature's Phase 2 completes, so engineering never has idle wait time for the next PRD.

---

### Phase 2: Development & QA (Parallel Implementation)

**Trigger:** Phase 1 PRD SIGN-OFF APPROVED (should already be waiting in queue, no blocking wait)
**Responsible:** Opus (orchestrator) + Haiku/Sonnet implementation + QA agents
**Output:** Tested, documented, browser-verified code ready for acceptance validation
**Key:** Engineering should **never wait** for TPPM to finish Phase 1. TPPM gets ahead during previous feature's Phase 2-4 so this PRD is already approved.

**Execution:** Follow the detailed **Feature Implementation Workflow (Phases A-C)** below.

**Parallel Work:** While engineering is in Phase 2, TPPM is already working on Feature N+2's Phase 1 PRD (for the feature after this one).

---

### Phase 3: Final Acceptance Validation (BLOCKING)

**Trigger:** Phase 2 development + QA complete
**Responsible Agent:** Technical Principal Product Manager (TPPM)
**Output:** "FEATURE ACCEPTANCE APPROVED" or "NEEDS CHANGES"

**Steps:**
1. TPPM receives the developed feature + browser test screenshots + QA report
2. TPPM validates:
   - **All acceptance criteria met**: Every functional requirement works as specified
   - **No edge cases broken**: All PRD edge cases handled correctly
   - **Non-functional criteria satisfied**: Performance, UX, accessibility meet spec
   - **Test coverage complete**: All acceptance tests pass
3. TPPM explicitly signs off with **"FEATURE ACCEPTANCE APPROVED"** — this unblocks Phase 4

**If NEEDS CHANGES:** Describe specific unmet criteria → Opus launches fix agents → Re-test → Re-validate by TPPM.

---

### Phase 4: Parallel Post-Acceptance (Two Independent Tracks)

**Trigger:** Phase 3 FEATURE ACCEPTANCE APPROVED
**Execution:** Both tracks run in parallel immediately

#### Track A: Closure (Finalization)
**Responsible Agent:** Closer
**Output:** Merged code, updated docs, completion report

**Steps:**
1. Closer receives approved code + documented feature
2. Generates/updates all technical documentation (API specs, internal docs)
3. Generates/updates user-facing changelogs and guides
4. Performs final git operations: commit, merge to `main`, push
5. Outputs completion summary report with commit hash and doc links
6. **Feature is now live** — ready for user deployment

#### Track B: Feedback & Stress Test (Quality Assurance)
**Responsible Agents:** TPPM + Flink Developer
**Output:** Structured feedback report, roadmap enhancement recommendations

**Steps:**
1. Flink Developer receives approved feature + dev environment access
2. Performs intensive dev stress test:
   - Heavy load testing (large datasets, many concurrent queries)
   - Edge case discovery (boundary conditions, error scenarios)
   - Performance bottleneck identification
   - UX friction points in real workflows
3. Compiles findings into **Structured Feedback Report** including:
   - What broke or failed under stress
   - Performance metrics and bottlenecks
   - User workflow friction
   - Enhancement ideas and nice-to-haves
4. Flink Developer hands report to TPPM
5. TPPM reads and determines priority of each feedback item

---

### Phase 5: Roadmap Synthesis & Continuous Planning

**Trigger:** Phase 4 both tracks complete (Closer finishes merging code, Flink Developer finishes stress test)
**Responsible Agent:** Technical Principal Product Manager (TPPM)
**Output:** Updated `roadmap.md`
**Pipeline Model:** TPPM synthesizes feedback and re-ranks backlog; next feature's Phase 1 PRD may already be signed off and waiting in engineering queue

**Steps:**
1. TPPM synthesizes Track B (Flink Developer) stress-test feedback:
   - Categorize findings: critical bugs, enhancements, performance improvements, nice-to-haves
   - Determine business priority and impact for each item
   - Estimate complexity and resource requirements
2. TPPM updates `docs/roadmap.md`:
   - Move completed feature to "✅ Completed" section with Closer's commit hash
   - Add Flink Developer feedback items to "📥 Feedback & Stress Test Inbox"
   - Re-rank the "📋 Prioritized Backlog" based on synthesis and new feedback
3. TPPM reviews if next feature's Phase 1 PRD is already signed off:
   - **If YES:** Engineering can immediately start Phase 2 with the approved PRD (no wait)
   - **If NO:** TPPM should have started working on it during Phase 4; prioritize completing Phase 1 for the new top-ranked item
4. **Documentation:** Update `roadmap.md` with synthesis results and confirm pipeline status

**Key:** The next feature's Phase 1 should already be complete (or nearly complete) by Phase 5. If not, TPPM has not successfully gotten ahead. Adjust Phase 1 timing to overlap with current feature's Phase 2-4.

---

## Subagent Profiles

### Technical Principal Product Manager (TPPM)

**Role:** Gatekeeper of product quality, product-market fit, and continuous roadmap momentum. Orchestrates a continuous pipeline where engineering always has a signed-off PRD waiting to be built.

**Core Responsibilities:**

- **Pipeline Planner (Ongoing):** Always be one feature ahead. While engineering works on Feature N (Phases 2-4), TPPM works on Feature N+1's PRD. Goal: Have next feature's Phase 1 PRD signed off before current feature's Phase 2 finishes, so engineering never waits.

- **PRD Gatekeeper (Phase 1):** Write or review draft PRDs from Haiku agent. Validate and refine all functional and non-functional acceptance criteria. Write all acceptance tests (both functional and non-functional). Output **"PRD SIGN-OFF APPROVED"** to unblock Phase 2.

- **Acceptance Validator (Phase 3):** Post-QA, rigorously evaluate the feature against the PRD and acceptance tests. Validate that all criteria are perfectly met. Do not approve until confident feature is production-ready. Output **"FEATURE ACCEPTANCE APPROVED"** to unblock Phase 4.

- **Feedback Synthesizer & Roadmap Manager (Phase 5):** Partner with Flink Developer. Synthesize their stress-test feedback, categorize findings by priority, and translate into roadmap items. Update `roadmap.md` to reflect new backlog items and re-rank priorities based on feedback + business impact. Confirm that next feature's Phase 1 is complete and ready for engineering.

**Key Outputs:**
- **"PRD SIGN-OFF APPROVED"** (unblocks Phase 2; engineering can immediately start building)
- **"FEATURE ACCEPTANCE APPROVED"** (unblocks Phase 4; feature is production-ready)
- Updated `roadmap.md` with synthesis, new items, re-ranked backlog
- Next feature's Phase 1 PRD already signed off (waiting in queue for Phase 2 to start)

**Success Metric:** Engineering never experiences idle time waiting for the next PRD. Phase 2 always starts immediately when Phase 2 of previous feature completes.

---

### Closer Subagent

**Role:** Meticulous finisher. Handles asynchronous administrative and technical wrap-up so the team can move to the next feature.

**Core Responsibilities:**
- **Documentation:** Generate or update technical documentation, API specs, user-facing changelogs based on the completed feature.
- **Code Check-in:** Perform final git operations (commit, merge to `main`, push) to officially ship code.
- **Completion Report:** Output a summary of merged code (commit hash, branches, files) and updated doc links.

**Execution Model:**
- Runs asynchronously in parallel with Flink Developer stress test (Track B)
- Does NOT block the next feature cycle from starting in Phase 1
- Ensures code is officially merged before feature is considered "live"

**Key Outputs:**
- Merged code to `main`
- Updated technical & user documentation
- Completion summary report with commit hash

---

### Flink Developer Subagent

**Role:** Rigorous stress-tester and customer proxy. Pushes features to limits in dev environment to simulate real-world usage.

**Core Responsibilities:**
- **Dev Stress Testing:** Take the newly approved feature and conduct heavy stress testing. Simulate real-world load, edge cases, and workflows. Look for failures, performance bottlenecks, and UX friction.
- **Feedback Generation:** Compile findings into a structured product feedback report. Highlight what broke, what was slow, what was confusing, and what could be better.
- **Delivery to TPPM:** Hand the report directly to TPPM for roadmap synthesis and prioritization.

**Testing Focus Areas:**
- Large datasets (1000s+ rows, large result sets)
- Concurrent query execution
- Streaming result buffering and cursor pagination
- Error handling and recovery
- Performance under load
- User workflow edge cases from daily Flink/Kafka usage
- Real-world usage patterns (multi-workspace, multi-catalog navigation)

**Key Outputs:**
- Structured Feedback Report with severity/priority per finding
- Performance metrics (query latency, memory usage, CPU)
- Enhancement suggestions and workflow improvements
- Handed to TPPM for Phase 5 synthesis

---

## Feature Implementation Workflow (Phases A-C)

This is the detailed technical implementation flow that executes during **Phase 2: Development & QA**. When implementing features, ALWAYS follow this orchestration flow. NEVER skip steps.

### Phase A: DESIGN (Before ANY code is written)

#### A1. TECHNICAL PRD (Haiku subagent)
- Write a technical PRD for the feature to `docs/features/{feature-name}.md`
- PRD must include: Problem statement, proposed solution, files to modify, API changes, type changes, acceptance criteria, edge cases
- Keep it concise but complete - this is the implementation blueprint

#### A2. DESIGN REVIEW (2 Sonnet subagents in parallel)
Launch both reviewers simultaneously:

**Principal Architect Review:**
- Reviews: system design, state management impact, API contract changes, performance implications, separation of concerns
- Checks: does this fit the existing architecture? Any coupling risks? Scalability concerns?
- Output: APPROVE / NEEDS CHANGES with specific feedback

**Principal Engineer Review:**
- Reviews: implementation approach, code patterns, edge cases, error handling, type safety, testing strategy
- Checks: are we reusing existing code? Any simpler approach? Race conditions? Memory leaks?
- Output: APPROVE / NEEDS CHANGES with specific feedback

#### A2.1. SR FLINK/KAFKA ENGINEER REVIEW (Sonnet subagent)
- Reviews: real-world usefulness, domain expert perspective from daily Flink/Kafka workflows
- Checks: does this feature solve actual pain points? Are there workflow enhancements or use-cases missing? Could the solution be simplified for domain expertise? What additional capabilities would make this more valuable?
- Output: APPROVE / NEEDS CHANGES with enhancement suggestions and workflow feedback

#### A3. REVISE (if needed)
- If any reviewer flags issues or suggests enhancements, launch a haiku agent to revise the PRD
- Re-review only the changed sections (by affected reviewers)
- Loop until all three reviewers approve

### Phase B: IMPLEMENT (After design approval)

#### B1. IMPLEMENT (Haiku subagents)
- Launch haiku subagents for each small task (1-3 files max per agent)
- Max 3 parallel impl agents at once
- Each agent gets: the PRD, exact file paths, what to change, acceptance criteria
- Agents work in isolation on non-overlapping files

#### B2. BROWSER TEST (Immediate - after EACH feature commit, NEVER batched)
- Ensure dev server is running (`npm run dev`)
- Open the app in Chrome via browser automation tools (Claude in Chrome MCP)
- Visually verify the feature works: take screenshots, click through UI, check renders
- Test edge cases from the PRD in the actual browser
- This step is NOT delegated - the orchestrator does it directly to catch real rendering/runtime issues
- **CRITICAL**: Browser test MUST happen immediately after each feature is implemented and committed
- If bugs are found, launch fix agents immediately before moving to the next feature
- No feature is "done" until browser-verified in Chrome

#### B3. QA VALIDATE (Sonnet subagents)
After browser test passes, launch QA agents for comprehensive code and API validation. QA must verify: test markers exist, code correctness, API compliance, and all PRD requirements are met.

**PART A: Test Marker Validation (BLOCKING - Executes First)**

This is the **gatekeeper check**. Zero tolerance for missing markers.

- **Marker audit**: READ all new/modified code and verify EVERY changed line has test markers
  - Markers: `@changed`, `@feature-name`, or similar identifiable tags in describe blocks
  - Format: `describe('[@marker] description', () => {})` in test files
  - Scope: Must cover ALL acceptance criteria + ALL edge cases from PRD
- **Marker consistency**:
  - Same files touched by multiple agents? Verify non-overlapping code sections have distinct markers to avoid collision
  - Feature spanning multiple files? Each file should have feature-specific marker (e.g., `@phase-10-sidebar`)
- **Executable verification** - QA MUST RUN subset commands:
  - Execute: `npm test -- --grep "@changed"` (or feature-specific marker)
  - Verify: Only tests for changed sections run, not full suite
  - Confirm: ALL matching tests PASS (zero failures)
  - If any test fails, QA FAILS this phase—must be fixed before proceeding
- **PRD correlation**:
  - Every acceptance criterion from PRD → mapped to at least one test marker
  - Every edge case from PRD → covered by test or documented as N/A with reason
  - Template: "PRD Requirement X → Tests: [@marker-a, @marker-b]"
- **Failure = Show-Stopper**: Missing markers = automatic FAIL, code cannot move to next QA phase

---

**PART B: Code Review & Logic Validation (BLOCKING)**

- **Code correctness**: READ code and document bugs as structured findings with severity
  - Business logic flows: trace execution path, verify no gaps or wrong order
  - State management: Zustand updates correct? Selectors properly defined? Persist config correct?
  - Error handling: Try/catch blocks in place? Errors logged? User shown feedback?
  - Type safety: All API responses properly typed? No `any` types without justification?
- **Edge cases**: Verify all PRD scenarios are handled
  - Template for findings:
    ```
    Severity: [Critical|Major|Minor]
    File: src/path/to/file.ts:line
    Issue: [Description of problem]
    Expected: [What should happen]
    Actual: [What currently happens]
    ```
- **Pattern compliance**: Code follows existing codebase patterns
  - Zustand actions follow existing store patterns?
  - Components match file structure (barrel exports, prop types, etc.)?
  - Consistent naming (camelCase functions, PascalCase components)?

---

**PART C: API Validation & Testing (BLOCKING if APIs changed)**

Use the separate [QA API Validation Checklist](./docs/QA-API-VALIDATION-CHECKLIST.md) as reference. Summary:

**C1. REST Compliance Check:**
- HTTP verbs correct: GET (retrieve), POST (create), PUT/PATCH (update), DELETE (remove)
- URLs consistent: `/api/resource` not `/api/getResource`; `/api/statements/{id}` not `/api/statement?id=...`
- Request payloads: Well-formed JSON, proper `Content-Type: application/json` header
- Response payloads: JSON with correct structure matching TypeScript interfaces
- Status codes semantically correct: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 5xx Server Error
- Idempotency: GET requests never have side effects; safe methods used correctly

**C2. Confluent Flink SQL API Contract Check:**
See [Flink/Confluent Checkpoints](./docs/QA-API-VALIDATION-CHECKLIST.md#flink-confluent-specific-checkpoints) in checklist. Key validations:
- Statement execution flow: POST `/statements` → GET `/statements/{id}` polling → GET `/statements/{id}/results` with cursor
- Streaming results: Handles cursor pagination, respects 5000-row buffer limit
- Result fetching: Cursor management correct, handles empty results gracefully
- Workspace/catalog operations: Proper error handling for missing workspaces/tables
- Credentials in headers: Basic Auth correctly formatted, sensitive data not logged

**C3. API Contract Matching:**
- Request structure matches `src/api/flink-api.ts` function signatures exactly
- Request body: Field names, types, required vs optional all correct per Confluent docs
- Response types: All response properties are defined in `src/types/index.ts` interfaces
- Error shapes: Error responses parsed correctly (path to error message, status code handling)
- HTTP client usage: Uses `confluentClient` for Flink SQL, `fcpmClient` for Cloud Management (not raw fetch)

**C4. API Testing (EXECUTABLE - Code Must Have Tests):**
- **Test coverage audit**: READ all modified API calls and verify test cases exist
  - Every new/modified API call → must have test case in `src/__tests__/`
  - Test marker: Use `@api` or feature-specific marker (e.g., `@api-phase-10-sidebar`)
- **Test content requirements**: Tests must cover all these paths:
  - ✅ Success path: Normal operation with valid request/response
  - ✅ Error paths: 4xx client errors (400, 401, 404), 5xx server errors (500, 503)
  - ✅ Network failures: Timeout, ECONNREFUSED, network error handling
  - ✅ Edge cases: Empty results, large payloads, cursor boundaries, streaming cancellation
  - ✅ PRD edge cases: All edge cases from PRD must have corresponding test
- **Mock usage**: All tests use mocked API responses from `src/test/mocks/api.ts`
  - Factories available: `mockStatement()`, `mockResults()`, `mockStatementWithStatus()`, etc.
  - No live API calls in tests (Vite proxy should be disabled in test setup)
- **Executable verification**:
  - Execute: `npm test -- -t "@api"` (or feature-specific marker)
  - Verify: Test suite runs, only tests for API changes included
  - Confirm: ALL API tests PASS (zero failures)
  - If any API test fails, QA FAILS—must be fixed
- **API contract validation in tests**:
  - Assert request payload structure matches contract (field names, types)
  - Assert response properties exist and have correct types
  - Assert error response shapes are handled (status code, error message path)
  - If new endpoint added: Verify request/response match Confluent Cloud API docs (https://docs.confluent.io/cloud/current/flink/index.html)

---

**QA Workflow: Sequential Phases**

1. **Phase A (Test Markers)**: Run and pass marker validation first—if it fails, stop here
2. **Phase B (Code Review)**: If Phase A passes, do code review and document findings
3. **Phase C (API Validation)**: If Phase B findings are non-blocking, validate APIs
4. **Report**: Document all findings (findings template below)
5. **Status**: Return APPROVE or NEEDS CHANGES

**Findings Template:**
```
[SEVERITY: Critical|Major|Minor]
[PHASE: A|B|C]
[CATEGORY: Test Markers|Logic|Edge Case|REST Compliance|API Contract|API Tests]
File: src/path/to/file.ts:line
Issue: [Clear description]
Expected: [What should be]
Actual: [What is]
Fix: [Recommended fix, if obvious]
```

#### B4. FIX (Haiku subagents)
- For each bug found by QA, launch a fixer agent
- Fixer gets: the bug description, file path, expected vs actual behavior
- Re-QA after fixes if severity was high

#### B5. UX REVIEW (Sonnet subagent)
- After QA passes, launch UX review agent
- Reviews against ALL of these checkpoints:
  - **Dark mode**: Every new element must work in light and dark modes. Check contrast, borders, backgrounds, text colors using CSS custom properties (`--flink-*`). No hardcoded hex values.
  - **Light mode**: Verify the same elements render correctly in default light theme
  - **Consistency**: Use existing component patterns, spacing, font sizes, border-radius from codebase
  - **Accessibility**: Focus states, aria labels on interactive elements, keyboard navigation, color not as sole indicator
  - **Polish**: Smooth animations, no layout shifts, proper hover states, edge case rendering
- Documents UX issues as structured findings with severity (Critical / Major / Minor)

#### B6. FIX UX (Haiku subagents)
- Fix any UX issues found
- Re-test in browser after fixes to confirm dark/light mode and accessibility are correct

### Phase C: SHIP

#### C0. DOCUMENTATION REVIEW (Sonnet subagent)
- After UX fixes pass browser testing, launch documentation review agent
- Reviews all code documentation for clarity and completeness:
  - **Inline comments**: Explain *why* not *what*; help junior engineers understand logic at a glance
  - **Function/component headers**: Clear purpose, parameters, return values, usage examples where complex
  - **Complex algorithms**: Step-by-step explanation for non-obvious code
  - **Type definitions**: Document custom types, enums, interfaces with examples
  - **README updates**: Feature overview added to main README; new components/modules documented
  - **Error handling**: Document why errors occur and how they're handled
- Checks: Is this codebase self-documenting? Can a junior engineer understand the flow without asking questions?
- Output: List of documentation gaps with severity (Critical / Major / Minor)
- **Critical/Major gaps block commit** - must be fixed before moving to C1

#### C1. FAQ/HOWTO (Haiku subagent)
- Create user-facing FAQ/HowTo documentation from the technical PRD
- Convert technical feature docs → beginner-friendly "how do I...?" guides
- Store in `docs/faqs/{feature-name}.md` with format:
  - **Problem/Use Case**: What user problem does this solve?
  - **Step-by-step Guide**: Simple numbered steps (no jargon)
  - **Common Gotchas**: Edge cases users should know about
  - **Tips & Tricks**: Pro tips from the domain
  - **Related Features**: Links to complementary features
- FAQ will be loaded into app Help system (once Help feature is implemented)
- **Link back to PRD**: FAQ references the technical PRD for developers

#### C2. DOCS & COMMIT
- Update the feature PRD in `docs/features/` with final implementation notes
- Verify FAQ/HowTo is complete and user-friendly
- Update README if needed
- Stage and commit changes with descriptive message (only when user explicitly asks)

### Key Rules for Continuous Pipeline Execution

**Pipeline & Parallelism:**
- **TPPM must get ahead** - Phase 1 PRD work should happen during previous feature's Phases 2-4. If engineering finishes Phase 2 and is waiting for Phase 1 PRD approval, TPPM has fallen behind.
- **Engineering never waits** - Phase 2 should start immediately with an already-approved PRD. Zero idle time waiting for TPPM.
- **Async tracks don't block** - Phase 4 Tracks A (Closer) and B (Flink Developer) are non-blocking. Phase 5 synthesis happens in parallel with potential Phase 2 starts of next feature.
- **Smallest possible tasks** for maximum parallelism (max 3 impl agents during Phase 2)

**Quality & Validation:**
- **You (Opus) are the orchestrator** - supervise, don't implement directly. Launch agents for each phase.
- **NEVER skip design review** - architect, engineer, and domain expert (SR Flink/Kafka Engineer) must all sign off before coding
- **Browser test EVERY feature immediately after implementation** - never batch or skip. No feature is done until verified in Chrome.
- **Test markers = HARD BLOCKER** - all new/modified code must have test markers/tags. QA MUST verify markers exist, run subset tests, and confirm they pass. Zero tolerance for missing markers.
- **Never skip QA** - every feature gets validated (test markers → code review → API validation)
- **Never skip documentation review** - code must be clear for junior engineers before commit
- **Documentation is blockers** - Critical/Major doc gaps must be fixed before shipping
- **Fix bugs in real-time** - don't batch them

**Documentation:**
- **Document everything** - PRDs in `docs/features/`, FAQs in `docs/faqs/`, roadmap in `roadmap.md`, inline comments in code
- **User-facing docs matter** - Every feature ships with user-friendly FAQ/HowTo alongside technical docs
- **Roadmap drives velocity** - `roadmap.md` is the single source of truth for what's next. TPPM updates it during Phase 5.

## Architecture

### Key Files
| File | Purpose |
|------|---------|
| `src/store/workspaceStore.ts` | Zustand store - all app state and actions |
| `src/api/flink-api.ts` | Confluent Flink SQL API calls |
| `src/api/confluent-client.ts` | Axios HTTP client with Basic Auth |
| `src/components/EditorCell/EditorCell.tsx` | SQL editor cell with Monaco |
| `src/components/ResultsTable/ResultsTable.tsx` | Query results table |
| `src/components/TreeNavigator/TreeNavigator.tsx` | Sidebar tree of DB objects |
| `src/App.tsx` | Root layout shell |
| `src/types/index.ts` | TypeScript type definitions |
| `src/config/environment.ts` | Environment variable config |

### API Pattern
- All API calls go through Vite proxy at `/api/flink` → Confluent Cloud
- Auth: Basic Auth with `VITE_FLINK_API_KEY:VITE_FLINK_API_SECRET`
- Statement execution: POST → poll status → fetch results with cursor pagination
- Streaming: FIFO buffer of 5000 rows max, cursor-based long-polling

### Unused Code (Available for Reuse)
- `getTableSchema()` in `flink-api.ts:231` - DESCRIBE table, returns columns
- `listStatements()` in `flink-api.ts:149` - List all server statements
- `@tanstack/react-virtual` - In deps, not yet integrated
- `framer-motion` - In deps, not yet used
