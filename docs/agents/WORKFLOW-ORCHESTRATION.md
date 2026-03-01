# Multi-Agent Workflow Orchestration (Phases 1-5)

This is the overarching orchestration framework that wraps all feature development. It ensures product quality, validates requirements, and drives continuous roadmap iteration.

**Core Principle:** TPPM gets ahead and writes PRDs while engineering builds, so there's always a signed-off feature ready to go. Engineering never waits for TPPM to finish the next PRD.

---

## PARALLELISM: Ask For Every Phase

**Every phase transition, ask: CAN THIS HAPPEN IN PARALLEL?**

### Phase Parallelism Rules

| Phase | Ask | Can Parallel? | Examples |
|-------|-----|---------------|----------|
| **Phase 1** | Can Feature N+1 PRD be written while Feature N Phase 2 runs? | ✅ YES | TPPM writes N+1 Phase 1 during N's Phase 2-4 |
| **Phase 2 (A2)** | Can 5 design reviewers review simultaneously? | ✅ YES | All 5 parallel (Architect, Engineer, QA, UX/IA, Flink) |
| **Phase 2 (B1)** | Can implementation be split by file ownership? | ✅ YES | Max 3-4 agents, each owns different files, parallel implementation |
| **Phase 2 (B2)** | Can browser tests run while B1 still wrapping up? | ✅ YES | B2 starts immediately as B1 completes |
| **Phase 2 (B3)** | Can QA validation (Part A/B/C) be done in parallel? | ✅ YES | Marker validation + code review + API validation in parallel |
| **Phase 2.5** | Can QA Manager test execution + screenshot review run simultaneously? | ✅ YES | Tests running in background while reviewing screenshots |
| **Phase 2.6** | Can UX/IA validate dark mode + light mode simultaneously? | ✅ YES | Both mode validations in parallel, not sequential |
| **Phase 3** | Can TPPM validate acceptance while Phase 4 planning starts? | ✅ YES | Validation can happen while prepping Phase 4 parallel tracks |
| **Phase 4A (Closer)** | Can code merge + doc updates happen simultaneously? | ✅ YES | Don't wait for perfect docs before merging |
| **Phase 4B/C/D/E** | Can all four tracks run in parallel? | ✅ YES | Closer, Flink Developer, Test Completion, Interview, Optimizer all parallel |
| **Phase 5** | Can Feature N+2 Phase 1 PRD start while N's Phase 5 synthesis happens? | ✅ YES | TPPM starts N+2 Phase 1 while finishing N's Phase 5 |

### Duplicate Agent Rule

**If 2+ features in same phase simultaneously:**
- ❌ DON'T sequence them
- ✅ DO spin up another agent instance for each feature
- Example: Phase 2.5 for Feature A + Feature B? Spin up 2 QA Manager instances

### Never Sequence Independent Work

**Independent tasks (no shared dependencies):**
- Split by file ownership? → Parallel agents
- Split by reviewer responsibility? → Parallel reviewers
- Split by test category? → Parallel test execution
- Split by feature? → Duplicate agents

**Only sequence if true blocker:**
- Example: Shared file edit bottleneck → One agent edits first, others wait minimal time, then continue
- NOT: "Let's do Feature A first, then Feature B" (wasted time)

---

## Pipeline Visualization

```
Timeline ──────────────────────────────────────────────────────────────────────────────
Feature A:  Phase 1 → Phase 2 → Phase 2.5 → Phase 2.6 → Phase 3 → Phase 4(A/B/C/D/E) → Phase 5
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

---

## Key Gates (Sequential Blockers)

- **Phase 1 → Phase 2:** TPPM "PRD SIGN-OFF APPROVED" (blocking)
- **Phase 2 → Phase 2.5:** Engineering completes Phase B (blocking)
- **Phase 2.5 → Phase 2.6:** QA Manager "SIGN-OFF APPROVED" (blocking)
- **Phase 2.6 → Phase 3:** UX/IA Reviewer "SIGN-OFF APPROVED" (blocking)
- **Phase 3 → Phase 4:** TPPM "FEATURE ACCEPTANCE APPROVED" (blocking)

---

## Key Flow

1. TPPM writes Feature B's PRD **while** engineering is building Feature A (Phases 2-4)
2. Feature A Phase 2-4 completes → Phase 5 happens
3. Feature B's Phase 1 is already signed off → Engineering immediately starts Feature B Phase 2 (no blocking wait)
4. Simultaneously, TPPM starts Feature C's Phase 1 PRD **while** engineering builds Feature B
5. Repeat

**Result:** Continuous feature delivery with zero idle time for engineering.

---

## Phase 1: PRD Definition & Sign-off (TPPM Gets Ahead)

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

## Phase 2: Development & QA (Parallel Implementation)

**Trigger:** Phase 1 PRD SIGN-OFF APPROVED (should already be waiting in queue, no blocking wait)
**Responsible:** Opus (orchestrator) + Haiku/Sonnet implementation + QA agents
**Output:** Tested, documented, browser-verified code ready for validation gates
**Key:** Engineering should **never wait** for TPPM to finish Phase 1. TPPM gets ahead during previous feature's Phase 2-4 so this PRD is already approved.

**Parallel Work:** While engineering is in Phase 2, TPPM is already working on Feature N+2's Phase 1 PRD (for the feature after this one).

**Detail:** Implementation workflow (Phases A, B, C) is executed during Phase 2. See [FEATURE-IMPLEMENTATION.md](./FEATURE-IMPLEMENTATION.md).

---

## Phase 2.5: QA Manager Sign-Off (BLOCKING Gatekeeper)

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

## Phase 2.6: UX/IA/Accessibility Validation (BLOCKING Gatekeeper)

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

## Phase 3: Final Acceptance Validation (BLOCKING)

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

## Phase 4: Parallel Post-Acceptance (Five Independent Async Tracks — ALL Non-Blocking)

**Trigger:** Phase 3 FEATURE ACCEPTANCE APPROVED
**Execution:** All five tracks run in parallel immediately. **NONE of these tracks block Phase 5 or the next feature Phase 1 from starting.**

See [CLAUDE.md - Phase 4](../../CLAUDE.md) for detailed track descriptions (Closer, Flink Developer, Test Completion, Interview Analyst, Agent Definition Optimizer).

---

## Phase 5: Roadmap Synthesis & Continuous Planning

**Trigger:** Phase 4 all tracks complete (Closer, Flink Developer, Test Completion, Interview Analyst, Agent Definition Optimizer)
**Responsible Agent:** Technical Principal Product Manager (TPPM)

**Inputs:**
- Flink Developer stress-test feedback report
- Customer & expert interview report
- Closer's completion summary
- Test completion metrics from Track C
- Agent Definition Optimizer improvement suggestions + convergence status

**Steps:**
1. Synthesize feedback from both sources:
   - Flink Developer stress test: categorize critical bugs, perf issues, UX friction, enhancement ideas
   - Customer interviews: consolidate feature requests, pain points, workflow improvements
   - Combined: determine priority, business impact, roadmap fit
2. Update `roadmap.md`: move completed feature to ✅, add all feedback items to inbox, re-rank backlog based on combined signals
3. Verify next feature's Phase 1 is already signed off & waiting (if not, TPPM got behind—Phase 1 should start at Phase 3 approval, complete before Phase 4 ends)
4. Document synthesis results in roadmap

**Output:** Updated `roadmap.md` + confirmation that pipeline is ready for next feature
