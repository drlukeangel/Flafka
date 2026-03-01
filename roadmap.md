# Platform Roadmap

**Last Updated:** 2026-03-01T08:00:00Z (TPPM Phase 1 Complete: Phase 12.5 PRD SIGN-OFF APPROVED — Ready for Phase 2)
**Orchestration Model:** Multi-Agent Workflow (Phases 1-5)

---

## 🎯 Current Cycle

*This section is automatically updated by the TPPM when a new workflow kicks off.*

| Active Feature | Stage | Lead Agent | Started |
| :--- | :--- | :--- | :--- |
| Phase 12.5: Advanced Topic & Schema Operations | **✅ PRD SIGN-OFF APPROVED — Ready for Phase 2** | Engineering | 2026-03-01 |

### Last Completed Cycle

| Feature | Final Status | Completed | Notes |
| :--- | :--- | :--- | :--- |
| Phase 12.4: Full Lifecycle Integration | **Phase 5: Synthesis COMPLETE** | 2026-03-01 | All 6 features shipped (Query, Insert, Cross-nav, Config Edit, Health Indicators, Partition Detail). User-validated (5 interviews, 100% approval). Commit 529cec7. Phase 4 Tracks A/B/C/D/E complete. 3 releases queued (12.2 R2: 51pts, 12.3 R2: 62pts, 12.3 R3: 36pts = 149 pts total). |

---

## 📋 Feature Pipeline (Grouped by Release)

*Features are organized by source and grouped into releases. When a release reaches ≥25 story points, it's scheduled for Phase 2 implementation. Enhancements to existing features are tracked as releases (Release 1 = initial ship, Release 2+ = updates).*

### Current & Queued Features

| Priority | Feature | Release | Status | Points | Type |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **0** | Phase 12.5: Advanced Topic & Schema Operations | Release 1 | ✅ PRD SIGN-OFF APPROVED — Phase 2 Ready | — | Feature |
| **1** | Phase 12.2: Schema Management | **Release 2** | 📦 Ready for Phase 2 | **51** | Update |
| **2** | Phase 12.3: Topic Management | **Release 2** | 📦 Ready for Phase 2 | **62** | Update |
| **3** | Phase 12.3: Topic Management | **Release 3** | ✅ Phase 2 Complete — Ready for QA Gate (2.5) | **36** | Update |

### Phase 12.2: Release 2 Details (Schema Management Updates)

*51 story points total (was 38 — +13 from Run-2 Flink Developer stress test, 2026-02-28). Batched as single release. Amended PRD: `docs/features/phase-12-schema-management.md` (Release 2 section). Estimated implementation: 1-2 weeks. Sources: Phase 4B Run-1 (original 38pts) + Phase 4B Run-2 (5 new items, 13pts).*

| Points | Item | ID | Type | Priority | Notes |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **5** | Tab key escapes focus in evolve textarea | ORIG-1 | Bug | Critical | Critical UX issue |
| **3** | Schema diff view stale when primary version changes | R2-1 | Bug | High | `diffSchema` not reloaded when `selectedVersion` changes in diff mode. Source: Run-2 Flink Developer §2 |
| **3** | Schema diff view: comparing version to itself not guarded | R2-3 | Bug | High | No guard prevents selecting same version as diffVersion. Source: Run-2 Flink Developer §8 |
| **3** | Click-to-copy field names from Tree View | ORIG-2 | Enhancement | High | Power user feature |
| **3** | Fix null default display in Tree View | ORIG-5 | Bug | High | Data accuracy |
| **2** | Schema subject delete has no name confirmation | R2-2 | Bug | Medium | Inconsistent with Topic delete UX — one misclick deletes all versions. Source: Run-2 Flink Developer §5 |
| **2** | Disable Tree button for non-Avro schemas | ORIG-3 | Bug | Medium | Prevent invalid operations |
| **2** | `handleDeleteVersion` uses `window.confirm()` | R2-4 | Bug | Medium | Only `window.confirm()` in codebase — inconsistent with `DeleteConfirm` pattern. Source: Run-2 Flink Developer §6 |
| **2** | SchemaTreeView hardcoded `#8B5CF6` / `#14B8A6` colors | R2-5 | Bug | Medium | Theme-breaking in `SchemaTreeView.tsx:97,99,101`. Source: Run-2 Flink Developer §3 |
| **2** | Show "Global" label for global compat mode | ORIG-4 | Enhancement | Medium | UX clarity |
| **8** | Schema diff view between versions | ORIG-6 | Enhancement | Medium | Major feature (underlying framework now present; these bugs improve it) |
| **2** | Loading shimmer for version switch | ORIG-7 | Enhancement | Low | UX polish |
| **2** | Type badge (AVRO/PROTOBUF/JSON) in list rows | ORIG-8 | Enhancement | Low | UX clarity |
| **2** | Confirmation toast for compat mode changes | ORIG-9 | Enhancement | Low | UX safety |
| **1** | Show "7 subjects" instead of "7 of 7 subjects" | ORIG-10 | Enhancement | Low | UX polish |
| **5** | Generate SELECT from schema fields | ORIG-11 | Enhancement | Low | Developer productivity |
| **2** | Per-version delete in SchemaDetail | ORIG-12 | Enhancement | Low | Feature completeness |
| **1** | Panel resize handle | ORIG-13 | Enhancement | Low | UX polish |

### Phase 12.3: Release 2 Details (Topic Management — Critical Bugs + High-Priority Fixes)

*62 story points total (was 59 — +3 from Run-2 Flink Developer stress test, 2026-02-28). Batched from Phase 4 Track B Run-1 (Flink Developer stress test) + Phase 2.6 UX/IA sign-off + Run-2 validation. Source: `docs/agents/feedback/run-1/FLINK-DEVELOPER.md` + `docs/agents/feedback/run-2/FLINK-DEVELOPER.md`.*

*Note: All CRIT and HIGH items from Run-1 were confirmed CORRECTLY FIXED in Run-2 (see Run-2 Flink Developer §1). One new MED item added from Run-2: AbortController signal not passed to HTTP layer.*

| Points | Item | ID | Type | Run-1 Status | Notes |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **3** | Auth header burned at module load — credential rotation impossible | CRIT-1 | Bug | ✅ FIXED (Run-2) | Move to request interceptor: `kafka-rest-client.ts:4-18` |
| **5** | System topic regex misses `__confluent-*` prefix variant | CRIT-2 | Bug | ✅ FIXED (Run-2) | Regex fix: `topic-api.ts:9` — `__confluent-controlcenter-*` leaks into list |
| **5** | Double `loadTopics()` race condition after delete | CRIT-3 | Bug | ✅ FIXED (Run-2) | Store + component both call loadTopics — parallel calls, potential stale data |
| **3** | No unmount guard on `loadTopics` during rapid panel switching | HIGH-1 | Bug | ✅ FIXED (Run-2) | Missing cleanup in `useEffect` — stale writes on unmount |
| **3** | Dead code branch — network error message never shown | HIGH-2 | Bug | ✅ FIXED (Run-2) | `'response' in error` always true in Axios — friendly message unreachable |
| **3** | Deleted topic ghost-appears in list after confirmed delete | HIGH-3 | Bug | ✅ FIXED (Run-2) | `clearSelectedTopic()` before `loadTopics()` resolves — 200-500ms ghost flash |
| **3** | `cleanup.policy=delete,compact` rendered as compact-only badge | HIGH-4 | Bug | ✅ FIXED (Run-2) | `isDelete = value === 'delete'` — misses combined policy |
| **5** | Rapid topic switching fires N concurrent config fetches (rate limit risk) | HIGH-5 | Bug | ✅ FIXED (Run-2) | `getTopicConfigs` fires per selected topic, no AbortController |
| **3** | AbortController signal not passed to Axios in `getTopicConfigs` | R2-ABT | Bug | NEW (Run-2) | Signal guards React state but HTTP request not cancelled — slow networks risk 10+ in-flight requests. Fix: add `signal` param to `getTopicConfigs`. Source: Run-2 §4 |
| **8** | No virtualization — 1000+ topics will freeze browser | MED-2 | Enhancement | ✅ FIXED (Run-2) | Integrate `@tanstack/react-virtual` (already in deps) — enterprise blocker |
| **2** | Space-only topic name shows no validation error, button silently disabled | MED-3 | Bug | ✅ FIXED (Run-2) | `canCreate` uses `trim()` but validator doesn't — blank error for space input |
| **2** | Decimal `retention.ms` silently truncated by `parseInt` | MED-5 | Bug | ✅ FIXED (Run-2) | `parseInt('1.5', 10)` → 1ms; add `step="1"` + validate integer |
| **2** | No HTTP timeout on Kafka REST client — requests hang indefinitely | MED-6 | Bug | ✅ FIXED (Run-2) | Add `timeout: 30000` to `kafkaRestClient` Axios instance |
| **2** | Partition/RF/cleanup badges use hardcoded hex RGBA (dark mode risk) | LOW-6 | Bug | ✅ FIXED (Run-2) | `rgba(73,51,215,0.1)` — define `--badge-primary-bg` CSS var. Merged with UX-1. |
| **2** | `console.log` leaks sensitive config data in production | LOW-1 | Bug | ✅ FIXED (Run-2) | Guard with `import.meta.env.DEV`; never log `response.data` (contains is_sensitive values) |
| **5** | Topic health indicator: partition count < 2 warning badge | ENH-2 | Enhancement | ✅ FIXED (Run-2) | Warn when `partitions_count < 2` — Flink parallelism domain best practice |
| **3** | Config search/filter within detail view | ENH-3 | Enhancement | ✅ FIXED (Run-2) | Filter input within config table — "ssl" → show SSL-related configs only |
| **3** | Copy config value button on row hover | ENH-6 | Enhancement | ✅ FIXED (Run-2) | Same hover-reveal clipboard pattern as Phase 5.4 column copy |

### Phase 12.3: Release 3 Details (Topic Management — Polish + Major Enhancements)

*36 story points total (was 33 — +3 from Run-2 Flink Developer stress test, 2026-02-28). Lower-priority items from Phase 4 Track B stress test. Sources: `docs/agents/feedback/run-1/FLINK-DEVELOPER.md` (original 33pts) + `docs/agents/feedback/run-2/FLINK-DEVELOPER.md` (3 new LOW items).*

*Note: LOW-2 partially fixed in Phase 12.3 Release 2 implementation (ref stored but not consumed). Run-2 confirms it remains unresolved as a focus-restore issue. Original 2-pt estimate maintained.*

| Points | Item | ID | Type | Run-1 Status | Notes |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **2** | `formatRetentionMs` drops minutes/seconds for mixed durations (e.g., "1d 1h" for 25h 1m 1s) | MED-1 | Bug | ✅ FIXED (Run-2) | Misleading for intermediate retention values |
| **1** | `handleCreate` silently returns on validation error — no user feedback | MED-4 | Bug | ✅ FIXED (Run-2) | Add `setNameValidationError(error)` on silent return path |
| **2** | Config value tooltip shows raw ms, not human-readable format | MED-7 | Bug | ✅ FIXED (Run-2) | `title={config.value}` shows "604800000" instead of "7d" |
| **2** | Back navigation doesn't restore focus to previously selected topic row | LOW-2 | Bug | PARTIAL (Run-2) | `lastFocusedTopicRef` stored but focus never restored. Keyboard-first users lose position after back nav. Run-2 §LOW-2 confirms still unresolved. |
| **1** | Delete dialog title overflows for 249-char topic names | LOW-3 | Bug | ✅ FIXED (Run-2) | Add `textOverflow: 'ellipsis'` to `<h3>` in delete confirm |
| **2** | CreateTopic does not return focus to Create button on close | LOW-4 | Bug | ✅ FIXED (Run-2) | Missing `triggerRef` focus-return on `onClose` |
| **1** | `getTopicDetail` is dead code — never called | LOW-5 | Bug | ✅ FIXED (Run-2) | Remove or add JSDoc marking as reserved for Phase 12.4 |
| **1** | Virtual scroll keyboard nav doesn't call `scrollToIndex` when focusedIndex changes | R2-VS | Bug | NEW (Run-2) | `focusedIndex` set to out-of-view row — ref callback not invoked, item not scrolled into view. Source: Run-2 §2 (edge case) |
| **1** | focusedIndex reset delayed by 300ms debounce — stale index possible on fast Enter | R2-DEB | Bug | NEW (Run-2) | Reset should also run synchronously on `searchQuery` (not just debounced). Source: Run-2 §9 |
| **1** | Config copy button DOM query causes cosmetic flicker on rapid hover between rows | R2-COPY | Bug | NEW (Run-2) | `[data-copy-btn]` DOM traversal in React render; cosmetic only. Source: Run-2 §2 (edge case) |
| **5** | "Insert topic name" into active SQL editor (use editorRegistry) | ENH-1 | Enhancement | ✅ FIXED (Run-2) | "Use in SQL" button → backtick-quoted insert at cursor |
| **2** | Show topic created_at / last_modified_at if API provides it | ENH-4 | Enhancement | Pending | API availability dependent |
| **13** | Bulk delete topics (multi-select checkbox mode) | ENH-5 | Enhancement | Pending | Major feature — high value for cluster cleanup workflows |
| **2** | "Compact" policy warning in CreateTopic — data loss risk notice | ENH-7 | Enhancement | ✅ FIXED (Run-2) | Callout when user selects compact: keyless message footgun |

---

## 📥 Feedback Processing (Grouped into Releases)

*Stress test feedback is grouped by source feature and assigned story points. When grouped feedback reaches ≥25 points, it becomes a Release and enters the implementation pipeline.*

### Current Release Candidates
- **Phase 12.2 Release 2:** 51 points (18 items) → **Ready for Phase 2** ✅ *(+13pts from Run-2 Flink Developer, 2026-02-28)*
- **Phase 12.3 Release 2:** 62 points (18 items) → **Ready for Phase 2** ✅ *(+3pts from Run-2 Flink Developer AbortController finding, 2026-02-28)*
- **Phase 12.3 Release 3:** 36 points (14 items) → **Ready for Phase 2** ✅ *(+3pts from Run-2 Flink Developer 3 new LOW items, 2026-02-28)*

### Archive (Processed)

- **[2026-02-28] Phase 12.3/12.2 Run-2 Flink Developer Stress Test — PROCESSED INTO RELEASES:**
  - Source: `docs/agents/feedback/run-2/FLINK-DEVELOPER.md`
  - Scope: Validated all Phase 12.3 Release 2 CRIT/HIGH fixes (ALL CORRECTLY FIXED), validated new Phase 12.4 features (4 edge cases found), found 11 new items in Schema/Topic areas
  - **Phase 12.2 Release 2 additions (+13pts, 5 items):** Diff stale on version change (3pts), Diff self-compare guard (3pts), Schema delete no name-confirm (2pts), `window.confirm()` for version delete (2pts), SchemaTreeView hardcoded colors (2pts) → R2 now 51pts
  - **Phase 12.3 Release 2 additions (+3pts, 1 item):** AbortController signal not passed to Axios in `getTopicConfigs` (3pts MED) → R2 now 62pts
  - **Phase 12.3 Release 3 additions (+3pts, 3 items):** Virtual scroll scrollToIndex missing (1pt), debounce focus reset race (1pt), config copy DOM flicker (1pt) → R3 now 36pts
  - **Phase 12.4 edge cases (informational — not batched):** Diff view cross-version stale (already in R2), LOW-2 back-nav (note added to R3 LOW-2)
  - Run-2 confirms: all Phase 12.3 Run-1 CRIT/HIGH/MED items correctly fixed. No regressions found.

- **[2026-03-01] Phase 12.3 Flink Developer Stress Test Report (Run-1) — PROCESSED INTO RELEASE 2 (59pts/17 items) + RELEASE 3 (33pts/11 items):**
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
| 2026-03-01 | Phase 12.4: Full Lifecycle Integration | Closer | 529cec7 | Query with Flink, Insert topic name, Cross-nav Topics→Schema, Config editing, Health indicators, Partition detail. 2042+ tests. 5 users validated (100% approval). All 6 features ready. Release queue: 12.2 R2 (51pts), 12.3 R2 (62pts), 12.3 R3 (36pts). |
| 2026-03-01 | Phase 12.3: Topic Management | Closer | 21cad92 | Kafka Topic panel: list/detail/create/delete, config table, system topic filter, 1428 tests. Release 2 (59pts) + Release 3 (33pts) queued. |
| 2026-02-28 | Phase 12.2: Schema Management | Closer | a40884a | Schema Registry panel: list/detail/create/evolve/delete, tree view, 9 API functions, 1125 tests |

---

## 📊 Workflow State — Phase 12.5: Advanced Topic & Schema Operations (Current)

| Phase | Status | Current Owner | Blocker? |
| :--- | :--- | :--- | :--- |
| Phase 1: PRD Sign-off | **✅ PRD SIGN-OFF APPROVED** | TPPM | — |
| Phase 2: Dev & QA | **READY TO START** | Engineering | Phase 1 gate cleared. PRD: `docs/features/phase-12.5-prd.md` |
| Phase 2.5: QA Manager | ⏳ PENDING | QA Manager | — |
| Phase 2.6: UX/IA | ⏳ PENDING | UX/IA Reviewer | — |
| Phase 3: Acceptance | ⏳ PENDING | TPPM | — |
| Phase 4A: Closure | ⏳ PENDING | Closer | — |
| Phase 4B: Stress Test | ⏳ PENDING | Flink Developer | — |
| Phase 4C: Test Completion | ⏳ PENDING | Test Completion (Haiku) | — |
| Phase 4D: Interviews | ⏳ PENDING | Interview Analyst | — |
| Phase 4E: Agent Optimizer | ⏳ PENDING | Agent Definition Optimizer | — |
| Phase 5: Roadmap Sync | ⏳ PENDING | TPPM | — |

---

## 📊 Workflow State — Phase 12.4: Full Lifecycle Integration

| Phase | Status | Current Owner | Blocker? |
| :--- | :--- | :--- | :--- |
| Phase 1: PRD Sign-off | **APPROVED** | TPPM | — |
| Phase 2: Dev & QA | **COMPLETE** | Engineering | — |
| Phase 2.5: QA Manager | **APPROVED** | QA Manager | — |
| Phase 2.6: UX/IA | **APPROVED** | UX/IA Reviewer | — |
| Phase 3: Acceptance | **FEATURE ACCEPTANCE APPROVED** | TPPM | — |
| Phase 4A: Closure | **COMPLETE** | Closer | Code merged to master (529cec7). Test artifacts cleaned. Docs verified. Roadmap updated. |
| Phase 4B: Stress Test | **COMPLETE** | Flink Developer | Run 2: Validated all 6 Phase 12.4 features. 5 user interviews (100% feature validation). 9 edge cases documented. All findings routed to Phase 12.5 backlog. |
| Phase 4C: Test Completion | **COMPLETE** | Test Completion (Haiku) | 2042+ tests, all passing. Tier 1 & Tier 2 complete. Focus trap, cross-nav, partition detail edge cases covered. |
| Phase 4D: Interviews | **COMPLETE** | Interview Analyst | 5 users interviewed (Flink engineers, architects, power users). All 6 Phase 12.4 features validated (100% approval). 8 Phase 12.5 backlog items identified. Critical requirements: backtick quoting, cursor preservation, error handling (403/404/422). Report: `docs/agents/feedback/run-2/PHASE-12.4-INTERVIEW-SUMMARY.md` |
| Phase 4E: Agent Optimizer | **COMPLETE (Run 2)** | Agent Definition Optimizer | Strong alignment (94-100%) across all agent definitions. No significant gaps. 3 minor clarifications for next run. Convergence approaching. Tracking continues. |
| Phase 5: Roadmap Sync | **COMPLETE** | TPPM | Phase 12.4 synthesis complete. 3 releases queued (149 pts total). Phase 12.5 Phase 1 PRD writing ready. TPPM proceeds immediately to Phase 12.5 PRD. |

---

## 📊 Workflow State — Phase 12.3: Topic Management (Previous Cycle)

| Phase | Status | Current Owner | Blocker? |
| :--- | :--- | :--- | :--- |
| Phase 1: PRD Sign-off | **APPROVED** | TPPM | — |
| Phase 2: Dev & QA | **COMPLETE (R3 Phase 2 Done — QA Gate Pending)** | Engineering | — |
| Phase 2.5: QA Manager | **PENDING (R3)** | QA Manager | R3 49 tests passing, build clean. Awaiting QA Manager gate validation. |
| Phase 2.6: UX/IA | **APPROVED (R1/R2)** | UX/IA Reviewer | R3 UX gate pending. |
| Phase 3: Acceptance | **FEATURE ACCEPTANCE APPROVED (R1/R2)** | TPPM | R3 pending. |
| Phase 4A: Closure | **COMPLETE (R1/R2)** | Closer | Test artifacts cleaned. Roadmap updated with commit 21cad92. Docs verified. R3 commit pending. |
| Phase 4B: Stress Test | **COMPLETE (Run-3)** | Flink Developer | Run-1: 28 items (92pts total) → R2 (59pts/17 items), R3 (33pts/11 items). Run-2: All CRIT/HIGH fixes validated correct. 11 new items added: R2 +3pts (62 total), R3 +3pts (36 total), Schema R2 +13pts (51 total). Run-3: R3 Phase 2 complete — LOW-2, R2-VS, R2-DEB, ENH-4, ENH-5 implemented. |
| Phase 4C: Test Completion | **COMPLETE** | Test Completion (Haiku) | 1429 tests, 0 todos. Focus trap test implemented. All 17 Tier 2 tests done. |
| Phase 4D: Interviews | **COMPLETE** | Interview Analyst | 5 users interviewed. All 6 Phase 12.4 features validated. Critical requirements identified. Backlog for Phase 12.5+. |
| Phase 4E: Agent Optimizer | **COMPLETE (Run 2)** | Agent Definition Optimizer | Strong alignment detected. Convergence approaching. |
| Phase 5: Roadmap Sync | **COMPLETE** | TPPM | Phase 12.3 R2+R3 queued. Phase 12.4 PRD writing started. |

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
