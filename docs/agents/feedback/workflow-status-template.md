# Workflow Status Template

**Schema & Structure Definition**

This is a **template document** defining the structure of `workflow-status.md` (live data file).

The **Workflow Manager** (continuous background agent) populates `workflow-status.md` every 60 seconds using this schema.

---

## Live Data File Structure

### Header Section
```
**Last Updated:** [ISO 8601 timestamp]
**Next Update:** [ISO 8601 timestamp + 60 seconds]
**Monitor Cycle:** #[N] ([Brief 1-2 line status summary])
```

### Section: Active Features

Table with columns:
- **Feature** — Feature name + release number
- **Phase** — Current phase (e.g., "Phase 2 — B1 Implementation ACTIVE")
- **Agent** — Responsible agent (Engineering, TPPM, QA Manager, etc.)
- **Task** — Current task description
- **Status** — Status emoji + description (🔨 ACTIVE, ⏳ PENDING, ✅ COMPLETE)
- **ETA** — Expected completion date (YYYY-MM-DD)
- **Blockers** — Current blockers or "None"

### Section: Running Agents

Table with columns:
- **Agent** — Agent name
- **Status** — Current status (✅ ACTIVE, ⏳ WAITING, idle, etc.)
- **Task** — Current task description
- **Phase** — Phase/phase section
- **Last Heartbeat** — Last time agent reported status (ISO 8601)
- **ETA** — Expected completion or "—"

### Section: Gate Status

Table with columns:
- **Gate** — Gate name (e.g., "Ops Excellence Drill-Down: A2 → B1")
- **Status** — ✅ CLEARED, ⏳ PENDING, ❌ BLOCKED, etc.
- **Agent** — Gate guardian agent (TPPM, QA Manager, UX/IA Reviewer, etc.)
- **Date Approved** — Date gate was cleared (or "—")
- **Notes** — Brief notes on gate requirements/status

### Section: A2 Design Review Tracker (if active)

Table with columns:
- **Reviewer** — Reviewer role (Principal Architect, QA Manager, UX/IA Reviewer, Principal Engineer, Domain Expert)
- **Role** — Responsibility area
- **A2 Final Verdict** — ✅ A2 APPROVED or ❌ NEEDS CHANGES
- **Resolved Items** — Summary of blocking issues resolved
- **Re-Review Conducted?** — YES / NO with notes

### Section: Non-Blocking Engineering Notes (if any)

Table with columns:
- **#** — Item number
- **Item** — Description
- **Source** — Agent/reviewer who flagged it
- **Priority** — LOW, MEDIUM, HIGH
- **Action** — What engineering should do

### Section: UX/IA Phase 2.6 Conditions (if registered)

Table with columns:
- **#** — Condition number (U-1, U-2, etc.)
- **Condition** — Condition description
- **Enforced At** — Phase gate where enforced (e.g., "Phase 2.6 gate")
- **Engineering Status** — ⏳ Implement during B1, ✅ COMPLETE, ❌ FAILED, etc.

### Section: A3 PRD Revision Tracker (if A3 active)

Subsections by reviewer type:
- **Architect Items** — Table with Item #, Description, Status
- **QA Manager Items** — Table with Item #, Description, Status
- **Principal Engineer Items** — Table with Item #, Description, Status
- **Domain Expert Items** — Table with Item #, Description, Status
- **UX/IA Conditions** — Table with Condition #, Description, Enforced At

### Section: Violations & Alerts

Table with columns:
- **Violation** — Violation description
- **Severity** — HIGH, MEDIUM, LOW
- **Status** — ⚠️ Open, 🔧 In Progress, ✅ Resolved
- **Details** — Detailed context
- **Action Required** — What needs to be done

### Section: Feature Organizer & Ranker — PRD/Roadmap Alignment Verification

Table with columns:
- **Check** — What was verified
- **Result** — ✅ Updated, ✅ Confirmed, ❌ MISMATCH, etc.
- **Notes** — Brief notes

### Section: Recently Completed Features (In Review — Phase 4 Track D)

Table with columns:
- **Feature** — Feature name
- **Completed** — Completion date
- **Closer Status** — Closer wrap-up status
- **Async Review** — VP / Eng / Product reviewing / Awaiting feedback

### Section: Feedback Pipeline (Feature Organizer & Ranker)

Table with columns:
- **Release Candidate** — Feature + Release number
- **Points** — Story point total
- **Threshold** — Threshold (25)
- **Status** — 🔨 Phase B1 — Implementation Active, 🔄 Watching, 🔄 New, etc.

### Section: Gate Enforcement Summary

Subsections for each active gate (Phase 1 → Phase 2, A2 → B1, B1 → B2, Phase 2 → 2.5, Phase 2.5 → 2.6, Phase 2.6 → Phase 3, Phase 3 → Phase 4):
- **Condition** — Gate requirement
- **Status** — Status emoji + description
- **Cleared at** — Timestamp (or "—")
- **Final tally** / **Requirements** / **Next active gate** — Context-specific details

### Section: Next Recommended Actions

Numbered list of actions with:
- **Agent responsible** (bold)
- **(PRIORITY LEVEL — Context):** Description
- Action details and reasoning

---

## Workflow Manager Write Algorithm

**Every 60 seconds:**

1. Read template schema above
2. Query current state:
   - Active features from roadmap.md
   - Agent heartbeats from agent feedback folders (docs/agents/feedback/)
   - Gate status from workflow registry
   - Violations from logs
3. Populate each section with live data
4. Write to `docs/agents/feedback/run-{N}/workflow-status.md` (overwrite)
5. Log write timestamp and section summary to console/logs

**If error during write:**
- Log error to `docs/agents/feedback/run-{N}/workflow-status.md` Violations section (append, don't overwrite)
- Wait 60 seconds
- Retry write operation
- **Do NOT exit loop**

---

## Feedback Folder Integration

**Location:** `docs/agents/feedback/run-{N}/`

**Agents write structured feedback reports here (permanent audit trail):**

### Feedback Report Format
```
docs/agents/feedback/run-{N}/[AgentName].md

Example:
  docs/agents/feedback/run-7/TPPM.md
  docs/agents/feedback/run-7/QA-MANAGER.md
  docs/agents/feedback/run-7/PRINCIPAL-ARCHITECT.md
  docs/agents/feedback/run-7/UX-IA-REVIEWER.md
  docs/agents/feedback/run-7/ENGINEERING.md
  docs/agents/feedback/run-7/CLOSER.md
```

### Feedback Content Structure
See `docs/agents/feedback/README.md` for template. Each agent outputs:
- Definition vs Reality — What MD says vs actual behavior
- Aligned? — Yes/No/Partially
- Gaps Found — Missing capabilities, outdated assumptions, suggestions
- Confidence — High/Medium/Low

### Workflow Manager Reads Feedback
1. Determine current run number (N) from git commit history or roadmap.md
2. Scan `docs/agents/feedback/run-{N}/` for reports from each active agent
3. Extract last update timestamp and status summary from each agent's MD
4. Parse blockers, notes, and recommendations from agent feedback
5. Populate "Running Agents" section with latest status from feedback
6. Use feedback file timestamps for "Last Heartbeat" column
7. Extract recommendations and consolidate into "Next Recommended Actions" section
8. Identify stale feedback (> 120 seconds old since last update) → flag as alert in Violations section

### Agent Update Timing
- Agents write feedback to `run-{N}/[AgentName].md` at significant checkpoints (task complete, blocker found, gate passed)
- Agents do NOT need to wait for Workflow Manager — write asynchronously as milestones complete
- Workflow Manager polls every 60s and reflects latest feedback in `workflow-status.md`

---

## Key Rules

- **This is a template, not a live file** — Do NOT directly edit this file
- **Live file: `workflow-status.md`** — Auto-populated every 60 seconds by Workflow Manager
- **Feedback folder: `docs/agents/feedback/`** — Agents write heartbeat reports here continuously
- **Workflow Manager responsibilities:**
  - Read this template every cycle
  - Aggregate live data from feedback folder + roadmap + logs
  - Write `workflow-status.md` (always overwrite, complete refresh)
  - Never exit loop, handle errors gracefully
- **Agents write feedback continuously** — Don't wait for Workflow Manager to ask
- **Heartbeat timing:** Write feedback whenever completing a task checkpoint or significant milestone
- **Feedback retention:** Keep last 10 reports per agent (auto-cleanup old files)
