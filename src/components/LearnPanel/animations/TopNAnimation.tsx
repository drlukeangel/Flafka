import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const PHASE_STATUS = [
  'TUMBLE(30s) collects events, then ROW_NUMBER ranks them',
  '6 loans arrive during the window',
  'Window closes — all events freeze for ranking',
  'ROW_NUMBER ranks by amount DESC: $180k→#1, $145k→#2, $112k→#3',
  'WHERE rownum ≤ 3 — ranks 4,5,6 fade out',
  'Top-3 emit to leaderboard output',
  'New window opens — fresh ranking cycle begins',
  'ROW_NUMBER in subquery + WHERE rownum ≤ 3. Flink re-ranks every window.',
];

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

// 6 loan events with amounts
interface LoanEvent {
  id: number;
  amount: string;
  amountNum: number;
  color: string;
  staggerDelay: number; // 0-1 delay fraction within phase 1
}

const LOANS: LoanEvent[] = [
  { id: 1, amount: '$180k', amountNum: 180, color: '#3b82f6',  staggerDelay: 0.00 },
  { id: 2, amount: '$95k',  amountNum: 95,  color: '#6366f1',  staggerDelay: 0.15 },
  { id: 3, amount: '$145k', amountNum: 145, color: '#8b5cf6',  staggerDelay: 0.28 },
  { id: 4, amount: '$60k',  amountNum: 60,  color: '#14b8a6',  staggerDelay: 0.40 },
  { id: 5, amount: '$112k', amountNum: 112, color: '#f59e0b',  staggerDelay: 0.55 },
  { id: 6, amount: '$40k',  amountNum: 40,  color: '#f97316',  staggerDelay: 0.70 },
];

// Sorted by amount DESC for ranking phase
const SORTED_LOANS = [...LOANS].sort((a, b) => b.amountNum - a.amountNum);
// Ranks: #1=180k, #2=145k, #3=112k, #4=95k, #5=60k, #6=40k

// Window box geometry
const WIN_X = 175;
const WIN_Y = 30;
const WIN_W = 170;
const WIN_H = 185;

// Window slots (2 columns × 3 rows)
const SLOT_POSITIONS = [
  { x: WIN_X + 20,  y: WIN_Y + 40 },  // id1
  { x: WIN_X + 95,  y: WIN_Y + 40 },  // id2
  { x: WIN_X + 20,  y: WIN_Y + 95 },  // id3
  { x: WIN_X + 95,  y: WIN_Y + 95 },  // id4
  { x: WIN_X + 20,  y: WIN_Y + 150 }, // id5
  { x: WIN_X + 95,  y: WIN_Y + 150 }, // id6
];

// Ranked slot positions (single column, sorted)
const RANKED_POSITIONS = SORTED_LOANS.map((_, i) => ({
  x: WIN_X + 20,
  y: WIN_Y + 30 + i * 26,
}));

// Leaderboard geometry
const LB_X = 385;
const LB_Y = 50;
const LB_W = 155;
const LB_ROW_H = 36;

// Input lane
const IN_X = 30;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopNAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Phase 1: events stagger into the window box
  const getEventOpacity = (loan: LoanEvent): number => {
    if (phase === 0) return 0;
    if (phase >= 2) return 1;
    // Phase 1: staggered arrival
    const local = Math.max(0, (phaseProgress - loan.staggerDelay) / (1 - loan.staggerDelay));
    return easeInOutCubic(Math.min(local * 1.5, 1));
  };

  const getEventX = (loan: LoanEvent, idx: number): number => {
    if (phase <= 1) return SLOT_POSITIONS[idx].x;
    if (phase === 2) return SLOT_POSITIONS[idx].x;
    // Phase 3: reorder to ranked positions
    const rankedIdx = SORTED_LOANS.findIndex(l => l.id === loan.id);
    const fromX = SLOT_POSITIONS[idx].x;
    const toX = RANKED_POSITIONS[rankedIdx].x;
    const moveProgress = phase === 3 ? eased : 1;
    return fromX + (toX - fromX) * moveProgress;
  };

  const getEventY = (loan: LoanEvent, idx: number): number => {
    if (phase <= 1) return SLOT_POSITIONS[idx].y;
    if (phase === 2) return SLOT_POSITIONS[idx].y;
    const rankedIdx = SORTED_LOANS.findIndex(l => l.id === loan.id);
    const fromY = SLOT_POSITIONS[idx].y;
    const toY = RANKED_POSITIONS[rankedIdx].y;
    const moveProgress = phase === 3 ? eased : 1;
    return fromY + (toY - fromY) * moveProgress;
  };

  // Phase 4: ranks 4,5,6 fade out (rownum > 3)
  const getFadeOpacity = (loan: LoanEvent): number => {
    const rank = SORTED_LOANS.findIndex(l => l.id === loan.id) + 1;
    if (rank <= 3) return 1;
    if (phase < 4) return 1;
    if (phase === 4) return 1 - eased * 0.85;
    if (phase >= 5) return 0.1;
    return 1;
  };

  // Phase 5: top-3 slide to leaderboard
  const leaderboardVisible = phase >= 5;
  const lbProgress = phase === 5 ? eased : 1;

  // Window close flash (phase 2)
  const closingFlash = phase === 2 ? Math.abs(Math.sin(phaseProgress * Math.PI * 4)) * 0.4 : 0;

  // New window (phase 6)
  const showNewWindow = phase >= 6;
  const newWinOpacity = phase === 6 ? eased : 1;

  // Window border style
  const winBorderColor = phase >= 2 && phase <= 5 ? '#f59e0b' : '#3b82f6';
  const winStrokeDash = phase === 0 ? '6 3' : 'none';

  // Rank labels (phase 3+)
  const showRankLabels = phase >= 3;

  // "CLOSED" badge (phase 2+)
  const showClosedBadge = phase >= 2;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="Top-N animation: ROW_NUMBER inside tumble window ranks loans and emits top 3">
        <defs>
          <filter id="tn-glow">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── INPUT LANE ── */}
        <text x={IN_X + 10} y={WIN_Y - 6} fontSize="9" fontWeight="700"
          fill="var(--color-text-primary)" opacity={0.5}>LOANS</text>
        <line x1={IN_X} y1={WIN_Y} x2={WIN_X} y2={WIN_Y + WIN_H / 2}
          stroke="#3b82f6" strokeWidth="1" opacity={0.2} strokeDasharray="4 3" />
        <polygon points={`${WIN_X - 6},${WIN_Y + WIN_H / 2 - 4} ${WIN_X},${WIN_Y + WIN_H / 2} ${WIN_X - 6},${WIN_Y + WIN_H / 2 + 4}`}
          fill="#3b82f6" opacity={0.25} />

        {/* ── WINDOW BOX ── */}
        <rect x={WIN_X} y={WIN_Y} width={WIN_W} height={WIN_H} rx="8"
          fill={closingFlash > 0 ? `rgba(245,158,11,${closingFlash})` : 'rgba(255,255,255,0.03)'}
          stroke={winBorderColor}
          strokeWidth={phase >= 2 && phase <= 4 ? 2 : 1.5}
          strokeDasharray={winStrokeDash}
          filter={closingFlash > 0.15 ? 'url(#tn-glow)' : undefined} />
        <text x={WIN_X + WIN_W / 2} y={WIN_Y + 16} textAnchor="middle"
          fontSize="9" fontWeight="700" fontFamily="monospace"
          fill={winBorderColor}>TUMBLE(30s)</text>

        {/* CLOSED badge */}
        {showClosedBadge && !showNewWindow && (
          <g opacity={phase === 2 ? eased : 1}>
            <rect x={WIN_X + WIN_W / 2 - 30} y={WIN_Y - 10} width="60" height="16" rx="8"
              fill="#f59e0b" />
            <text x={WIN_X + WIN_W / 2} y={WIN_Y} textAnchor="middle"
              fontSize="8.5" fontWeight="800" fill="#fff">CLOSED</text>
          </g>
        )}

        {/* ── LOAN EVENTS IN WINDOW ── */}
        {phase < 6 && LOANS.map((loan, idx) => {
          const op = getEventOpacity(loan) * getFadeOpacity(loan);
          if (op <= 0.01) return null;
          const ex = getEventX(loan, idx);
          const ey = getEventY(loan, idx);
          const rank = SORTED_LOANS.findIndex(l => l.id === loan.id) + 1;
          const isTop3 = rank <= 3;
          const showRank = showRankLabels && getFadeOpacity(loan) > 0.3;

          return (
            <g key={`loan-${loan.id}`} opacity={op}>
              {/* Box */}
              <rect x={ex} y={ey - 10} width="55" height="22" rx="4"
                fill={loan.color} opacity={0.8}
                stroke={isTop3 && phase >= 3 ? '#fff' : 'none'} strokeWidth="1"
                strokeOpacity={0.4} />
              <text x={ex + 27} y={ey + 4} textAnchor="middle"
                fontSize="9" fontWeight="700" fontFamily="monospace" fill="#fff">
                {loan.amount}
              </text>
              {/* Rank badge */}
              {showRank && (
                <g>
                  <circle cx={ex + 48} cy={ey - 10} r={8} fill={isTop3 ? '#f59e0b' : '#6b7280'} />
                  <text x={ex + 48} y={ey - 6} textAnchor="middle" fontSize="8" fontWeight="800"
                    fill="#fff">#{rank}</text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── LEADERBOARD ── */}
        {leaderboardVisible && (
          <g opacity={lbProgress}>
            <text x={LB_X + LB_W / 2} y={LB_Y - 8} textAnchor="middle"
              fontSize="9" fontWeight="700" fill="#f59e0b" opacity={0.9}>TOP 3 LEADERBOARD</text>

            {SORTED_LOANS.slice(0, 3).map((loan, i) => {
              const ry = LB_Y + i * LB_ROW_H;
              const rankColors = ['#f59e0b', '#94a3b8', '#cd7c2f'];
              const rankLabels = ['#1', '#2', '#3'];
              const delay = i * 0.25;
              const localProg = phase === 5 ? Math.max(0, (eased - delay) / (1 - delay)) : 1;
              const slideX = phase === 5 ? WIN_X + WIN_W + (LB_X - WIN_X - WIN_W) * easeInOutCubic(Math.min(localProg, 1)) : LB_X;

              return (
                <g key={`lb-${i}`} opacity={easeInOutCubic(Math.min(localProg * 1.5, 1))}>
                  <rect x={slideX} y={ry} width={LB_W} height={LB_ROW_H - 4} rx="5"
                    fill={loan.color} fillOpacity={0.15}
                    stroke={loan.color} strokeWidth="1.5" />
                  {/* Rank circle */}
                  <circle cx={slideX + 18} cy={ry + LB_ROW_H / 2 - 2} r={10}
                    fill={rankColors[i]} opacity={0.9} />
                  <text x={slideX + 18} y={ry + LB_ROW_H / 2 + 2} textAnchor="middle"
                    fontSize="9" fontWeight="800" fill="#fff">{rankLabels[i]}</text>
                  {/* Amount */}
                  <text x={slideX + 35} y={ry + LB_ROW_H / 2 - 4} fontSize="11" fontWeight="800"
                    fontFamily="monospace" fill={loan.color}>{loan.amount}</text>
                  <text x={slideX + 35} y={ry + LB_ROW_H / 2 + 9} fontSize="7.5"
                    fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.5}>
                    rownum={i + 1}
                  </text>
                </g>
              );
            })}

            {/* Arrow from window to leaderboard */}
            {phase >= 5 && (
              <g opacity={lbProgress}>
                <line x1={WIN_X + WIN_W + 4} y1={WIN_Y + WIN_H / 2}
                  x2={LB_X - 8} y2={LB_Y + LB_ROW_H}
                  stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" opacity={0.4} />
              </g>
            )}
          </g>
        )}

        {/* ── NEW WINDOW (phase 6) ── */}
        {showNewWindow && (
          <g opacity={newWinOpacity}>
            <rect x={WIN_X} y={WIN_Y} width={WIN_W} height={WIN_H} rx="8"
              fill="rgba(255,255,255,0.025)" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="6 3" />
            <text x={WIN_X + WIN_W / 2} y={WIN_Y + 16} textAnchor="middle"
              fontSize="9" fontWeight="700" fontFamily="monospace" fill="#3b82f6">
              TUMBLE(30s) — new cycle
            </text>
            <text x={WIN_X + WIN_W / 2} y={WIN_Y + WIN_H / 2} textAnchor="middle"
              fontSize="11" fill="var(--color-text-primary)" opacity={0.25}>
              collecting...
            </text>
          </g>
        )}

        {/* ── INSIGHT (phase 7) ── */}
        {phase === 7 && (
          <g opacity={0.7 + 0.3 * Math.sin(phaseProgress * Math.PI * 2)}>
            <rect x="25" y="220" width="510" height="22" rx="6"
              fill="rgba(245,158,11,0.08)" stroke="#f59e0b" strokeWidth="1" />
            <text x="280" y="235" textAnchor="middle" fontSize="10" fontWeight="600" fill="#f59e0b">
              ROW_NUMBER() in subquery + WHERE rownum ≤ 3. Flink re-ranks every window.
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
          <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="2" fill="rgba(59,130,246,0.3)" stroke="#3b82f6" strokeWidth="1" /></svg>
          Window (collecting)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="2" fill="#3b82f6" opacity={0.8} /></svg>
          Loan event
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#f59e0b" /></svg>
          Top-3 rank
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#6b7280" opacity={0.4} /></svg>
          Filtered out (rownum &gt; 3)
        </span>
      </div>
    </div>
  );
}
