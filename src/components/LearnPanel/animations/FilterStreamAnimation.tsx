import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const PASS_COLOR = '#10b981';
const DROP_COLOR = '#ef4444';
const FILTER_COLOR = '#6366f1';

// Event definitions
const EVENTS = [
  { label: 'APPROVED', pass: true  },
  { label: 'DECLINED', pass: false },
  { label: 'APPROVED', pass: true  },
  { label: 'PENDING',  pass: false },
  { label: 'APPROVED', pass: true  },
];

const PHASE_STATUS: string[] = [
  'Stream arrives — every row hits the WHERE clause',
  'Loan events: APPROVED, DECLINED, APPROVED, PENDING, APPROVED',
  'APPROVED → WHERE passes → PASS lane (green)',
  'DECLINED → WHERE fails → DROP lane (red)',
  'Both paths active simultaneously',
  'PASS counter ticks — throughput unchanged',
  'WHERE clause highlights on each evaluation',
  'WHERE runs on every row — zero state, zero latency',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// Diamond filter points at center cx,cy with half-size s
function diamondPoints(cx: number, cy: number, s: number): string {
  return `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilterStreamAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Geometry
  const FILTER_X = 280;
  const FILTER_Y = 100;
  const INPUT_Y = 100;
  const PASS_Y = 45;
  const DROP_Y = 160;
  const LANE_END_X = 520;

  // Phase 1: events stagger in from X=30 toward filter at X=280
  // Each event starts at a different x position so they appear staggered
  const inputEventPositions = EVENTS.map((_, i) => {
    if (phase < 1) return null;
    const startX = 30 + i * 30;
    const targetX = FILTER_X - 20 - i * 12;
    const x = phase === 1 ? startX + eased * (targetX - startX) : targetX;
    const visible = phase >= 1;
    return visible ? x : null;
  });

  // Phase 2: LOL travels to filter then arcs to pass lane
  const lolPhase2X = phase === 2 ? FILTER_X - 20 + eased * 20 : phase > 2 ? FILTER_X : null;
  const lolPassX = phase === 2 && eased > 0.7 ? FILTER_X + (eased - 0.7) / 0.3 * (LANE_END_X - FILTER_X) : phase > 2 ? LANE_END_X : null;
  const lolPassY = lolPassX != null ? FILTER_Y + (lolPassX - FILTER_X) / (LANE_END_X - FILTER_X) * (PASS_Y - FILTER_Y) : FILTER_Y;

  // Phase 3: GROAN hits filter, drops
  const groanX = phase === 3 ? FILTER_X - 8 + eased * 8 : phase > 3 ? FILTER_X : null;
  const groanDropX = phase === 3 && eased > 0.6 ? FILTER_X + (eased - 0.6) / 0.4 * (LANE_END_X - FILTER_X) : phase > 3 ? LANE_END_X : null;
  const groanDropY = groanDropX != null ? FILTER_Y + (groanDropX - FILTER_X) / (LANE_END_X - FILTER_X) * (DROP_Y - FILTER_Y) : FILTER_Y;

  // Phase 4: ROFL and MEH simultaneously
  const roflX = phase === 4 ? FILTER_X - 20 + eased * (LANE_END_X - FILTER_X + 20) : phase > 4 ? LANE_END_X : null;
  const roflY = roflX != null && roflX > FILTER_X ? FILTER_Y + (roflX - FILTER_X) / (LANE_END_X - FILTER_X) * (PASS_Y - FILTER_Y) : FILTER_Y;
  const mehX = phase === 4 ? FILTER_X - 12 + eased * (LANE_END_X - FILTER_X + 12) : phase > 4 ? LANE_END_X : null;
  const mehY = mehX != null && mehX > FILTER_X ? FILTER_Y + (mehX - FILTER_X) / (LANE_END_X - FILTER_X) * (DROP_Y - FILTER_Y) : FILTER_Y;

  // Phase 5: pass counter
  const passCount = phase === 5 ? Math.round(eased * 3) : phase > 5 ? 3 : 0;
  const countVisible = phase >= 5;

  // Phase 6: WHERE clause pulse
  const wherePulse = phase === 6 ? 0.5 + 0.5 * Math.sin(phaseProgress * Math.PI * 6) : 1;

  // Phase 7: insight
  const insightOpacity = phase === 7 ? eased : 0;

  // Filter glow based on active evaluation phases
  const filterGlow = (phase === 2 || phase === 3 || phase === 4 || phase === 6) ? 0.8 + 0.2 * Math.sin(phaseProgress * Math.PI * 4) : 0.6;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }} aria-label="WHERE clause streaming filter animation showing loan events passing or dropping based on status condition">
        <defs>
          <filter id="fsa-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="fsa-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-text-primary)" opacity="0.35" />
          </marker>
          <marker id="fsa-pass-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={PASS_COLOR} opacity="0.7" />
          </marker>
          <marker id="fsa-drop-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={DROP_COLOR} opacity="0.7" />
          </marker>
        </defs>

        {/* ── INPUT LANE ── */}
        <line x1="30" y1={INPUT_Y} x2={FILTER_X - 22} y2={INPUT_Y}
          stroke="var(--color-text-primary)" strokeWidth="1.5" opacity={0.3}
          markerEnd="url(#fsa-arr)" />
        <text x="30" y={INPUT_Y - 10} fontSize="9" fill="var(--color-text-primary)" opacity={0.5} fontFamily="monospace">
          input stream
        </text>

        {/* ── PASS LANE ── */}
        <line x1={FILTER_X + 22} y1={FILTER_Y} x2={LANE_END_X} y2={PASS_Y}
          stroke={PASS_COLOR} strokeWidth="1.5" opacity={0.4}
          markerEnd="url(#fsa-pass-arr)" />
        <rect x={LANE_END_X - 60} y={PASS_Y - 12} width="60" height="18" rx="5"
          fill={PASS_COLOR} fillOpacity={0.12} stroke={PASS_COLOR} strokeWidth="1" />
        <text x={LANE_END_X - 30} y={PASS_Y + 1} textAnchor="middle" fontSize="9"
          fontWeight="700" fill={PASS_COLOR}>PASS ✓</text>

        {/* ── DROP LANE ── */}
        <line x1={FILTER_X + 22} y1={FILTER_Y} x2={LANE_END_X} y2={DROP_Y}
          stroke={DROP_COLOR} strokeWidth="1.5" opacity={0.4}
          markerEnd="url(#fsa-drop-arr)" />
        <rect x={LANE_END_X - 60} y={DROP_Y - 8} width="60" height="18" rx="5"
          fill={DROP_COLOR} fillOpacity={0.12} stroke={DROP_COLOR} strokeWidth="1" />
        <text x={LANE_END_X - 30} y={DROP_Y + 5} textAnchor="middle" fontSize="9"
          fontWeight="700" fill={DROP_COLOR}>DROP ✗</text>

        {/* ── WHERE DIAMOND FILTER ── */}
        <polygon points={diamondPoints(FILTER_X, FILTER_Y, 22)}
          fill={FILTER_COLOR} fillOpacity={0.12 + filterGlow * 0.08}
          stroke={FILTER_COLOR} strokeWidth="2"
          opacity={wherePulse}
          filter={phase >= 2 ? 'url(#fsa-glow)' : undefined} />
        <text x={FILTER_X} y={FILTER_Y - 28} textAnchor="middle" fontSize="9"
          fontWeight="700" fill={FILTER_COLOR} opacity={0.85}>WHERE</text>
        <text x={FILTER_X} y={FILTER_Y + 4} textAnchor="middle" fontSize="7.5"
          fontWeight="600" fill={FILTER_COLOR}>filter</text>

        {/* ── WHERE CONDITION TEXT ── */}
        <rect x="80" y="190" width="400" height="26" rx="5"
          fill="rgba(99,102,241,0.07)" stroke={FILTER_COLOR} strokeWidth="1"
          opacity={wherePulse * 0.9} />
        <text x="280" y="207" textAnchor="middle" fontSize="10"
          fontFamily="monospace" fontWeight="600" fill={FILTER_COLOR} opacity={wherePulse}>
          WHERE status = 'APPROVED'
        </text>

        {/* ── PHASE 1: Input events staggered in lane ── */}
        {phase >= 1 && inputEventPositions.map((x, i) => {
          if (x === null) return null;
          const evt = EVENTS[i];
          const color = evt.pass ? PASS_COLOR : DROP_COLOR;
          // Hide events that have already been "consumed" by later phases
          const consumed = (i === 0 && phase >= 2) || (i === 1 && phase >= 3) ||
                           ((i === 2 || i === 3) && phase >= 4);
          if (consumed) return null;
          return (
            <g key={`inp-${i}`}>
              <circle cx={x} cy={INPUT_Y} r="11"
                fill={color} fillOpacity={0.15}
                stroke={color} strokeWidth="1.5" opacity={0.7} />
              <text x={x} y={INPUT_Y + 4} textAnchor="middle" fontSize="7.5"
                fontWeight="700" fill={color}>{evt.label}</text>
            </g>
          );
        })}

        {/* ── PHASE 2: LOL arcs to PASS ── */}
        {phase >= 2 && lolPassX !== null && (
          <g filter={phase === 2 && eased < 0.9 ? 'url(#fsa-glow)' : undefined}>
            <circle cx={lolPassX} cy={lolPassY} r="11"
              fill={PASS_COLOR} fillOpacity={0.25}
              stroke={PASS_COLOR} strokeWidth="2" />
            <text x={lolPassX} y={lolPassY + 4} textAnchor="middle" fontSize="7.5"
              fontWeight="700" fill={PASS_COLOR}>LOL</text>
          </g>
        )}
        {phase === 2 && lolPhase2X !== null && (eased <= 0.7) && (
          <g filter="url(#fsa-glow)">
            <circle cx={lolPhase2X} cy={FILTER_Y} r="11"
              fill={PASS_COLOR} fillOpacity={0.2}
              stroke={PASS_COLOR} strokeWidth="2" />
            <text x={lolPhase2X} y={FILTER_Y + 4} textAnchor="middle" fontSize="7.5"
              fontWeight="700" fill={PASS_COLOR}>LOL</text>
          </g>
        )}

        {/* ── PHASE 3: GROAN drops ── */}
        {phase >= 3 && groanDropX !== null && (
          <g>
            <circle cx={groanDropX} cy={groanDropY} r="11"
              fill={DROP_COLOR} fillOpacity={0.2}
              stroke={DROP_COLOR} strokeWidth="2"
              opacity={phase === 3 ? eased : 0.7} />
            <text x={groanDropX} y={groanDropY + 4} textAnchor="middle" fontSize="6.5"
              fontWeight="700" fill={DROP_COLOR}>GRN</text>
          </g>
        )}
        {phase === 3 && groanX !== null && eased <= 0.6 && (
          <g filter="url(#fsa-glow)">
            <circle cx={groanX} cy={FILTER_Y} r="11"
              fill={DROP_COLOR} fillOpacity={0.2}
              stroke={DROP_COLOR} strokeWidth="2" />
            <text x={groanX} y={FILTER_Y + 4} textAnchor="middle" fontSize="6.5"
              fontWeight="700" fill={DROP_COLOR}>GRN</text>
          </g>
        )}

        {/* ── PHASE 4: ROFL and MEH simultaneously ── */}
        {phase >= 4 && roflX !== null && (
          <circle cx={roflX} cy={roflY} r="11"
            fill={PASS_COLOR} fillOpacity={0.2}
            stroke={PASS_COLOR} strokeWidth="2"
            opacity={phase === 4 ? Math.min(eased * 2, 1) : 0.7} />
        )}
        {phase >= 4 && roflX !== null && roflY <= (PASS_Y + FILTER_Y) / 2 + 10 && (
          <text x={roflX} y={roflY + 4} textAnchor="middle" fontSize="7"
            fontWeight="700" fill={PASS_COLOR}>ROFL</text>
        )}
        {phase >= 4 && mehX !== null && (
          <circle cx={mehX} cy={mehY} r="11"
            fill={DROP_COLOR} fillOpacity={0.2}
            stroke={DROP_COLOR} strokeWidth="2"
            opacity={phase === 4 ? Math.min(eased * 2, 1) : 0.7} />
        )}
        {phase >= 4 && mehX !== null && mehY >= (DROP_Y + FILTER_Y) / 2 - 10 && (
          <text x={mehX} y={mehY + 4} textAnchor="middle" fontSize="7"
            fontWeight="700" fill={DROP_COLOR}>MEH</text>
        )}

        {/* ── PHASE 5: PASS counter ── */}
        {countVisible && (
          <g opacity={phase === 5 ? eased : 1}>
            <rect x={LANE_END_X - 80} y={PASS_Y + 14} width="80" height="22" rx="5"
              fill={PASS_COLOR} fillOpacity={0.1} stroke={PASS_COLOR} strokeWidth="1" />
            <text x={LANE_END_X - 40} y={PASS_Y + 29} textAnchor="middle" fontSize="11"
              fontWeight="700" fill={PASS_COLOR}>{passCount} passed</text>
          </g>
        )}

        {/* ── PHASE 7: Insight ── */}
        {phase === 7 && (
          <g opacity={insightOpacity}>
            <rect x="40" y="222" width="480" height="24" rx="6"
              fill="rgba(99,102,241,0.1)" stroke={FILTER_COLOR} strokeWidth="1" />
            <text x="280" y="238" textAnchor="middle" fontSize="9.5" fontWeight="600"
              fill={FILTER_COLOR}>
              WHERE runs on every row — zero state, zero latency. 1M/s = 10/s.
            </text>
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

      {/* HTML legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--color-text-primary)', opacity: 0.75 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill={PASS_COLOR} opacity="0.85" /></svg>
          PASS lane
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill={DROP_COLOR} opacity="0.85" /></svg>
          DROP lane
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><polygon points="6,1 11,6 6,11 1,6" fill={FILTER_COLOR} opacity="0.85" /></svg>
          WHERE filter
        </span>
      </div>
    </div>
  );
}
