# SR Flink/Kafka Engineer — A2 Design Review
## Phase 12.6: Config Audit, Schema Filtering & Query Templates

**Reviewer:** SR Flink/Kafka Engineer (Domain Expert)
**Date:** 2026-03-01
**Status:** COMPLETE

---

## Review Scope

Reviewing `docs/features/phase-12.6-prd.md` for domain usefulness, real-world Flink/Kafka workflow fit, and enhancement opportunities based on how practitioners actually use these tools.

---

## Domain Assessment

### F1 — Config Audit Log

**Domain Fit: EXCELLENT. Directly addresses a genuine pain point.**

- In real Kafka operations, config changes are a major source of incidents. Teams routinely ask "who changed min.insync.replicas to 1?" and have no answer without server-side audit logs.
- The session-scoped, client-side approach is the correct pragmatic choice given Confluent Cloud API constraints (no audit log API available). Sets correct expectations.
- FIFO cap at 200 entries: reasonable for a session. A power user editing configs across a 100-topic estate might hit 200 entries but that's an extreme edge case.
- Display format `HH:MM:SS key oldValue -> newValue`: operators scan these logs during incident triage — the compact, scannable format is correct.
- Per-topic display: operators are usually triage-focused on a single topic. Showing only entries for the current topic is the right default.

**Enhancement idea (non-blocking, Phase 12.7 consideration):** A "View all changes" cross-topic summary mode would be valuable for compliance audits. Not needed now.

**Domain Recommendation:** APPROVE. Correct design for the use case.

---

### F2 — Schema Subject List Filter

**Domain Fit: HIGH VALUE. Enterprise-grade necessity.**

- Organizations using Confluent Schema Registry in production routinely manage 200-500+ subjects. The current "search by name" is completely inadequate for navigation.
- Type filter: In mixed-format organizations (AVRO for events, PROTOBUF for gRPC, JSON for legacy), filtering by type is essential for bulk operations.
- Compat filter: BACKWARD_TRANSITIVE vs BACKWARD is a critical distinction in Flink streaming pipelines — changing compat modes can break running jobs. Architects need to quickly find "all subjects with FULL_TRANSITIVE" to ensure compatibility before schema evolution.
- AND logic (type + compat + name): correct. Practitioners combine these filters naturally.
- Not persisted (resets on panel mount): acceptable.

**Enhancement note (non-blocking):** A "Clear all filters" button or reset link when filters are active would reduce friction. Easy to add during B1.

**Domain Recommendation:** APPROVE. Addresses a real daily friction point.

---

### F3 — Schema Panel Loading Skeleton

**Domain Fit: QUALITY OF LIFE. Correct fix.**

- A blank panel is indistinguishable from "nothing registered" or "something broke" in production environments. The skeleton communicates "loading" clearly.
- Simple, correct, no domain concerns.

**Domain Recommendation:** APPROVE.

---

### F4 — Config Table Sort Persistence

**Domain Fit: HIGH VALUE for multi-topic comparison workflows.**

- The explicit use case (comparing retention.ms across topics in "orders" and "payments") is a real daily workflow for platform engineers managing multiple topics in a Kafka ecosystem.
- Sorting by Key (ascending) and navigating through configs alphabetically is the standard way to compare configs across topics.
- sessionStorage (not localStorage): correct. Sort preference is workflow-scoped, not a permanent preference.

**Domain Recommendation:** APPROVE.

---

### F5 — AbortController on Schema Diff Fetch

**Domain Fit: CORRECTNESS FIX. Required for accurate diff behavior.**

- Schema diff is used when evaluating schema evolution safety. If stale diff content appears due to a race condition, an operator may incorrectly assess compatibility — with downstream consequences for running Flink jobs.
- This is not just a UX polish: stale schema content can lead to incorrect decisions.
- Pattern established in Phase 12.5 F8 for topic config fetches: consistent. Good to complete the pattern for schema diffs.

**Domain Recommendation:** APPROVE. Critical for correctness.

---

### F6 — Query Templates / Saved Snippets Library

**Domain Fit: EXTREMELY HIGH VALUE. Highest-priority feature for a reason.**

- Flink SQL practitioners use repetitive query patterns constantly:
  - SELECT * FROM topic LIMIT 100 (exploratory sampling)
  - SELECT COUNT(*) FROM topic (volume check)
  - SELECT * FROM topic WHERE event_type = 'ORDER_CREATED' (filtered monitoring)
  - Windowed aggregations for debugging (complex patterns worth saving)
- Users A and D correctly identified this as a high-priority item. 40+ repeated keystrokes per session is confirmed waste.
- localStorage persistence: correct. Snippets are a personal workspace tool, not team-shared. Session-persistent is essential.
- 100-snippet cap: generous. A power user with 20-30 well-named snippets is the expected upper bound.
- Insert into focused editor via editorRegistry: correct. Non-disruptive to active work.
- Rename + delete: standard CRUD. Necessary for long-term usability.

**Enhancement ideas (non-blocking, Phase 12.7+ consideration):**
1. Team-shared snippets via export/import (similar to workspace export/import in Phase 10).
2. Snippet tagging: optional tags to categorize snippets (e.g., "debugging", "monitoring").
3. Insert snippet with variables: template-style substitution for parameterized queries.

These are Phase 12.7+ ideas. Not needed now.

**Domain Recommendation:** APPROVE. Correct scope. Correct implementation approach.

---

### F7 — Diff View Stale Closure Fix

**Domain Fit: CORRECTNESS FIX. Schema diff is used during schema evolution review — incorrect diff state is dangerous.**

- The specific scenario (changing primary version to match diff version causing self-compare) is a real user workflow: "I want to compare v3 (latest) against v1 (original)." If clicking v1 as primary causes self-compare, the tool becomes unusable for this workflow.
- Auto-update diff version to next available: correct graceful degradation.
- Exit diff mode if only 1 version remains: correct terminal state.

**Domain Recommendation:** APPROVE.

---

### F8 — TopicDetail Health Dot for Healthy Topics

**Domain Fit: VISUAL CONSISTENCY FIX. Reduces alert fatigue.**

- In production environments with 100+ topics, most are healthy. If every healthy topic shows a (green) dot in TopicDetail, the dot carries no signal.
- Hiding green dots means the dot is a genuine signal: "something needs attention." This is the correct approach (consistent with TopicList behavior).

**Domain Recommendation:** APPROVE.

---

### F9 — Diff Mode Auto-Exit on Last-Version Delete

**Domain Fit: CORRECTNESS FIX. Prevents broken state after destructive action.**

- Users deleting versions to clean up test subjects (a common cleanup operation) should not end up in a broken diff view.

**Domain Recommendation:** APPROVE.

---

### F10 — Duplicate Health Warning Fix

**Domain Fit: CORRECTNESS FIX. Health tooltip accuracy matters for triage.**

- A 0-partition topic is a critical error. Showing both "no partitions" AND "single-partition" warnings is confusing and could mislead an operator.
- Early-return pattern is the correct fix.

**Domain Recommendation:** APPROVE.

---

### F11 — CSS Custom Property Fix

**Domain Fit: N/A (cosmetic, technical debt fix). Correct fix. No domain concerns.**

**Domain Recommendation:** APPROVE.

---

## Overall Domain Assessment

All 11 features are well-motivated and correctly scoped for real-world Flink/Kafka workflows. F6 (Query Templates) is the standout feature — arguably the most time-saving quality-of-life improvement since Phase 5.1 (SQL autocomplete). F1 (Config Audit Log) addresses a genuine compliance need. F2 (Schema Filter) will be immediately valuable to enterprise users managing large subject registries.

Prioritization in PRD is correct: F6 > F1 > F2 > others. This matches real-world pain point severity.

No domain-level issues that block implementation.

---

## VERDICT: APPROVE

**Domain concerns (non-blocking):**
1. F2: Consider adding a "Clear all filters" button for when type + compat + name filters are all active — one click to reset all. Easy B1 addition.
2. F6: Sidebar icon should visually evoke "code snippet" or "library" — not generic bookmark or star — to communicate the feature's purpose to technical users.

**Status:** APPROVED
**Signed:** SR Flink/Kafka Engineer
**Date:** 2026-03-01
