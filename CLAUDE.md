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

## Feature Development Workflow

Feature development follows a structured multi-phase orchestration model (Phases 1-5) with detailed implementation steps (Phases A-C). Both are fully documented in `docs/agents/`:

### Workflow Orchestration (Phases 1-5)
See [docs/agents/WORKFLOW-ORCHESTRATION.md](docs/agents/WORKFLOW-ORCHESTRATION.md) for:
- **Phase 1:** PRD Definition & Sign-off (TPPM)
- **Phase 2:** Development & QA (Engineering + QA agents)
- **Phase 2.5:** QA Manager Sign-Off (BLOCKING gate)
- **Phase 2.6:** UX/IA Validation (BLOCKING gate)
- **Phase 3:** Final Acceptance Validation (TPPM)
- **Phase 4:** Five Parallel Async Tracks (Closer, Flink Developer, Test Completion, Interview Analyst, Agent Definition Optimizer)
- **Phase 5:** Roadmap Synthesis (TPPM)

**Core Principle:** TPPM gets ahead and writes PRDs while engineering builds, so there's always a signed-off feature ready. Engineering never waits for PRDs.

### Feature Implementation (Phases A-C)
See [docs/agents/FEATURE-IMPLEMENTATION.md](docs/agents/FEATURE-IMPLEMENTATION.md) for:
- **Phase A:** Design Review (5-reviewer approval gate)
- **Phase B:** Implementation with Tests & Browser Validation (B1-B8 detailed steps)
- **Phase C:** Documentation, FAQ, and Commit

### Phase 4 Detailed Track Descriptions

See [CLAUDE.md - Phase 4 Tracks](#phase-4-tracks) below for five async tracks running in parallel (non-blocking).

---

## Phase 4: Parallel Post-Acceptance (Five Independent Async Tracks — ALL Non-Blocking)

**Trigger:** Phase 3 FEATURE ACCEPTANCE APPROVED
**Execution:** All five tracks run in parallel immediately. **NONE of these tracks block Phase 5 or the next feature Phase 1 from starting.**

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
   - **KEEP:** `docs/agents/feedback/` folder and all agent feedback files inside (NEVER DELETE — permanent audit trail)
3. Commit cleaned code + updated docs to `main`
4. Push to remote
5. Output completion report with commit hash & doc links

**Key:** Test code stays, test artifacts go. Tests run in CI/CD, coverage lives in reports, not in repo. `docs/agents/feedback/` is permanent — never delete it under any circumstances.

#### Track B: Feedback & Stress Test (Async, Non-Blocking)
**Responsible Agents:** TPPM + Flink Developer

**Runs:** In parallel with Tracks A, C, D, and E. Does NOT block Phase 5 or next feature.

**Steps:**
- Flink Developer conducts heavy load testing, edge cases, performance profiling, workflow stress
- Output: Structured feedback report (what broke, perf metrics, UX friction, enhancement ideas)
- TPPM partners with Flink Developer to ensure findings are captured

#### Track C: Test Completion (Async, Non-Blocking)
**Responsible Agent:** Test Completion Agent (Haiku)

**Runs:** In parallel with Tracks A, B, D, and E. Does NOT block Phase 5 or next feature.

**Steps:**
1. Receive Tier 2 gap list from QA Manager
2. Implement all Tier 2 test stubs (edge cases, concurrency, performance)
3. Run full test suite — Tier 1 + Tier 2 must both reach 100% pass
4. Target: ≥ 80% total code coverage at Track C completion
5. Commit Tier 2 tests + update test report in feature PRD

**Reference:** [docs/TESTING-STRATEGY.md](../TESTING-STRATEGY.md)

#### Track D: Customer & Expert Interviews (Async, Non-Blocking)
**Responsible Agent:** Interview Analyst (Sonnet)

**Runs:** In parallel with Tracks A, B, C, and E. Does NOT block Phase 5 or next feature.

**Steps:**
1. Conduct structured interviews with: Flink engineers (daily users), domain experts, power users
2. Topics: What's missing? What friction exists? What would make this 10x more valuable? What to build next?
3. Compile findings into a **Customer Interview Report** with:
   - Feature-specific feedback (immediate improvements)
   - Roadmap ideas (new features to consider)
   - Pain points (workflow gaps)
   - Priority signals (what interviewees care most about)
4. Deliver report to TPPM for Phase 5 synthesis alongside Flink Developer stress-test feedback

#### Track E: Agent Definition Optimization (Async, Self-Improving, Self-Regulating)
**Responsible Agent:** Agent Definition Optimizer (Sonnet)

**Runs:** In parallel with Tracks A, B, C, and D. Does NOT block Phase 5 or next feature.

**Self-Improvement Loop:**
1. Collect feedback from all Phase 4 agents: Each agent outputs to `docs/agents/feedback/run-{N}/[AgentName].md` (e.g., `run-1/TPPM.md`, `run-2/QA-MANAGER.md`, etc.)
2. Compare current `docs/agents/[Agent].md` files against actual behavior documented in feedback
3. Identify gaps: missing capabilities, outdated assumptions, inaccurate descriptions
4. Generate improvement suggestions with evidence from feedback
5. Output: `docs/agents/agent-improvement-suggestions.md` with structured recommendations
6. **Self-Rating & Convergence Detection:**
   - Measure % of text changed from previous optimization run
   - If change % > 1% across all agents: Continue optimizing (definitions still converging)
   - If change % ≤ 1% for 5+ consecutive runs: Mark as "CONVERGED" — pause optimizer until feedback patterns shift
   - If new feedback patterns detected: Automatically resume optimizer

**Key:** This track self-regulates. Once agent definitions converge, it goes dormant, eliminating computational overhead. Reactivates automatically if behavior patterns change.

**Output:** Improvement suggestions report + convergence status. Claude Code reviews suggestions asynchronously and applies updates between features (non-critical path).

---

## Key Rules for Continuous Pipeline Execution

**Pipeline & Parallelism:**
- **TPPM must get ahead** - Phase 1 PRD work should overlap with previous feature's Phases 2-4
- **TPPM starts next feature at Phase 3 approval** - Immediately after "FEATURE ACCEPTANCE APPROVED" is output, TPPM begins writing the next feature's Phase 1 (full PRD + acceptance tests + E2E specs). By the time Phase 4 completes, next feature is fully documented and ready for engineering Phase 2.
- **Engineering never waits** - Phase 2 starts immediately with already-approved Phase 1 PRD (with tests and E2E specs pre-written)
- **Async tracks don't block** - Phase 4 Tracks A/B/C/D/E run in parallel, don't block Phase 5 or next Phase 1
- **Agent definitions self-improve** - Track E continuously improves agent MD files based on feedback; self-regulates (pauses when converged at <1% change/run)
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
- **Roadmap drives velocity** - `roadmap.md` is the single source of truth. Simple format:
  ```
  ## Current Feature
  - Phase: X (1-5)
  - PRD: docs/features/phase-X.md
  - Agent: [TPPM|Engineer|QA Manager]

  ## Next Feature (If TPPM is ahead)
  - Phase: 1 (PRD writing)
  - PRD: docs/features/phase-Y.md

  ## Shipped Features
  - Phase Z (Release N)
  ```
- **How it works** - Claude Code reads `roadmap.md`, launches the appropriate agent(s) for the current phase, waits for completion, updates roadmap. No polling, no background processes. Zero overhead.

---

## Subagent Profiles

All agent definitions live in `docs/agents/`. Each file contains: role, responsibilities, inputs, outputs, and success criteria.

| Agent | Model | File | Phase | Description |
|-------|-------|------|-------|-------------|
| **TPPM** | Sonnet | [TPPM.md](docs/agents/TPPM.md) | 1, 3, 5 | PRD gatekeeper, acceptance validator, roadmap synthesizer |
| **QA Manager** | Sonnet | [QA-MANAGER.md](docs/agents/QA-MANAGER.md) | 2.5, A2 | Test quality gatekeeper, screenshot validator, Tier 1/2 auditor |
| **UX/IA Reviewer** | Sonnet | [UX-IA-REVIEWER.md](docs/agents/UX-IA-REVIEWER.md) | 2.6, A2 | UX gatekeeper, accessibility validator, design reviewer |
| **Closer** | Sonnet | [CLOSER.md](docs/agents/CLOSER.md) | 4A | Code finisher, documentation, artifact cleanup, repo merging |
| **Flink Developer** | Sonnet | [FLINK-DEVELOPER.md](docs/agents/FLINK-DEVELOPER.md) | 4B | Stress tester, performance validator, feedback generator |
| **Test Completion** | Haiku | [TEST-COMPLETION.md](docs/agents/TEST-COMPLETION.md) | 4C | Post-ship test finisher, Tier 2 implementation, coverage completion |
| **Interview Analyst** | Sonnet | [INTERVIEW-ANALYST.md](docs/agents/INTERVIEW-ANALYST.md) | 4D | Customer voice, user interviews, roadmap input gathering |
| **Agent Definition Optimizer** | Sonnet | [AGENT-DEFINITION-OPTIMIZER.md](docs/agents/AGENT-DEFINITION-OPTIMIZER.md) | 4E | Self-improving agent profiles, convergence detection, continuous refinement |
| **Workflow Manager** | Opus | [WORKFLOW-MANAGER.md](docs/agents/WORKFLOW-MANAGER.md) | Continuous | Workflow orchestrator, gate enforcer, status file maintainer |
| **Feature Organizer & Ranker** | Sonnet | [FEATURE-ORGANIZER-RANKER.md](docs/agents/FEATURE-ORGANIZER-RANKER.md) | Continuous | Feedback grouping, story pointing, release batching, roadmap auto-update |

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
