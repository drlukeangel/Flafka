import { useState, useEffect } from 'react';
import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants — standard animation convention
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const PASS_COLOR   = '#3b82f6';  // blue  — matched events
const REJECT_COLOR = '#ef4444';  // red   — filtered-out events
const FLINK_COLOR  = '#6366f1';  // indigo — Flink SQL box

// Layout
const INPUT_PIPE_X1  = 20;
const INPUT_PIPE_X2  = 185;
const FILTER_X1      = 200;
const FILTER_X2      = 360;
const OUTPUT_PIPE_X1 = 375;
const OUTPUT_PIPE_X2 = 540;
const BALL_Y         = 105;
const FILTER_ENTRY_X = 210; // where rejection is detected

// EVENTS: [label, amount, matched]
const EVENTS: [string, number, boolean][] = [
  ['$150', 150, true],   // phase 1 — PASS
  ['$50',   50, false],  // phase 2 — DESTROY
  ['$200', 200, true],   // phase 3 — PASS
  ['$30',   30, false],  // phase 4 — DESTROY
  ['$175', 175, true],   // phase 5 — PASS
];

const PHASE_STATUS: string[] = [
  'Flink SQL: WHERE amount > 100 — continuously evaluates every event',
  '$150 arrives — amount=150 > 100 → PASS, flows to output stream',
  '$50 arrives — amount=50 ≤ 100 → filtered out, never reaches output',
  '$200 arrives — passes filter, joins the output stream',
  '$30 arrives — destroyed at the filter, zero downstream cost',
  '$175 arrives — passes, three matched events in output stream',
  'Continuous flow — high-volume or low, the query never stops',
  'Flink SQL is always running. Events flow in, results flow out.',
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

export function FlinkBasicsAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);
  const [queryPulse, setQueryPulse] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setQueryPulse((p) => !p), 1500);
    return () => clearInterval(id);
  }, []);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // ── PASS BALL (phases 1, 3, 5): travels full span left → right ──
  const isPassPhase = phase === 1 || phase === 3 || phase === 5;
  const passIdx = phase === 1 ? 0 : phase === 3 ? 2 : 4;
  const passLabel = isPassPhase ? EVENTS[passIdx][0] : '';
  const passBallX = isPassPhase ? lerp(INPUT_PIPE_X1 + 5, OUTPUT_PIPE_X2 - 5, eased) : 0;
  // "in filter" range: draw glow
  const passInFilter = isPassPhase && passBallX >= FILTER_X1 && passBallX <= FILTER_X2;

  // ── REJECT BALL (phases 2, 4): travels to filter entry → EXPLODES ──
  const isRejectPhase = phase === 2 || phase === 4;
  const rejectLabel = phase === 2 ? '$50' : phase === 4 ? '$30' : '';
  // Travel: 0 → 45% of phase reaches FILTER_ENTRY_X
  const rejectTravelP = Math.min(eased / 0.45, 1);
  const rejectBallX   = lerp(INPUT_PIPE_X1 + 5, FILTER_ENTRY_X, rejectTravelP);
  // Explosion progress: starts at 45% of phase
  const explodeP = Math.max(0, (eased - 0.45) / 0.55);
  // Ball shrinks and reddens during explosion
  const rejectBallR = isRejectPhase ? (explodeP < 0.3 ? 13 + explodeP * 10 : Math.max(0, 16 - (explodeP - 0.3) / 0.7 * 16)) : 0;
  const rejectBallOpacity = isRejectPhase ? Math.max(0, 1 - explodeP * 1.4) : 0;
  const rejectBallVisible = isRejectPhase && eased < 0.95;

  // Explosion particles: 8 sparks radiating from the explosion point
  const PARTICLE_COUNT = 8;
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
    const dist = explodeP * 38;
    return {
      x: FILTER_ENTRY_X + Math.cos(angle) * dist,
      y: BALL_Y + Math.sin(angle) * dist,
      opacity: Math.max(0, 1 - explodeP * 1.6),
      r: 3 + i % 2,
    };
  });
  const showParticles = isRejectPhase && explodeP > 0.05;

  // Big X at explosion site
  const showX = isRejectPhase && explodeP > 0.1 && explodeP < 0.95;
  const xSize = 14 * Math.min(explodeP * 3, 1);
  const xOpacity = Math.max(0, Math.min(explodeP * 3, 1) * (1 - explodeP * 1.3));

  // ── PHASE 6: rapid flow (multiple simultaneous events) ──
  // Cycling: a ball enters every 13 ticks (half a phase)
  const rapid6Balls = [0, 13].map((offset) => {
    const t = ((tick % PHASE_TICKS) + offset) % PHASE_TICKS;
    const tp = t / PHASE_TICKS;
    const tp_e = easeInOutCubic(tp);
    const isPass = (offset === 0); // alt pass/reject per ball for visual interest
    const bx = lerp(INPUT_PIPE_X1 + 5, OUTPUT_PIPE_X2 - 5, tp_e);
    return {
      x: bx,
      color: isPass ? PASS_COLOR : (tp_e > 0.4 ? REJECT_COLOR : '#94a3b8'),
      inFilter: bx >= FILTER_X1 && bx <= FILTER_X2,
      visible: phase === 6 && (isPass || tp_e < 0.48),
    };
  });

  // ── SETTLED BALLS in output pipe (counts) ──
  // Show 1 settled ball per PASS phase completed
  const settledCount = phase >= 2 ? 1 : 0;
  const settled2 = phase >= 4 ? 1 : 0;
  const settled3 = phase >= 6 ? 1 : 0;

  // Phase 7: insight
  const insightOpacity = phase === 7 ? eased : 0;

  // Filter WHERE clause pulse on reject approach
  const whereHighlight = isRejectPhase && rejectTravelP > 0.7;
  const wherePulse = whereHighlight ? 0.7 + 0.3 * Math.sin(phaseProgress * Math.PI * 8) : 1;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="Flink SQL continuous query — matched events flow to output, filtered events are destroyed at the WHERE clause">
        <defs>
          <filter id="fb-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="fb-red-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="fb-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={PASS_COLOR} opacity="0.5" />
          </marker>
        </defs>

        {/* ── INPUT PIPE (Kafka topic) ── */}
        <rect x={INPUT_PIPE_X1} y={BALL_Y - 22} width={INPUT_PIPE_X2 - INPUT_PIPE_X1} height={44} rx="8"
          fill="var(--color-bg-surface)" stroke={PASS_COLOR} strokeWidth="1.5"
          strokeDasharray="5 3" opacity={0.6} />
        <text x={(INPUT_PIPE_X1 + INPUT_PIPE_X2) / 2} y={BALL_Y - 28} textAnchor="middle"
          fontSize="10" fontWeight="600" fill="var(--color-text-primary)" opacity={0.55}>
          Kafka Topic (input)
        </text>
        {/* Flow dashes inside pipe */}
        {[50, 80, 110, 140, 170].map((ax) => (
          <text key={ax} x={ax} y={BALL_Y + 4} fontSize="11" fill={PASS_COLOR} opacity={0.2}>›</text>
        ))}

        {/* ── ARROW left → filter ── */}
        <line x1={INPUT_PIPE_X2} y1={BALL_Y} x2={FILTER_X1 - 2} y2={BALL_Y}
          stroke={PASS_COLOR} strokeWidth="2" opacity={0.4}
          markerEnd="url(#fb-arr)" />

        {/* ── FLINK SQL FILTER BOX ── */}
        <rect x={FILTER_X1} y={BALL_Y - 36} width={FILTER_X2 - FILTER_X1} height={72} rx="10"
          fill="var(--color-bg-surface)"
          stroke={FLINK_COLOR}
          strokeWidth={queryPulse ? 2.2 : 1.5}
          opacity={queryPulse ? 1 : 0.85} />
        <text x={(FILTER_X1 + FILTER_X2) / 2} y={BALL_Y - 18} textAnchor="middle"
          fontSize="10" fontWeight="700" fill={FLINK_COLOR}>Flink SQL</text>
        <text x={(FILTER_X1 + FILTER_X2) / 2} y={BALL_Y - 4} textAnchor="middle"
          fontSize="8.5" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.65}>
          SELECT * FROM tx
        </text>
        <text x={(FILTER_X1 + FILTER_X2) / 2} y={BALL_Y + 11} textAnchor="middle"
          fontSize="8.5" fontFamily="monospace"
          fill={whereHighlight ? REJECT_COLOR : 'var(--color-text-primary)'}
          opacity={whereHighlight ? wherePulse : 0.65}
          fontWeight={whereHighlight ? '700' : '400'}>
          WHERE amount &gt; 100
        </text>
        {/* Running indicator */}
        <circle cx={FILTER_X1 + 10} cy={BALL_Y + 28} r="3"
          fill={queryPulse ? FLINK_COLOR : 'var(--color-text-primary)'} opacity={0.6} />
        <text x={FILTER_X1 + 17} y={BALL_Y + 32} fontSize="7.5"
          fill="var(--color-text-primary)" opacity={0.5} fontStyle="italic">always running</text>

        {/* ── ARROW filter → output ── */}
        <line x1={FILTER_X2} y1={BALL_Y} x2={OUTPUT_PIPE_X1 - 2} y2={BALL_Y}
          stroke={PASS_COLOR} strokeWidth="2" opacity={0.4}
          markerEnd="url(#fb-arr)" />

        {/* ── OUTPUT PIPE (results stream) ── */}
        <rect x={OUTPUT_PIPE_X1} y={BALL_Y - 22} width={OUTPUT_PIPE_X2 - OUTPUT_PIPE_X1} height={44} rx="8"
          fill="var(--color-bg-surface)" stroke={PASS_COLOR} strokeWidth="1.5"
          strokeDasharray="5 3" opacity={0.6} />
        <text x={(OUTPUT_PIPE_X1 + OUTPUT_PIPE_X2) / 2} y={BALL_Y - 28} textAnchor="middle"
          fontSize="10" fontWeight="600" fill="var(--color-text-primary)" opacity={0.55}>
          Output Stream (matched)
        </text>
        {[405, 435, 465, 495, 525].map((ax) => (
          <text key={ax} x={ax} y={BALL_Y + 4} fontSize="11" fill={PASS_COLOR} opacity={0.2}>›</text>
        ))}

        {/* ── SETTLED BALLS in output pipe ── */}
        {settledCount > 0 && phase >= 2 && phase <= 5 && (
          <g opacity={phase === 2 ? eased : 1}>
            <circle cx={420} cy={BALL_Y} r="11" fill={PASS_COLOR} fillOpacity={0.18} stroke={PASS_COLOR} strokeWidth="1.5" />
            <text x="420" y={BALL_Y + 4} textAnchor="middle" fontSize="7" fontWeight="600" fill={PASS_COLOR}>$150</text>
          </g>
        )}
        {settled2 > 0 && phase >= 4 && phase <= 5 && (
          <g opacity={phase === 4 ? eased : 1}>
            <circle cx={455} cy={BALL_Y} r="11" fill={PASS_COLOR} fillOpacity={0.18} stroke={PASS_COLOR} strokeWidth="1.5" />
            <text x="455" y={BALL_Y + 4} textAnchor="middle" fontSize="7" fontWeight="600" fill={PASS_COLOR}>$200</text>
          </g>
        )}
        {settled3 > 0 && phase >= 6 && (
          <g opacity={phase === 6 ? eased : 1}>
            <circle cx={490} cy={BALL_Y} r="11" fill={PASS_COLOR} fillOpacity={0.18} stroke={PASS_COLOR} strokeWidth="1.5" />
            <text x="490" y={BALL_Y + 4} textAnchor="middle" fontSize="7" fontWeight="600" fill={PASS_COLOR}>$175</text>
          </g>
        )}

        {/* ── PASS BALL (phases 1, 3, 5) ── */}
        {isPassPhase && (
          <g filter={passInFilter ? 'url(#fb-glow)' : undefined}>
            <circle cx={passBallX} cy={BALL_Y} r="13"
              fill={PASS_COLOR} fillOpacity={0.2} stroke={PASS_COLOR} strokeWidth="1.8" />
            <text x={passBallX} y={BALL_Y + 4} textAnchor="middle" fontSize="7.5"
              fontWeight="700" fill={PASS_COLOR}>{passLabel}</text>
          </g>
        )}

        {/* ── REJECT BALL (phases 2, 4) — travels then explodes ── */}
        {rejectBallVisible && (
          <g filter={explodeP > 0.1 ? 'url(#fb-red-glow)' : undefined}>
            <circle cx={rejectBallX} cy={BALL_Y} r={rejectBallR}
              fill={REJECT_COLOR} fillOpacity={0.2 + explodeP * 0.15}
              stroke={REJECT_COLOR} strokeWidth="1.8"
              opacity={rejectBallOpacity} />
            {rejectBallR > 2 && (
              <text x={rejectBallX} y={BALL_Y + 4} textAnchor="middle" fontSize="7.5"
                fontWeight="700" fill={REJECT_COLOR} opacity={rejectBallOpacity}>
                {rejectLabel}
              </text>
            )}
          </g>
        )}

        {/* Explosion particles */}
        {showParticles && particles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r}
            fill={i % 2 === 0 ? REJECT_COLOR : '#f97316'}
            opacity={p.opacity} />
        ))}

        {/* Big ✕ at rejection site */}
        {showX && (
          <g opacity={xOpacity}>
            <line x1={FILTER_ENTRY_X - xSize} y1={BALL_Y - xSize}
              x2={FILTER_ENTRY_X + xSize} y2={BALL_Y + xSize}
              stroke={REJECT_COLOR} strokeWidth="3.5" strokeLinecap="round" />
            <line x1={FILTER_ENTRY_X + xSize} y1={BALL_Y - xSize}
              x2={FILTER_ENTRY_X - xSize} y2={BALL_Y + xSize}
              stroke={REJECT_COLOR} strokeWidth="3.5" strokeLinecap="round" />
          </g>
        )}

        {/* ── PHASE 6: rapid cycling balls ── */}
        {phase === 6 && rapid6Balls.map((b, i) => b.visible && (
          <g key={i} filter={b.inFilter ? 'url(#fb-glow)' : undefined}>
            <circle cx={b.x} cy={BALL_Y} r="11"
              fill={b.color} fillOpacity={0.18} stroke={b.color} strokeWidth="1.5" />
          </g>
        ))}

        {/* ── Counter badge ── */}
        {phase >= 2 && phase <= 6 && (
          <g>
            <rect x={OUTPUT_PIPE_X1} y={BALL_Y + 30} width="165" height="22" rx="4"
              fill="var(--color-bg-surface)" opacity={0.7} />
            <text x={(OUTPUT_PIPE_X1 + OUTPUT_PIPE_X2) / 2} y={BALL_Y + 45}
              textAnchor="middle" fontSize="9" fill="var(--color-text-primary)">
              <tspan fill={PASS_COLOR} fontWeight="600">
                {phase === 2 ? 1 : phase === 4 ? 2 : phase >= 6 ? 3 : phase === 3 ? 1 : phase === 5 ? 2 : 3}
              </tspan>
              <tspan fill="var(--color-text-primary)" opacity={0.6}> matched  </tspan>
              <tspan fill={REJECT_COLOR} fontWeight="600">
                {phase >= 3 ? (phase >= 5 ? 2 : 1) : 1}
              </tspan>
              <tspan fill="var(--color-text-primary)" opacity={0.6}> filtered</tspan>
            </text>
          </g>
        )}

        {/* ── PHASE 7: insight ── */}
        {phase === 7 && insightOpacity > 0 && (
          <g opacity={insightOpacity}>
            <rect x="50" y="155" width="460" height="22" rx="6"
              fill="rgba(99,102,241,0.08)" stroke={FLINK_COLOR} strokeWidth="1" />
            <text x="280" y="170" textAnchor="middle" fontSize="9.5" fontWeight="600"
              fill={FLINK_COLOR}>
              WHERE runs on every row — no polling, no batching, no lag.
            </text>
          </g>
        )}

        {/* ── Legend ── */}
        <g transform="translate(20, 175)">
          <circle cx="8" cy="8" r="6" fill={PASS_COLOR} fillOpacity={0.85} />
          <text x="19" y="12" fontSize="9" fill="var(--color-text-primary)" opacity={0.7}>matched (amount &gt; 100)</text>
          <circle cx="188" cy="8" r="6" fill={REJECT_COLOR} fillOpacity={0.85} />
          <text x="199" y="12" fontSize="9" fill="var(--color-text-primary)" opacity={0.7}>destroyed (amount ≤ 100)</text>
        </g>

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
    </div>
  );
}
