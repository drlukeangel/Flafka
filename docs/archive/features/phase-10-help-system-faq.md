# Phase 10: In-App Help System & FAQ/HowTo

## Overview
Build an in-app Help system that:
1. Displays user-friendly FAQ/HowTo guides covering both UI features and Flink SQL domain knowledge
2. Searchable help UI accessible from app header (replaces existing keyboard shortcuts modal)
3. Contextual "?" help icons on high-value features (autocomplete, results table, history panel)
4. Backfill existing features (Phases 0-9) with comprehensive FAQ/HowTo content

## Problem Statement
- Users have only technical feature PRDs to learn from—no beginner-friendly guides
- Onboarding is steep; no in-app help increases support burden
- **Critical gap**: No Flink SQL domain knowledge (watermark delays, cardinality explosions, streaming semantics) documented anywhere
- Users confuse Flink SQL concepts (PROCTIME vs ROWTIME, windowed vs unwindowed JOINs, changelog semantics)
- Known limitations (autocomplete restrictions, 5000-row buffer cap) not explained to users
- Feature discovery is low for powerful features (autocomplete, keyboard navigation, insert-at-cursor)

## Proposed Solution

### User Experience
- **Help Icon** in top-right header (opens full-screen Help Panel centered overlay)
- **Search bar** searches FAQ by title, keywords, and content
- **Category tabs**: UI Features (Editor, Results, Sidebar, Keyboard Shortcuts) + **Flink SQL Concepts** + **Troubleshooting** + **Tips & Tricks**
- **Contextual Help**: "?" icons on autocomplete, results table, and history panel link directly to relevant FAQ section
- **Dark/Light mode**: Uses CSS custom properties for themeable colors
- **Copy code examples**: FAQ code snippets are easily copyable to clipboard

### Technical Implementation

**Files to Create:**
- `src/components/HelpPanel/HelpPanel.tsx` - Main help UI component with search and category tabs
- `src/data/helpTopics.ts` - Static typed FAQ data array (no Zustand store)
- `src/components/HelpPanel/types.ts` - HelpTopic and related types (local to Help system, not global)
- `docs/faqs/` - Source markdown files for FAQ authorship (documentation only, not runtime)

**Files to Modify:**
- `src/App.tsx` - Remove existing help modal (lines 404-429), add new HelpPanel component and trigger button, add `helpPanelOpen` and `helpTopicId` state
- `src/index.css` - Help panel overlay and animation styles (dark/light mode CSS vars)
- `src/store/workspaceStore.ts` - Exclude FAQ data from localStorage `partialize` (if any future state added)

**Data Structure:**
```typescript
interface HelpTopic {
  id: string;
  title: string;
  category: 'editor' | 'results' | 'sidebar' | 'keyboard-shortcuts' | 'flink-sql' | 'troubleshooting' | 'tips';
  content: ContentSection[]; // Structured, NOT markdown
  relatedTopicIds: string[];
  keywords: string[];
  sortOrder: number;
}

interface ContentSection {
  type: 'heading' | 'paragraph' | 'code-block' | 'list' | 'list-item';
  text: string;
}
```

**Help Panel Features:**
1. **Search bar** - real-time filtering by title/keywords (case-insensitive)
2. **Category tabs** - UI Features, Flink SQL, Troubleshooting, Tips & Tricks
3. **Inline code rendering** - Bold, `code` blocks, bullet lists rendered as JSX
4. **Copy to clipboard** - Code examples trigger toast on successful copy
5. **Focus management** - `autoFocus` on search input, focus trap (Tab cycling), focus restoration on close
6. **Keyboard shortcut** - `?` key opens panel, `Escape` closes it

### Acceptance Criteria
- [ ] Help Panel opens/closes with fade + slide animation
- [ ] Existing help modal (lines 404-429 in App.tsx) is **removed and replaced**
- [ ] Search filters FAQs real-time by title, keywords, content keywords
- [ ] Dark mode: All colors use CSS custom properties, readable contrast (test both themes visually)
- [ ] Light mode: Proper contrast, consistent with existing app palette
- [ ] Focus management: `autoFocus` on search, Tab-trap within panel, focus returns to button on close
- [ ] Contextual help: "?" icons on EditorCell (autocomplete link), ResultsTable (buffer cap link), HistoryPanel (50-statement limit link)
- [ ] Keyboard nav: Tab/Shift+Tab, Escape to close, Enter to click links
- [ ] All Phases 0-9 features have UI-feature FAQ entries
- [ ] **Domain knowledge**: Cardinality explosion, watermark delays, streaming vs batch, changelog semantics, PROCTIME vs ROWTIME FAQs
- [ ] **Troubleshooting**: "Why do my results stop updating?" and "Why are column suggestions wrong?" FAQs
- [ ] Copy code: Code examples copy to clipboard with success toast
- [ ] Accessibility: aria-labels on buttons, aria-modal on overlay, semantic HTML

---

## FAQ Content Strategy

### Must-Have (High Domain Value, Ship-Critical)

**UI Features (Backfill Phases 0-9):**
- How do I resize SQL editor cells?
- How do I use the keyboard shortcuts? (move to Keyboard Shortcuts tab)
- How do I autocomplete SQL? (explain sidebar click limitation)
- How do I view query results and understand the table?
- How do I rerun previous statements from history?
- And one FAQ per major feature from Phases 0-9

**Flink SQL Concepts (Domain Knowledge - Critical):**
1. **Why is my JOIN producing millions of rows or running out of memory?**
   - Explain: Unwindowed JOINs on unbounded streams cause cardinality explosion
   - Solution: Use TUMBLE/HOP windows to bound the join key
   - Example: `SELECT * FROM left JOIN right ON left.id = right.id` (bad) vs windowed (good)

2. **Why do my event-time aggregation results appear delayed?**
   - Explain: Watermark lag - results wait for data to arrive from all partitions
   - Show: How to check current watermark with `CURRENT_WATERMARK()` or check compute pool logs
   - Clarify: This is expected behavior, not a bug

3. **Why does `SELECT *` never finish?**
   - Explain: Streaming mode vs batch mode—SELECT without LIMIT runs forever waiting for new data
   - Clarify: This workspace runs in streaming mode (default for Confluent Cloud Flink)
   - Example: Add `LIMIT 10` to see results immediately, or `LIMIT 1` for first result

4. **What's the difference between ROWTIME and PROCTIME?**
   - PROCTIME: Wall-clock time when row is processed (NOW())—fast, always advances
   - ROWTIME: Event timestamp embedded in Kafka message—correct for historical data, may lag
   - When to use: ROWTIME for event-time processing (correctness), PROCTIME for monitoring (low latency)
   - Example: `TUMBLE(rowtime_col, INTERVAL '1' MINUTE)` for event-time windows

5. **Why do my aggregation results show duplicate rows with different values?**
   - Explain: Streaming aggregations output changelog rows (retract old result, emit new result)
   - Clarify: This is not a bug—it's how streaming SQL communicates incremental changes
   - Example: GROUP BY shows each group key with its running total, updates show as new rows

### Should-Have (Adds Significant Value, Pre-Ship if Possible)

**Flink SQL Reference:**
- Window functions: TUMBLE, HOP, CUMULATE with SQL examples (copy-paste ready)
- Temporal JOINs (FOR SYSTEM_TIME AS OF) for dimension table enrichment patterns
- Common patterns: Deduplication, top-N, session windows with code
- Performance tips: Use EXPLAIN to understand query plans

**Troubleshooting (Second Tier):**
- "What does 'Compute pool is full' mean?"
  - Answer: Your account's Flink compute pool is at capacity. Long-running statements may queue. Check compute pool usage in header.

**Tips & Tricks:**
- Use keyboard shortcuts (Ctrl+Enter to run, Escape to cancel, Ctrl+Alt+Up/Down for navigation)
- Paste full query into a new cell with Ctrl+Alt+Down instead of typing
- Check query plan with EXPLAIN before running complex joins
- Save workspace frequently (auto-saved to browser)
- Use history panel to re-run similar queries quickly

### Nice-to-Have (Future Iteration)
- Links to Apache Flink docs and Confluent docs (footer "Learn More" link)
- EXPLAIN output interpretation guide
- Performance debugging tips for slow queries

---

## Implementation Plan

### Phase 10.1: Core Help System UI + High-Value Contextual Help
**Goal**: Build searchable Help Panel, replace existing modal, add "?" to top 3 features

**Tasks:**
1. Create `HelpPanel.tsx` component (search bar, category tabs, content rendering, animations)
2. Create `src/data/helpTopics.ts` with static FAQ data (structured, NOT markdown strings)
3. Create `src/components/HelpPanel/types.ts` with HelpTopic interface
4. Modify `App.tsx`:
   - Remove existing help modal overlay (lines 404-429)
   - Add `helpPanelOpen: boolean` and `helpTopicId: string | null` to local state
   - Render `<HelpPanel>` component
   - Wire up `?` key handler to toggle panel
5. Add styles to `src/index.css` for Help Panel overlay, animations, dark/light modes
6. Add "?" contextual icons to:
   - EditorCell (near autocomplete area) → links to "How do I autocomplete SQL?"
   - ResultsTable header → links to "Why do my results stop updating?"
   - HistoryPanel header → links to "How do I rerun previous statements?"
7. Implement focus management: autoFocus on search, focus trap, focus restoration

### Phase 10.2: FAQ Data Migration (Backfill)
**Goal**: Convert Phases 0-9 feature PRDs + domain knowledge → comprehensive FAQ entries

**Must-Have Content (blocks ship):**
- 5 Flink SQL concept FAQs (cardinality, watermark, streaming vs batch, PROCTIME, changelog)
- 2 troubleshooting FAQs (results buffer, autocomplete limitation)
- 1 FAQ per major UI feature from Phases 0-9 (15-20 total UI FAQs)

**Should-Have Content (pre-ship if time):**
- Window function reference (TUMBLE, HOP, CUMULATE examples)
- Compute pool FAQ
- 3-5 Tips & Tricks entries

**Process:**
- Create `docs/faqs/ui-features.md`, `docs/faqs/flink-sql-concepts.md`, `docs/faqs/troubleshooting.md` as source files
- Convert each into typed entries in `src/data/helpTopics.ts`
- Verify all entries are copy-pasteable in code snippets
- Verify all keywords/tags are searchable

### Phase 10.3: Full Contextual Help + Remaining Content (Future)
**Goal**: Add "?" to remaining features, complete FAQ backfill, add "Learn More" links

**Future additions:**
- "?" icons on all major components with links to their FAQ
- Full Flink SQL reference section
- Links to external Confluent/Apache Flink docs
- Search highlighting

---

## Edge Cases
- Empty search results → show "No results found" message with suggestion to browse categories
- User presses `?` while panel is open → close it (toggle)
- User clicks a related topic link → panel scrolls to that topic, highlights it briefly
- Focus trap: Tab at end of items wraps to search, Shift+Tab at start wraps to button
- Very long content → scrollable container with sticky header, code blocks scrollable horizontally

## Testing Strategy
- Marker: `@help-system` for Help Panel component tests (open/close, animations)
- Marker: `@help-search` for search filtering tests (keywords, case-insensitivity)
- Marker: `@help-focus` for focus management tests (autoFocus, trap, restore)
- Marker: `@help-contextual` for contextual help link tests
- Marker: `@faq-content-{category}` for per-category FAQ content tests
- Search tests: keyword matching, multi-word queries, edge cases (empty string, special chars)
- Keyboard tests: `?` shortcut, Escape closes, Tab navigation, link activation
- Theme tests: Dark mode visually correct (test in browser B2 step), light mode contrast verified
- Copy-to-clipboard: Code blocks copy correctly, toast appears
- Accessibility: Tab order correct, aria-labels present, screen reader friendly
- Note: Browser theme testing (dark/light) is handled in B5/B6 UX review + B2 browser test

## Implementation Notes

**localStorage consideration:**
- FAQ data is static and should NOT be persisted to localStorage
- If any help state is added to workspaceStore, exclude from `partialize` to avoid stale cached FAQs

**No new markdown dependency:**
- Content stored as structured TypeScript objects (heading, paragraph, code-block, list types)
- Inline JSX renderer (no `react-markdown` library needed)
- Simplifies implementation, avoids broken markdown edge case

**Replaces existing modal:**
- The current `help-modal-overlay` block (App.tsx lines 404-429) is **removed entirely**
- Its content (keyboard shortcuts) becomes one category tab in the new Help Panel
- The `?` key handler on line 143 remains and now toggles the new HelpPanel

**No Zustand store for help:**
- Panel open/close is local `useState` in App.tsx (like `showHistory`, `showSettings`)
- FAQ data is a static module-level constant in `helpTopics.ts`
- Search query is local `useState` inside HelpPanel component
- This keeps the architecture simple and avoids unnecessary state replication

**Phase 10.3 ready:**
- HelpPanel accepts `activeTopicId?: string` prop from App.tsx
- On mount with `activeTopicId`, panel scrolls to that topic
- Implementation: `helpTopicId` state in App.tsx, pass to HelpPanel
- No store needed—props-based approach is simpler

---

## Success Metrics
- Users find answers in-app without opening external docs
- Onboarding friction reduced (domain knowledge available on day 1)
- Autocomplete discovery increases (FAQ explains hidden limitation + how to use)
- Support questions about streaming semantics drop (watermark, changelog, cardinality FAQs available)
- All Phases 0-9 features documented + searchable
- Help Panel accessible in <100ms (search, open/close)
- Focus management verified by QA (no focus traps, no focus loss)
