# Platform Roadmap

**Last Updated:** 2026-03-01 (Phase 5 synthesis complete — Phase 12.3 Topic Management)
**Orchestration Model:** Multi-Agent Workflow (Phases 1-5)

---

## 🎯 Current Cycle

*This section is automatically updated by the TPPM when a new workflow kicks off.*

| Active Feature | Stage | Lead Agent | Started |
| :--- | :--- | :--- | :--- |
| Phase 12.4: Full Lifecycle Integration | **Phase 1: PRD Writing (TPPM)** | TPPM | 2026-03-01 |

### Last Completed Cycle

| Feature | Final Status | Completed | Notes |
| :--- | :--- | :--- | :--- |
| Phase 12.3: Topic Management | **Phase 5: Synthesis COMPLETE** | 2026-03-01 | 59+33 pts backlog queued. See Release 2 & 3 in pipeline. |

---

## 📋 Feature Pipeline (Grouped by Release)

*Features are organized by source and grouped into releases. When a release reaches ≥25 story points, it's scheduled for Phase 2 implementation. Enhancements to existing features are tracked as releases (Release 1 = initial ship, Release 2+ = updates).*

### Current & Queued Features

| Priority | Feature | Release | Status | Points | Type |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **1** | Phase 12.4: Full Lifecycle Integration | Release 1 | Phase 1 PRD (TPPM Writing) | — | Feature |
| **2** | Phase 12.2: Schema Management | **Release 2** | 📦 Ready for Phase 2 | **38** | Update |
| **3** | Phase 12.3: Topic Management | **Release 2** | 📦 Ready for Phase 2 | **59** | Update |
| **4** | Phase 12.3: Topic Management | **Release 3** | 📦 Ready for Phase 2 | **33** | Update |

### Phase 12.2: Release 2 Details (Schema Management Updates)

*38 story points total — batched as single release. Amended PRD: `docs/features/phase-12-schema-management.md` (Release 2 section). Estimated implementation: 1-2 weeks.*

| Points | Item | Type | Notes |
| :---: | :--- | :--- | :--- |
| **5** | Tab key escapes focus in evolve textarea | Bug | Critical UX issue |
| **3** | Click-to-copy field names from Tree View | Enhancement | Power user feature |
| **2** | Disable Tree button for non-Avro schemas | Bug | Prevent invalid operations |
| **2** | Show "Global" label for global compat mode | Enhancement | UX clarity |
| **3** | Fix null default display in Tree View | Bug | Data accuracy |
| **8** | Schema diff view between versions | Enhancement | Major feature |
| **2** | Loading shimmer for version switch | Enhancement | UX polish |
| **2** | Type badge (AVRO/PROTOBUF/JSON) in list rows | Enhancement | UX clarity |
| **2** | Confirmation toast for compat mode changes | Enhancement | UX safety |
| **1** | Show "7 subjects" instead of "7 of 7 subjects" | Enhancement | UX polish |
| **5** | Generate SELECT from schema fields | Enhancement | Developer productivity |
| **2** | Per-version delete in SchemaDetail | Enhancement | Feature completeness |
| **1** | Panel resize handle | Enhancement | UX polish |

### Phase 12.3: Release 2 Details (Topic Management — Critical Bugs + High-Priority Fixes)

*59 story points total — batched from Phase 4 Track B (Flink Developer stress test, 2026-03-01) + Phase 2.6 UX/IA sign-off. Recommended to implement before Phase 12.4 begins. Source: `docs/agents/feedback/run-1/FLINK-DEVELOPER.md`.*

| Points | Item | ID | Type | Notes |
| :---: | :--- | :--- | :--- | :--- |
| **3** | Auth header burned at module load — credential rotation impossible | CRIT-1 | Bug | Move to request interceptor: `kafka-rest-client.ts:4-18` |
| **5** | System topic regex misses `__confluent-*` prefix variant | CRIT-2 | Bug | Regex fix: `topic-api.ts:9` — `__confluent-controlcenter-*` leaks into list |
| **5** | Double `loadTopics()` race condition after delete | CRIT-3 | Bug | Store + component both call loadTopics — parallel calls, potential stale data |
| **3** | No unmount guard on `loadTopics` during rapid panel switching | HIGH-1 | Bug | Missing cleanup in `useEffect` — stale writes on unmount |
| **3** | Dead code branch — network error message never shown | HIGH-2 | Bug | `'response' in error` always true in Axios — friendly message unreachable |
| **3** | Deleted topic ghost-appears in list after confirmed delete | HIGH-3 | Bug | `clearSelectedTopic()` before `loadTopics()` resolves — 200-500ms ghost flash |
| **3** | `cleanup.policy=delete,compact` rendered as compact-only badge | HIGH-4 | Bug | `isDelete = value === 'delete'` — misses combined policy |
| **5** | Rapid topic switching fires N concurrent config fetches (rate limit risk) | HIGH-5 | Bug | `getTopicConfigs` fires per selected topic, no AbortController |
| **8** | No virtualization — 1000+ topics will freeze browser | MED-2 | Enhancement | Integrate `@tanstack/react-virtual` (already in deps) — enterprise blocker |
| **2** | Space-only topic name shows no validation error, button silently disabled | MED-3 | Bug | `canCreate` uses `trim()` but validator doesn't — blank error for space input |
| **2** | Decimal `retention.ms` silently truncated by `parseInt` | MED-5 | Bug | `parseInt('1.5', 10)` → 1ms; add `step="1"` + validate integer |
| **2** | No HTTP timeout on Kafka REST client — requests hang indefinitely | MED-6 | Bug | Add `timeout: 30000` to `kafkaRestClient` Axios instance |
| **2** | Partition/RF/cleanup badges use hardcoded hex RGBA (dark mode risk) | LOW-6 | Bug | `rgba(73,51,215,0.1)` — define `--badge-primary-bg` CSS var. Merged with UX-1. |
| **2** | `console.log` leaks sensitive config data in production | LOW-1 | Bug | Guard with `import.meta.env.DEV`; never log `response.data` (contains is_sensitive values) |
| **5** | Topic health indicator: partition count < 2 warning badge | ENH-2 | Enhancement | Warn when `partitions_count < 2` — Flink parallelism domain best practice |
| **3** | Config search/filter within detail view | ENH-3 | Enhancement | Filter input within config table — "ssl" → show SSL-related configs only |
| **3** | Copy config value button on row hover | ENH-6 | Enhancement | Same hover-reveal clipboard pattern as Phase 5.4 column copy |

### Phase 12.3: Release 3 Details (Topic Management — Polish + Major Enhancements)

*33 story points total — lower-priority items from Phase 4 Track B stress test. Source: `docs/agents/feedback/run-1/FLINK-DEVELOPER.md`.*

| Points | Item | ID | Type | Notes |
| :---: | :--- | :--- | :--- | :--- |
| **2** | `formatRetentionMs` drops minutes/seconds for mixed durations (e.g., "1d 1h" for 25h 1m 1s) | MED-1 | Bug | Misleading for intermediate retention values |
| **1** | `handleCreate` silently returns on validation error — no user feedback | MED-4 | Bug | Add `setNameValidationError(error)` on silent return path |
| **2** | Config value tooltip shows raw ms, not human-readable format | MED-7 | Bug | `title={config.value}` shows "604800000" instead of "7d" |
| **2** | Back navigation doesn't restore focus to previously selected topic row | LOW-2 | Bug | Keyboard-first users lose position after back nav |
| **1** | Delete dialog title overflows for 249-char topic names | LOW-3 | Bug | Add `textOverflow: 'ellipsis'` to `<h3>` in delete confirm |
| **2** | CreateTopic does not return focus to Create button on close | LOW-4 | Bug | Missing `triggerRef` focus-return on `onClose` |
| **1** | `getTopicDetail` is dead code — never called | LOW-5 | Bug | Remove or add JSDoc marking as reserved for Phase 12.4 |
| **5** | "Insert topic name" into active SQL editor (use editorRegistry) | ENH-1 | Enhancement | "Use in SQL" button → backtick-quoted insert at cursor |
| **2** | Show topic created_at / last_modified_at if API provides it | ENH-4 | Enhancement | API availability dependent |
| **13** | Bulk delete topics (multi-select checkbox mode) | ENH-5 | Enhancement | Major feature — high value for cluster cleanup workflows |
| **2** | "Compact" policy warning in CreateTopic — data loss risk notice | ENH-7 | Enhancement | Callout when user selects compact: keyless message footgun |

---

## 📥 Feedback Processing (Grouped into Releases)

*Stress test feedback is grouped by source feature and assigned story points. When grouped feedback reaches ≥25 points, it becomes a Release and enters the implementation pipeline.*

### Current Release Candidates
- **Phase 12.2 Release 2:** 38 points (13 items) → **Ready for Phase 2** ✅ *(corrected from 34 — item-by-item recount)*
- **Phase 12.3 Release 2:** 59 points (17 items) → **Ready for Phase 2** ✅ *(Flink Developer stress test + UX/IA sign-off, 2026-03-01)*
- **Phase 12.3 Release 3:** 33 points (11 items) → **Ready for Phase 2** ✅ *(Flink Developer stress test, 2026-03-01)*

### Archive (Processed)
- **[2026-03-01] Phase 12.3 Flink Developer Stress Test Report — PROCESSED INTO RELEASE 2 (59pts/17 items) + RELEASE 3 (33pts/11 items):**
  - Source: `docs/agents/feedback/run-1/FLINK-DEVELOPER.md`
  - 21 bug/issue findings (59 pts corrected — Flink Developer's table states 57 due to arithmetic error)
  - 7 enhancement findings (33 pts)
  - UX-1 from Phase 2.6 UX/IA review (1pt) merged into LOW-6 (2pt) — same rgba badge issue
  - All 28 items batched into Release 2 (priority) and Release 3 (polish/enhancements)
- **[2026-02-28] Phase 12.2 TPPM+Flink Developer Partnership Report — PROCESSED INTO RELEASE 2:**
  - ~~BUG-1 (MEDIUM): Race condition in rapid subject switching — FIXED (generation counter)~~
  - ~~BUG-2 (LOW): Console logs expected 404s as errors — FIXED (suppressed 404 interceptor)~~
  - HIGH: Tab key escapes focus in evolve textarea → Backlog Rank 2
  - HIGH: No click-to-copy field names from Tree View → Backlog Rank 3
  - MEDIUM: Tree button enabled for non-Avro schemas → Backlog Rank 4
  - MEDIUM: No global vs subject-level compat indication → Backlog Rank 5
  - MEDIUM: Null default display issue in Tree View → Backlog Rank 6
  - MEDIUM: No schema diff view between versions → Backlog Rank 7
  - LOW: Loading shimmer for version switch → Backlog Rank 8
  - LOW: Type badge in list rows → Backlog Rank 9
  - LOW: Confirmation toast for compat mode changes → Backlog Rank 10
  - LOW: Show "N subjects" instead of "N of N" when all match → Backlog Rank 11
  - LOW: Generate SELECT from schema fields → Backlog Rank 12
  - LOW: Per-version delete → Backlog Rank 13
  - LOW: Panel resize handle → Backlog Rank 14

---

## ✅ Completed

*The Closer subagent logs successfully deployed and documented features here. These are features that have passed all phases and are live.*

| Date | Feature | Closer | Commits | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 2026-03-01 | Phase 12.3: Topic Management | Closer | Pending commit | Kafka Topic panel: list/detail/create/delete, config table, system topic filter, 1428 tests. Release 2 (59pts) + Release 3 (33pts) queued. |
| 2026-02-28 | Phase 12.2: Schema Management | Closer | a40884a | Schema Registry panel: list/detail/create/evolve/delete, tree view, 9 API functions, 1125 tests |

---

## 📊 Workflow State — Phase 12.3: Topic Management

| Phase | Status | Current Owner | Blocker? |
| :--- | :--- | :--- | :--- |
| Phase 1: PRD Sign-off | **APPROVED** | TPPM | — |
| Phase 2: Dev & QA | **COMPLETE** | Engineering | — |
| Phase 2.5: QA Manager | **APPROVED** | QA Manager | — |
| Phase 2.6: UX/IA | **APPROVED** | UX/IA Reviewer | — |
| Phase 3: Acceptance | **FEATURE ACCEPTANCE APPROVED** | TPPM | — |
| Phase 4A: Closure | **COMPLETE** | Closer | Artifacts cleaned, docs verified, commit-ready. |
| Phase 4B: Stress Test | **COMPLETE** | Flink Developer | 28 items, 92 pts total. Batched: R2 (59pts/17 items), R3 (33pts/11 items). |
| Phase 4C: Test Completion | **COMPLETE** | Test Completion (Haiku) | 1429 tests, 0 todos. Focus trap test implemented. All 17 Tier 2 tests done. |
| Phase 4D: Interviews | Deferred | Interview Analyst | No real user interviews available this cycle. |
| Phase 4E: Agent Optimizer | Deferred | Agent Definition Optimizer | Insufficient feedback runs for convergence detection. |
| Phase 5: Roadmap Sync | **COMPLETE** | TPPM | Phase 12.3 R2+R3 queued. Phase 12.4 PRD writing started. Roadmap updated 2026-03-01. |

---

## 🔄 Workflow Execution Rules

- **Phase 1 → Phase 2:** TPPM must output "PRD SIGN-OFF APPROVED" to unblock development
- **Phase 3 → Phase 4:** TPPM must output "FEATURE ACCEPTANCE APPROVED" to unblock closure & stress testing
- **Phase 4A & 4B:** Run in parallel; neither blocks the other
- **Phase 5 Kickoff:** TPPM synthesizes Track B feedback and commands Phase 1 for next top-ranked item
- **Frequency:** Current plan is one feature cycle per [TBD by TPPM]

---

## 📝 Notes

- This roadmap is the source of truth for project prioritization and workflow state.
- TPPM updates this document during Phase 5 synthesis and before kickoff.
- All decisions are documented here for transparency and continuity.
- Target state: Continuous feature delivery with integrated stress testing and feedback loops.
