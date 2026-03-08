import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const PHASE_STATUS = [
  'Temporal join: look up what the table contained AT a past moment',
  'Customer table v1: score=720 at t=0, effective from t=0',
  'Loan at t=10 — looks up customer AS OF t=10 → score=720 joins',
  'Customer table UPDATE: score=735 at t=20 (new version)',
  'Loan at t=30 — AS OF t=30 → score=735 (sees the update)',
  'Point-in-time accuracy: t=10 loan still shows 720, not 735',
  'Historical audit: scores are what they WERE, not what they are',
  'FOR SYSTEM_TIME AS OF: the score they SAW, not the score they have now',
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

// Top lane: Loan stream
const LOAN_LANE_Y = 68;
const LOAN_LANE_Y2 = 88; // bottom of lane

// Bottom lane: versioned customer table
const TBL_LANE_Y = 165;
const TBL_LANE_Y2 = 185;

// Timeline span
const TL_X0 = 60;
const TL_X1 = 490;

// Loan event positions (by time)
const LOAN1_X = 185; // t=10
const LOAN2_X = 335; // t=30

// Customer version positions
const VER1_X = 80;   // t=0
const VER2_X = 245;  // t=20

// Output rows (right side)
const OUT_X = 400;
const OUT_Y1 = 80;
const OUT_Y2 = 125;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemporalJoinAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Visibility flags
  const showVer1 = phase >= 1;
  const showLoan1 = phase >= 2;
  const showVer2 = phase >= 3;
  const showLoan2 = phase >= 4;
  const showResult1 = phase >= 2;
  const showResult2 = phase >= 4;

  // Dashed connector lines animate downward when loan appears
  const connector1Progress = phase === 2 ? eased : phase > 2 ? 1 : 0;
  const connector2Progress = phase === 4 ? eased : phase > 4 ? 1 : 0;

  // Phase 5: highlight that loan1 shows 720 even though table is at 735
  const showHistoricalHighlight = phase >= 5;
  const highlightOpacity = phase === 5 ? eased : phase > 5 ? 0.7 + 0.3 * Math.sin(phaseProgress * Math.PI * 2) : 0;

  // Insight
  const showInsight = phase === 7;
  const insightOpacity = showInsight ? 0.7 + 0.3 * Math.sin(phaseProgress * Math.PI * 2) : 0;

  const connectorMidY = (LOAN_LANE_Y2 + TBL_LANE_Y) / 2;

  const renderConnector = (loanX: number, verX: number, progress: number, color: string, targetScore: string) => {
    if (progress <= 0) return null;
    const startY = LOAN_LANE_Y2 + 4;
    const midY1 = startY + (connectorMidY - startY) * progress;
    // Horizontal step from loanX to verX midpoint
    const stepY = connectorMidY;

    return (
      <g opacity={Math.min(1, progress * 1.5)}>
        {/* Vertical line down from loan */}
        <line x1={loanX} y1={startY} x2={loanX} y2={Math.min(midY1, stepY)}
          stroke={color} strokeWidth="1.5" strokeDasharray="4 3" opacity={0.7} />
        {/* Horizontal step */}
        {progress > 0.5 && (
          <line x1={loanX} y1={stepY}
            x2={loanX + (verX - loanX) * Math.min(1, (progress - 0.5) * 2)} y2={stepY}
            stroke={color} strokeWidth="1.5" strokeDasharray="4 3" opacity={0.7} />
        )}
        {/* Vertical down to table */}
        {progress > 0.75 && (
          <line x1={verX} y1={stepY} x2={verX} y2={TBL_LANE_Y - 4}
            stroke={color} strokeWidth="1.5" strokeDasharray="4 3"
            opacity={(progress - 0.75) / 0.25 * 0.7} />
        )}
        {/* Match label */}
        {progress > 0.85 && (
          <g opacity={(progress - 0.85) / 0.15}>
            <rect x={(loanX + verX) / 2 - 22} y={stepY - 10} width="44" height="14" rx="7"
              fill={color} opacity={0.9} />
            <text x={(loanX + verX) / 2} y={stepY - 1} textAnchor="middle"
              fontSize="8" fontWeight="700" fill="#fff">{targetScore}</text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="Temporal join animation: FOR SYSTEM_TIME AS OF point-in-time lookup">
        <defs>
          <filter id="tj-glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="tj-arrow" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
            <path d="M0,0 L7,2.5 L0,5 Z" fill="rgba(255,255,255,0.4)" />
          </marker>
        </defs>

        {/* ── HEADER BADGE ── */}
        <rect x="8" y="6" width="220" height="20" rx="4"
          fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x="118" y="20" textAnchor="middle" fontSize="9.5" fontWeight="600" fontFamily="monospace"
          fill="var(--color-text-primary)" opacity={0.8}>FOR SYSTEM_TIME AS OF loan.rowtime</text>

        {/* ── LOAN LANE (top) ── */}
        <text x={TL_X0 - 6} y={LOAN_LANE_Y - 12} fontSize="9" fontWeight="700"
          fill="#3b82f6" opacity={0.8}>LOANS stream</text>
        <rect x={TL_X0 - 4} y={LOAN_LANE_Y - 2} width={TL_X1 - TL_X0 + 8} height={LOAN_LANE_Y2 - LOAN_LANE_Y + 4}
          rx="4" fill="rgba(59,130,246,0.05)" stroke="rgba(59,130,246,0.2)" strokeWidth="1" />
        <line x1={TL_X0} y1={(LOAN_LANE_Y + LOAN_LANE_Y2) / 2} x2={TL_X1} y2={(LOAN_LANE_Y + LOAN_LANE_Y2) / 2}
          stroke="#3b82f6" strokeWidth="1" opacity={0.25} strokeDasharray="5 3" />

        {/* Loan event 1 (t=10) */}
        {showLoan1 && (
          <g opacity={phase === 2 ? eased : 1}>
            <rect x={LOAN1_X - 22} y={LOAN_LANE_Y + 2} width="44" height={LOAN_LANE_Y2 - LOAN_LANE_Y - 4} rx="4"
              fill="#3b82f6" opacity={0.8} />
            <text x={LOAN1_X} y={LOAN_LANE_Y + 14} textAnchor="middle"
              fontSize="8" fontWeight="700" fill="#fff">L-1</text>
            <text x={LOAN1_X} y={LOAN_LANE_Y - 8} textAnchor="middle"
              fontSize="8" fontFamily="monospace" fill="#3b82f6" opacity={0.7}>t=10</text>
          </g>
        )}

        {/* Loan event 2 (t=30) */}
        {showLoan2 && (
          <g opacity={phase === 4 ? eased : 1}>
            <rect x={LOAN2_X - 22} y={LOAN_LANE_Y + 2} width="44" height={LOAN_LANE_Y2 - LOAN_LANE_Y - 4} rx="4"
              fill="#3b82f6" opacity={0.8} />
            <text x={LOAN2_X} y={LOAN_LANE_Y + 14} textAnchor="middle"
              fontSize="8" fontWeight="700" fill="#fff">L-2</text>
            <text x={LOAN2_X} y={LOAN_LANE_Y - 8} textAnchor="middle"
              fontSize="8" fontFamily="monospace" fill="#3b82f6" opacity={0.7}>t=30</text>
          </g>
        )}

        {/* ── DASHED CONNECTORS ── */}
        {renderConnector(LOAN1_X, VER1_X + 40, connector1Progress, '#10b981', 'score=720')}
        {renderConnector(LOAN2_X, VER2_X + 40, connector2Progress, '#f59e0b', 'score=735')}

        {/* ── CUSTOMER TABLE LANE (bottom) ── */}
        <text x={TL_X0 - 6} y={TBL_LANE_Y - 12} fontSize="9" fontWeight="700"
          fill="#f59e0b" opacity={0.8}>CUSTOMER TABLE (versioned)</text>
        <rect x={TL_X0 - 4} y={TBL_LANE_Y - 2} width={TL_X1 - TL_X0 + 8} height={TBL_LANE_Y2 - TBL_LANE_Y + 4}
          rx="4" fill="rgba(245,158,11,0.05)" stroke="rgba(245,158,11,0.2)" strokeWidth="1" />
        <line x1={TL_X0} y1={(TBL_LANE_Y + TBL_LANE_Y2) / 2} x2={TL_X1} y2={(TBL_LANE_Y + TBL_LANE_Y2) / 2}
          stroke="#f59e0b" strokeWidth="1" opacity={0.25} strokeDasharray="5 3" />

        {/* Customer v1 (effective from t=0) */}
        {showVer1 && (
          <g opacity={phase === 1 ? eased : 1}>
            <rect x={VER1_X} y={TBL_LANE_Y + 2} width="90" height={TBL_LANE_Y2 - TBL_LANE_Y - 4} rx="4"
              fill="#f59e0b" opacity={0.75} />
            <text x={VER1_X + 45} y={TBL_LANE_Y + 14} textAnchor="middle"
              fontSize="8" fontWeight="700" fill="#fff">v1 score=720 [t=0…]</text>
            <text x={VER1_X + 45} y={TBL_LANE_Y - 8} textAnchor="middle"
              fontSize="8" fontFamily="monospace" fill="#f59e0b" opacity={0.7}>effective t=0</text>
          </g>
        )}

        {/* Customer v2 (effective from t=20) */}
        {showVer2 && (
          <g opacity={phase === 3 ? eased : 1}>
            <rect x={VER2_X} y={TBL_LANE_Y + 2} width="90" height={TBL_LANE_Y2 - TBL_LANE_Y - 4} rx="4"
              fill="#f97316" opacity={0.75} />
            <text x={VER2_X + 45} y={TBL_LANE_Y + 14} textAnchor="middle"
              fontSize="8" fontWeight="700" fill="#fff">v2 score=735 [t=20…]</text>
            <text x={VER2_X + 45} y={TBL_LANE_Y - 8} textAnchor="middle"
              fontSize="8" fontFamily="monospace" fill="#f97316" opacity={0.7}>UPDATE t=20</text>
            {/* Update badge */}
            {phase === 3 && eased > 0.4 && (
              <g opacity={(eased - 0.4) / 0.6}>
                <rect x={VER2_X + 25} y={TBL_LANE_Y - 26} width="40" height="14" rx="7"
                  fill="#f97316" />
                <text x={VER2_X + 45} y={TBL_LANE_Y - 15} textAnchor="middle"
                  fontSize="8" fontWeight="700" fill="#fff">UPDATE</text>
              </g>
            )}
          </g>
        )}

        {/* ── OUTPUT RESULTS ── */}
        <text x={OUT_X + 50} y="60" textAnchor="middle" fontSize="9" fontWeight="700"
          fill="var(--color-text-primary)" opacity={0.6}>ENRICHED OUTPUT</text>

        {showResult1 && (
          <g opacity={phase === 2 ? connector1Progress : 1}>
            <rect x={OUT_X} y={OUT_Y1} width="110" height="30" rx="5"
              fill="rgba(16,185,129,0.12)" stroke="#10b981" strokeWidth={showHistoricalHighlight ? 2 : 1}
              filter={showHistoricalHighlight ? 'url(#tj-glow)' : undefined} />
            <text x={OUT_X + 55} y={OUT_Y1 + 11} textAnchor="middle"
              fontSize="8" fontWeight="700" fill="#10b981">L-1 (AS OF t=10)</text>
            <text x={OUT_X + 55} y={OUT_Y1 + 23} textAnchor="middle"
              fontSize="9" fontWeight="800" fill="#10b981">score = 720</text>
            {/* "Still 720!" callout during phase 5+ */}
            {showHistoricalHighlight && (
              <g opacity={highlightOpacity}>
                <rect x={OUT_X - 2} y={OUT_Y1 - 2} width="114" height="34" rx="6"
                  fill="none" stroke="#10b981" strokeWidth="2" />
                <rect x={OUT_X + 20} y={OUT_Y1 - 16} width="70" height="14" rx="7"
                  fill="#10b981" />
                <text x={OUT_X + 55} y={OUT_Y1 - 6} textAnchor="middle"
                  fontSize="8" fontWeight="700" fill="#fff">still 720!</text>
              </g>
            )}
          </g>
        )}

        {showResult2 && (
          <g opacity={phase === 4 ? connector2Progress : 1}>
            <rect x={OUT_X} y={OUT_Y2} width="110" height="30" rx="5"
              fill="rgba(245,158,11,0.12)" stroke="#f59e0b" strokeWidth="1" />
            <text x={OUT_X + 55} y={OUT_Y2 + 11} textAnchor="middle"
              fontSize="8" fontWeight="700" fill="#f59e0b">L-2 (AS OF t=30)</text>
            <text x={OUT_X + 55} y={OUT_Y2 + 23} textAnchor="middle"
              fontSize="9" fontWeight="800" fill="#f59e0b">score = 735</text>
          </g>
        )}

        {/* ── INSIGHT (phase 7) ── */}
        {showInsight && (
          <g opacity={insightOpacity}>
            <rect x="30" y="215" width="500" height="24" rx="6"
              fill="rgba(16,185,129,0.08)" stroke="#10b981" strokeWidth="1" />
            <text x="280" y="231" textAnchor="middle" fontSize="10" fontWeight="600" fill="#10b981">
              AS OF joins to the version that was valid at the event's timestamp
            </text>
          </g>
        )}

        {/* ── STATUS BAR ── */}
        <rect x="0" y="255" width="560" height="40" fill="rgba(255,255,255,0.025)" />
        {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
          <circle key={i} cx={200 + i * 20} cy={265} r={i === phase ? 4 : 2.5}
            fill={i === phase ? '#f59e0b' : 'var(--color-text-primary)'}
            opacity={i === phase ? 0.9 : 0.25} />
        ))}
        <text x="280" y="284" textAnchor="middle" fontSize="10"
          fill="var(--color-text-primary)" opacity={0.7} fontStyle="italic">
          {PHASE_STATUS[phase]}
        </text>
      </svg>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--color-text-primary)', opacity: 0.75 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="2" fill="#3b82f6" opacity={0.85} /></svg>
          Loan event
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="2" fill="#f59e0b" opacity={0.85} /></svg>
          Customer version (v1/v2)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="2" fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth="1" /></svg>
          Enriched result
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="18" height="12">
            <line x1="0" y1="6" x2="18" y2="6" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
          Point-in-time lookup
        </span>
      </div>
    </div>
  );
}
