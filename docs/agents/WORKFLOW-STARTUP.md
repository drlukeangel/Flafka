# Workflow Startup & Hand-Off Guide

**How to kick off and maintain continuous workflow execution**

---

## Getting Started

### Step 1: TPPM Kicks Off Phase 1

**When:** Feature PRD is complete and approved

**TPPM outputs:**
```
PRD SIGN-OFF APPROVED

Next: Launch Workflow Manager for run-1
```

### Step 2: Launch Workflow Manager

**Who:** Claude Code or automation system

**Action:**
```
Launch Workflow Manager for run-1
```

**What happens:**
```
WFM for run-1:
  ✅ Creates docs/agents/feedback/run-1/ folder
  ✅ Copies workflow-status-template.md → run-1/workflow-status.md
  ✅ Begins 60-second polling loop
  ✅ Monitors all Phase 1-5 activities
```

---

## Keeping It Running

### The 60-Second Heartbeat

**Every 60 seconds, WFM:**
1. Polls all active subagents for status
2. Reads feedback from `run-{N}/[AgentName].md` files
3. Validates all gate conditions
4. Updates `run-{N}/workflow-status.md`
5. Sleeps 60 seconds
6. Repeats

**This heartbeat = health check.** As long as WFM is polling every 60s, it's alive.

---

## The Hand-Off (Critical)

### When Closer Finishes (Phase 4 Track A)

**Closer writes:**
```
# Closer Feedback
Status: COMPLETE
Task: Artifacts cleaned, docs verified, code merged
Timestamp: 2026-03-01T15:30:00Z
```

### WFM for run-N Detects This

**WFM sees:**
- Closer status = COMPLETE
- Phase 4 Track A = FINISHED

**WFM immediately:**
1. ✅ Spawns Workflow Manager for run-{N+1}
2. ✅ New WFM creates run-{N+1}/ folder
3. ✅ New WFM starts independent 60s polling
4. ✅ Current WFM notes in status file: "Handed off to run-{N+1}"

### WFM for run-N Still Running

**While Closer is done, async tracks continue:**
- Track B: Flink Developer (stress test)
- Track C: Test Completion (Tier 2 tests)
- Track D: Interview Analyst (customer interviews)
- Track E: Agent Definition Optimizer (agent profiles)

**WFM waits** for all B, C, D, E to finish polling every 60s

### When All Async Tracks Done

**WFM for run-N sees:**
- run-{N}/FLINK-DEVELOPER.md = COMPLETE
- run-{N}/TEST-COMPLETION.md = COMPLETE
- run-{N}/INTERVIEW-ANALYST.md = COMPLETE
- run-{N}/AGENT-DEFINITION-OPTIMIZER.md = COMPLETE

**WFM for run-N:**
```
1. Logs final summary to run-{N}/workflow-status.md
2. Outputs: "Workflow run-{N} COMPLETE. All async tracks finished. Handing to run-{N+1}. Terminating."
3. EXITS CLEANLY (loop terminates)
```

**Meanwhile, run-{N+1} Workflow Manager:**
- Already running for several hours (since Closer finished)
- Has fresh context (no bloat)
- Continues Phase 1-5 for next feature
- Will hand off to run-{N+2} when its Closer finishes

---

## The Result

```
Timeline:

T=0:00     WFM run-1 launched (Phase 1 starts)
T=0:01     Polling begins every 60s
T=8:30     Closer finishes (Phase 4 Track A done)
           → WFM run-1 SPAWNS WFM run-2
           → WFM run-2 starts (fresh context)
           → run-1 status: "Waiting for async tracks"
T=15:00    Flink Developer finishes (Track B done)
T=16:30    Test Completion finishes (Track C done)
T=18:00    Interview Analyst finishes (Track D done)
T=19:30    Agent Definition Optimizer finishes (Track E done)
           → WFM run-1 sees all async done
           → WFM run-1 logs final status
           → WFM run-1 TERMINATES
T=20:00    WFM run-2 continues independently
           (now ~11.5 hours into its own Phase 1-5 cycle)
           Will hand off to WFM run-3 when ITS Closer finishes
```

**No gaps. No bloat. Clean hand-off.**

---

## Troubleshooting

### "WFM stopped responding"
- Check `run-{N}/workflow-status.md` — Last Updated timestamp > 120 seconds old?
- If yes, WFM crashed
- **Action:** Manually launch WFM for same run-{N} again (it will resume from current state)

### "WFM created run-{N+1} but never finished run-{N}"
- Async tracks (B, C, D, E) still running
- This is normal — WFM waits for them to finish before exiting
- **Action:** Monitor `run-{N}/workflow-status.md` "Running Agents" section until all show COMPLETE

### "Two WFMs running for different runs"
- This is expected during hand-off
- run-{N} WFM waiting for async tracks
- run-{N+1} WFM running Phase 1-5
- **Action:** Let them both run. run-{N} will exit once async done.

---

## Key Rules

✅ **WFM runs ONE feature per instance** — Not forever
✅ **Hand-off triggers on Closer finish** — Not manual
✅ **New WFM spawned with fresh context** — No bloat
✅ **Old WFM waits for async completion** — Clean exit
✅ **60-second polling = heartbeat** — Constant health check
✅ **Status file always current** — Every 60s update
