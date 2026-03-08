import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const INPUT_COLOR = '#3b82f6';
const OUTPUT_COLOR = '#10b981';
const BRACKET_COLOR = '#f59e0b';
const UNNEST_COLOR = '#6366f1';

interface ArrayExample {
  loanId: string;
  elements: string[];
}

const EXAMPLES: ArrayExample[] = [
  { loanId: 'L-001', elements: ['Alice', 'Bob', 'Carol'] },
  { loanId: 'L-002', elements: ['Dave', 'Eve'] },
  { loanId: 'L-003', elements: ['Frank', 'Grace', 'Hank', 'Ivy'] },
];

// Phase → which example is active
// 0: setup  1: slide+bracket  2: stagger  3: HOLD
// 4: L-002 slide+stagger  5: L-002 HOLD
// 6: L-003 slide+stagger  7: L-003 HOLD + insight
const PHASE_EXAMPLE = [0, 0, 0, 0, 1, 1, 2, 2];

const PHASE_STATUS: string[] = [
  'One wide row — coborrower_names ARRAY hides multiple people',
  'L-001 arrives: coborrower_names = [Alice, Bob, Carol]',
  'CROSS JOIN UNNEST fires — 3 output rows emerge',
  '1 wide row → 3 slim rows, each with the same loan_id',
  'L-002: [Dave, Eve] slides in — UNNEST fires 2 rows',
  '1 row → 2 rows, same loan_id for both borrowers',
  'L-003: [Frank, Grace, Hank, Ivy] — 4 co-borrowers',
  'CROSS JOIN UNNEST: 1 input row → N output rows per element',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArrayUnnestAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  const exIdx = PHASE_EXAMPLE[phase];
  const example = EXAMPLES[exIdx];
  const n = example.elements.length;

  const inputRowStartX = 30;
  const inputRowWidth = 500;
  const inputRowY = 38;
  const inputRowH = 30;
  const outputBaseY = 110;
  const outputRowGap = 30;

  // ── Input row slide-in ──
  // Phase 1: full smooth slide (L-001)
  // Phase 4: fast slide first 55% of phase (L-002)
  // Phase 6: fast slide first 55% of phase (L-003)
  const inputX =
    phase === 1 ? inputRowStartX - inputRowWidth * (1 - eased) :
    phase === 4 ? inputRowStartX - inputRowWidth * (1 - Math.min(eased / 0.55, 1)) :
    phase === 6 ? inputRowStartX - inputRowWidth * (1 - Math.min(eased / 0.55, 1)) :
    phase === 0 ? -inputRowWidth + 50 : // peeking at far left in phase 0
    inputRowStartX;
  const inputOpacity = phase === 0 ? 0.35 : 1;

  // ── Bracket spread ──
  // Phase 1: animates open with the slide
  // Phase 4/6: opens in first 50% of phase
  const bracketSpread =
    phase === 1 ? eased :
    phase === 4 ? Math.min(eased / 0.5, 1) :
    phase === 6 ? Math.min(eased / 0.5, 1) :
    phase > 1 ? 1 : 0;

  const bracketActive = phase === 1 || phase === 4 || phase === 6;

  // ── Output rows ──
  // Phase 2: full stagger for L-001 (3 rows)
  // Phase 3: HOLD — all L-001 rows fully visible
  // Phase 4: stagger starts at 55% of phase for L-002 (2 rows)
  // Phase 5: HOLD — L-002 fully visible
  // Phase 6: stagger starts at 55% for L-003 (4 rows)
  // Phase 7: HOLD — L-003 fully visible
  const isHold = phase === 3 || phase === 5 || phase === 7;
  const isStagger2 = phase === 2;
  const isStagger46 = phase === 4 || phase === 6;

  const outputRows = example.elements.map((name, i) => {
    const finalY = outputBaseY + i * outputRowGap;
    let opacity = 0;
    let y = finalY;

    if (isHold) {
      // Static, fully visible — this is the "hold" the user can read
      opacity = 1;
    } else if (isStagger2) {
      // Full-phase stagger: each row delays proportionally
      const delay = i / (n * 2.2);
      const rowP = Math.max(0, (phaseProgress - delay) / (1 - delay));
      opacity = easeInOutCubic(rowP);
      y = finalY - (1 - opacity) * 18;
    } else if (isStagger46) {
      // Stagger starts after slide finishes (~55% into phase)
      const start = 0.55;
      const adjusted = Math.max(0, (phaseProgress - start) / (1 - start));
      const delay = i / (n * 2.2);
      const rowP = Math.max(0, (adjusted - delay) / (1 - delay));
      opacity = easeInOutCubic(rowP);
      y = finalY - (1 - opacity) * 18;
    }

    return { name, opacity, y };
  });

  // ── UNNEST box glow ──
  const unnestGlow = phase === 2 || phase === 4 || phase === 6;

  // ── Insight ──
  const insightOpacity = phase === 7 ? eased : 0;

  // Arrow visibility
  const arrowOpacity = phase >= 1 ? 0.5 : 0.2;

  const UNNEST_X = 200;
  const UNNEST_Y = 75;

  const arrayText = bracketSpread > 0.4
    ? `[ ${example.elements.join('  ·  ')} ]`
    : `[${example.elements.join(', ')}]`;

  // Counter badge for hold phases
  const showBadge = isHold;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="CROSS JOIN UNNEST animation — one input row with an array column explodes into multiple output rows">
        <defs>
          <filter id="aun-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="aun-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={UNNEST_COLOR} opacity="0.6" />
          </marker>
        </defs>

        {/* ── CROSS JOIN UNNEST label ── */}
        <rect x="150" y="6" width="260" height="22" rx="5"
          fill={UNNEST_COLOR} fillOpacity={0.1}
          stroke={UNNEST_COLOR} strokeWidth="1" />
        <text x="280" y="21" textAnchor="middle" fontSize="10" fontWeight="700"
          fontFamily="monospace" fill={UNNEST_COLOR}>
          CROSS JOIN UNNEST(coborrower_names)
        </text>

        {/* ── INPUT ROW ── */}
        <g opacity={inputOpacity}>
          <rect x={inputX} y={inputRowY} width={inputRowWidth} height={inputRowH} rx="5"
            fill={INPUT_COLOR} fillOpacity={0.1} stroke={INPUT_COLOR} strokeWidth="1.5" />
          {/* loan_id cell */}
          <rect x={inputX} y={inputRowY} width={80} height={inputRowH} rx="4"
            fill={INPUT_COLOR} fillOpacity={0.18} />
          <text x={inputX + 40} y={inputRowY + 20} textAnchor="middle" fontSize="10"
            fontWeight="700" fontFamily="monospace" fill={INPUT_COLOR}>
            {example.loanId}
          </text>
          <line x1={inputX + 80} y1={inputRowY} x2={inputX + 80} y2={inputRowY + inputRowH}
            stroke={INPUT_COLOR} strokeWidth="1" opacity={0.35} />
          {/* array cell */}
          <text x={inputX + 90} y={inputRowY + 11} fontSize="9"
            fill="var(--color-text-primary)" opacity={0.5} fontFamily="monospace">
            coborrower_names:
          </text>
          <text x={inputX + 90} y={inputRowY + 24} fontSize="9.5"
            fontFamily="monospace" fontWeight="600"
            fill={bracketActive ? BRACKET_COLOR : 'var(--color-text-primary)'}
            opacity={bracketActive ? 1 : 0.8}>
            {arrayText}
          </text>
        </g>

        {/* ── UNNEST BOX ── */}
        <rect x={UNNEST_X} y={UNNEST_Y} width="160" height="26" rx="5"
          fill={UNNEST_COLOR} fillOpacity={0.12}
          stroke={UNNEST_COLOR} strokeWidth="1.5"
          filter={unnestGlow ? 'url(#aun-glow)' : undefined} />
        <text x={UNNEST_X + 80} y={UNNEST_Y + 17} textAnchor="middle" fontSize="10"
          fontWeight="700" fill={UNNEST_COLOR}>
          UNNEST
        </text>

        {/* ── ARROW: input → unnest ── */}
        <line x1="280" y1={inputRowY + inputRowH} x2="280" y2={UNNEST_Y}
          stroke={UNNEST_COLOR} strokeWidth="1.5" opacity={arrowOpacity}
          markerEnd="url(#aun-arr)" />

        {/* ── OUTPUT ROWS ── */}
        {outputRows.map((row, i) => (
          <g key={`out-${i}`} opacity={row.opacity}>
            {/* Fan-out line from unnest */}
            <line x1="280" y1={UNNEST_Y + 26} x2={90 + i * 8} y2={row.y + 12}
              stroke={OUTPUT_COLOR} strokeWidth="1" opacity={0.25} />
            <rect x="50" y={row.y} width="460" height={outputRowGap - 6} rx="4"
              fill={OUTPUT_COLOR} fillOpacity={0.08}
              stroke={OUTPUT_COLOR} strokeWidth="1.2" />
            {/* loan_id */}
            <rect x="50" y={row.y} width="72" height={outputRowGap - 6} rx="4"
              fill={OUTPUT_COLOR} fillOpacity={0.18} />
            <text x="86" y={row.y + 16} textAnchor="middle" fontSize="9.5"
              fontWeight="700" fontFamily="monospace" fill={OUTPUT_COLOR}>
              {example.loanId}
            </text>
            <line x1="122" y1={row.y} x2="122" y2={row.y + outputRowGap - 6}
              stroke={OUTPUT_COLOR} strokeWidth="1" opacity={0.25} />
            {/* element name */}
            <text x="142" y={row.y + 16} fontSize="9.5"
              fontFamily="monospace" fontWeight="600"
              fill="var(--color-text-primary)" opacity={0.9}>
              {row.name}
            </text>
            {/* row indicator */}
            <text x="502" y={row.y + 16} textAnchor="end" fontSize="8"
              fill={OUTPUT_COLOR} opacity={0.6} fontFamily="monospace">
              row {i + 1}/{n}
            </text>
          </g>
        ))}

        {/* ── HOLD badge (1 in → N out) ── */}
        {showBadge && (
          <g opacity={eased}>
            <rect x="190" y="225" width="180" height="22" rx="6"
              fill={OUTPUT_COLOR} fillOpacity={0.12}
              stroke={OUTPUT_COLOR} strokeWidth="1" />
            <text x="280" y="240" textAnchor="middle" fontSize="9.5" fontWeight="700"
              fill={OUTPUT_COLOR}>
              1 row in → {n} rows out
            </text>
          </g>
        )}

        {/* ── PHASE 7: insight ── */}
        {phase === 7 && insightOpacity > 0.3 && (
          <g opacity={Math.max(0, insightOpacity - 0.3)}>
            <rect x="45" y="252" width="470" height="0" rx="0" fill="none" />
          </g>
        )}

        {/* ── STATUS BAR ── */}
        <rect x="0" y="255" width="560" height="40" fill="rgba(255,255,255,0.025)" />
        {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
          <circle key={i} cx={200 + i * 20} cy={265}
            r={i === phase ? 4 : 2.5}
            fill={i === phase ? '#3b82f6' : 'var(--color-text-primary)'}
            opacity={i === phase ? 0.9 : 0.25} />
        ))}
        <text x="280" y="284" textAnchor="middle" fontSize="10"
          fill="var(--color-text-primary)" opacity={0.7} fontStyle="italic">
          {PHASE_STATUS[phase]}
        </text>
      </svg>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--color-text-primary)', opacity: 0.75 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="24" height="12"><rect x="0" y="1" width="24" height="10" rx="3" fill={INPUT_COLOR} fillOpacity="0.2" stroke={INPUT_COLOR} strokeWidth="1" /></svg>
          Input row (array column)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect x="0" y="1" width="12" height="10" rx="3" fill={UNNEST_COLOR} fillOpacity="0.2" stroke={UNNEST_COLOR} strokeWidth="1" /></svg>
          UNNEST
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="24" height="12"><rect x="0" y="1" width="24" height="10" rx="3" fill={OUTPUT_COLOR} fillOpacity="0.2" stroke={OUTPUT_COLOR} strokeWidth="1" /></svg>
          Output rows (one per element)
        </span>
      </div>
    </div>
  );
}
