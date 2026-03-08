import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const PHASE_STATUS = [
  'Interval join: match events within ±5 minutes of each other',
  'Loan at t=0 — join window opens: [t=-5min, t=+5min]',
  'Customer event at t=3 — inside window → MATCH!',
  'Customer event at t=8 — outside window → NO MATCH',
  'Loan at t=12 — new window [t=7min, t=17min]',
  'Customer event at t=14 — inside → MATCH!',
  'Matched pairs flow to output — expired windows auto-cleared',
  'Interval joins: bounded memory. Time-proximity matching.',
];

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const LOAN_Y = 78;          // Loans timeline Y center
const CUST_Y = 168;         // Customer events timeline Y center
const TL_X0 = 55;
const TL_X1 = 490;

// Loan positions (by time: t=0 → t=12)
const LOAN1_X = 140;  // t=0
const LOAN2_X = 320;  // t=12

// Customer event positions
const CUST1_X = 192;  // t=3  (inside window 1)
const CUST2_X = 272;  // t=8  (outside window 1)
const CUST3_X = 368;  // t=14 (inside window 2)

// Window 1: [t=-5..t=5] → visually [LOAN1_X - 60 .. LOAN1_X + 60]
const WIN1_X0 = LOAN1_X - 60;
const WIN1_X1 = LOAN1_X + 60;

// Window 2: [t=7..t=17] → centered on LOAN2_X
const WIN2_X0 = LOAN2_X - 60;
const WIN2_X1 = LOAN2_X + 60;

// Output pairs
const OUT_X = 400;
const OUT_Y1 = 90;
const OUT_Y2 = 130;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntervalJoinAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Visibility
  const showLoan1 = phase >= 1;
  const showWin1  = phase >= 1;
  const showCust1 = phase >= 2;  // match
  const showCust2 = phase >= 3;  // no-match
  const showLoan2 = phase >= 4;
  const showWin2  = phase >= 4;
  const showCust3 = phase >= 5;  // match
  const showResult1 = phase >= 2;
  const showResult2 = phase >= 5;

  // Match arc between loan and customer event
  const arc1Progress = phase === 2 ? eased : phase > 2 ? 1 : 0;
  const arc2Progress = phase === 5 ? eased : phase > 5 ? 1 : 0;

  // No-match fade
  const noMatchOpacity = phase === 3 ? eased : phase > 3 ? 0.3 : 0;

  // Expired: cust2 (outside window 1) fades after phase 3
  const cust2FinalOpacity = phase >= 4 ? Math.max(0.1, 0.3 - (phase - 4) * 0.1) : noMatchOpacity;

  // Expired windows fade in phase 6
  const win1Opacity = phase >= 6 ? 0.15 : 1;

  // Insight
  const showInsight = phase === 7;
  const insightOpacity = showInsight ? 0.7 + 0.3 * Math.sin(phaseProgress * Math.PI * 2) : 0;

  // Render a SVG arc between two points (cubic bezier)
  const renderMatchArc = (loanX: number, custX: number, progress: number) => {
    if (progress <= 0) return null;
    const midX = (loanX + custX) / 2;
    const midY = (LOAN_Y + CUST_Y) / 2;
    // Draw a curved line
    const d = `M ${loanX} ${LOAN_Y + 10} C ${loanX + 20} ${midY}, ${custX - 20} ${midY}, ${custX} ${CUST_Y - 10}`;
    return (
      <g opacity={Math.min(1, progress * 2)}>
        <path d={d} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="5 3"
          opacity={0.6} />
        {progress > 0.5 && (
          <circle cx={midX} cy={midY} r={5} fill="#10b981" opacity={0.8} />
        )}
      </g>
    );
  };

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="Interval join animation: events from two streams matched within a time window">
        <defs>
          <filter id="ij-glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── HEADER BADGE ── */}
        <rect x="8" y="6" width="200" height="20" rx="4"
          fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x="108" y="20" textAnchor="middle" fontSize="9.5" fontWeight="600" fontFamily="monospace"
          fill="var(--color-text-primary)" opacity={0.8}>BETWEEN INTERVAL '-5' AND '+5'</text>

        {/* ── LOANS LANE ── */}
        <text x={TL_X0 - 6} y={LOAN_Y - 20} fontSize="9" fontWeight="700"
          fill="#3b82f6" opacity={0.8}>LOANS stream</text>
        <rect x={TL_X0 - 4} y={LOAN_Y - 14} width={TL_X1 - TL_X0 + 8} height="28"
          rx="4" fill="rgba(59,130,246,0.04)" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
        <line x1={TL_X0} y1={LOAN_Y} x2={TL_X1} y2={LOAN_Y}
          stroke="#3b82f6" strokeWidth="1" opacity={0.3} strokeDasharray="5 3" />
        <polygon points={`${TL_X1},${LOAN_Y - 4} ${TL_X1 + 10},${LOAN_Y} ${TL_X1},${LOAN_Y + 4}`}
          fill="#3b82f6" opacity={0.3} />

        {/* ── CUSTOMER LANE ── */}
        <text x={TL_X0 - 6} y={CUST_Y - 20} fontSize="9" fontWeight="700"
          fill="#8b5cf6" opacity={0.8}>CUSTOMER EVENTS stream</text>
        <rect x={TL_X0 - 4} y={CUST_Y - 14} width={TL_X1 - TL_X0 + 8} height="28"
          rx="4" fill="rgba(139,92,246,0.04)" stroke="rgba(139,92,246,0.15)" strokeWidth="1" />
        <line x1={TL_X0} y1={CUST_Y} x2={TL_X1} y2={CUST_Y}
          stroke="#8b5cf6" strokeWidth="1" opacity={0.3} strokeDasharray="5 3" />
        <polygon points={`${TL_X1},${CUST_Y - 4} ${TL_X1 + 10},${CUST_Y} ${TL_X1},${CUST_Y + 4}`}
          fill="#8b5cf6" opacity={0.3} />

        {/* ── TIME LABELS ── */}
        {[0, 3, 7, 8, 12, 14].map((t) => {
          const x = TL_X0 + (t / 16) * (TL_X1 - TL_X0);
          return (
            <g key={`tl-${t}`}>
              <line x1={x} y1={LOAN_Y + 14} x2={x} y2={CUST_Y - 14}
                stroke="var(--color-text-primary)" strokeWidth="0.5" opacity={0.1} />
              <text x={x} y={(LOAN_Y + CUST_Y) / 2 + 4} textAnchor="middle"
                fontSize="7.5" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.3}>
                t={t}
              </text>
            </g>
          );
        })}

        {/* ── WINDOW 1 BRACKET ── */}
        {showWin1 && (
          <g opacity={win1Opacity}>
            <rect x={Math.max(TL_X0, WIN1_X0)} y={LOAN_Y - 14}
              width={WIN1_X1 - Math.max(TL_X0, WIN1_X0)} height={CUST_Y + 14 - (LOAN_Y - 14)}
              rx="6" fill="rgba(59,130,246,0.06)" stroke="#3b82f6" strokeWidth="1"
              strokeDasharray={phase >= 4 ? '4 3' : 'none'} />
            <text x={(Math.max(TL_X0, WIN1_X0) + WIN1_X1) / 2} y={LOAN_Y + CUST_Y / 2 - 10}
              textAnchor="middle" fontSize="8" fill="#3b82f6" opacity={0.5} fontFamily="monospace">
              ±5 min
            </text>
          </g>
        )}

        {/* ── WINDOW 2 BRACKET ── */}
        {showWin2 && (
          <g opacity={phase === 4 ? eased : 1}>
            <rect x={WIN2_X0} y={LOAN_Y - 14}
              width={WIN2_X1 - WIN2_X0} height={CUST_Y + 14 - (LOAN_Y - 14)}
              rx="6" fill="rgba(16,185,129,0.06)" stroke="#10b981" strokeWidth="1" />
            <text x={(WIN2_X0 + WIN2_X1) / 2} y={LOAN_Y + CUST_Y / 2 - 10}
              textAnchor="middle" fontSize="8" fill="#10b981" opacity={0.5} fontFamily="monospace">
              ±5 min
            </text>
          </g>
        )}

        {/* ── LOAN 1 DOT ── */}
        {showLoan1 && (
          <g opacity={phase === 1 ? eased : 1}>
            <circle cx={LOAN1_X} cy={LOAN_Y} r={9} fill="#3b82f6" opacity={0.9} />
            <text x={LOAN1_X} y={LOAN_Y + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">L1</text>
            <text x={LOAN1_X} y={LOAN_Y - 16} textAnchor="middle" fontSize="8"
              fontFamily="monospace" fill="#3b82f6" opacity={0.7}>t=0</text>
          </g>
        )}

        {/* ── LOAN 2 DOT ── */}
        {showLoan2 && (
          <g opacity={phase === 4 ? eased : 1}>
            <circle cx={LOAN2_X} cy={LOAN_Y} r={9} fill="#10b981" opacity={0.9} />
            <text x={LOAN2_X} y={LOAN_Y + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">L2</text>
            <text x={LOAN2_X} y={LOAN_Y - 16} textAnchor="middle" fontSize="8"
              fontFamily="monospace" fill="#10b981" opacity={0.7}>t=12</text>
          </g>
        )}

        {/* ── CUSTOMER EVENT 1 (match) ── */}
        {showCust1 && (
          <g opacity={phase === 2 ? eased : 1}>
            <circle cx={CUST1_X} cy={CUST_Y} r={9} fill="#8b5cf6" opacity={0.9} />
            <text x={CUST1_X} y={CUST_Y + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">C1</text>
            <text x={CUST1_X} y={CUST_Y + 20} textAnchor="middle" fontSize="8"
              fontFamily="monospace" fill="#8b5cf6" opacity={0.7}>t=3</text>
          </g>
        )}

        {/* ── CUSTOMER EVENT 2 (no match) ── */}
        {showCust2 && (
          <g opacity={cust2FinalOpacity}>
            <circle cx={CUST2_X} cy={CUST_Y} r={9}
              fill={phase >= 4 ? '#6b7280' : '#8b5cf6'} opacity={0.6} />
            <text x={CUST2_X} y={CUST_Y + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">C2</text>
            <text x={CUST2_X} y={CUST_Y + 20} textAnchor="middle" fontSize="8"
              fontFamily="monospace" fill="#6b7280" opacity={0.6}>t=8</text>
            {/* "NO MATCH" X mark */}
            {phase === 3 && eased > 0.3 && (
              <g opacity={(eased - 0.3) / 0.7}>
                <text x={CUST2_X} y={CUST_Y - 18} textAnchor="middle" fontSize="14"
                  fontWeight="900" fill="#ef4444">✗</text>
                <text x={CUST2_X} y={CUST_Y - 4} textAnchor="middle" fontSize="7.5"
                  fill="#ef4444" opacity={0.8}>outside</text>
              </g>
            )}
          </g>
        )}

        {/* ── CUSTOMER EVENT 3 (match 2) ── */}
        {showCust3 && (
          <g opacity={phase === 5 ? eased : 1}>
            <circle cx={CUST3_X} cy={CUST_Y} r={9} fill="#8b5cf6" opacity={0.9} />
            <text x={CUST3_X} y={CUST_Y + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">C3</text>
            <text x={CUST3_X} y={CUST_Y + 20} textAnchor="middle" fontSize="8"
              fontFamily="monospace" fill="#8b5cf6" opacity={0.7}>t=14</text>
          </g>
        )}

        {/* ── MATCH ARCS ── */}
        {renderMatchArc(LOAN1_X, CUST1_X, arc1Progress)}
        {renderMatchArc(LOAN2_X, CUST3_X, arc2Progress)}

        {/* ── OUTPUT PAIRS ── */}
        <text x={OUT_X + 45} y="74" textAnchor="middle" fontSize="9" fontWeight="700"
          fill="var(--color-text-primary)" opacity={0.6}>MATCHED PAIRS</text>

        {showResult1 && (
          <g opacity={phase === 2 ? arc1Progress : 1}>
            <rect x={OUT_X} y={OUT_Y1} width="100" height="28" rx="5"
              fill="rgba(16,185,129,0.12)" stroke="#10b981" strokeWidth="1" />
            <text x={OUT_X + 50} y={OUT_Y1 + 11} textAnchor="middle"
              fontSize="8" fontWeight="700" fill="#10b981">L1 + C1</text>
            <text x={OUT_X + 50} y={OUT_Y1 + 22} textAnchor="middle"
              fontSize="8" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.6}>
              Δt = 3 min
            </text>
          </g>
        )}

        {showResult2 && (
          <g opacity={phase === 5 ? arc2Progress : 1}>
            <rect x={OUT_X} y={OUT_Y2} width="100" height="28" rx="5"
              fill="rgba(16,185,129,0.12)" stroke="#10b981" strokeWidth="1" />
            <text x={OUT_X + 50} y={OUT_Y2 + 11} textAnchor="middle"
              fontSize="8" fontWeight="700" fill="#10b981">L2 + C3</text>
            <text x={OUT_X + 50} y={OUT_Y2 + 22} textAnchor="middle"
              fontSize="8" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.6}>
              Δt = 2 min
            </text>
          </g>
        )}

        {/* "No match" placeholder for C2 in output */}
        {phase >= 3 && phase < 6 && (
          <g opacity={Math.min(1, (phase - 2) * 0.4)}>
            <rect x={OUT_X} y={OUT_Y1 + (showResult1 ? 36 : 0)} width="100" height="20" rx="5"
              fill="rgba(107,114,128,0.08)" stroke="#6b7280" strokeWidth="0.5" strokeDasharray="3 2" />
            <text x={OUT_X + 50} y={OUT_Y1 + (showResult1 ? 36 : 0) + 13} textAnchor="middle"
              fontSize="8" fill="#6b7280">C2 — no match</text>
          </g>
        )}

        {/* ── INSIGHT (phase 7) ── */}
        {showInsight && (
          <g opacity={insightOpacity}>
            <rect x="30" y="215" width="500" height="24" rx="6"
              fill="rgba(16,185,129,0.08)" stroke="#10b981" strokeWidth="1" />
            <text x="280" y="231" textAnchor="middle" fontSize="10" fontWeight="600" fill="#10b981">
              Interval joins: bounded memory — expired windows are automatically cleared
            </text>
          </g>
        )}

        {/* ── STATUS BAR ── */}
        <rect x="0" y="255" width="560" height="40" fill="rgba(255,255,255,0.025)" />
        {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
          <circle key={i} cx={200 + i * 20} cy={265} r={i === phase ? 4 : 2.5}
            fill={i === phase ? '#10b981' : 'var(--color-text-primary)'}
            opacity={i === phase ? 0.9 : 0.25} />
        ))}
        <text x="280" y="284" textAnchor="middle" fontSize="10"
          fill="var(--color-text-primary)" opacity={0.7} fontStyle="italic">
          {PHASE_STATUS[phase]}
        </text>
      </svg>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--color-text-primary)', opacity: 0.75 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#3b82f6" /></svg>
          Loan event
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#8b5cf6" /></svg>
          Customer event
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="14" height="12"><rect x="0" y="1" width="14" height="10" rx="2" fill="rgba(59,130,246,0.1)" stroke="#3b82f6" strokeWidth="1" /></svg>
          ±5 min window
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#10b981" /></svg>
          Matched pair
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#6b7280" opacity={0.5} /></svg>
          Outside window
        </span>
      </div>
    </div>
  );
}
