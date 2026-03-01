# Phase 12.5 — Interview Analyst Summary for TPPM

**To:** TPPM (for Phase 5 Synthesis)
**From:** Interview Analyst (Sonnet)
**Date:** 2026-03-01
**Status:** COMPLETE — Phase 4D

---

## What Was Done

Conducted 5 structured interviews with returning users from the Phase 12.4 interview cycle. Users have had 2-4 weeks of real-world usage of Phase 12.4 features. This run captured longitudinal feedback ("what changed since Phase 12.4 shipped?") in addition to Phase 12.5 feature validation.

**Interview Population:**
- User A: Flink Engineer (SRE, daily user, 3+ yrs Flink/Kafka)
- User B: Flink Engineer (ML team, 2 yrs Flink/Kafka, 40+ streaming jobs)
- User C: Sr. Architect (8+ yrs Confluent/Flink, enterprise focus)
- User D: Data Scientist (power user, ad-hoc analysis)
- User E: Platform Engineer (governance, compliance)

---

## Key Findings

### All 8 Phase 12.5 Features Validated

| Feature | Validation | Confidence | Critical Notes |
|:--- |:--- |:--- |:--- |
| F1: Schema Subject Delete Confirmation | 5/5 want it | VERY HIGH | Case-sensitive; compliance requirement; display name match (not URL-encoded) |
| F2: Schema Diff Stability | 5/5 want it | VERY HIGH | Production incident confirmed (User C): stale diff caused broken Flink job |
| F3: Schema Version Delete Overlay | 5/5 want it | HIGH | Version number must be prominent; loading state during API call needed |
| F4: Copy Topic Name Button | 5/5 want it | VERY HIGH | Must not steal Monaco editor focus; clipboard permission denial needs handling |
| F5: Pre-Save Config Validation | 5/5 want it | VERY HIGH | Cross-field rule identified: min.insync.replicas ≤ replication.factor (Kafka correctness) |
| F6: Composite Health Score | 5/5 want it | VERY HIGH | Tooltip must list ALL active conditions; null data = no dot |
| F7: SchemaTreeView CSS Vars | 5/5 validate | HIGH | 3/5 noticed the dark mode regression without prompting |
| F8: AbortController to Axios | 5/5 validate | HIGH | 3/5 experienced the stale config bug on VPN connections |

---

## Production Incidents Confirmed

Two real-world incidents surfaced that directly correspond to Phase 12.5 bugs:

1. **User C (Architect):** Stale schema diff caused a junior engineer to approve a breaking schema change while thinking the diff was current. Result: 2-hour Flink job incident. **Feature 2 directly prevents this.**

2. **User A (Flink Engineer):** Set `retention.ms` to a decimal value (`86400000.5`). parseInt silently truncated it to 1ms. Topic was set to 1-millisecond retention. Data loss occurred. **Feature 5 directly prevents this.**

These incidents are concrete production ROI for Phase 12.5. Worth highlighting in team communication.

---

## PRD Gaps Requiring Engineering Attention

| Gap | Feature | Issue | Severity |
|:--- |:--- |:--- |:--- |
| GAP-2 | F2: Diff Stability | No error handling when diff fetch fails — stale content shown instead of error banner | High |
| GAP-2b | F2: Diff Stability | AbortController not applied to diff fetch (parallel race on rapid version switching) | Medium |
| GAP-3 | F3: Version Delete | Loading state during delete API call not specified in PRD | Medium |
| GAP-3b | F3: Version Delete | Last-version delete should warn user it also deletes the subject | Low |
| GAP-4 | F4: Copy Button | Clipboard permission denial not addressed | Medium |
| GAP-4b | F4: Copy Button | Focus-theft prevention not specified — must not steal Monaco editor focus | High |
| GAP-5 | F5: Config Validation | Missing cross-field rule: min.insync.replicas ≤ replication.factor | High |
| GAP-6 | F6: Health Score | Null/undefined health data handling not specified (recommendation: no dot = optimistic) | Low |

**Immediate Action Required on GAP-5:** min.insync.replicas > replication.factor is a Kafka correctness constraint. If violated, the topic will refuse all writes. Client-side enforcement is achievable since both values are in the config table.

---

## Post-Phase-12.4 Pain Points (New)

Five workflow gaps emerged from 2-4 weeks of real usage that Phase 12.5 does not address:

| Pain Point | Users | Impact | Estimated Effort |
|:--- |:---:|:--- |:--- |
| Config edit audit trail (who changed what/when) | B, E | Compliance blocker — limits config editing to senior engineers only | 4-8 pts |
| Schema subject list: filter by type and compat mode | C | 200+ subject management untenable without filters | 3-5 pts |
| Schema panel loading skeleton on initial mount | D | UX confidence — panel looks broken before first load completes | 1-2 pts |
| Config table sort persistence within session | B | Multi-topic comparison workflow — sort resets between topics | 2-3 pts |
| AbortController on diff fetch (technical) | B | Parallel to Feature 8 — diff fetch can also fire multiple concurrent requests | 1-2 pts |

---

## Phase 12.6 Backlog (Ranked by Priority)

| Priority | Item | Pts (est.) | Signal |
|:---:|:--- |:---:|:--- |
| 1 | Config edit audit log | 4-8 | Users B, E — compliance |
| 2 | Schema list: filter by type/compat | 3-5 | User C — enterprise navigation |
| 3 | Schema panel loading skeleton | 1-2 | User D — quick win |
| 4 | Config table sort persistence (session) | 2-3 | User B — comparison workflow |
| 5 | AbortController on diff fetch | 1-2 | User B — technical hardening |
| 6 | Query templates / SQL snippets | 8-13 | Users A, D — upgraded from low to high priority |
| 7 | ISR < RF health warning | 4-8 | User C — deferred from 12.5 |
| 8 | Bulk topic delete | 13 | User B — already in backlog |

**Estimated total Phase 12.6 backlog: 37-55 story points** — comfortably above the ≥25 threshold for batching. Items 1-5 (11-20 pts) alone with items 6-8 give a strong Phase 12.6 Release 1. Feature Organizer & Ranker should story-point precisely and batch into releases.

---

## Priority Signals for Phase 5 Roadmap Synthesis

### Phase 12.5: Validated and Ready
All 8 features confirmed. Two critical implementation details added by interviews:
1. Cross-field validation for min.insync.replicas (GAP-5) — should be added to PRD before Phase 2 start
2. Copy button focus-theft prevention (GAP-4b) — should be specified in AC-4

### Phase 12.6: Clear Queue
Top 5 immediate items (config audit, schema filter, skeleton, sort persistence, diff AbortController) = 11-20 pts.
Plus items 6-8 = additional 25-34 pts. Phase 12.6 has a well-defined scope.

### Phase 13+ Strategic Items
- Topic lag monitoring (Users B, C — high effort, high value for SRE)
- Schema evolution validation (User E — enterprise safety)
- Cluster topology visualization
- Flink job → topic lineage

---

## Key Quotes for Team Communication

> "The stale diff caused a broken Flink job last week. A junior engineer approved a breaking schema because he didn't notice the diff hadn't reloaded." — **User C, Sr. Architect**

> "I set retention.ms to 1 millisecond by accident — I typed a decimal. Pre-save validation would have caught that before I lost data." — **User A, Flink Engineer**

> "Config edit without audit history is risky for compliance. We need to know who changed what and when. That's the gap Phase 12.5 doesn't close but Phase 12.6 should." — **User E, Platform Engineer**

> "The composite health score is exactly right. Green = nothing to do. Yellow = be aware. Red = stop and fix." — **User B, Flink Engineer**

> "Schema delete confirmation parity is overdue. One misclick on a production subject is a half-day incident. Name confirmation is the right control." — **User C, Sr. Architect**

---

## Full Interview Report

Detailed per-feature breakdowns, edge cases, raw interview notes, PRD gap analysis:

**`docs/agents/feedback/run-4/INTERVIEW-ANALYST.md`**

---

**Phase 4D Complete. Ready for Phase 5 Synthesis.**
