# Agent Feedback Archive

**This folder is permanent and should NEVER be deleted.**

---

## Purpose

`docs/agents/feedback/` stores structured feedback from all subagents across every feature cycle. This creates a permanent audit trail of agent behavior and enables the **Agent Definition Optimizer** to continuously improve agent profiles over time.

---

## Structure

```
docs/agents/feedback/
├── run-1/          ← Feature 1 (first feature cycle)
│   ├── TPPM.md
│   ├── PRINCIPAL-ARCHITECT.md
│   ├── QA-MANAGER.md
│   ├── UX-IA-REVIEWER.md
│   ├── PRINCIPAL-ENGINEER.md
│   ├── CLOSER.md
│   ├── VALIDATION-TESTING.md
│   ├── TEST-COMPLETION.md
│   ├── FEATURE-ORGANIZER-RANKER.md
│   ├── WORKFLOW-MANAGER.md
│   └── AGENT-DEFINITION-OPTIMIZER.md
│
├── run-2/          ← Feature 2 (second feature cycle)
│   ├── TPPM.md
│   ├── PRINCIPAL-ARCHITECT.md
│   ├── QA-MANAGER.md
│   ├── ...
│   └── AGENT-DEFINITION-OPTIMIZER.md
│
├── run-3/          ← Feature 3
│   └── ...
│
└── README.md       ← This file
```

---

## Feedback Format

Each agent outputs feedback to: `docs/agents/feedback/run-{N}/[AgentName].md`

**Template:**
```markdown
# [AgentName] Feedback

**Reference Profile:** [docs/agents/AGENT-NAME.md](../../AGENT-NAME.md)
**Feature Cycle:** Run {N}
**Timestamp:** [ISO 8601]

## Definition vs Reality

**What my MD says I do:**
[quote from the agent's MD file]

**What I actually did:**
[description of actual behavior during this feature]

**Aligned?**
- Yes / No / Partially

## Gaps Found

- Missing from definition: [capability not documented]
- Outdated assumption: [something that changed]
- Suggestion: [how MD should be updated]

**Confidence:** [High/Medium/Low]
```

---

## Key Rules

- **PERMANENT STORAGE:** All feedback files are retained indefinitely
- **NEVER DELETE:** The Closer agent must NEVER delete `docs/agents/feedback/` folder
- **VERSION TRACKING:** Each feature cycle gets its own `run-N/` folder (incrementing number)
- **AGENT COVERAGE:** Every active agent must output feedback (even if just "no changes needed")
- **AUDIT TRAIL:** Complete history enables Agent Definition Optimizer to detect patterns and convergence

---

## Usage

### For Agents (During Phase 4)
1. Complete your Phase 4 work
2. Assess: Does your MD definition match what you actually did?
3. Output feedback to: `docs/agents/feedback/run-{N}/[YourName].md`
4. Include gaps, suggestions, confidence level

### For Agent Definition Optimizer (Track E)
1. Read all feedback from `docs/agents/feedback/run-{N}/`
2. Compare agent feedback vs. current `docs/agents/[Agent].md` files
3. Generate improvement suggestions in `docs/agents/agent-improvement-suggestions.md`
4. Calculate convergence rate (% text changed from previous run)
5. Pause if converged (<1% change for 5+ runs), resume if patterns shift

### For Claude Code
1. Review improvement suggestions periodically (async, non-critical)
2. Approve/reject updates
3. Apply approved changes to `docs/agents/[Agent].md` files
4. Log all updates in `docs/agents/update-history.md`

---

## Convergence Tracking

The Agent Definition Optimizer measures improvement over time:

| Run | TPPM Change | QA Mgr Change | UX/IA Change | Avg Change | Status |
|-----|-------------|---------------|--------------|------------|--------|
| 1→2 | 8% | 5% | 3% | 5.3% | Converging ✓ |
| 2→3 | 2% | 1% | 2% | 1.7% | Converging ✓ |
| 3→4 | 0.5% | 0.3% | 0.8% | 0.5% | **CONVERGED** (paused) |
| 4→5 | 0% | 0% | 0% | 0% | Dormant |
| (New feedback pattern detected) | — | — | — | — | **RESUMED** |

---

## Long-term Value

After 10+ features, this archive provides:
- Complete behavior history for each agent
- Data on how agent definitions evolve with experience
- Patterns in where definitions diverge from reality
- Confidence levels that compound (high-confidence feedback weighted more)
- Convergence detection preventing unnecessary optimization

**Result:** Agent profiles become increasingly accurate and valuable for future projects.
