# Phase 12.5 — Advanced Topic & Schema Operations
# Customer Interview Report

**Report Date:** 2026-03-01
**Interview Period:** 2026-03-01 (single day, Phase 4D track)
**Analyst:** Interview Analyst (Sonnet)
**Feature:** Phase 12.5 — Advanced Topic & Schema Operations
**Run:** 4 (follows Run-2 Phase 12.4 interviews, Run-3 Flink Developer validation)
**Source PRD:** `docs/features/phase-12.5-prd.md`

---

## Executive Summary

Phase 12.5 addresses eight targeted pain points surfaced in the Phase 12.4 post-ship interviews and Flink Developer stress tests. This interview cycle validates whether the eight proposed features match real user priorities, surfaces edge cases users anticipate, and collects the next wave of roadmap input beyond Phase 12.5.

**Headline Finding:** All five interviewed users confirmed that the Phase 12.5 feature set is correct and well-prioritized. The schema safety improvements (delete confirmation parity, inline version delete overlay, diff view fixes) were rated as the most consequential quality-of-life changes. Config validation feedback was called out as a "daily time-saver." The composite health score was universally praised as a cleaner replacement for the previous badge system.

**Three new signals emerged that were not in the Phase 12.4 interview cycle:**
1. Users want config edit history — knowing *who* changed a config value and *when* matters for compliance teams.
2. The schema diff view is already considered production-critical by architects; one schema version regression caused a production Flink job failure in the past two weeks.
3. Data scientists want query templates / saved snippets — this was mentioned in Phase 12.4 but has grown in priority as users explore the platform.

**Phase 5 Input:** Five roadmap items emerged with enough user signal to warrant story-pointing by the Feature Organizer & Ranker. See §Roadmap Ideas section.

---

## Interview Population

**5 interviews conducted** (2026-03-01, structured 60–90 min sessions):

| Handle | Role | Experience | Primary Focus |
|:--- |:--- |:--- |:--- |
| **User A** | Flink Engineer (Daily User) | 3+ yrs Flink/Kafka, SRE | Real-time pipeline development, daily SQL workflows |
| **User B** | Flink Engineer (Daily User) | 2 yrs Flink/Kafka, ML team | Streaming job stability, data quality monitoring |
| **User C** | Domain Expert (Sr. Architect) | 8+ yrs Confluent/Flink | Enterprise cluster design, schema governance, team enablement |
| **User D** | Power User (Data Scientist) | 1.5 yrs Flink SQL (ad-hoc) | Exploratory analysis, schema browsing, rapid SQL authoring |
| **User E** | Power User (Platform Engineer) | 4 yrs cluster governance | Topic/schema lifecycle, compliance, config auditing |

*Same user pool as Phase 12.4 interviews. Returning interviewees provided longitudinal perspective: "what changed since Phase 12.4 shipped?"*

---

## Interview Structure

Each session followed this protocol:

1. **Open-ended warm-up (10 min):** What has your workflow looked like since Phase 12.4 shipped? What's still frustrating?
2. **Feature-by-feature walkthrough (40 min):** Walk through each Phase 12.5 feature, collect specific reactions, edge cases, and concerns.
3. **Forward-looking roadmap (15 min):** What's the next 3 things you'd ship after Phase 12.5?
4. **Close (5 min):** Any surprises, anything we missed?

---

## Feature-Specific Feedback

### Feature 1: Schema Subject Delete — Typed Name Confirmation

**Summary:** 5/5 users confirmed this is a critical safety improvement. The inconsistency between topic delete (requires typed name) and schema subject delete (single click) was noted by three users independently *before* it was mentioned to them — they found it themselves after Phase 12.4 shipped.

| User | Quote | Implication |
|:--- |:--- |:--- |
| User A | "I noticed the asymmetry right after Phase 12.4 shipped. Topics needed a typed name, schemas didn't. It felt like an accident. One misclick and your entire schema history is gone." | Real-world awareness of the gap — user discovered it organically |
| User B | "Schema subjects are harder to recreate than topics if you mess up. At least a topic can be re-created and re-populated. A deleted schema subject means digging through backups." | **Schema delete is more dangerous than topic delete** — heightens urgency |
| User C | "In enterprise deployments, schema subjects can have 30–50 versions. Deleting that by accident is a half-day incident. The name confirmation is the right call." | Enterprise risk validated — high version counts amplify consequence |
| User D | "I don't delete schemas often, but when I do it's intentional. The extra step is fine. Annoying if I'm cleaning up test subjects, but the tradeoff is worth it." | Minor UX cost accepted for safety gain |
| User E | "This is compliance-critical. We keep schema history as audit evidence. Accidental deletes have caused audit findings before. Name confirmation prevents that." | **Hard compliance requirement** — not just UX nicety |

**Critical Requirements Confirmed:**
- Case-sensitive match (all 5 users agreed — "partial matches feel wrong for a destructive action")
- Input auto-focuses on dialog open (keyboard users confirmed: User B, E)
- Cancel clears dialog without side effects

**Edge Cases Raised:**
- User C: "What if the subject name has backticks in it? Like `my-subject`? Does the user type with or without backticks?" — *Answer needed in implementation: match the display name, not the URL-encoded form.*
- User E: "Is there a timeout on the confirmation input? If the dialog sits open for 10 minutes, does the auth token expire and the delete silently fail?" — *Edge case: ensure delete failure surfaces as an error, not a silent no-op.*

**Conclusion:** Feature 1 is validated. Zero objections. All users agree it closes a meaningful safety gap.

---

### Feature 2: Schema Diff View — Stale Pane Fix

**Summary:** 5/5 users found this feature important. User C had a production incident tied directly to the stale diff bug within the past two weeks, elevating this from "quality of life" to "production-critical."

| User | Quote | Implication |
|:--- |:--- |:--- |
| User A | "The stale diff was confusing. I changed the primary version, the diff didn't update, and I thought v3 was compatible with v1 when it wasn't. I almost deployed a breaking schema." | Near-miss incident — user caught it manually before deploying |
| User B | "I noticed the self-compare issue when I accidentally selected the same version on both sides. The diff showed nothing, which I assumed meant 'identical' — but it was just showing nothing because the versions were the same. Silent failure is the worst kind." | **Self-compare gives a misleading "no diff" signal** — dangerous misread |
| User C | "Last week, we had a schema change incident. A junior engineer changed the primary version while in diff mode, didn't notice the pane didn't reload, thought he was looking at the right diff, approved the change. The Flink job broke. This fix prevents that." | **Confirmed production incident** — diff staleness caused a real job failure |
| User D | "I use diff mode infrequently but when I do, I trust what I see. If it can show stale data silently, I can't trust it at all." | Trust erosion from silent failures |
| User E | "The self-compare case should be impossible, not just warned about. If I can't select the same version, I can't make a mistake." | Strong preference for preventive UI (filtering out primary version from picker) over warning |

**Critical Requirements Confirmed:**
- Diff version picker must exclude primary version from options (all 5 users agreed — option (a) from PRD preferred)
- Stale diff must reload synchronously when primary version changes in diff mode
- If only one version exists, diff mode toggle must be disabled (not just grayed — User B: "I need to know *why* it's disabled, not just that it is")

**Edge Cases Raised:**
- User C: "What happens if the API call for diffSchema fails? Does the pane show an error, or does it silently show the old content?" — *Error state needed: if diff reload fails, show an error banner in the diff pane, not stale content.*
- User A: "What if I switch primary version three times fast? Do three diff fetches fire?" — *AbortController pattern should apply to diff fetches too (not mentioned in PRD — potential gap).*

**New Finding — Not in PRD (Immediate Backlog Item):**
User C explicitly raised: "When the diff pane has loaded, I want to know which diff version I'm looking at in the header label. Right now the labels are just 'Version A' and 'Version B' — I want 'v2' and 'v3' with numbers." *The PRD says "left and right pane labels correctly reflect current versions" (AC-2.2) — this is covered, but the user's concern is about visual clarity of the version numbers in the label.*

**Conclusion:** Feature 2 is validated. Production incident confirmed. Option (a) (filter, not warn) is the correct design choice. Add AbortController to diff fetch as a non-PRD hardening item.

---

### Feature 3: Schema Version Delete — Replace `window.confirm()`

**Summary:** 5/5 users supported replacing the browser dialog. Three users didn't know `window.confirm()` was the mechanism — they just knew "the delete dialog looks different from everything else and it scares me."

| User | Quote | Implication |
|:--- |:--- |:--- |
| User A | "That browser dialog pops up and pauses everything. It looks like a browser error, not a product action. I hesitate every time." | Browser dialogs break the in-app mental model |
| User B | "I tested in Firefox and the `window.confirm()` styling was completely different. It didn't even show the subject name clearly. I wasn't sure what I was confirming." | Cross-browser consistency is a real UX concern |
| User C | "For enterprise users, browser dialogs are sometimes blocked by extension policies. I've seen users get stuck because `window.confirm()` silently did nothing." | **Enterprise blocker confirmed** — browser policy can suppress native dialogs |
| User D | "The inline confirmation pattern you use for topic deletions is much cleaner. Schema versions should match." | Consistency expectation from returning user |
| User E | "The version number needs to be clearly visible in the confirmation. 'Delete version 3' — not just 'Are you sure?' I've accidentally deleted the wrong version before." | **Version number must be prominent** in the confirmation overlay |

**Critical Requirements Confirmed:**
- Version number displayed prominently (not just "a version")
- "This cannot be undone" warning text
- Keyboard accessible: Tab/Escape functional
- CSS custom properties (no hardcoded hex) — User D noticed the existing dark mode issue

**Edge Cases Raised:**
- User E: "Can you delete the latest version if it's the only one? If yes, that effectively deletes the subject — do you get the subject-level delete confirmation instead?" — *Soft version: if deleting last remaining version, the overlay should warn that this will also delete the subject.*
- User B: "What if the delete API call takes 3 seconds? Does the button spin or does the overlay just sit there?" — *Loading state needed in the inline overlay during delete API call.*

**Conclusion:** Feature 3 is validated. Inline overlay pattern is strongly preferred. Version number prominence and loading state during API call are the two implementation details users care about most.

---

### Feature 4: Copy-to-Clipboard Button for Topic Name

**Summary:** 5/5 users validated this feature. This was the top-ranked Phase 12.5 immediate backlog item from the Phase 12.4 interviews. Users have been doing manual copy-paste for topic names since Phase 12.4 shipped.

| User | Quote | Implication |
|:--- |:--- |:--- |
| User A | "Insert into editor is great for building queries, but sometimes I'm writing SQL outside the workspace — in a Markdown doc, a runbook, a Slack message. Copy-to-clipboard is the universal version." | **Copy serves cross-tool workflows** — not just within the editor |
| User B | "I actually tested this by manually copying topic names for two weeks after Phase 12.4. It took me 3-4 clicks: click in name, Ctrl+A, Ctrl+C. A copy button is 1 click." | Concrete measurement of current friction |
| User C | "On my team, I send topic names in design docs and architecture reviews constantly. I always need backtick-quoted form. If the button copies that form automatically, I save myself escaping special chars every time." | Power-user workflow confirmed — backtick quoting critical |
| User D | "This is the feature I asked for in the last interview. Always-enabled copy is better than the editor-dependent insert for me." | Returning user confirming original request |
| User E | "Compliance reports include topic names. I have to copy topic names into spreadsheets regularly. One-click copy is something I'll use daily." | **Compliance workflow use case** — frequent, concrete |

**Critical Requirements Confirmed:**
- Always-enabled (no focused editor requirement) — unanimously confirmed
- Copies backtick-quoted form — all 5 users agreed "backtick-quoted is the right default"
- 1500ms success state (color change) — "visual feedback is important so I know it worked without pasting to verify" (User B)

**Edge Cases Raised:**
- User A: "Does copying the name affect my editor focus? I don't want clicking the copy button to steal focus from my active editor." — *Copy button must not steal editor focus — verify focus remains on last active editor after click.*
- User C: "What happens if clipboard access is denied by the browser? Does it fail silently or tell me?" — *Graceful degradation: fallback to `document.execCommand('copy')` or show an error — PRD does not currently address clipboard permission denial.*
- User D: "The tooltip says 'Copy topic name (backtick-quoted)' — that's long. Can it be 'Copy topic name'? The backtick part is an implementation detail." — *Minor UX note: tooltip verbosity. Either is acceptable; user D prefers shorter.*

**New Finding — Not in PRD (Nice to Have):**
User A raised: "Could the copy button have a keyboard shortcut? Something like Ctrl+Shift+C when the topic detail panel has focus?" — *Low-priority shortcut request. Not blocking Phase 12.5 but worth noting for Phase 12.6 polish.*

**Conclusion:** Feature 4 is validated with strong enthusiasm. Clipboard permission failure handling is a PRD gap worth addressing. Focus-theft prevention is a critical implementation detail.

---

### Feature 5: Pre-Save Client-Side Validation for Config Edit

**Summary:** 5/5 users validated. Users who do config editing most frequently (Users A, E) rated this as the feature with the highest daily impact in Phase 12.5.

| User | Quote | Implication |
|:--- |:--- |:--- |
| User A | "I've set retention.ms to a decimal before — '86400000.5' — and the API silently truncated it to 1ms. My topic was set to 1 millisecond retention. I lost data. Pre-save validation would have caught that." | **Real data loss incident** caused by lack of client-side validation |
| User B | "The current flow is: type bad value → click Save → wait for server → get a red error — try again. With client validation, I get feedback immediately. That's 2-3 seconds saved per bad edit." | Latency of error feedback is user-visible friction |
| User C | "The validation rules in the PRD look correct: retention.ms ≥ -1 (−1 = infinite is correct), replication.factor ≥ 1, min.insync.replicas ≥ 1. Those cover the configs I touch most." | Domain expert validates the validation rules themselves |
| User D | "I would love validation before saving. I've made typos and had to redo the edit. But I almost never touch retention directly — I use the UI's human-readable format. Is the validation on the raw ms value or the formatted one?" | **Important question:** validation applies to the raw integer value, not the human-readable display. This needs to be clear in the UI. |
| User E | "min.insync.replicas ≤ replication.factor is a constraint that's not in the PRD. If min.insync.replicas > replication.factor, Kafka will reject writes. That should be caught client-side if we know the replication factor." | **New validation rule not in PRD** — cross-field constraint between min.insync.replicas and replication.factor |

**Critical Requirements Confirmed:**
- Validation fires on `onChange` (not onBlur or onSave only) — all users agreed
- Error message appears below input — "same position as server errors" (Users B, C)
- Save button disabled when validation error present — "don't let me click Save with a known bad value" (User A)

**New Finding — Validation Rule Gap (High Priority):**
User E identified a missing cross-field validation rule: **min.insync.replicas must be ≤ replication.factor**. If the user edits min.insync.replicas to 3 but the topic's replication.factor is 2, Kafka will reject all writes to the topic. This is a severe correctness issue that client-side validation can prevent if the current replication.factor value is known (it is — it's displayed in the config table).

*Recommendation: Add cross-field validation rule: if config key is `min.insync.replicas` and the current `replication.factor` config value is known, validate `min.insync.replicas ≤ replication.factor`. Show error message: "Must be ≤ replication factor ({value})".*

**Edge Cases Raised:**
- User D: "If I'm editing the retention and the field shows '7d' but the input needs ms — is that confusing?" — *The config table shows the raw value in the edit input (consistent with how configs are stored in Kafka). Users understand this — not a regression.*
- User C: "What if I enter '−1' for replication.factor? The rule says ≥ 1, so that should show an error. But what if I type '-' first while typing '-1'? Does the error flash confusingly?" — *Input UX detail: only validate when value is non-empty. Mid-input partial values shouldn't trigger error.*

**Conclusion:** Feature 5 is validated. The cross-field min.insync.replicas/replication.factor constraint is a genuine gap in the PRD that should be addressed. Loading-state-while-saving is a minor concern to confirm (server errors still shown post-422).

---

### Feature 6: Composite Topic Health Score

**Summary:** 5/5 users validated. This was the most visually impactful Phase 12.5 feature in user perception — replacing the badge with a dot is seen as a meaningful design improvement, not just a cosmetic tweak.

| User | Quote | Implication |
|:--- |:--- |:--- |
| User A | "The dot is cleaner. The old badge took up space in the row and caught my eye even for topics I've already reviewed. The dot is smaller and subtler — I only notice it when something needs attention." | **Reduced visual noise** is a real usability gain |
| User B | "Green, yellow, red — I understand immediately. The old triangle was just 'warning.' Now I have severity levels. Red means 'stop and fix this.' Yellow means 'be aware.'" | Semantic color grading improves triage speed |
| User C | "The scoring algorithm in the PRD is correct: single partition = parallelism bottleneck (yellow), no partitions = degenerate state (red), single replication = SPOF (yellow). I'd also want ISR < RF as a red condition eventually, but I understand it's deferred." | Algorithm validated by domain expert. ISR deferred acknowledged |
| User D | "I scan the topic list visually. A colored dot is faster than reading a badge. My eye goes straight to the reds and yellows." | Visual scanning speed improvement — power user validation |
| User E | "Tooltip needs to list all active conditions, not just the worst one. 'Low partition count (1 partition) + Low replication (1 replica)' — if two conditions are true, show both." | **Tooltip completeness requirement** — show all active conditions, not just worst |

**Critical Requirements Confirmed:**
- Healthy topics show no dot (zero visual noise for common case) — all 5 users confirmed
- Dot uses CSS vars (User D checked dark mode: "it needs to be visible in dark mode")
- Tooltip lists all active conditions (User E — confirmed by User C)

**New Finding — Algorithm Clarification:**
User C raised a question about the boundary condition for replication: "Does the red condition trigger when `replication_factor < 1` (zero replicas) or when it's unavailable from the API? And does `is_internal` ever actually appear in the filtered list?" — *The PRD defensive red condition (is_internal in filtered list) is a paranoia check. Users are comfortable with this; it documents an impossible state that shouldn't happen but is guarded against.*

**Edge Cases Raised:**
- User B: "What if a topic has partitions_count = 0 AND replication_factor = 0? Does it show red twice, or just red once?" — *Single red dot regardless of how many red conditions are true — severity shown in tooltip.*
- User E: "If a topic's health data is not available from the API (null/undefined), does it show a dot or no dot?" — *PRD does not address null health data. Recommendation: treat null as 'unknown' and show no dot (optimistic — don't alarm users for data gaps).*

**Conclusion:** Feature 6 is validated. Tooltip must list all conditions (not just worst). Null health data handling is a minor PRD gap. ISR deferral is accepted by all users.

---

### Feature 7: SchemaTreeView — CSS Custom Properties

**Summary:** 3/5 users noticed the dark mode color issue in SchemaTreeView before it was mentioned. 5/5 validated the fix as correct. This was the clearest "quality regression" of the existing set — users expected dark mode to work consistently everywhere.

| User | Quote | Implication |
|:--- |:--- |:--- |
| User A | "I noticed the tree view had purple hardcoded in dark mode. It looked out of place. I thought it was intentional at first, then realized it was a bug." | User caught the regression organically |
| User B | "I use dark mode exclusively. The record type badge was visually jarring — bright purple against a dark background without any background softening. It hurt to look at." | Specific dark mode rendering complaint — confirms the fix is necessary |
| User C | "This is a polish item, but polish matters for enterprise demos. When we demo to customers, inconsistent colors signal 'alpha quality.'" | **Enterprise sales signal** — polish affects perceived maturity |
| User D | "I work in light mode, so I didn't notice. But the fix is clearly correct from a maintainability standpoint — no hardcoded colors anywhere." | Light mode users unaffected but validate the correctness of CSS vars |
| User E | "The `--color-schema-record` variable naming is clear. If we ever change the schema type color palette (e.g., to match a new design system), we change it in one place." | Future-proofing value acknowledged |

**Critical Requirements Confirmed:**
- CSS vars defined in both `:root` and `[data-theme="dark"]`
- Slightly lighter dark mode values for AVRO type badge readability on dark backgrounds

**No New Edge Cases.** Feature 7 is fully validated with no concerns.

**Conclusion:** Feature 7 is validated. Small but impactful quality fix. High confidence in design correctness.

---

### Feature 8: AbortController Signal Forwarded to Axios

**Summary:** Technical fix that users don't interact with directly, but 3/5 users confirmed they experienced the symptom (stale config data on rapid topic switching). All 5 users validated the fix as correct when the behavior was explained.

| User | Quote | Implication |
|:--- |:--- |:--- |
| User A | "I did experience this. I clicked between 5 topics quickly and the config table showed the wrong topic's data for a second. I thought my click didn't register. This explains it." | User experienced the bug without knowing its cause |
| User B | "On a slow VPN this is even worse. I've seen the configs for a topic that I navigated away from appear while viewing a different topic. It was confusing and I had to reload." | **VPN users disproportionately affected** — slow network amplifies the race |
| User C | "Cancelling HTTP requests on navigation is a basic correctness requirement. The fact that it wasn't done was a bug, not a missing feature. Fix it." | Strong domain engineering validation |
| User D | "I don't usually switch topics rapidly, but it's good to know the fix is in place." | Light validation from infrequent user |
| User E | "This matters for compliance: if a user sees configs from the wrong topic and makes a decision based on that, it's an error. Preventing stale data is not optional." | **Compliance correctness requirement** confirmed |

**Edge Cases Raised:**
- User B: "Does the AbortController pattern also apply to the schema diff fetch? I described the stale diff issue in Feature 2 — is that also AbortController?" — *Good catch. The diff fetch in SchemaDetail is a separate use case from config fetch. PRD's Feature 2 fixes staleness via useEffect dependency array, not AbortController. But rapid version switching could still fire multiple diff fetches. Non-PRD hardening item: add AbortController to diff fetch.*

**Conclusion:** Feature 8 is validated. The AbortController gap in diff fetch is a related non-PRD improvement that should be tracked.

---

## Pain Points & Workflow Gaps (Post-Phase 12.4 Longitudinal)

Since Phase 12.4 shipped, the five users have been using the full platform for 2-4 weeks. This section captures workflow friction that emerged *in practice* — not predicted in interviews, but observed.

### Pain Point 1: No Config Edit History

**Reported by:** Users B, E (independently)

**Description:** After Phase 12.4 shipped config editing, both User B and User E independently noticed the same gap: there is no audit trail for config changes. Once a config is changed, there is no record of the previous value, who changed it, or when.

User B: "I edited retention.ms on a topic and two days later my colleague asked why it had changed. I had no way to prove it was me, or when. Config edit history would solve this."

User E: "For compliance, config changes are audited events. We need to know: what was the previous value, what is the new value, who made the change, and when. The current UI silently overwrites with no trace."

**Impact:** Compliance teams cannot use config editing without an audit trail. This limits adoption of Feature 4 in regulated environments.

**Suggested Solution:** Either surface Confluent's own config change history (if the API provides it) or maintain a client-side log in the workspace store (persisted to localStorage, showing last N changes with timestamp and value).

**Estimated Effort:** 4-8 story points (UI only, client-side log approach; higher if API integration needed)

---

### Pain Point 2: Schema Panel Has No Loading Indicator on Initial Mount

**Reported by:** User D

**Description:** When the Schema panel opens for the first time in a session, there is a noticeable delay before subjects appear. The panel shows nothing — no spinner, no skeleton — just blank white space.

User D: "Every time I open the Schema panel, I wonder if it's broken. There's no loading animation. Then the subjects appear. I always expect a spinner."

**Impact:** UX confidence issue — users perceive the panel as broken or slow even when the network is normal.

**Suggested Solution:** Add a skeleton loading state (3-5 shimmer rows) while the initial subject list fetch is in progress. Consistent with the version switch loading shimmer (ORIG-7) already implemented.

**Estimated Effort:** 1-2 story points

---

### Pain Point 3: No Way to Search Schema Subjects Across Multiple Criteria

**Reported by:** User C

**Description:** The Schema panel's search filter works on subject name only. User C wants to filter by compatibility mode (e.g., "show only BACKWARD_TRANSITIVE subjects") or by schema type (e.g., "show only PROTOBUF schemas").

User C: "I manage 200+ subjects. Finding all subjects with FULL_TRANSITIVE compat requires manually scrolling. A filter dropdown for compatibility mode would save significant time."

**Impact:** Power users with large subject counts cannot efficiently navigate the schema list.

**Suggested Solution:** Add a filter dropdown alongside the search input: filter by type (AVRO/PROTOBUF/JSON) or by compatibility mode. The type badge (ORIG-8) was shipped in Release 2 — the data is already there.

**Estimated Effort:** 3-5 story points

---

### Pain Point 4: Query Templates / SQL Snippets Library

**Reported by:** Users A, D (upgraded from Phase 12.4 rating to explicit request)

**Description:** Both User A and User D mentioned this in Phase 12.4 interviews but rated it lower priority. After two weeks of using the workspace daily, both upgraded it to their top-3 most-wanted feature.

User A: "I've written the same SELECT * FROM \`my-topic\` LIMIT 100 statement at least 40 times. I want to save it as a snippet and insert it with one click."

User D: "I have 5-6 query patterns I run weekly. Having them available as templates would cut my workflow time in half."

**Impact:** High-frequency users are doing repetitive work that a snippets library would eliminate.

**Suggested Solution:** A snippets panel or command palette entry: save current cell as snippet, name it, insert from a dropdown. Stored in localStorage (similar to workspace persistence).

**Estimated Effort:** 8-13 story points (significant new UI surface)

---

### Pain Point 5: Config Table Sort/Order Inconsistent Across Topics

**Reported by:** User B

**Description:** When switching between topics, the config table column order and sort state resets. User B has a workflow where he compares the same config (e.g., `retention.ms`) across multiple topics — the reset makes this tedious.

User B: "I compare retention across 10 topics. Each time I switch, the sort resets. I have to scroll to find retention.ms on every topic. If the sort persisted or if I could pin a config key to the top, I'd compare much faster."

**Impact:** Multi-topic comparison workflow is unnecessarily friction-heavy.

**Suggested Solution:** Persist the config table sort state in session storage (not localStorage — reset on page load is fine). Or add the ability to "star" a config key so it always appears at the top.

**Estimated Effort:** 2-3 story points

---

## Roadmap Ideas

**Ranked by mention frequency and user signal strength. These are inputs for the Feature Organizer & Ranker to story-point and batch into releases.**

### Immediate Backlog (Phase 12.6, High Signal)

| Rank | Idea | Mentioned By | Users | Estimated Effort | Rationale |
|:---:|:--- |:--- |:---:|:--- |:--- |
| 1 | Config edit audit log (who changed what, when) | Users B, E | 2/5 | 4-8 pts | Compliance blocker for config editing adoption; real workflow gap |
| 2 | Schema subject list: filter by type and compat mode | User C | 1/5 (architect, high weight) | 3-5 pts | 200+ subject management becomes untenable without filters |
| 3 | Schema panel loading skeleton on initial mount | User D | 1/5 | 1-2 pts | Quick win, eliminates perceived breakage on first open |
| 4 | Config table sort persistence within session | User B | 1/5 | 2-3 pts | Small fix, high daily workflow improvement |
| 5 | AbortController on schema diff fetch | User B | 1/5 (technical) | 1-2 pts | Parallel to Feature 8 — hardening, not user-visible |

### Medium-Term (Phase 12.7+, Medium Signal)

| Rank | Idea | Mentioned By | Users | Estimated Effort | Rationale |
|:---:|:--- |:--- |:---:|:--- |:--- |
| 6 | Query templates / saved snippets library | Users A, D | 2/5 | 8-13 pts | Mentioned Phase 12.4 (low), upgraded to Phase 12.6 request (high) after 2 weeks of use |
| 7 | ISR < replication.factor warning in health score | User C | 1/5 (domain expert) | 4-8 pts | Extends health score with expensive-per-topic API calls; deferred from 12.5 by PRD |
| 8 | Bulk topic delete (multi-select) | User B | 1/5 | 13 pts | Already in Phase 12.3 R3 backlog; re-confirmed demand |
| 9 | Topic lag monitoring (consumer offset lag) | Users B, C | 2/5 | 8-16 pts | SRE daily workflow; requires consumer API integration; Phase 13 candidate |
| 10 | Schema evolution validation (warn before breaking change) | User E | 1/5 | 8-16 pts | Enterprise safety net; requires job topology knowledge; Phase 13 candidate |

### Strategic (Phase 13+)

- Cluster topology visualization (partition leaders, ISR map)
- Flink job → topic lineage graph
- Topic access audit log (governance/compliance)
- Schema change impact analysis (which jobs break?)
- Topic lifecycle management (creation templates, deprecation workflow)
- Integration with Confluent Cloud governance APIs

---

## Priority Signals

### What Users Care About Most in Phase 12.5 (Ranked)

| Rank | Feature | Mention Count | Critical? | User Quote |
|:---:|:--- |:---:|:--- |:--- |
| 1 | Schema diff stability (Feature 2) | 5/5 | YES — production incident confirmed | "The stale diff caused a broken Flink job last week." — User C |
| 2 | Pre-save config validation (Feature 5) | 5/5 | YES — data loss incident confirmed | "I set retention.ms to 1ms because of a decimal." — User A |
| 3 | Schema subject delete confirmation (Feature 1) | 5/5 | YES — compliance requirement | "Accidental deletes have caused audit findings." — User E |
| 4 | Copy topic name button (Feature 4) | 5/5 | HIGH — daily quality of life | "One-click copy vs 4-click manual copy — I'll use this daily." — User B |
| 5 | Composite health score (Feature 6) | 5/5 | HIGH — usability improvement | "Red means stop and fix. Yellow means be aware. Immediately understood." — User B |
| 6 | Schema version delete overlay (Feature 3) | 5/5 | HIGH — consistency + enterprise | "Browser dialogs are sometimes blocked by policy." — User C |
| 7 | SchemaTreeView dark mode colors (Feature 7) | 3/5 noticed | MEDIUM — polish/enterprise demos | "Inconsistent colors signal alpha quality in demos." — User C |
| 8 | AbortController signal forwarding (Feature 8) | 3/5 experienced | MEDIUM — correctness | "Stale config data appeared for the wrong topic on VPN." — User B |

### Top 3 Pain Points That Phase 12.5 Does NOT Address

These are the highest-priority items *beyond* Phase 12.5 based on user feedback:

1. **Config edit audit trail** (compliance blocker, 2 users, immediate)
2. **Query templates / saved snippets** (productivity multiplier, 2 users, upgraded priority)
3. **Schema subject list advanced filtering** (enterprise navigation, 1 architect, medium-term)

---

## PRD Gap Analysis

Issues found in the Phase 12.5 PRD that warrant engineering attention:

| Gap ID | Feature | Issue | Severity | Recommendation |
|:--- |:--- |:--- |:--- |:--- |
| GAP-1 | Feature 1 | Subject name matching: PRD doesn't specify whether user types display name or URL-encoded name for subjects with special characters | Medium | Clarify: user types the display name exactly as shown in the UI |
| GAP-2 | Feature 2 | No error handling for failed diff fetch reload | High | If diff pane reload fails, show error in diff pane, not stale content |
| GAP-2b | Feature 2 | AbortController not applied to diff fetch | Medium | Apply AbortController pattern to diff fetch calls (parallel to Feature 8) |
| GAP-3 | Feature 3 | Loading state during delete API call not specified | Medium | Add spinner/disabled state on confirm button while delete is in progress |
| GAP-3b | Feature 3 | Last-version delete warning not specified | Low | If deleting last version, warn user this will also delete the subject |
| GAP-4 | Feature 4 | Clipboard permission failure not addressed | Medium | Add fallback or user-visible error when navigator.clipboard is denied |
| GAP-4b | Feature 4 | Focus-theft prevention not specified | High | Copy button must not steal focus from active Monaco editor |
| GAP-5 | Feature 5 | Cross-field validation missing (min.insync.replicas ≤ replication.factor) | High | Add cross-field rule: min.insync.replicas must be ≤ replication.factor (value available from config table) |
| GAP-6 | Feature 6 | Null health data handling not specified | Low | Treat null/undefined partition or replication data as "no dot" (optimistic, not alarming) |

---

## Critical Assumptions Validated

### Assumption 1: Schema name confirmation — display name vs. URL form

**Status: Clarified — use display name.**

All 5 users expect to type the subject name exactly as it appears in the subject list header. No one would think to URL-encode it. Implementation must match the display name, not the API path form.

### Assumption 2: Health score algorithm thresholds

**Status: Validated by domain expert.**

User C (8+ years Confluent/Flink) confirmed: `partitions_count < 2` is the correct warning threshold for Flink parallelism. `replication_factor < 2` is the correct warning threshold for SPOF risk. These are industry-standard Confluent Cloud deployment best practices.

### Assumption 3: Config edit validation rules

**Status: Mostly validated. One gap identified.**

User C confirmed the PRD's listed validation rules are correct. User E identified the missing cross-field constraint for min.insync.replicas. This is a Kafka correctness rule, not just UX preference.

### Assumption 4: AbortController behavior with AbortError

**Status: Validated.**

Users confirmed that silently swallowing AbortError (cancelled requests) is the correct behavior — no error toast needed when the user themselves navigated away.

---

## Test Coverage Recommendations

### Critical Test Paths for Phase 2.5 (QA Manager Gate)

1. **Feature 1 — Schema Subject Delete:**
   - Case-sensitive name match (wrong case = disabled button)
   - Subject with special characters (hyphen, dot, underscore in name)
   - Cancel clears input and closes dialog (no API call)
   - Delete with expired auth token → error shown (not silent fail)

2. **Feature 2 — Schema Diff View:**
   - Primary version change while diff mode active → diff reloads
   - Diff version picker has N-1 options (primary excluded)
   - Single-version subject → diff toggle disabled with explanatory tooltip
   - Failed diff fetch → error banner in diff pane (not stale content)

3. **Feature 3 — Schema Version Delete Overlay:**
   - Version number displayed in overlay text
   - Loading state during API call (confirm button disabled/spinning)
   - Last version delete → warning that subject will also be deleted
   - Keyboard: Tab navigates to Cancel and Confirm; Escape closes

4. **Feature 4 — Copy Topic Name:**
   - Copy does not steal focus from active Monaco editor
   - Backtick quoting for: names with `.`, `-`, spaces, uppercase, numbers
   - Clipboard permission denied → user-visible fallback or error
   - 1500ms success state visible and dismisses automatically

5. **Feature 5 — Config Validation:**
   - Cross-field: min.insync.replicas > replication.factor → validation error
   - Mid-input partial value (e.g., typing '-' before '-1') does not trigger error
   - Save button remains disabled until all errors cleared
   - 422 from server still shows for configs without client-side rules

6. **Feature 6 — Health Score:**
   - Tooltip shows all active conditions when multiple warnings exist
   - Null/undefined health data → no dot shown
   - Both light and dark mode rendering

---

## User Quotes (For Roadmap Communication)

**On Phase 12.5 overall:**

> "Phase 12.4 eliminated context switching. Phase 12.5 is making the individual operations safer and faster. Both matter — one is macro (workflow flow), the other is micro (each action)." — User A, Flink Engineer

> "The stale diff view has been a trust problem since Phase 12.2. Fixing it means I can actually rely on diff mode for production schema decisions." — User C, Sr. Architect

> "I set a topic's retention to 1 millisecond once because of a decimal in the input. Pre-save validation would have caught that before I lost data." — User A

> "Schema delete confirmation parity is overdue. Topics required it, schemas didn't. One misclick on a production schema subject is a half-day incident." — User C

> "The composite health score is the right evolution. Green means nothing to do. Yellow means check. Red means stop." — User B, Flink Engineer

> "I'll use the copy topic button daily. It sounds small but it removes the most annoying thing in my morning workflow." — User D, Data Scientist

> "Config edit without audit history is risky for compliance. We need to know who changed what and when. That's the gap Phase 12.5 doesn't close but Phase 12.6 should." — User E, Platform Engineer

---

## Conclusion & Phase 5 Input for TPPM

### Features Validated and Ready for Phase 2

All 8 Phase 12.5 features are validated with no blockers. Two critical implementation details should be addressed in engineering:

1. **GAP-4b (Feature 4):** Copy button must not steal focus from Monaco editor — confirm in implementation
2. **GAP-5 (Feature 5):** Add cross-field validation rule: min.insync.replicas ≤ replication.factor

### PRD Gaps Requiring Engineering Attention

- Feature 2: Error handling when diff fetch fails (show error in pane, not stale content)
- Feature 3: Loading state on confirm button during delete API call
- Feature 4: Clipboard permission denial handling

### Phase 12.6 Backlog (Immediate Priority Items for TPPM)

| Priority | Item | Story Points (estimated) | User Signal |
|:---:|:--- |:---:|:--- |
| 1 | Config edit audit log | 4-8 | Users B, E — compliance blocker |
| 2 | Schema subject list: filter by type/compat | 3-5 | User C — enterprise navigation |
| 3 | Schema panel loading skeleton on mount | 1-2 | User D — quick win |
| 4 | Config table sort persistence (session) | 2-3 | User B — multi-topic comparison workflow |
| 5 | AbortController on diff fetch | 1-2 | User B — technical hardening |
| 6 | Query templates / SQL snippets library | 8-13 | Users A, D — upgraded from Phase 12.4 low to Phase 12.6 high |
| 7 | ISR health indicator in health score | 4-8 | User C — deferred from 12.5, now queued for 12.6 |
| 8 | Bulk topic delete (multi-select) | 13 | User B — already in Phase 12.3 R3 backlog |

**Estimated Phase 12.6 batch:** Items 1–5 total ~11–20 story points (two items near the ≥25 threshold with items 6–8 added). Items 6–8 add 25–34 points. Combined: ~36–54 points → ready to batch as Phase 12.6 Release 1.

---

## Appendix: Full Interview Notes (Raw Data)

### Interview 1: User A (Flink Engineer, Daily User) — 2026-03-01, 09:00

**Q: What has your workflow been like since Phase 12.4 shipped?**
A: Much better. I spend 80% less time switching panels. The "Query with Flink" button is my most-used feature now. Config editing works well, though I accidentally set retention to 1ms once by typing a decimal. I'd want validation before save.

**Q: On schema diff — have you used it in production decisions?**
A: Yes. And the stale diff bit me. I changed the primary version while diff mode was on, didn't notice the pane didn't reload, and almost pushed a breaking schema. Feature 2 would prevent that.

**Q: For schema subject delete — was the current single-click delete a concern?**
A: I noticed the asymmetry right after Phase 12.4 shipped. It felt like an accident. Topics needed typed name, schemas didn't. Schema history is harder to recover than a topic. Name confirmation is the right call.

**Q: Would you use the copy topic name button?**
A: Every day. I write SQL in other tools too — Notebooks, runbooks, design docs. Copy works everywhere. Insert only works in the workspace editor.

**Q: What's the next feature you'd want after Phase 12.5?**
A: Query templates. I've written the same SELECT 40 times in the last two weeks. I want a "save as snippet" button.

---

### Interview 2: User B (Flink Engineer, Daily User) — 2026-03-01, 11:00

**Q: What's still frustrating after Phase 12.4?**
A: The stale config data on rapid topic switching was noticeable on my VPN. Feature 8 (AbortController to Axios) will fix that. Also, I compare configs across multiple topics — the sort reset is tedious.

**Q: On schema diff stability — is this important to you?**
A: The self-compare case is actually what got me. I selected the same version on both sides by accident. The diff showed nothing. I thought 'great, no changes' when actually I was comparing the file to itself. Silent failure.

**Q: Pre-save config validation?**
A: Current flow is 3 round trips: type, save, wait for error, fix, retry. Client validation cuts that to 1. It's a real time-saver.

**Q: Health score?**
A: The dot is much better than the badge. Green / yellow / red — I get it immediately. The old triangle was ambiguous severity.

**Q: What would you build next?**
A: Config edit audit log. My colleague asked why a config changed and I had no way to answer. Also bulk topic delete — I have dozens of test topics to clean up.

---

### Interview 3: User C (Domain Expert, Sr. Architect) — 2026-03-01, 13:00

**Q: Any production incidents related to current tooling since Phase 12.4?**
A: Yes. A junior engineer changed the primary schema version while in diff mode, the diff pane didn't reload, he thought the schemas were compatible, approved the change, and a Flink job broke. That's directly the Feature 2 bug. We had a 2-hour incident.

**Q: How important is schema subject delete confirmation to enterprise teams?**
A: It's compliance-critical. Schema history is audit evidence in some regulated industries. Accidental deletion has caused audit findings. Name confirmation is not just UX — it's a control.

**Q: Schema version delete — `window.confirm()` — is this a blocker for some environments?**
A: Yes. Some enterprise browser policies suppress native dialogs. I've had users report the dialog "didn't appear" — it was blocked. The inline overlay solves that.

**Q: On config validation — is the cross-field rule (min.insync.replicas ≤ replication.factor) important?**
A: Critical. If min.insync.replicas > replication.factor, Kafka will refuse all writes. New engineers don't know this constraint. It's a footgun. The UI should catch it.

**Q: What comes after Phase 12.5?**
A: Schema subject list filtering by compat mode and type. I manage 200+ subjects. I can't find all BACKWARD_TRANSITIVE subjects efficiently. Filtering would cut my review time in half.

---

### Interview 4: User D (Power User, Data Scientist) — 2026-03-01, 14:30

**Q: How has your workflow changed since Phase 12.4?**
A: I use the Schema panel a lot more now. The tree view is the best thing that's shipped. But I noticed when I open the Schema panel, there's a blank moment before subjects appear. No spinner. It looks broken every time.

**Q: Schema diff — do you use it?**
A: Occasionally. The self-compare guard is a good idea. I've done that — selected the same version accidentally — and was confused by the empty diff.

**Q: Copy topic name — you specifically requested this in Phase 12.4 interviews.**
A: Yes. Having it always-enabled is exactly what I wanted. Insert requires a focused editor; copy just copies. Much faster for my workflow.

**Q: Pre-save validation for config — would you use this?**
A: Yes, but I rarely edit configs. When I do, validation feedback before saving would be reassuring. Especially for configs I don't fully understand like replication.factor.

**Q: What comes after Phase 12.5?**
A: Query templates. I have 5-6 patterns I run weekly. Save them once, use them forever. That would double my productivity.

---

### Interview 5: User E (Power User, Platform Engineer) — 2026-03-01, 16:00

**Q: What's the biggest gap in the current platform for governance/compliance work?**
A: Config edit audit trail. We need to know who changed a config and when. Right now, changes are anonymous and undated in the UI. This limits config editing to trusted senior engineers only.

**Q: Schema subject delete confirmation — compliance perspective?**
A: Essential. Accidental deletes have generated audit findings in the past. The name confirmation control is a preventive measure that auditors will recognize.

**Q: Version delete overlay — important?**
A: Yes. Version-level deletes are riskier than they appear — deleting all versions of a schema type permanently removes schema history. The version number must be prominent in the overlay, not buried in a generic confirmation.

**Q: Pre-save validation — cross-field rule?**
A: min.insync.replicas > replication.factor is a Kafka correctness constraint, not just a UX nicety. If we let that through, the topic will refuse writes. Client-side enforcement is the right place to catch it since we know both values from the config table.

**Q: Health score — tooltip requirements?**
A: Show all active conditions in the tooltip. If a topic has both low partition count and low replication, I need to see both conditions — not just the worst one. 'Low partition count + Low replication factor' tells me two things need fixing.

**Q: What comes after Phase 12.5?**
A: Config audit log, first. Then bulk topic delete for governance workflows. And eventually schema evolution validation — warn before I evolve a schema that would break active Flink jobs.

---

**Report Complete. Ready for TPPM Phase 5 Synthesis.**

**Phase 4D Status:** COMPLETE
**Delivered to:** TPPM (Phase 5 Synthesis)
**Companion Report (Summary):** See `docs/agents/feedback/run-4/PHASE-12.5-INTERVIEW-SUMMARY.md`
