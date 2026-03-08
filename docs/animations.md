# Animation Architecture Guide

> How Learn Center animations are built, wired, and extended.

---

## Overview

Every example card and concept lesson in the Learn Center can display an animated hero graphic. There are two separate surfaces:

| Surface | Location | Driven by |
|---------|----------|-----------|
| **Concept lesson animation** | `ConceptAnimation.tsx` router | `ANIMATION_MAP` record |
| **Example card animation** | `ExampleDetailPage.tsx` | `EXAMPLE_ANIMATION` record |

Both surfaces render the same set of animation components. The only difference is how they're addressed: concept lessons use the animation type directly (e.g., `'tumble-window'`); example cards map their card ID to an animation type.

---

## Component Anatomy

All animation components live in:

```
src/components/LearnPanel/animations/
```

A typical animation component follows this structure:

```typescript
// 1. Constants
const TICK_MS = 50;
const PHASE_TICKS = 26;   // 1.3s per phase
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

// 2. Semantic color constants
const PRIMARY_COLOR = '#3b82f6';

// 3. Event/data definitions (static arrays)
const EVENTS = [...];

// 4. Phase status strings (one per phase)
const PHASE_STATUS = ['Phase 0 description', ...];

// 5. Easing helper (copy exactly — do not import)
function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// 6. Geometry helpers (timeToX, laneY, etc.)

// 7. Component
export function MyAnimation() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((prev) => (prev + 1) % CYCLE_TICKS);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Derive all state from phase + phaseProgress (no additional useState)
  const isXVisible = phase >= 2;
  const xProgress = phase === 2 ? eased : phase > 2 ? 1 : 0;

  return (
    <div className="concept-animation">
      <h4>...</h4>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}>
        {/* ... SVG content ... */}

        {/* Status bar (always at bottom, standard layout) */}
        <rect x="0" y="255" width="560" height="40" fill="rgba(255,255,255,0.025)" />
        {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
          <circle key={i} cx={200 + i * 20} cy={265}
            r={i === phase ? 4 : 2.5}
            fill={i === phase ? 'var(--color-accent, #3b82f6)' : 'var(--color-text-primary)'}
            opacity={i === phase ? 0.9 : 0.25} />
        ))}
        <text x="280" y="284" textAnchor="middle" fontSize="10"
          fill="var(--color-text-primary)" opacity={0.7} fontStyle="italic">
          {PHASE_STATUS[phase]}
        </text>
      </svg>

      {/* HTML legend below SVG */}
    </div>
  );
}
```

---

## Timing Model

```
TICK_MS = 50          → setInterval fires every 50ms
PHASE_TICKS = 26      → 26 × 50ms = 1.3 seconds per phase
TOTAL_PHASES = 8      → 8 phases × 1.3s = 10.4 second total cycle
CYCLE_TICKS = 208     → tick wraps at 208 back to 0
```

Derived per-render:
```typescript
const phase = Math.floor(tick / PHASE_TICKS);         // 0–7
const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS; // 0.0–1.0
const eased = easeInOutCubic(phaseProgress);           // 0.0–1.0, smooth
```

**Rule:** All visual state must be derived from `phase` and `phaseProgress`. Do not add extra `useState` for things that can be computed.

---

## SVG Conventions

| Property | Value |
|----------|-------|
| `viewBox` | `"0 0 560 320"` (560×280 for simpler animations) |
| `style` | `{ width: '100%', height: 'auto' }` |
| Timeline Y | ~60–70px from top |
| Status bar | Y=255, height=40 |
| Phase dots | `cx={200 + i*20} cy={265}` |
| Status text | `y={284}` |

**Color tokens** (use CSS variables for theme compatibility):
```
var(--color-text-primary)   — labels, axes
var(--color-text-secondary) — secondary labels
var(--color-accent, #3b82f6) — phase indicator, highlights
var(--color-surface)        — backgrounds
var(--color-border)         — dividers
```

**Semantic colors** (define as constants in each file):
```
Blue:   #3b82f6  — general windows, W1
Green:  #10b981  — accepted/ok states, W2
Amber:  #f59e0b  — W3, warnings
Orange: #f97316  — session windows, S1
Teal:   #14b8a6  — session windows, S2
Indigo: #6366f1  — insights, highlights
Red:    #ef4444  — late events, errors, resets
```

---

## Phase Design Principles

A well-designed 8-phase animation follows this arc:

| Phase | Purpose |
|-------|---------|
| 0 | Setup — show the empty stage, config labels, establish the visual metaphor |
| 1–2 | First data arrives, window/state opens |
| 3 | Critical moment — threshold crossed, gap exceeded, overlap detected |
| 4 | State change fires (window closes, reset, flash) |
| 5–6 | Second cycle begins — same concept, different data |
| 7 | Insight callout — the "aha moment" in one sentence |

Minimum quality bar for "excellent":
- 8 phases with meaningful transitions
- Phase progress dots at bottom
- Status text that explains each phase in plain English
- Glow/flash animation on key state changes
- HTML legend below the SVG
- `aria-label` on the `<svg>` element describing the full animation for screen readers

---

## Adding a New Animation Component

### Step 1: Create the file

```bash
src/components/LearnPanel/animations/MyConceptAnimation.tsx
```

Use `HopWindowAnimation.tsx` as the reference template (8 phases, clean phase derivation, legend).

### Step 2: Export the component

The component must be a named export matching the file name convention:
```typescript
export function MyConceptAnimation() { ... }
```

### Step 3: Wire into ConceptAnimation.tsx

```typescript
// 1. Add import at the top
import { MyConceptAnimation } from './MyConceptAnimation';

// 2. Add to ANIMATION_MAP
const ANIMATION_MAP: Record<string, React.FC> = {
  ...
  'my-concept': MyConceptAnimation,
};
```

The key (`'my-concept'`) must match a value in the `ConceptAnimationType` union in `src/types/learn.ts` if it's a new type.

### Step 4: Add to example cards (if needed)

In `src/components/ExampleDetailView/ExampleDetailPage.tsx`:
```typescript
const EXAMPLE_ANIMATION: Record<string, ConceptAnimationType> = {
  ...
  'my-example-card-id': 'my-concept',
};
```

---

## Adding an Animation to an Existing Example Card

If the concept already has an animation component, you only need Step 4 above:

```typescript
// ExampleDetailPage.tsx
'loan-my-new-example': 'tumble-window',  // reuse existing animation
```

Any of the 15 animation types can be reused for any example card.

---

## Animation Type Reference

| Type | Component | Concept |
|------|-----------|---------|
| `flink-basics` | `FlinkBasicsAnimation` | SQL transformations, filtering, simple streaming |
| `kafka-basics` | `KafkaBasicsAnimation` | Topics, producers, consumers, partitions |
| `consumer-groups` | `ConsumerGroupsAnimation` | Partition assignment, group rebalancing |
| `changelog-modes` | `ChangelogModesAnimation` | Append, retract, upsert changelog semantics |
| `watermark` | `WatermarkAnimation` | Event time, watermark advancement, late events |
| `join-match` | `JoinAnimation` | Stream-stream joins, interval joins, temporal joins |
| `state-accumulate` | `StateAnimation` | Stateful aggregation, running totals, rankings |
| `tumble-window` | `TumbleWindowAnimation` | Fixed non-overlapping time windows |
| `hop-window` | `HopWindowAnimation` | Sliding overlapping windows, multi-window membership |
| `session-window` | `SessionWindowAnimation` | Activity-gap-based dynamic windows |
| `cumulate-window` | `CumulateWindowAnimation` | Growing partial results within a max window |
| `streams-vs-tables` | `StreamsVsTablesAnimation` | Duality: streams as changelog of tables |
| `confluent-architecture` | `ConfluentArchitectureAnimation` | Confluent Cloud platform components |
| `schema-governance` | `SchemaGovernanceAnimation` | Schema Registry, evolution, compatibility |
| `startup-modes` | `StartupModesAnimation` | EARLIEST, LATEST, FROM_TIMESTAMP startup modes |

---

## Common Patterns

### Staggered event arrival
```typescript
// Phase 1: events arrive staggered across the phase
const delay = i * 0.25;
const localP = Math.max(0, Math.min((phaseProgress - delay) * 1.8, 1));
const localEased = easeInOutCubic(localP);
```

### Flash on state change
```typescript
// Flash fades out over the phase
const closeFlash = isClosing ? (1 - eased) * 0.55 : 0;
// Apply as fillOpacity on a rect overlay
```

### Arrival glow (pulse on new event)
```typescript
const isJustArrived = phase === arrivalPhase && phaseProgress < 0.45;
const r = isJustArrived ? 7 + (0.45 - phaseProgress) * 10 : 7;
```

### Insight callout (phase 7 pattern)
```typescript
const insightOpacity = phase === 7
  ? 0.7 + 0.3 * Math.sin(phaseProgress * Math.PI * 2)
  : 0;

{phase === 7 && (
  <g opacity={insightOpacity}>
    <rect x="55" y="165" width="450" height="30" rx="6"
      fill="rgba(99,102,241,0.08)" stroke="#6366f1" strokeWidth="1" />
    <text x="280" y="184" textAnchor="middle" fontSize="10" fontWeight="600"
      fill="#6366f1">
      The "aha moment" in one sentence.
    </text>
  </g>
)}
```

### Result pill emit
```typescript
const resultProgress = phase === emitPhase
  ? easeInOutCubic(Math.max(0, (phaseProgress - 0.4) * 1.7))
  : phase > emitPhase ? 1 : 0;

{resultProgress > 0 && (
  <g opacity={resultProgress}>
    <rect x={rx} y={ry} width={rw} height={rh} rx="10"
      fill={color} fillOpacity={0.12}
      stroke={color} strokeWidth={1.2} />
    <text x={rx + rw/2} y={ry + rh/2 + 4}
      textAnchor="middle" fontSize="7.5" fontWeight="600" fill={color}>
      count=5, sum=$28k
    </text>
  </g>
)}
```
