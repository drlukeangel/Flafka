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
Timeline ──────────────────────────────────────────────────────────────────────────────
Feature A:  Phase 1 → Phase 2 → Phase 2.5 → Phase 2.6 → Phase 3 → Phase 4(A/B/C/D) → Phase 5
                       (eng)      (QA)      (UX/IA)     ↓                            (sync)
                                                         │                            ↓
                                           TPPM immediately starts ↓             Synthesize
Feature B:                                 Phase 1 (PRD+tests+E2E) ↓            feedback
                                                        ↓
                                          ▓▓ Phase 1 complete ▓▓ ← by Phase 4 end
                                                        ↓
                                      Phase 2 starts immediately (no wait)
                                                        ↓
Feature C:                             ▓▓▓ Phase 1 drafted ▓▓▓ → Waiting in queue
```

**Key Gates (Sequential Blockers):**
- Phase 1 → Phase 2: TPPM "PRD SIGN-OFF APPROVED" (blocking)
- Phase 2 → Phase 2.5: Engineering completes Phase B (blocking)
- Phase 2.5 → Phase 2.6: QA Manager "SIGN-OFF APPROVED" (blocking)
- Phase 2.6 → Phase 3: UX/IA Reviewer "SIGN-OFF APPROVED" (blocking)
- Phase 3 → Phase 4: TPPM "FEATURE ACCEPTANCE APPROVED" (blocking)

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
4a. TPPM writes E2E test specifications (user workflows, browser-level scenarios, acceptance criteria mapped to test cases)
4b. TPPM classifies Tier 1 (blocking) vs Tier 2 (async) for every test per [docs/TESTING-STRATEGY.md](../TESTING-STRATEGY.md)
5. TPPM explicitly signs off with **"PRD SIGN-OFF APPROVED"** — this unblocks Phase 2 when engineering is ready

**If NEEDS CHANGES:** TPPM works with Haiku agent to revise until approval.

**Key:** TPPM should complete Phase 1 PRD sign-off **before** current feature's Phase 2 completes, so engineering never has idle wait time for the next PRD.

---

### Phase 2: Development & QA (Parallel Implementation)

**Trigger:** Phase 1 PRD SIGN-OFF APPROVED (should already be waiting in queue, no blocking wait)
**Responsible:** Opus (orchestrator) + Haiku/Sonnet implementation + QA agents
**Output:** Tested, documented, browser-verified code ready for validation gates
**Key:** Engineering should **never wait** for TPPM to finish Phase 1. TPPM gets ahead during previous feature's Phase 2-4 so this PRD is already approved.

**Parallel Work:** While engineering is in Phase 2, TPPM is already working on Feature N+2's Phase 1 PRD (for the feature after this one).

---

## Feature Implementation Workflow (Phases A, B, C) — Executed During Phase 2

### Phase A: DESIGN (Before ANY code is written)

#### A1. TECHNICAL PRD (Haiku subagent)
Write technical PRD to `docs/features/{feature-name}.md` with: problem statement, proposed solution, files to modify, API changes, type changes, acceptance criteria, edge cases.

PRD must also include a **Test Coverage Plan** with tiers clearly labeled per [docs/TESTING-STRATEGY.md](../TESTING-STRATEGY.md):
- **Tier 1 (BLOCKING):** Happy path + critical error scenarios (must pass before ship)
- **Tier 2 (ASYNC):** Edge cases, concurrency, performance (completed in Track C post-ship)

#### A2. DESIGN REVIEW (5 parallel reviewers)
All must approve before proceeding:
1. **Principal Architect** — system design fit
2. **Principal Engineer** — implementation approach
3. **QA Manager** — test coverage plan validation
4. **UX/IA/Accessibility Reviewer** — user journey, discoverability, accessibility
5. **SR Flink/Kafka Engineer** — domain usefulness

#### A3. REVISE (if needed)
If any reviewer flags issues, revise PRD/tests/design and re-review affected sections until all 5 approve.

### Phase B: IMPLEMENT (After design approval)

#### B1. IMPLEMENT (Haiku subagents)
- Launch haiku subagents for each small task (1-3 files max per agent)
- Max 3 parallel impl agents at once
- Agents work in isolation on non-overlapping files

#### B2. BROWSER TEST (Immediate - after EACH feature commit)
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

#### B3. QA VALIDATE (Sonnet subagents)
After browser tests pass:
- **Part A:** Test marker validation — all new code has markers, tests runnable, all PASS
- **Part B:** Code review — logic flow, error handling, type safety, patterns
- **Part C:** API validation — REST compliance, API contracts, Confluent Flink specs

#### B4. FIX (Haiku subagents)
Fix each bug found by QA, then re-QA.

#### B5. UX REVIEW (Sonnet subagent)
Review: dark/light modes, consistency, accessibility (focus, aria, keyboard nav), polish.

#### B6. FIX UX (Haiku subagents)
Fix UX issues, re-test in browser.

#### B6.5. SENIOR QA TEST PLANNING (Sonnet subagent)
Separate tests by tier before B8:
- Tier 1: Must be completed in B8 (before shipping)
- Tier 2: Deferred to Track C (post-ship) — stubs created in B8

#### B8. UPDATE TESTS (Haiku subagent)
- Implement all Tier 1 tests identified in B6.5
- Create Tier 2 stub files with `TODO` comments (not skipped, just empty)
- Run `npm test -- -t "tier1"` — MUST pass 100%
- Gate Rule: TPPM accepts ONLY if Tier 1 tests pass 100%
- Reference: [docs/TESTING-STRATEGY.md](../TESTING-STRATEGY.md)

### Phase C: SHIP

#### C0. DOCUMENTATION REVIEW (Sonnet subagent)
Review code documentation clarity. Critical/Major gaps block commit.

#### C1. FAQ/HOWTO (Haiku subagent)
Create user-facing FAQ from technical PRD. Store in `docs/faqs/{feature-name}.md`.

#### C2. DOCS & COMMIT
Update PRD with implementation notes, verify FAQ complete, update README if needed.

---

---

### Phase 2.5: QA Manager Sign-Off (BLOCKING Gatekeeper)

**Trigger:** Phase 2 development + all QA validation complete + **Browser test screenshots delivered**
**Responsible Agent:** QA Manager
**Output:** "QA MANAGER SIGN-OFF APPROVED" with complete test report, OR "NEEDS CHANGES"
**Key Rule:** Phase 2.6 cannot start until QA Manager approves. This is a hard blocker.

**Deliverables QA Manager Must Verify:**
- ✅ **Tier 1 tests pass 100%** (happy path + critical errors — per Tier 1 plan in PRD)
- ✅ Tier 1 coverage ≥ 40% (critical path covered)
- ✅ Tier 2 stubs exist (edge cases documented in test files as TODO)
- ✅ Tier 2 gap list delivered to Track C agent
- ✅ All PRD acceptance criteria mapped to Tier 1 tests
- ✅ **BROWSER TEST SCREENSHOTS:** All PRD scenarios have screenshots proving feature works end-to-end
  - Screenshots show: feature state, user interactions, results
  - Include browser address bar (URL/context visible)
  - Cover: happy path, all edge cases, error states, dark mode, light mode
  - Each screenshot documented: "Screenshot X shows [description]"

**QA Manager Sign-Off Process:**
1. Receive all test files, coverage report, AND browser test screenshots
2. Verify test counts, pass/fail %, coverage metrics
3. **REVIEW SCREENSHOTS:** Open each screenshot, verify it shows what's claimed
4. **Confirm:** Feature visually works as described in PRD (screenshots prove it)
5. Map all PRD acceptance criteria → test markers → screenshots
6. Output: Complete test execution report with embedded/linked screenshots

**Output:** Complete test execution report (test counts, pass/fail %, coverage metrics, test-to-PRD mapping, **signed-off browser screenshots**, any failures with root cause) + **"QA MANAGER SIGN-OFF APPROVED"** or **"NEEDS CHANGES"**

---

### Phase 2.6: UX/IA/Accessibility Validation (BLOCKING Gatekeeper)

**Trigger:** Phase 2.5 QA Manager SIGN-OFF APPROVED + Phase B5 (UX Review) complete
**Responsible Agent:** UX/IA/Accessibility Reviewer
**Output:** "UX/IA SIGN-OFF APPROVED" with validation report, OR "UX CHANGES NEEDED"
**Key Rule:** Phase 3 cannot start until UX/IA Reviewer approves. This is a hard blocker.

**Validation Checklist:**
- ✅ User journey is intuitive. Workflow flows logically. No confusing steps.
- ✅ Feature is discoverable. Fits existing information architecture. Not hidden.
- ✅ Consistent with existing component patterns & interactions. No unexpected friction.
- ✅ Accessible: keyboard navigation, screen reader support, high contrast, all user types included.
- ✅ Dark/light modes render correctly. No hardcoded colors breaking contrast.
- ✅ Layouts clear, labels unambiguous, affordances match expectations.

**Output:** UX/IA validation report (journey assessment, IA fit, consistency check, accessibility verdict, dark/light verdicts, flow screenshots) + **"UX/IA SIGN-OFF APPROVED"** or **"UX CHANGES NEEDED"**

---

### Phase 3: Final Acceptance Validation (BLOCKING)

**Trigger:** Phase 2.5 QA Manager SIGN-OFF APPROVED + Phase 2.6 UX/IA SIGN-OFF APPROVED
**Responsible Agent:** Technical Principal Product Manager (TPPM)
**Output:** "FEATURE ACCEPTANCE APPROVED" or "NEEDS CHANGES"

**TPPM validates against PRD (with QA + UX/IA reports backing all quality claims):**
- ✅ All acceptance criteria met (from Phase 1 tests)
- ✅ All tests passed (verified by QA Manager)
- ✅ All edge cases covered (per QA Manager report)
- ✅ UX/IA validated (per UX/IA Reviewer report)
- ✅ Accessibility standards met (per UX/IA Reviewer report)
- ✅ Coverage metrics adequate (per QA Manager report)

**Output:** **"FEATURE ACCEPTANCE APPROVED"** → unblocks Phase 4 (Closer + Flink Developer)

**Immediately After Approval:** TPPM begins Feature N+1 Phase 1 **without delay**:
- Write full PRD (problem, solution, files, API changes, acceptance criteria, edge cases)
- Write all acceptance tests (functional + non-functional)
- Write E2E test specifications (user flows, browser-level acceptance criteria, test case mappings)
- Classify Tier 1 (blocking) vs Tier 2 (async) for every test

**Goal:** Feature N+1 Phase 1 fully signed off before Phase 4 tracks complete, so engineering starts Phase 2 with zero blocker.

**If NEEDS CHANGES:** Describe specific gaps → launch fix agents → Re-test with QA Manager & UX/IA Reviewer → Re-validate by TPPM.

---

### Phase 4: Parallel Post-Acceptance (Four Independent Async Tracks — ALL Non-Blocking)

**Trigger:** Phase 3 FEATURE ACCEPTANCE APPROVED
**Execution:** All four tracks run in parallel immediately. **NONE of these tracks block Phase 5 or the next feature Phase 1 from starting.**

#### Track A: Closure (Finalization)
**Responsible Agent:** Closer

**Steps:**
1. Generate/update technical & user-facing documentation
2. Clean up testing artifacts:
   - Remove test coverage reports (`coverage/` directory)
   - Remove `.playwright` or test automation artifacts
   - Remove mock data files used only for testing
   - Clean up any temporary test fixtures or debug logs
   - **KEEP:** All `src/__tests__/` test files (these stay in repo for future test runs)
3. Commit cleaned code + updated docs to `main`
4. Push to remote
5. Output completion report with commit hash & doc links

**Key:** Test code stays, test artifacts go. Tests run in CI/CD, coverage lives in reports, not in repo.

#### Track B: Feedback & Stress Test (Async, Non-Blocking)
**Responsible Agents:** TPPM + Flink Developer

**Runs:** In parallel with Tracks A, C, and D. Does NOT block Phase 5 or next feature.

**Steps:**
- Flink Developer conducts heavy load testing, edge cases, performance profiling, workflow stress
- Output: Structured feedback report (what broke, perf metrics, UX friction, enhancement ideas)
- TPPM partners with Flink Developer to ensure findings are captured

#### Track C: Test Completion (Async, Non-Blocking)
**Responsible Agent:** Test Completion Agent (Haiku)

**Runs:** In parallel with Track A (Closer) and Track B (Flink Developer). Does NOT block Phase 5 or next feature.

**Steps:**
1. Receive Tier 2 gap list from QA Manager
2. Implement all Tier 2 test stubs (edge cases, concurrency, performance)
3. Run full test suite — Tier 1 + Tier 2 must both reach 100% pass
4. Target: ≥ 80% total code coverage at Track C completion
5. Commit Tier 2 tests + update test report in feature PRD

**Reference:** [docs/TESTING-STRATEGY.md](../TESTING-STRATEGY.md)

#### Track D: Customer & Expert Interviews (Async, Non-Blocking)
**Responsible Agent:** Interview Analyst (Sonnet)

**Runs:** In parallel with Tracks A, B, and C. Does NOT block Phase 5 or next feature.

**Steps:**
1. Conduct structured interviews with: Flink engineers (daily users), domain experts, power users
2. Topics: What's missing? What friction exists? What would make this 10x more valuable? What to build next?
3. Compile findings into a **Customer Interview Report** with:
   - Feature-specific feedback (immediate improvements)
   - Roadmap ideas (new features to consider)
   - Pain points (workflow gaps)
   - Priority signals (what interviewees care most about)
4. Deliver report to TPPM for Phase 5 synthesis alongside Flink Developer stress-test feedback

---

### Phase 5: Roadmap Synthesis & Continuous Planning

**Trigger:** Phase 4 all tracks complete (Closer, Flink Developer, Test Completion, Interview Analyst)
**Responsible Agent:** Technical Principal Product Manager (TPPM)

**Inputs:**
- Flink Developer stress-test feedback report
- Customer & expert interview report
- Closer's completion summary
- Test completion metrics from Track C

**Steps:**
1. Synthesize feedback from both sources:
   - Flink Developer stress test: categorize critical bugs, perf issues, UX friction, enhancement ideas
   - Customer interviews: consolidate feature requests, pain points, workflow improvements
   - Combined: determine priority, business impact, roadmap fit
2. Update `roadmap.md`: move completed feature to ✅, add all feedback items to inbox, re-rank backlog based on combined signals
3. Verify next feature's Phase 1 is already signed off & waiting (if not, TPPM got behind—Phase 1 should start at Phase 3 approval, complete before Phase 4 ends)
4. Document synthesis results in roadmap

**Output:** Updated `roadmap.md` + confirmation that pipeline is ready for next feature

---

## Key Rules for Continuous Pipeline Execution

**Pipeline & Parallelism:**
- **TPPM must get ahead** - Phase 1 PRD work should overlap with previous feature's Phases 2-4
- **TPPM starts next feature at Phase 3 approval** - Immediately after "FEATURE ACCEPTANCE APPROVED" is output, TPPM begins writing the next feature's Phase 1 (full PRD + acceptance tests + E2E specs). By the time Phase 4 completes, next feature is fully documented and ready for engineering Phase 2.
- **Engineering never waits** - Phase 2 starts immediately with already-approved Phase 1 PRD (with tests and E2E specs pre-written)
- **Async tracks don't block** - Phase 4 Tracks A/B/C/D run in parallel, don't block Phase 5 or next Phase 1
- **Smallest possible tasks** - max 3 impl agents during Phase 2

**Quality & Validation Gates:**
- **NEVER skip design review** - 5 reviewers must approve (Architect, Engineer, QA Manager, UX/IA, SR Flink/Kafka Engineer)
- **QA Manager gate = HARD BLOCKER (Phase 2.5)** - Tier 1 tests (100% pass) + Tier 2 stubs required before proceeding. Full 80%+ coverage completed async in Track C. See [docs/TESTING-STRATEGY.md](../TESTING-STRATEGY.md).
- **UX/IA gate = HARD BLOCKER (Phase 2.6)** - Feature must be intuitive, discoverable, accessible, consistent before acceptance
- **Test markers = HARD BLOCKER** - All new code must have test markers. QA verifies markers exist and tests pass.
- **Browser test EVERY feature** - immediately after Phase B6. No feature done until verified in Chrome.
- **Never skip documentation review** - code clarity is critical before shipping
- **Track C completes async** - Tier 2 tests and edge cases completed post-ship in parallel with Closer and Flink Developer. Does not block next feature Phase 1.

**Documentation & Roadmap:**
- **Document everything** - PRDs in `docs/features/`, FAQs in `docs/faqs/`, roadmap in `roadmap.md`
- **Roadmap drives velocity** - `roadmap.md` is the single source of truth. TPPM updates during Phase 5.

---

## Subagent Profiles

### Technical Principal Product Manager (TPPM)
**Role:** Gatekeeper of product quality, product-market fit, and continuous roadmap momentum. Orchestrates continuous pipeline where engineering always has signed-off PRD waiting.

**Core Responsibilities:**
- **Pipeline Planner:** Always one feature ahead. While engineering works on Feature N (Phases 2-4), TPPM works on Feature N+1's PRD.
- **PRD Gatekeeper (Phase 1):** Write/review draft PRDs. Validate and write all acceptance tests (functional + non-functional). Output **"PRD SIGN-OFF APPROVED"**.
- **Acceptance Validator (Phase 3):** Rigorously evaluate feature against PRD and acceptance tests (using QA Manager + UX/IA reports). Output **"FEATURE ACCEPTANCE APPROVED"**.
- **Feedback Synthesizer & Roadmap Manager (Phase 5):** Synthesize Flink Developer stress-test feedback. Update `roadmap.md`. Confirm next feature's Phase 1 is ready.

**Success Metric:** Engineering never experiences idle time waiting for next PRD.

---

### QA Manager Subagent
**Role:** Test quality gatekeeper. Ensures all functional, unit, and E2E tests are written, executed, and passing. **Also verifies browser test screenshots prove feature works end-to-end.**

**Core Responsibilities:**
- **Test Coverage Audit:** Verify all unit, integration, E2E, and acceptance tests exist and pass.
- **Test Execution:** Run full test suite (`npm test`), verify 100% pass rate, achieve 80%+ code coverage.
- **Test Mapping:** Map all PRD acceptance criteria → test markers. Verify all edge cases covered.
- **Browser Screenshot Review (CRITICAL):**
  - Receive all browser test screenshots from Phase B2 (Playwright or Chrome extension captures)
  - Review each screenshot: verify it shows what's claimed
  - Confirm: feature visually works as described in PRD
  - Verify coverage: happy path ✓, all edge cases ✓, error states ✓, dark/light modes ✓
  - Document screenshot evidence for each PRD requirement
- **Deliver Report:** Complete test execution report with test counts, pass/fail %, coverage metrics, PRD-to-test mapping, **signed-off browser screenshots**, any failures with root cause.

**Sign-Off:** **"QA MANAGER SIGN-OFF APPROVED"** (all tests pass, coverage adequate, screenshots verified) OR **"NEEDS CHANGES"** (describe gaps or missing screenshots)

**Success Metric:** 100% acceptance criteria coverage with tests. Zero failures. 80%+ code coverage. **All PRD scenarios have browser test screenshots signed off by QA Manager.**

---

### UX/IA/Accessibility Reviewer Subagent
**Role:** User experience gatekeeper. Ensures features are intuitive, discoverable, accessible, consistent with system.

**Core Responsibilities:**
- **Phase A2 Design Review:** Review PRD design for UX/IA/accessibility concerns before engineering starts.
- **Phase 2.6 Implementation Validation:** Walk through live feature. Verify intuitive workflow, IA discoverability, system consistency, accessibility (keyboard, screen reader, contrast, dark/light modes).
- **Testing:** Real user workflows from PRD, keyboard-only navigation, screen reader testing, contrast validation, all user types.
- **Deliver Report:** UX validation report with journey assessment, IA fit, consistency check, accessibility verdict, dark/light verdict, flow screenshots.

**Sign-Off:** **"UX/IA SIGN-OFF APPROVED"** (feature is user-friendly, discoverable, accessible, consistent) OR **"UX CHANGES NEEDED"** (describe friction/gaps)

**Success Metric:** Users accomplish feature goals intuitively. Integrates smoothly with system. No accessibility exclusions.

---

### Closer Subagent
**Role:** Meticulous finisher. Handles administrative and technical wrap-up asynchronously so team can move to next feature.

**Core Responsibilities:**
- **Documentation:** Generate/update technical docs, API specs, user-facing changelogs based on completed feature.
- **Clean Up Testing Artifacts:**
  - Remove `coverage/` directory (test coverage reports)
  - Remove `.playwright-cli/` or test automation artifacts
  - Remove temporary test fixtures, debug logs, mock data files
  - **KEEP:** All `src/__tests__/` test files (these live in repo for future test runs)
- **Code Check-in:** Commit cleaned code + updated docs. Merge to `main`. Push to remote.
- **Completion Report:** Output summary with commit hash, files changed, doc links.

**Execution Model:** Runs asynchronously in parallel with Flink Developer (Track B). Does NOT block next feature Phase 1 from starting.

**Key Outputs:** Merged code to `main`, updated documentation, completion report with commit hash, clean repo (tests stay, artifacts removed).

---

### Flink Developer Subagent
**Role:** Rigorous stress-tester and customer proxy. Pushes features to limits in dev environment to simulate real-world usage.

**Core Responsibilities:**
- **Dev Stress Testing:** Heavy load (1000s+ rows, concurrent queries), edge cases (boundary conditions, error scenarios), performance (latency, memory, CPU under load), workflow friction (real Flink/Kafka usage patterns).
- **Feedback Generation:** Compile findings into structured feedback report. Highlight what broke, what was slow, what was confusing, what could be better.
- **Delivery to TPPM:** Hand report directly to TPPM for Phase 5 roadmap synthesis.

**Testing Focus:** Large datasets, concurrent execution, streaming scenarios, error recovery, performance bottlenecks, multi-workspace workflows, user pain points.

**Key Outputs:** Structured Feedback Report (severity/priority per finding, performance metrics, enhancement suggestions) → delivered to TPPM for Phase 5.

---

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
