import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const NE_COLOR = '#3b82f6';   // blue — NORTHEAST
const SE_COLOR = '#10b981';   // green — SOUTHEAST
const W_COLOR  = '#f97316';   // orange — WEST

const LANE_Y = [55, 125, 195];
const LANE_LABELS = ['NORTHEAST', 'SOUTHEAST', 'WEST'];
const LANE_COLORS = [NE_COLOR, SE_COLOR, W_COLOR];

const FUNNEL_X0 = 260;
const FUNNEL_X1 = 320;
const OUTPUT_Y = 125;
const OUTPUT_END_X = 520;

const PHASE_STATUS: string[] = [
  'Three regional feeds: NORTHEAST, SOUTHEAST, WEST',
  'NORTHEAST blue events flow in from left',
  'SOUTHEAST green events arrive',
  'WEST orange events join the stream',
  'All three converge at the merge funnel',
  'Interleaved output — arrival order preserved',
  'Total count: NE + SE + WEST combined',
  'UNION ALL: no deduplication. Events in arrival order.',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// Traveling event: returns x position along a lane [0..1] → [startX..endX]
function laneX(progress: number, startX: number, endX: number): number {
  return startX + progress * (endX - startX);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UnionMergeAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Events traveling on each input lane — shown per phase
  // Each "event" is {progress, color, label}
  type TravelEvent = { progress: number; color: string; label: string; laneIdx: number };
  const travelEvents: TravelEvent[] = [];

  // Phase 1: NE events flow left to right
  if (phase === 1) {
    [-0.3, 0.1, 0.5].forEach((offset, i) => {
      const p = Math.max(0, Math.min(1, eased + offset));
      travelEvents.push({ progress: p, color: NE_COLOR, label: `NE${i + 1}`, laneIdx: 0 });
    });
  }
  // Phase 2: SE events
  if (phase === 2) {
    [-0.2, 0.2, 0.6].forEach((offset, i) => {
      const p = Math.max(0, Math.min(1, eased + offset));
      travelEvents.push({ progress: p, color: SE_COLOR, label: `SE${i + 1}`, laneIdx: 1 });
    });
  }
  // Phase 3: WEST events
  if (phase === 3) {
    [-0.2, 0.25, 0.65].forEach((offset, i) => {
      const p = Math.max(0, Math.min(1, eased + offset));
      travelEvents.push({ progress: p, color: W_COLOR, label: `W${i + 1}`, laneIdx: 2 });
    });
  }
  // Phase 4: all three simultaneously converging
  if (phase === 4) {
    [0.1, 0.5].forEach((offset, i) => {
      const p = Math.max(0, Math.min(1, eased + offset));
      travelEvents.push({ progress: p, color: NE_COLOR, label: `NE${i + 1}`, laneIdx: 0 });
    });
    [0.0, 0.45].forEach((offset, i) => {
      const p = Math.max(0, Math.min(1, eased + offset));
      travelEvents.push({ progress: p, color: SE_COLOR, label: `SE${i + 1}`, laneIdx: 1 });
    });
    [-0.1, 0.4].forEach((offset, i) => {
      const p = Math.max(0, Math.min(1, eased + offset));
      travelEvents.push({ progress: p, color: W_COLOR, label: `W${i + 1}`, laneIdx: 2 });
    });
  }

  // Phase 5: interleaved output events flowing out right side
  const outputEvents: { x: number; color: string; label: string }[] = [];
  if (phase === 5) {
    const seq = [
      { color: NE_COLOR, label: 'NE1' },
      { color: SE_COLOR, label: 'SE1' },
      { color: W_COLOR,  label: 'W1'  },
      { color: NE_COLOR, label: 'NE2' },
      { color: SE_COLOR, label: 'SE2' },
      { color: W_COLOR,  label: 'W2'  },
      { color: NE_COLOR, label: 'NE3' },
    ];
    seq.forEach((evt, i) => {
      const offset = -i * 0.12;
      const p = Math.max(0, Math.min(1, eased + offset));
      if (p > 0) {
        outputEvents.push({ x: laneX(p, FUNNEL_X1, OUTPUT_END_X), color: evt.color, label: evt.label });
      }
    });
  }
  if (phase >= 6) {
    // Static output events
    [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.88].forEach((p, i) => {
      const colors = [NE_COLOR, SE_COLOR, W_COLOR, NE_COLOR, SE_COLOR, W_COLOR, NE_COLOR];
      const labels = ['NE1', 'SE1', 'W1', 'NE2', 'SE2', 'W2', 'NE3'];
      outputEvents.push({ x: laneX(p, FUNNEL_X1, OUTPUT_END_X), color: colors[i], label: labels[i] });
    });
  }

  // Phase 6: counter text
  const counterOpacity = phase === 6 ? eased : phase > 6 ? 1 : 0;

  // Phase 7: insight
  const insightOpacity = phase === 7 ? eased : 0;

  // Funnel glow when events converge
  const funnelGlow = phase >= 4 && phase <= 5;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }} aria-label="UNION ALL animation showing three regional streams merging into one interleaved output">
        <defs>
          <filter id="uma-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {LANE_COLORS.map((c, i) => (
            <marker key={i} id={`uma-arr-${i}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={c} opacity="0.6" />
            </marker>
          ))}
          <marker id="uma-out-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-text-primary)" opacity="0.4" />
          </marker>
        </defs>

        {/* ── THREE INPUT LANES ── */}
        {LANE_Y.map((y, i) => (
          <g key={`lane-${i}`}>
            {/* Lane arrow */}
            <line x1="30" y1={y} x2={FUNNEL_X0 - 4} y2={y}
              stroke={LANE_COLORS[i]} strokeWidth="1.5" opacity={0.35}
              markerEnd={`url(#uma-arr-${i})`} />
            {/* Lane label */}
            <text x="32" y={y - 9} fontSize="9" fontWeight="700"
              fill={LANE_COLORS[i]} opacity={0.8}>{LANE_LABELS[i]}</text>
          </g>
        ))}

        {/* ── FUNNEL SHAPE ── */}
        {/* Lines converging from 3 lane entrances to single output */}
        <path d={`M${FUNNEL_X0},${LANE_Y[0]} L${FUNNEL_X1},${OUTPUT_Y}`}
          stroke={NE_COLOR} strokeWidth="1.5" opacity={0.35} fill="none" />
        <path d={`M${FUNNEL_X0},${LANE_Y[1]} L${FUNNEL_X1},${OUTPUT_Y}`}
          stroke={SE_COLOR} strokeWidth="1.5" opacity={0.35} fill="none" />
        <path d={`M${FUNNEL_X0},${LANE_Y[2]} L${FUNNEL_X1},${OUTPUT_Y}`}
          stroke={W_COLOR} strokeWidth="1.5" opacity={0.35} fill="none" />

        {/* Funnel polygon fill */}
        <polygon
          points={`${FUNNEL_X0},${LANE_Y[0]} ${FUNNEL_X0},${LANE_Y[2]} ${FUNNEL_X1},${OUTPUT_Y + 8} ${FUNNEL_X1},${OUTPUT_Y - 8}`}
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
          filter={funnelGlow ? 'url(#uma-glow)' : undefined}
        />

        {/* UNION ALL label in funnel */}
        <text x={(FUNNEL_X0 + FUNNEL_X1) / 2} y={OUTPUT_Y + 3} textAnchor="middle"
          fontSize="8" fontWeight="700" fill="var(--color-text-primary)" opacity={0.5}
          fontFamily="monospace">UNION ALL</text>

        {/* ── OUTPUT LANE ── */}
        <line x1={FUNNEL_X1} y1={OUTPUT_Y} x2={OUTPUT_END_X + 10} y2={OUTPUT_Y}
          stroke="var(--color-text-primary)" strokeWidth="1.5" opacity={0.3}
          markerEnd="url(#uma-out-arr)" />
        <text x={OUTPUT_END_X - 60} y={OUTPUT_Y - 10} fontSize="9"
          fill="var(--color-text-primary)" opacity={0.5} fontFamily="monospace">merged stream</text>

        {/* ── TRAVELING INPUT EVENTS ── */}
        {travelEvents.map((evt, i) => {
          const y = LANE_Y[evt.laneIdx];
          const x = laneX(evt.progress, 30, FUNNEL_X0);
          if (evt.progress <= 0) return null;
          return (
            <g key={`te-${i}`}>
              <circle cx={x} cy={y} r="10"
                fill={evt.color} fillOpacity={0.2}
                stroke={evt.color} strokeWidth="1.5" />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="7.5"
                fontWeight="700" fill={evt.color}>{evt.label}</text>
            </g>
          );
        })}

        {/* ── OUTPUT EVENTS ── */}
        {outputEvents.map((evt, i) => (
          <g key={`oe-${i}`}>
            <circle cx={evt.x} cy={OUTPUT_Y} r="10"
              fill={evt.color} fillOpacity={0.2}
              stroke={evt.color} strokeWidth="1.5" />
            <text x={evt.x} y={OUTPUT_Y + 4} textAnchor="middle" fontSize="7"
              fontWeight="700" fill={evt.color}>{evt.label}</text>
          </g>
        ))}

        {/* ── PHASE 6: COUNTER ── */}
        {counterOpacity > 0 && (
          <g opacity={counterOpacity}>
            <rect x="110" y="215" width="340" height="26" rx="5"
              fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <text x="280" y="232" textAnchor="middle" fontSize="10" fontWeight="600"
              fill="var(--color-text-primary)" opacity={0.85} fontFamily="monospace">
              NE: 4  |  SE: 3  |  W: 3  |  Total: 10
            </text>
          </g>
        )}

        {/* ── PHASE 7: INSIGHT ── */}
        {phase === 7 && (
          <g opacity={insightOpacity}>
            <rect x="55" y="215" width="450" height="26" rx="6"
              fill="rgba(249,115,22,0.08)" stroke={W_COLOR} strokeWidth="1" />
            <text x="280" y="232" textAnchor="middle" fontSize="9.5" fontWeight="600"
              fill={W_COLOR}>
              UNION ALL: no deduplication. Events in arrival order.
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
        {LANE_COLORS.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill={c} opacity="0.85" /></svg>
            {LANE_LABELS[i]}
          </span>
        ))}
      </div>
    </div>
  );
}
