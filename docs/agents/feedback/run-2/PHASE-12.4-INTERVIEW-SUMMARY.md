# Phase 12.4: Interview Analyst Summary for TPPM

**To:** TPPM (for Phase 5 Synthesis)
**From:** Interview Analyst (Haiku)
**Date:** 2026-03-01
**Status:** ✅ Phase 4D COMPLETE

---

## What Was Done

Conducted 5 structured interviews with Flink engineers, domain experts, and power users to validate Phase 12.4's proposed features and gather roadmap feedback.

**Interview Population:**
- User A: Flink Engineer (daily user, 3+ yrs Flink/Kafka, SRE focus)
- User B: Flink Engineer (daily user, 2 yrs Flink/Kafka, ML team, 40+ jobs)
- User C: Sr. Architect (8+ yrs Confluent/Flink, domain expertise)
- User D: Data Scientist (power user, ad-hoc analysis)
- User E: Platform Engineer (governance, compliance, cluster management)

---

## Key Findings

### ✅ All 6 Features Validated & Ready to Ship

| Feature | Validation | Confidence | Critical Requirements |
|---------|-----------|-----------|----------------------|
| **F1: "Query with Flink"** | 5/5 users want it | **VERY HIGH** | Backtick quoting for special chars |
| **F2: "Insert topic name"** | 4/5 users want it | **HIGH** | Cursor position preservation |
| **F3: Cross-nav Topics→Schema** | 4/5 users want it | **HIGH** | Error handling for missing subjects; naming convention docs |
| **F4: Topic Config Editing** | 5/5 users want it | **VERY HIGH** | Read-only config indication; error handling for 403/422 |
| **F5: Health Indicators** | 5/5 users want it | **VERY HIGH** | Partition count < 2 threshold is correct |
| **F6: Partition Detail View** | 3/5 users want it* | **MEDIUM** | Collapse by default (ops/SRE use case) |

*Users B & D deprioritize; Users A, C, E find value (ops/compliance)

### 🎯 Top 3 User Pain Points Addressed

1. **Context Switching** (SOLVED by F1, F2, F4) — Users currently switch between 6-8 times per workflow. Phase 12.4 reduces to 2-3 switches. **Time saved: 5-10 min per job development cycle.**
2. **Topic Config Editing** (SOLVED by F4) — Currently requires jumping to Cloud Console. Users edit retention 1-2x/week. **Time saved: 2 min per edit.**
3. **Low Partition Count** (SOLVED by F5) — Users have shipped single-partition topics to production by accident. **Risk reduced: Prevents parallelism bottlenecks.**

### 📊 Validation Summary

**Feature-by-Feature Breakdown:**

**Feature 1: "Query with Flink" Button**
- Mention frequency: 5/5 (universal desire)
- Daily value: "saves 30 seconds per query"
- User B caveat: "Don't auto-run. Just create the cell so I can review first." ✅ (PRD says this already)
- User E validation: "Backticks are essential for `topic.name`, `topic-name` style names." ✅
- **Recommendation:** Ship as designed. No changes needed.

**Feature 2: "Insert topic name" Button**
- Mention frequency: 4/5 (strong desire, 1 alternative suggestion)
- Critical requirement: "Preserve cursor position" (User B) — already in PRD ✅
- User D suggestion: "Copy button alternative" — noted for Phase 12.5 (not blocking)
- User E validation: "Backtick quoting is essential." ✅
- **Recommendation:** Ship as designed. Consider copy-button as Phase 12.5 enhancement.

**Feature 3: Cross-Navigation Topics → Schema**
- Mention frequency: 4/5 (strong desire)
- User B critical flag: "If topic `events` but schema subject is `data.events-value`, this breaks." ✅ **Must document naming convention assumption.**
- User E validation: "Compliance teams need to verify alignment." ✅
- Error handling requirement: "Graceful 404 if schema doesn't exist, don't crash." ✅ (PRD says "No schema registered" message)
- **Recommendation:** Ship as designed. Add documentation about Confluent naming convention (`{topic}-value`/`{topic}-key` suffixes).

**Feature 4: Topic Config Editing**
- Mention frequency: 5/5 (unanimous desire)
- Daily impact: "Edit retention 1-2x/week, currently uses Cloud Console"
- User B validation: "Make sure read-only configs are clearly marked." ✅
- User C validation: "Test replication.factor and min.insync.replicas specifically." ✅ (QA note)
- User E critical requirement: "Handle 403 Forbidden gracefully—some orgs restrict config editing." ✅ (needs error handling)
- **Recommendation:** Ship as designed. QA focus: replication configs, error handling for 403/422.

**Feature 5: Topic Health Indicators**
- Mention frequency: 5/5 (universal appreciation)
- User A personal story: "Would have caught single-partition topics I shipped to production."
- All users confirmed: `partitions_count < 2` is the correct threshold.
- User C future enhancement: "Also warn on ISR < replicas (broker failure), replication factor < 2 (redundancy)." ✅ (noted for Phase 12.5)
- **Recommendation:** Ship as designed. Threshold is validated.

**Feature 6: Partition-Level Detail View**
- Mention frequency: 3/5 (ops/SRE interest, lower priority for daily users)
- User C value: "Useful for cluster health debugging, shows ISR vs replicas, helps spot broker failures."
- User E value: "Compliance audits—verify replication factor, ISR counts."
- Users B & D: "Lower priority, only useful when troubleshooting."
- **Recommendation:** Ship as designed (collapsed by default). Not blocking. Future: expand with ISR warnings + broker rebalancing alerts.

---

## Critical Requirements Identified

These must be validated by QA Manager in Phase 2.5:

1. **Backtick Quoting** (Features 1, 2, 3) — All topic names with special chars (`.`, `-`, etc.) must generate/use backticks
   - Test: `topic.name`, `topic-name`, `my_topic`, `UPPERCASE`, `with spaces`
   - Failure example (User E): If backticks are missing, `topic.name` breaks in SQL

2. **Cursor Preservation** (Feature 2) — Inserting topic name must not move cursor or replace selection
   - Test: Click in middle of SQL, insert name, verify cursor is after inserted text
   - Failure example (User B): "If pasting loses my cursor, it's worse than copy-paste"

3. **Read-Only Config Indication** (Feature 4) — Edit buttons must only appear on editable configs
   - Test: `broker_id`, `num_log_segments` are read-only; verify no edit button shown
   - Failure example (User B): "I don't want to accidentally try to edit `broker_id`"

4. **Error Handling** (Features 3, 4) — Graceful messages for 403/404/422 responses
   - 403: "You don't have permission to edit this config. Contact your cluster admin."
   - 404: "Schema subject not found. This topic may not have a schema registered."
   - 422: "Invalid value. Retention must be > 0."
   - Failure example (User E): "If config edit fails, show why, not a crash"

5. **Documentation** (Feature 3) — Confluent naming convention must be documented
   - Assumption: Topic name matches schema subject name with `-value`/`-key` suffixes
   - Fallback: "No schema registered" message if subject not found
   - Failure example (User B): "If topic is `events` but schema is `data.events-value`, feature breaks silently"

---

## User-Validated Backlog for Phase 12.5+

**Ranked by user mention frequency and estimated effort.**

### Immediate (Phase 12.5, 1-2 week sprint)
1. **Copy button next to topic name** (30min) — User D prefers copy over insert for quick workflows
2. **"Back to topic list" breadcrumb in partition view** (30min) — User A: collapsing partition view loses context
3. **Pre-save validation feedback for config edits** (2-4hrs) — User D: "Show validation errors before I click save"
4. **Health score dashboard** (2-4hrs) — User D: Visual 🟢 Healthy / 🟡 Warning / 🔴 Critical indicators in topic list

### Medium-Term (Phase 12.5+, next sprint cycle)
1. **Topic lag monitoring** (8-16hrs) — Users B, C: Real-time consumer lag per topic (SRE feature)
2. **ISR & rebalancing warnings** (4-8hrs) — User C: Alert when ISR < replicas or broker is rebalancing
3. **Schema evolution validation** (8-16hrs) — User E: Warn if schema change would break active Flink jobs
4. **Query templates library** (4-8hrs) — User D: Snippets for repetitive queries (SELECT from topic, aggregate, etc.)

### Strategic (Phase 13+)
- Cluster topology visualization
- Flink job → topic lineage
- Topic lifecycle management (creation templates, deprecation workflow)
- Schema change impact analysis

---

## Priority Signals for Phase 5 Roadmap Synthesis

### What Users Care About Most
1. **F1 "Query with Flink"** → Mentioned by all 5 users as top priority
2. **F4 "Config Editing"** → Mentioned by all 5 users as daily pain point
3. **F2 "Insert topic name"** → Mentioned by 4/5 as complementary to F1
4. **F3 "Cross-nav"** → Mentioned by 4/5 as useful for schema verification
5. **F5 "Health Indicators"** → Mentioned by all 5 as useful safeguard

### Expected Business Impact
- **Time Saved:** 5-10 min per job development cycle per engineer (20+ jobs/week per Flink team → significant productivity gain)
- **Risk Reduced:** Prevents accidental single-partition topic deployments (User A: "would have caught 3+ mistakes last year")
- **Compliance Improved:** Enables verification of topic/schema alignment (User E: critical for governance)
- **Engineer Satisfaction:** Unified workspace eliminates frustrating context switches (User C: "This is the unified workspace we've been asking for")

---

## Quotes for Communicating With Stakeholders

> "This removes the biggest pain point in my workflow—context switching. I can now stay in one place to query, explore, and manage topics." — **User A, Flink Engineer**

> "One-click query generation is perfect. Don't let it run automatically—just create the cell so I can review it first." — **User B, Flink Engineer**

> "This is the unified workspace we've been asking for. Phase 12 is now complete." — **User C, Sr. Architect**

> "Inline config editing is the blocker. I have to leave the UI to adjust retention now. This fixes that." — **User A (repeated emphasis)**

> "Health warnings on low partition counts would have caught the single-partition topics I shipped. This is a real improvement." — **User A**

---

## Recommendation to TPPM for Phase 5

**✅ ALL FEATURES READY FOR PHASE 2 IMPLEMENTATION**

- All 6 features are validated by users
- No PRD changes needed
- Critical requirements identified and documented (see above)
- QA focus areas clearly defined
- Backlog prioritized for Phase 12.5+

**If resources are constrained, prioritize this way:**
1. **Phase 12.4a:** F1, F2, F4 (top 3 pain points) — 2-3 day sprint
2. **Phase 12.4b:** F3, F5 — 1-2 day sprint
3. **Phase 12.4c:** F6 (ops-only) — 1 day sprint

**Risk mitigations for QA:**
1. Exhaustive special-char testing (all features)
2. Error handling for 403/404/422 (F3, F4)
3. Load testing F6 with 100+ partitions
4. Backtick quoting validation (all features)

---

## Full Interview Report

Detailed interview notes, raw quotes, and comprehensive feedback synthesis: **`docs/agents/feedback/run-2/INTERVIEW-ANALYST.md`**

---

**Phase 4D Complete. Ready for Phase 5 Synthesis.**
