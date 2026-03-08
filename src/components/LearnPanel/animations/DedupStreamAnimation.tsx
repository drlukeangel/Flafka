import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const PASS_COLOR = '#10b981';  // green — keep
const DROP_COLOR = '#ef4444';  // red — discard
const GATE_COLOR = '#6366f1';  // indigo — ROW_NUMBER gate
const ACCENT = '#3b82f6';      // blue — general

// Geometry
const INPUT_Y = 45;
const GATE_X = 260;
const GATE_Y = 118;
const OUTPUT_Y = 200;

const PHASE_STATUS: string[] = [
  'Input stream — Kafka at-least-once means duplicates happen',
  'Loan L-001 (1st): ROW_NUMBER = 1 → PASS (keep)',
  'Loan L-001 duplicate: ROW_NUMBER = 2 → DROP (discard)',
  'Loan L-001 third copy: ROW_NUMBER = 3 → DROP',
  'Loan L-002 (1st arrival): ROW_NUMBER = 1 → PASS',
  'Only unique first-occurrence rows accumulate in output',
  '5 events in, 2 unique out — dedup ratio 60%',
  'ROW_NUMBER keeps the first. Exactly-once semantics achieved.',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DedupStreamAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Input lane: events arrive from left at Y=INPUT_Y, travel to X=GATE_X
  // Events stacked with slight x-offsets to show duplicates
  // Phases 1-4: L-001 (pass/drop/drop), L-002 (pass) — rendered individually below

  // Phase-driven visibility and positions:
  // Phase 1: L-001 (1st) — travels input, hits gate, glows green, arcs down to output
  // Phase 2: L-001 (dup) — hits gate, red X, fades
  // Phase 3: L-001 (3rd) — hits gate, red X, fades
  // Phase 4: L-002 — travels, glows green, arcs to output
  // Phase 5: output lane shows 2 events
  // Phase 6: counter
  // Phase 7: insight

  // Compute event positions
  type RenderedEvt = {
    x: number; y: number; opacity: number;
    color: string; label: string; rownum: number; pass: boolean;
    showX: boolean; showGlow: boolean;
  };

  const rendered: RenderedEvt[] = [];

  // Helper: smoothly transition x and y as an event travels toward the gate
  // xProgress 0-0.7: move horizontally; 0.7-1.0: descend vertically to GATE_Y
  function eventPos(p: number, startX: number): { x: number; y: number } {
    const hP = Math.min(p / 0.7, 1);   // horizontal phase: 0→1 while p goes 0→0.7
    const vP = Math.max(0, (p - 0.7) / 0.3); // vertical phase: 0→1 while p goes 0.7→1
    return {
      x: lerp(startX, GATE_X, hP),
      y: lerp(INPUT_Y, GATE_Y, vP),
    };
  }

  // ── Phase 1: L-001 first copy ──
  if (phase === 1) {
    const inputProgress = Math.min(eased * 1.5, 1);
    if (inputProgress >= 1) {
      const arcP = Math.max(0, (eased - 0.66) / 0.34);
      const ex = lerp(GATE_X, 450, arcP);
      const ey = lerp(GATE_Y, OUTPUT_Y, arcP);
      rendered.push({ x: ex, y: ey, opacity: 0.9, color: PASS_COLOR, label: 'L-001', rownum: 1, pass: true, showX: false, showGlow: true });
    } else {
      const pos = eventPos(inputProgress, 40);
      rendered.push({ x: pos.x, y: pos.y, opacity: 0.9, color: ACCENT, label: 'L-001', rownum: 1, pass: true, showX: false, showGlow: false });
    }
  }

  // Persistent output events from previous phases
  if (phase >= 2) {
    rendered.push({ x: 340, y: OUTPUT_Y, opacity: 0.85, color: PASS_COLOR, label: 'L-001', rownum: 1, pass: true, showX: false, showGlow: false });
  }

  // ── Phase 2: L-001 duplicate ──
  if (phase === 2) {
    const inputProgress = Math.min(eased * 1.6, 1);
    if (inputProgress >= 1) {
      const fadeOut = Math.max(0, 1 - (eased - 0.65) / 0.35);
      rendered.push({ x: GATE_X, y: GATE_Y, opacity: fadeOut, color: DROP_COLOR, label: 'L-001', rownum: 2, pass: false, showX: true, showGlow: false });
    } else {
      const pos = eventPos(inputProgress, 40);
      rendered.push({ x: pos.x, y: pos.y, opacity: 0.85, color: DROP_COLOR, label: 'L-001', rownum: 2, pass: false, showX: false, showGlow: false });
    }
  }

  // ── Phase 3: L-001 third copy ──
  if (phase === 3) {
    const inputProgress = Math.min(eased * 1.6, 1);
    if (inputProgress >= 1) {
      const fadeOut = Math.max(0, 1 - (eased - 0.65) / 0.35);
      rendered.push({ x: GATE_X, y: GATE_Y, opacity: fadeOut, color: DROP_COLOR, label: 'L-001', rownum: 3, pass: false, showX: true, showGlow: false });
    } else {
      const pos = eventPos(inputProgress, 40);
      rendered.push({ x: pos.x, y: pos.y, opacity: 0.85, color: DROP_COLOR, label: 'L-001', rownum: 3, pass: false, showX: false, showGlow: false });
    }
  }

  // ── Phase 4: L-002 ──
  if (phase === 4) {
    const inputProgress = Math.min(eased * 1.5, 1);
    if (inputProgress >= 1) {
      const arcP = Math.max(0, (eased - 0.66) / 0.34);
      const ex = lerp(GATE_X, 450, arcP);
      const ey = lerp(GATE_Y, OUTPUT_Y, arcP);
      rendered.push({ x: ex, y: ey, opacity: 0.9, color: PASS_COLOR, label: 'L-002', rownum: 1, pass: true, showX: false, showGlow: true });
    } else {
      const pos = eventPos(inputProgress, 40);
      rendered.push({ x: pos.x, y: pos.y, opacity: 0.9, color: ACCENT, label: 'L-002', rownum: 1, pass: true, showX: false, showGlow: false });
    }
  }

  if (phase >= 5) {
    rendered.push({ x: 430, y: OUTPUT_Y, opacity: 0.85, color: PASS_COLOR, label: 'L-002', rownum: 1, pass: true, showX: false, showGlow: false });
  }

  // Phase 5: gentle pulse on output lane
  const outputPulse = phase === 5 ? 0.85 + 0.15 * Math.sin(phaseProgress * Math.PI * 3) : 0.85;

  // Phase 6: counter
  const counterOpacity = phase === 6 ? eased : phase > 6 ? 1 : 0;

  // Phase 7: insight
  const insightOpacity = phase === 7 ? eased : 0;

  // Gate glow when active
  const gateGlow = phase >= 1 && phase <= 4;
  const gateColor = (phase === 2 || phase === 3) ? DROP_COLOR : (phase === 1 || phase === 4) ? PASS_COLOR : GATE_COLOR;

  // Input lane duplicate stacking indicators (phases 0-3)
  const showStackIndicators = phase >= 0 && phase <= 3;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }} aria-label="ROW_NUMBER deduplication animation showing first-occurrence events passing and duplicates being dropped">
        <defs>
          <filter id="dsa-glow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="dsa-in-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-text-primary)" opacity="0.35" />
          </marker>
          <marker id="dsa-out-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={PASS_COLOR} opacity="0.5" />
          </marker>
        </defs>

        {/* ── INPUT LANE ── */}
        <line x1="30" y1={INPUT_Y} x2={GATE_X - 4} y2={INPUT_Y}
          stroke="var(--color-text-primary)" strokeWidth="1.5" opacity={0.3}
          markerEnd="url(#dsa-in-arr)" />
        <text x="32" y={INPUT_Y - 10} fontSize="9" fill="var(--color-text-primary)" opacity={0.5}>
          input stream (at-least-once)
        </text>

        {/* ── STACK INDICATORS: duplicate events arriving ── */}
        {showStackIndicators && (
          <g opacity={0.3}>
            <circle cx={100} cy={INPUT_Y - 3} r="10" fill="none" stroke={DROP_COLOR} strokeWidth="1" strokeDasharray="3 2" />
            <circle cx={100} cy={INPUT_Y + 3} r="10" fill="none" stroke={DROP_COLOR} strokeWidth="1" strokeDasharray="3 2" />
            <text x={100} y={INPUT_Y + 30} textAnchor="middle" fontSize="8"
              fill={DROP_COLOR} opacity={0.6}>duplicates</text>
          </g>
        )}

        {/* ── ROW_NUMBER GATE ── */}
        <rect x={GATE_X - 55} y={GATE_Y - 22} width="110" height="44" rx="8"
          fill={GATE_COLOR} fillOpacity={0.1}
          stroke={gateColor} strokeWidth="2"
          filter={gateGlow ? 'url(#dsa-glow)' : undefined} />
        <text x={GATE_X} y={GATE_Y - 5} textAnchor="middle" fontSize="9"
          fontWeight="700" fill={GATE_COLOR} fontFamily="monospace">ROW_NUMBER()</text>
        <text x={GATE_X} y={GATE_Y + 10} textAnchor="middle" fontSize="7.5"
          fontFamily="monospace" fill={GATE_COLOR} opacity={0.7}>PARTITION BY loan_id</text>
        <text x={GATE_X} y={GATE_Y + 22} textAnchor="middle" fontSize="7.5"
          fontFamily="monospace" fill={GATE_COLOR} opacity={0.7}>ORDER BY $rowtime</text>

        {/* ── VERTICAL CONNECTOR input → gate ── */}
        <line x1={GATE_X} y1={INPUT_Y + 4} x2={GATE_X} y2={GATE_Y - 22}
          stroke="var(--color-text-primary)" strokeWidth="1.2" opacity={0.2}
          strokeDasharray="4 3" />

        {/* ── OUTPUT LANE ── */}
        <line x1={GATE_X} y1={GATE_Y + 22} x2={GATE_X} y2={OUTPUT_Y - 4}
          stroke={PASS_COLOR} strokeWidth="1.2" opacity={0.25}
          strokeDasharray="4 3" />
        <line x1={GATE_X - 80} y1={OUTPUT_Y} x2={500} y2={OUTPUT_Y}
          stroke={PASS_COLOR} strokeWidth="1.5" opacity={0.3}
          markerEnd="url(#dsa-out-arr)" />
        <text x={GATE_X - 80} y={OUTPUT_Y - 10} fontSize="9" fill={PASS_COLOR} opacity={0.6}>
          deduplicated output
        </text>

        {/* ── WHERE rownum=1 LABEL ── */}
        <rect x={GATE_X - 50} y={OUTPUT_Y - 48} width="100" height="16" rx="4"
          fill={PASS_COLOR} fillOpacity={0.08}
          stroke={PASS_COLOR} strokeWidth="1" />
        <text x={GATE_X} y={OUTPUT_Y - 37} textAnchor="middle" fontSize="8"
          fontFamily="monospace" fill={PASS_COLOR} opacity={0.7}>WHERE rownum = 1</text>

        {/* ── RENDERED EVENTS ── */}
        {rendered.map((evt, i) => {
          const r = 13;
          return (
            <g key={i} opacity={evt.opacity}
              filter={evt.showGlow ? 'url(#dsa-glow)' : undefined}>
              <circle cx={evt.x} cy={evt.y} r={r}
                fill={evt.color} fillOpacity={0.18}
                stroke={evt.color} strokeWidth="1.8" />
              <text x={evt.x} y={evt.y - 2} textAnchor="middle" fontSize="7"
                fontWeight="700" fill={evt.color}>{evt.label}</text>
              <text x={evt.x} y={evt.y + 9} textAnchor="middle" fontSize="6.5"
                fill={evt.color} opacity={0.8}>#{evt.rownum}</text>
              {/* Red X for drops */}
              {evt.showX && (
                <g>
                  <line x1={evt.x - 9} y1={evt.y - 9} x2={evt.x + 9} y2={evt.y + 9}
                    stroke={DROP_COLOR} strokeWidth="2.5" strokeLinecap="round" />
                  <line x1={evt.x + 9} y1={evt.y - 9} x2={evt.x - 9} y2={evt.y + 9}
                    stroke={DROP_COLOR} strokeWidth="2.5" strokeLinecap="round" />
                </g>
              )}
            </g>
          );
        })}

        {/* ── PHASE 5: Output pulse ── */}
        {phase === 5 && (
          <rect x={GATE_X - 80} y={OUTPUT_Y - 18} width="420" height="36" rx="5"
            fill={PASS_COLOR} fillOpacity={0.04 * outputPulse}
            stroke={PASS_COLOR} strokeWidth="1" opacity={outputPulse * 0.4} />
        )}

        {/* ── PHASE 6: COUNTER ── */}
        {counterOpacity > 0 && (
          <g opacity={counterOpacity}>
            <rect x="130" y="152" width="300" height="30" rx="6"
              fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <text x="280" y="162" textAnchor="middle" fontSize="8"
              fill="var(--color-text-primary)" opacity={0.5}>events</text>
            <text x="200" y="176" textAnchor="middle" fontSize="13"
              fontWeight="700" fill={ACCENT}>5 in</text>
            <text x="280" y="176" textAnchor="middle" fontSize="12"
              fill="var(--color-text-primary)" opacity={0.4}>→</text>
            <text x="360" y="176" textAnchor="middle" fontSize="13"
              fontWeight="700" fill={PASS_COLOR}>2 out</text>
          </g>
        )}

        {/* ── PHASE 7: INSIGHT ── */}
        {phase === 7 && (
          <g opacity={insightOpacity}>
            <rect x="45" y="218" width="470" height="24" rx="6"
              fill="rgba(16,185,129,0.08)" stroke={PASS_COLOR} strokeWidth="1" />
            <text x="280" y="234" textAnchor="middle" fontSize="9.5" fontWeight="600"
              fill={PASS_COLOR}>
              ROW_NUMBER keeps the first. Exactly-once semantics achieved.
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
          rownum=1 — KEEP
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill={DROP_COLOR} opacity="0.85" /></svg>
          rownum&gt;1 — DROP
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="2" fill={GATE_COLOR} fillOpacity="0.2" stroke={GATE_COLOR} strokeWidth="1" /></svg>
          ROW_NUMBER gate
        </span>
      </div>
    </div>
  );
}
