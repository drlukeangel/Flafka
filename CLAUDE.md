# CLAUDE.md - Project Instructions

## Project Overview
Flink SQL Workspace UI - A React app connecting to Confluent Cloud's Flink SQL API.
Stack: React + TypeScript + Vite + Zustand + Monaco Editor + Axios

## Development Commands
- `npm run dev` - Start dev server (Vite with proxy to Confluent Cloud)
- `npm run build` - Production build
- `npm run lint` - ESLint

## Feature Implementation Workflow

When implementing features, ALWAYS follow this orchestration flow. NEVER skip steps.

### Phase A: DESIGN (Before ANY code is written)

#### A1. TECHNICAL PRD (Haiku subagent)
- Write a technical PRD for the feature to `docs/features/{feature-name}.md`
- PRD must include: Problem statement, proposed solution, files to modify, API changes, type changes, acceptance criteria, edge cases
- Keep it concise but complete - this is the implementation blueprint

#### A2. DESIGN REVIEW (2 Sonnet subagents in parallel)
Launch both reviewers simultaneously:

**Principal Architect Review:**
- Reviews: system design, state management impact, API contract changes, performance implications, separation of concerns
- Checks: does this fit the existing architecture? Any coupling risks? Scalability concerns?
- Output: APPROVE / NEEDS CHANGES with specific feedback

**Principal Engineer Review:**
- Reviews: implementation approach, code patterns, edge cases, error handling, type safety, testing strategy
- Checks: are we reusing existing code? Any simpler approach? Race conditions? Memory leaks?
- Output: APPROVE / NEEDS CHANGES with specific feedback

#### A3. REVISE (if needed)
- If either reviewer flags issues, launch a haiku agent to revise the PRD
- Re-review only the changed sections
- Loop until both reviewers approve

### Phase B: IMPLEMENT (After design approval)

#### B1. IMPLEMENT (Haiku subagents)
- Launch haiku subagents for each small task (1-3 files max per agent)
- Max 3 parallel impl agents at once
- Each agent gets: the PRD, exact file paths, what to change, acceptance criteria
- Agents work in isolation on non-overlapping files

#### B2. QA VALIDATE (Sonnet subagents)
- After impl agents complete, launch QA agents
- QA agents validate: UI renders correctly, API calls work as expected, edge cases from PRD handled
- QA agents READ code + use browser automation tools to verify
- QA agents document bugs as structured findings with severity

#### B3. FIX (Haiku subagents)
- For each bug found by QA, launch a fixer agent
- Fixer gets: the bug description, file path, expected vs actual behavior
- Re-QA after fixes if severity was high

#### B4. UX REVIEW (Sonnet subagent)
- After QA passes, launch UX review agent
- Reviews: consistency with existing UI, accessibility, polish, responsive behavior
- Documents UX issues as structured findings

#### B5. FIX UX (Haiku subagents)
- Fix any UX issues found

### Phase C: SHIP

#### C1. DOCS & COMMIT (Haiku subagent)
- Update the feature PRD in `docs/features/` with final implementation notes
- Update README if needed
- Stage and commit changes with descriptive message

### Key Rules
- **You (Opus) are the orchestrator** - supervise, don't implement directly
- **NEVER skip design review** - both architect and engineer must sign off before coding
- **Smallest possible tasks** for maximum parallelism
- **Never skip QA** - every feature gets validated
- **Fix bugs in real-time** - don't batch them
- **Document everything** - PRDs in `docs/features/`, audits in `docs/roadmap/`

## Architecture

### Key Files
| File | Purpose |
|------|---------|
| `src/store/workspaceStore.ts` | Zustand store - all app state and actions |
| `src/api/flink-api.ts` | Confluent Flink SQL API calls |
| `src/api/confluent-client.ts` | Axios HTTP client with Basic Auth |
| `src/components/EditorCell/EditorCell.tsx` | SQL editor cell with Monaco |
| `src/components/ResultsTable/ResultsTable.tsx` | Query results table |
| `src/components/TreeNavigator/TreeNavigator.tsx` | Sidebar tree of DB objects |
| `src/App.tsx` | Root layout shell |
| `src/types/index.ts` | TypeScript type definitions |
| `src/config/environment.ts` | Environment variable config |

### API Pattern
- All API calls go through Vite proxy at `/api/flink` → Confluent Cloud
- Auth: Basic Auth with `VITE_FLINK_API_KEY:VITE_FLINK_API_SECRET`
- Statement execution: POST → poll status → fetch results with cursor pagination
- Streaming: FIFO buffer of 5000 rows max, cursor-based long-polling

### Unused Code (Available for Reuse)
- `getTableSchema()` in `flink-api.ts:231` - DESCRIBE table, returns columns
- `listStatements()` in `flink-api.ts:149` - List all server statements
- `@tanstack/react-virtual` - In deps, not yet integrated
- `framer-motion` - In deps, not yet used
