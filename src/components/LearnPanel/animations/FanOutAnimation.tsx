import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 40;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const UW_COLOR  = '#3b82f6';  // blue — UNDERWRITING
const FIN_COLOR = '#10b981';  // green — FINANCE
const COM_COLOR = '#f97316';  // orange — COMPLIANCE
const IN_COLOR  = '#e2e8f0';  // neutral — incoming ball

const INPUT_START_X = 30;
const SPLIT_X = 220;
const OUTPUT_END_X = 515;
const INPUT_Y  = 130;
const UW_Y     = 55;
const FIN_Y    = 130;
const COM_Y    = 205;

const OUTPUT_LANES = [
  { label: 'UNDERWRITING', y: UW_Y,  color: UW_COLOR,  where: "event_type = 'NEW_LOAN'" },
  { label: 'FINANCE',      y: FIN_Y, color: FIN_COLOR,  where: "event_type = 'APPROVED'" },
  { label: 'COMPLIANCE',   y: COM_Y, color: COM_COLOR,  where: "event_type = 'DECLINED'" },
];

const LANE_COUNTS = [4, 3, 2];

const PHASE_STATUS: string[] = [
  'One source topic — loan events flow to a split point',
  'Loan event enters the pipeline (one ball, one message)',
  'At the fork — one event fans out to all three lanes simultaneously',
  'Second event arrives — same split, each consumer receives a copy',
  'Third event — continuous fan-out in action',
  'Rapid flow — every event is replicated to every downstream lane',
  'Each lane accumulates its own independent event count',
  'Three WHERE clauses, one topic — explicit, observable, zero state',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FanOutAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // ── Phase 1: ONE neutral ball travels input lane ──
  const p1BallX = phase === 1 ? lerp(INPUT_START_X, SPLIT_X, eased) : 0;
  const p1Visible = phase === 1;

  // ── Phase 2: BURST — three colored balls arc from SPLIT_X to their lanes ──
  // A brief glow at SPLIT_X marks the split moment (first 20% of phase)
  const p2BurstOpacity = phase === 2 ? Math.max(0, 1 - eased * 5) : 0;
  const p2SplitP = phase === 2 ? eased : phase > 2 ? 1 : 0;
  const p2Balls = OUTPUT_LANES.map(lane => ({
    x: lerp(SPLIT_X, OUTPUT_END_X, p2SplitP),
    y: lerp(INPUT_Y, lane.y, p2SplitP),
    color: lane.color,
    visible: phase >= 2,
    opacity: phase === 2 ? Math.min(eased * 3, 1) : (phase > 2 ? 0.5 : 0),
  }));

  // ── Phase 3: second ball — travel (first 50%) then split (last 50%) ──
  const p3TravelP  = phase === 3 ? Math.min(eased / 0.5, 1) : 1;
  const p3BallX    = lerp(INPUT_START_X, SPLIT_X, p3TravelP);
  const p3InVis    = phase === 3 && eased < 0.55;
  const p3SplitP   = phase === 3 ? Math.max(0, (eased - 0.48) / 0.52) : phase > 3 ? 1 : 0;
  const p3BurstOp  = phase === 3 ? Math.max(0, (1 - Math.max(0, (eased - 0.48) / 0.1))) * (eased > 0.45 ? 1 : 0) : 0;
  const p3Balls = OUTPUT_LANES.map(lane => ({
    x: lerp(SPLIT_X, OUTPUT_END_X, p3SplitP),
    y: lerp(INPUT_Y, lane.y, p3SplitP),
    color: lane.color,
    visible: phase === 3 ? eased > 0.45 : phase > 3,
    opacity: phase === 3 ? Math.min(Math.max(0, (eased - 0.45) / 0.25), 1) : (phase > 3 ? 0.35 : 0),
  }));

  // ── Phase 4: third ball — same pattern as phase 3 ──
  const p4TravelP  = phase === 4 ? Math.min(eased / 0.5, 1) : 1;
  const p4BallX    = lerp(INPUT_START_X, SPLIT_X, p4TravelP);
  const p4InVis    = phase === 4 && eased < 0.55;
  const p4SplitP   = phase === 4 ? Math.max(0, (eased - 0.48) / 0.52) : phase > 4 ? 1 : 0;
  const p4BurstOp  = phase === 4 ? Math.max(0, (1 - Math.max(0, (eased - 0.48) / 0.1))) * (eased > 0.45 ? 1 : 0) : 0;
  const p4Balls = OUTPUT_LANES.map(lane => ({
    x: lerp(SPLIT_X, OUTPUT_END_X, p4SplitP),
    y: lerp(INPUT_Y, lane.y, p4SplitP),
    color: lane.color,
    visible: phase === 4 ? eased > 0.45 : phase > 4,
    opacity: phase === 4 ? Math.min(Math.max(0, (eased - 0.45) / 0.25), 1) : (phase > 4 ? 0.3 : 0),
  }));

  // ── Phase 5: rapid continuous flow — two overlapping cycles ──
  // Two balls cycle at offset intervals: ball A at tick offset 0, ball B at offset 13
  const rapidCycle = (offset: number) => {
    const t = ((tick % PHASE_TICKS) + offset) % PHASE_TICKS;
    const tp = t / PHASE_TICKS;
    if (tp < 0.48) {
      // traveling input lane
      return { traveling: true, ballX: lerp(INPUT_START_X, SPLIT_X, easeInOutCubic(tp / 0.48)), splitP: 0 };
    } else {
      // arcing out
      return { traveling: false, ballX: SPLIT_X, splitP: easeInOutCubic((tp - 0.48) / 0.52) };
    }
  };
  const rapid5A = phase === 5 ? rapidCycle(0) : null;
  const rapid5B = phase === 5 ? rapidCycle(13) : null;

  // ── Phase 6: counters ──
  const counterOpacity = phase === 6 ? eased : phase > 6 ? 1 : 0;

  // ── Phase 7: insight ──
  const insightOpacity = phase === 7 ? eased : 0;

  // Split glow
  const splitGlow = phase >= 1 && phase <= 5;

  // Helper: render a ball at (x, y) with color and text
  const Ball = ({ x, y, color, label, r = 13, opacity = 1 }: { x: number; y: number; color: string; label: string; r?: number; opacity?: number }) => (
    <g opacity={opacity}>
      <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.18} stroke={color} strokeWidth="1.8" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="6.5" fontWeight="700" fill={color}>{label}</text>
    </g>
  );

  // Helper: render three split balls at a given splitP
  const SplitBalls = ({ balls, r = 12 }: { balls: typeof p2Balls; r?: number }) => (
    <>
      {balls.map((b, i) => b.visible && (
        <Ball key={i} x={b.x} y={b.y} color={b.color}
          label={OUTPUT_LANES[i].label.slice(0, 3)} r={r} opacity={b.opacity} />
      ))}
    </>
  );

  // Helper: burst glow at split point
  const BurstGlow = ({ opacity }: { opacity: number }) =>
    opacity > 0.02 ? (
      <circle cx={SPLIT_X} cy={INPUT_Y} r={18} fill="rgba(255,255,255,0.25)"
        stroke="rgba(255,255,255,0.4)" strokeWidth="2" opacity={opacity} />
    ) : null;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="Fan-out animation — one event enters and splits into three, each routed to a different consumer lane">
        <defs>
          <filter id="foa-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="foa-in-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="rgba(255,255,255,0.3)" />
          </marker>
          {OUTPUT_LANES.map((lane, i) => (
            <marker key={i} id={`foa-arr-${i}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={lane.color} opacity="0.5" />
            </marker>
          ))}
        </defs>

        {/* ── INPUT LANE ── */}
        <line x1={INPUT_START_X} y1={INPUT_Y} x2={SPLIT_X - 8} y2={INPUT_Y}
          stroke="rgba(255,255,255,0.25)" strokeWidth="2"
          markerEnd="url(#foa-in-arr)" />
        <text x={INPUT_START_X} y={INPUT_Y - 10} fontSize="9"
          fill="var(--color-text-primary)" opacity={0.5}>
          source topic
        </text>

        {/* ── SPLIT POINT ── */}
        <circle cx={SPLIT_X} cy={INPUT_Y} r="8"
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.35)" strokeWidth="2"
          filter={splitGlow ? 'url(#foa-glow)' : undefined} />

        {/* ── OUTPUT LANES ── */}
        {OUTPUT_LANES.map((lane, i) => (
          <g key={i}>
            {/* Diverging stub from split */}
            <line x1={SPLIT_X} y1={INPUT_Y} x2={SPLIT_X + 18} y2={lane.y}
              stroke={lane.color} strokeWidth="1.2" opacity={0.25} />
            {/* Lane arrow */}
            <line x1={SPLIT_X + 18} y1={lane.y} x2={OUTPUT_END_X - 6} y2={lane.y}
              stroke={lane.color} strokeWidth="1.8" opacity={0.3}
              markerEnd={`url(#foa-arr-${i})`} />
            {/* Lane label */}
            <text x={SPLIT_X + 22} y={lane.y - 10} fontSize="8.5" fontWeight="700"
              fill={lane.color} opacity={0.9}>{lane.label}</text>
            {/* WHERE clause */}
            <text x={SPLIT_X + 22} y={lane.y + 17} fontSize="7"
              fontFamily="monospace" fill={lane.color} opacity={0.5}>
              WHERE {lane.where}
            </text>
          </g>
        ))}

        {/* ── PHASE 1: single neutral ball traveling ── */}
        {p1Visible && (
          <g>
            <circle cx={p1BallX} cy={INPUT_Y} r="13"
              fill={IN_COLOR} fillOpacity={0.15}
              stroke={IN_COLOR} strokeWidth="1.8" />
            <text x={p1BallX} y={INPUT_Y + 4} textAnchor="middle" fontSize="7"
              fontWeight="600" fill={IN_COLOR}>EVENT</text>
          </g>
        )}

        {/* ── PHASE 2: BURST → three balls arc out ── */}
        <BurstGlow opacity={p2BurstOpacity} />
        <SplitBalls balls={p2Balls} />

        {/* ── PHASE 3: second ball + split ── */}
        {p3InVis && (
          <g>
            <circle cx={p3BallX} cy={INPUT_Y} r="13"
              fill={IN_COLOR} fillOpacity={0.15} stroke={IN_COLOR} strokeWidth="1.8" />
            <text x={p3BallX} y={INPUT_Y + 4} textAnchor="middle" fontSize="7"
              fontWeight="600" fill={IN_COLOR}>EVENT</text>
          </g>
        )}
        <BurstGlow opacity={p3BurstOp} />
        <SplitBalls balls={p3Balls} r={11} />

        {/* ── PHASE 4: third ball + split ── */}
        {p4InVis && (
          <g>
            <circle cx={p4BallX} cy={INPUT_Y} r="13"
              fill={IN_COLOR} fillOpacity={0.15} stroke={IN_COLOR} strokeWidth="1.8" />
            <text x={p4BallX} y={INPUT_Y + 4} textAnchor="middle" fontSize="7"
              fontWeight="600" fill={IN_COLOR}>EVENT</text>
          </g>
        )}
        <BurstGlow opacity={p4BurstOp} />
        <SplitBalls balls={p4Balls} r={11} />

        {/* ── PHASE 5: rapid continuous flow ── */}
        {phase === 5 && rapid5A && (
          <>
            {rapid5A.traveling ? (
              <g>
                <circle cx={rapid5A.ballX} cy={INPUT_Y} r="13"
                  fill={IN_COLOR} fillOpacity={0.15} stroke={IN_COLOR} strokeWidth="1.8" />
                <text x={rapid5A.ballX} y={INPUT_Y + 4} textAnchor="middle" fontSize="7"
                  fontWeight="600" fill={IN_COLOR}>EVENT</text>
              </g>
            ) : (
              OUTPUT_LANES.map((lane, i) => {
                const bx = lerp(SPLIT_X, OUTPUT_END_X, rapid5A.splitP);
                const by = lerp(INPUT_Y, lane.y, rapid5A.splitP);
                return (
                  <circle key={i} cx={bx} cy={by} r="11"
                    fill={lane.color} fillOpacity={0.18}
                    stroke={lane.color} strokeWidth="1.5" opacity={0.8} />
                );
              })
            )}
          </>
        )}
        {phase === 5 && rapid5B && (
          <>
            {rapid5B.traveling ? (
              <g>
                <circle cx={rapid5B.ballX} cy={INPUT_Y} r="11"
                  fill={IN_COLOR} fillOpacity={0.12} stroke={IN_COLOR} strokeWidth="1.5"
                  opacity={0.7} />
              </g>
            ) : (
              OUTPUT_LANES.map((lane, i) => {
                const bx = lerp(SPLIT_X, OUTPUT_END_X, rapid5B.splitP);
                const by = lerp(INPUT_Y, lane.y, rapid5B.splitP);
                return (
                  <circle key={i} cx={bx} cy={by} r="9"
                    fill={lane.color} fillOpacity={0.15}
                    stroke={lane.color} strokeWidth="1.2" opacity={0.55} />
                );
              })
            )}
          </>
        )}

        {/* ── PHASE 6: counters on each lane ── */}
        {counterOpacity > 0 && OUTPUT_LANES.map((lane, i) => (
          <g key={`cnt-${i}`} opacity={counterOpacity}>
            <rect x={OUTPUT_END_X - 55} y={lane.y - 13} width="65" height="20" rx="5"
              fill={lane.color} fillOpacity={0.12}
              stroke={lane.color} strokeWidth="1" />
            <text x={OUTPUT_END_X - 22} y={lane.y + 2} textAnchor="middle" fontSize="9"
              fontWeight="700" fill={lane.color}>{LANE_COUNTS[i]} events</text>
          </g>
        ))}

        {/* ── PHASE 7: insight ── */}
        {phase === 7 && insightOpacity > 0 && (
          <g opacity={insightOpacity}>
            <rect x="40" y="228" width="480" height="22" rx="6"
              fill="rgba(249,115,22,0.08)" stroke={COM_COLOR} strokeWidth="1" />
            <text x="280" y="243" textAnchor="middle" fontSize="9.5" fontWeight="600"
              fill={COM_COLOR}>
              3 WHERE clauses, one topic — 1 event becomes 3 copies. Zero state, zero code.
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

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--color-text-primary)', opacity: 0.75 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill={IN_COLOR} opacity="0.6" /></svg>
          incoming event
        </span>
        {OUTPUT_LANES.map((lane, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill={lane.color} opacity="0.85" /></svg>
            {lane.label}
          </span>
        ))}
      </div>
    </div>
  );
}
