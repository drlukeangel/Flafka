# Platform Roadmap

**Last Updated:** 2026-02-28
**Orchestration Model:** Multi-Agent Workflow (Phases 1-5)

---

## 🎯 Current Cycle

*This section is automatically updated by the TPPM when a new workflow kicks off.*

| Active Feature | Stage | Lead Agent | Started |
| :--- | :--- | :--- | :--- |
| Phase 12.2: Schema Management | **Phase 5: Complete** | TPPM | 2026-02-28 |

---

## 📋 Prioritized Backlog

*Items are strictly ranked by the TPPM. The TPPM will automatically pull the `Rank 1` item when the Current Cycle is completed.*

| Rank | Feature / Issue | Source | Type | Status | Complexity | Phase |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Automated GitHub CLI Provisioning | Architecture Plan | Feature | **🔄 In Progress** | Medium | Phase 1 |
| **2** | Dynamic PySpark Cluster Scaling | Team Request | Enhancement | Queued | High | Phase 1 |
| **3** | Kafka Message Retry Logic | Flink Dev Feedback | Bug | Queued | Medium | Phase 1 |

---

## 📥 Feedback & Stress Test Inbox

*The Flink Developer outputs raw dev stress-test results here. The TPPM parses this inbox, determines priority, and moves items to the Prioritized Backlog.*

### Pending Review by TPPM
- **[2026-02-28] Phase 12.2 Stress Test Feedback:**
  - ~~BUG-1 (MEDIUM): Race condition in rapid subject switching — FIXED (generation counter in loadSchemaDetail)~~
  - ~~BUG-2 (LOW): Console logs expected 404s as errors — FIXED (suppressed 404 in SR client interceptor)~~
  - ENHANCEMENT: Add loading shimmer/skeleton for version switch instead of full overlay
  - ENHANCEMENT: Show "Global" instead of "—" when compat mode falls back to global config
  - ENHANCEMENT: Add type badge (AVRO/PROTOBUF/JSON) to list view rows for quick scanning
  - ENHANCEMENT: Confirmation toast for compatibility mode changes (currently saves immediately)
  - ENHANCEMENT: Show filtered count as "7 subjects" instead of "7 of 7 subjects" when all match

### Archive (Processed)
- [2026-02-28] - *Inbox initialized; awaiting first feature completion and stress test feedback.*

---

## ✅ Completed

*The Closer subagent logs successfully deployed and documented features here. These are features that have passed all phases and are live.*

| Date | Feature | Closer | Commits | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 2026-02-28 | Phase 12.2: Schema Management | Closer | pending | Schema Registry panel: list/detail/create/evolve/delete, tree view, 9 API functions, 1125 tests |

---

## 📊 Workflow State

| Phase | Status | Current Owner | Blocker? |
| :--- | :--- | :--- | :--- |
| Phase 1: PRD Sign-off | **Complete** | TPPM | — |
| Phase 2: Dev & QA | **Complete** | Opus + Agents | — |
| Phase 2.5: QA Manager | **APPROVED** | QA Manager | — |
| Phase 2.6: UX/IA | **APPROVED** | UX/IA Reviewer | — |
| Phase 3: Acceptance | **APPROVED** | TPPM | — |
| Phase 4A: Closure | **Complete** | Closer | — |
| Phase 4B: Stress Test | **Complete** | Flink Developer | — |
| Phase 5: Roadmap Sync | **Complete** | TPPM | — |

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
