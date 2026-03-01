# Workflow Status System — Quick Start

**Complete workflow visibility through integrated template + live data + feedback architecture**

---

## System at a Glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW STATUS INTEGRATION                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  STATIC SCHEMA              SELF-CONTAINED RUN FOLDER                    │
│  (Template)                 (Updated every 60s + Permanent Audit)        │
│                                                                           │
│  ┌──────────────────┐        ┌─ feedback/run-7/                         │
│  │ workflow-status- │        │  ├─ workflow-status.md  ← LIVE DATA     │
│  │ template.md      │───────→│  │  (auto-populated by Workflow Manager) │
│  │                  │   (1)  │  ├─ TPPM.md            ← AUDIT TRAIL   │
│  │ • Sections       │        │  ├─ QA-MANAGER.md                      │
│  │ • Tables         │        │  ├─ PRINCIPAL-ARCHITECT.md             │
│  │ • Field names    │        │  ├─ ENGINEERING.md                     │
│  │ • Data structure │        │  ├─ UX-IA-REVIEWER.md                  │
│  │                  │        │  ├─ CLOSER.md                          │
│  │                  │        │  ├─ VALIDATION-TESTING.md              │
│  └──────────────────┘        │  ├─ TEST-COMPLETION.md                 │
│         (1)                  │  └─ ... (all agent feedback files)      │
│  Copied to each              │                                          │
│  run-{N} folder on   (2) Workflow Manager reads & populates            │
│  first cycle               run-{N}/workflow-status.md                  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

(1) Template is source for all runs — defines structure & sections
(2) Agents write feedback to run-{N}/ folder (same folder as status file)
```

---

## Files & Their Roles

| File | Type | Updated | By Whom | Purpose |
|------|------|---------|---------|---------|
| `workflow-status-template.md` | Schema | Rarely | Workflow Manager (when schema changes) | Define live file structure (sections, tables, field names) — source for all runs |
| `feedback/run-{N}/workflow-status.md` | Live Data | Every 60s | Workflow Manager (automatic) | **CURRENT STATE FOR RUN** — feature phases, agent status, gate status for this run |
| `feedback/run-{N}/TPPM.md` | Audit | Async | TPPM agent (at milestones) | TPPM feedback report: "what I did vs my definition" |
| `feedback/run-{N}/QA-MANAGER.md` | Audit | Async | QA Manager agent | QA Manager feedback report |
| `feedback/run-{N}/PRINCIPAL-ARCHITECT.md` | Audit | Async | Principal Architect agent | API design validation feedback |
| `feedback/run-{N}/ENGINEERING.md` | Audit | Async | Engineering agent | Implementation progress feedback |
| `feedback/run-{N}/[AgentName].md` | Audit | Async | Each agent (11 total) | Feedback reports from all agents in current run |

---

## Quick Checklist

### Before Starting Major Work
- [ ] Determine current feature run number (check `roadmap.md` or recent folder in `feedback/`)
- [ ] Read **`docs/agents/feedback/run-{N}/workflow-status.md`** (live current state)
  - Is a feature already in progress? (check Active Features)
  - Are there blocked gates? (check Gate Status)
  - What are Next Recommended Actions?
- [ ] If starting new feature, check Phase 1 → Phase 2 gate cleared
- [ ] If continuing feature, find which phase it's in

### During Feature Development
- [ ] Agents write feedback asynchronously to `run-{N}/[AgentName].md` at major checkpoints
  - No need to wait for Workflow Manager to ask
  - Write when you complete a phase or hit a blocker
  - Use **`AGENT-FEEDBACK-TEMPLATE.md`** as guide
- [ ] Workflow Manager automatically updates `run-{N}/workflow-status.md` every 60s
  - No manual action needed — automatic updates
  - File reflects latest agent feedback + gate status from same folder

### At End of Feature Cycle
- [ ] All Phase 4 agents write final feedback to `feedback/run-{N}/[AgentName].md`
- [ ] Closer commits feedback files in batch during Phase 4A
- [ ] New cycle starts with `run-{N+1}/` folder

---

## Common Tasks

### "I need to know the current workflow state"
**→ Read:** `docs/agents/feedback/run-{N}/workflow-status.md` (current run)
- Shows active features, phases, blockers, next actions for this run
- Updated every 60 seconds, always current
- Located in the same folder as all agent feedback files

### "I want to write feedback about my work"
**→ Create:** `docs/agents/feedback/run-{N}/[YourRole].md`
- Use template from `AGENT-FEEDBACK-TEMPLATE.md`
- Write asynchronously when milestone completes
- Include: definition vs reality, gaps found, suggestions, confidence

### "I need to understand the workflow status architecture"
**→ Read:** `WORKFLOW-STATUS-INTEGRATION.md`
- Complete guide to all three files
- How Workflow Manager populates live data
- Data flow diagram and examples

### "I need to set up the feedback folder for a new feature"
**→ Create:** `docs/agents/feedback/run-8/` (incrementing folder)
- One markdown file per agent: `TPPM.md`, `QA-MANAGER.md`, etc.
- Files created as agents complete work during cycle
- Never delete — permanent audit trail

### "I want to see the live data structure"
**→ Read:** `workflow-status-template.md`
- Shows all sections and table formats
- Explains what each field contains
- Reference for understanding populated `workflow-status.md`

---

## Key Rules

✅ **Workflow Manager Responsibilities:**
- Create `run-{N}/` folder on first cycle of each feature
- Copy template to `run-{N}/workflow-status.md` on first cycle
- Update `run-{N}/workflow-status.md` every 60 seconds without fail
- Read template + feedback folder to populate live file
- Never exit loop (run continuously forever)
- Handle errors gracefully (log, wait 60s, retry)

✅ **Agent Responsibilities:**
- Write feedback to `run-{N}/[YourRole].md` at major checkpoints
- Include timestamp, status, phase, blockers, ETA
- Write honestly (definition vs reality, confidence level)
- Don't wait for Workflow Manager to ask

✅ **Closer Responsibilities:**
- Commit feedback files in batch during Phase 4A
- NEVER DELETE `docs/agents/feedback/` folder
- Organize runs into meaningful feature cycles

✅ **Claude Code Responsibilities:**
- Read `workflow-status.md` before major decisions
- Check gate status before phase transitions
- Use Next Recommended Actions to guide priorities
- Never bypass workflow status

---

## Data Flow Example

**Scenario:** Engineering completes B1 implementation

```
1. ENGINEERING writes feedback
   → docs/agents/feedback/run-7/ENGINEERING.md
   → Status: "B1 Implementation COMPLETE"
   → ETA: "2026-03-08"
   → Timestamp: "2026-02-28T21:00:00Z"

2. Workflow Manager polls (every 60 seconds)
   → Reads: feedback/run-7/ENGINEERING.md
   → Parses: status=COMPLETE, ETA=2026-03-08, timestamp=21:00:00Z
   → Queries: roadmap.md (Ops Excellence in Phase 2 — B1)

3. Workflow Manager populates live file
   → Updates: run-7/workflow-status.md (SAME FOLDER as feedback files)
   → Running Agents section:
      | Engineering | ✅ B1 COMPLETE | ... | 2026-02-28T21:00:00Z | 2026-03-08 |

4. CLAUDE CODE reads status file
   → Sees: run-7/workflow-status.md shows Engineering B1 complete
   → Decides: Activate QA Manager for Phase 2.5 browser testing
   → Proceeds with appropriate next action
```

---

## File Locations

```
docs/agents/
├── WORKFLOW-ORCHESTRATION.md          ← Phase 1-5 overview
├── FEATURE-IMPLEMENTATION.md          ← Phase A/B/C detailed steps
├── ARCHITECT.md                       ← A2 REST/API validation
├── TPPM.md
├── QA-MANAGER.md
├── UX-IA-REVIEWER.md
├── CLOSER.md
├── VALIDATION-TESTING.md
├── TEST-COMPLETION.md
├── FEATURE-ORGANIZER-RANKER.md
├── WORKFLOW-MANAGER.md
├── workflow-status-template.md        ← SCHEMA (static, source for all runs)
├── WORKFLOW-STATUS-INTEGRATION.md     ← Complete guide
├── WORKFLOW-STATUS-QUICK-START.md     ← This file
├── AGENT-FEEDBACK-TEMPLATE.md         ← Template for agents
└── feedback/                          ← PERMANENT AUDIT TRAIL
    ├── README.md                      ← Feedback folder guide
    ├── run-1/                         ← Feature 1 (self-contained)
    │   ├── workflow-status.md         ← LIVE DATA (auto-populated)
    │   ├── TPPM.md                    ← Agent feedback
    │   ├── QA-MANAGER.md
    │   └── ... (all agent feedback files)
    ├── run-2/                         ← Feature 2 (self-contained)
    │   ├── workflow-status.md
    │   ├── TPPM.md
    │   └── ... (all agent feedback files)
    └── run-7/                         ← Feature 7 (current, self-contained)
        ├── workflow-status.md         ← LIVE DATA (auto-populated)
        ├── TPPM.md                    ← Agent feedback
        ├── PRINCIPAL-ARCHITECT.md
        ├── QA-MANAGER.md
        ├── UX-IA-REVIEWER.md
        ├── PRINCIPAL-ENGINEER.md
        ├── ENGINEERING.md
        ├── CLOSER.md
        ├── VALIDATION-TESTING.md
        ├── TEST-COMPLETION.md
        ├── FEATURE-ORGANIZER-RANKER.md
        ├── WORKFLOW-MANAGER.md
        └── AGENT-DEFINITION-OPTIMIZER.md
```

---

## Next Steps

1. **Understand the architecture:** Read `WORKFLOW-STATUS-INTEGRATION.md`
2. **See it in action:** Check `docs/agents/feedback/run-7/workflow-status.md` (or current run)
3. **Review feedback structure:** Look at `feedback/run-7/` for examples of agent feedback files
4. **Write feedback:** Use `AGENT-FEEDBACK-TEMPLATE.md` when your milestone completes
5. **Monitor:** Read `docs/agents/feedback/run-{N}/workflow-status.md` (current run) before major actions
