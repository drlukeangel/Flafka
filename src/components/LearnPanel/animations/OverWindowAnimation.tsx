import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const PHASE_STATUS = [
  'OVER window: running totals accumulate per customer partition',
  'Loan #1 $10k — running_count=1, running_total=$10k',
  'Loan #2 $15k — running_count=2, running_total=$25k',
  'Loan #3 $8k — running_count=3, running_total=$33k',
  'All 3 rows preserved with their running snapshot',
  'New partition C-002 — counter resets independently',
  'OVER keeps rows; GROUP BY collapses them',
  'OVER adds history context to every row without collapsing',
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

interface LoanRow {
  id: number;
  customer: string;
  amount: string;
  count: number;
  total: string;
  color: string;
  phase: number; // phase when this row appears
}

const LOAN_ROWS: LoanRow[] = [
  { id: 1, customer: 'C-001', amount: '$10k', count: 1, total: '$10k', color: '#3b82f6', phase: 1 },
  { id: 2, customer: 'C-001', amount: '$15k', count: 2, total: '$25k', color: '#3b82f6', phase: 2 },
  { id: 3, customer: 'C-001', amount: '$8k',  count: 3, total: '$33k', color: '#3b82f6', phase: 3 },
  { id: 4, customer: 'C-002', amount: '$12k', count: 1, total: '$12k', color: '#10b981', phase: 5 },
];

// Bar chart heights for accumulator (% of max)
const BAR_HEIGHTS = [0, 0.33, 0.66, 1.0];
const BAR_MAX_H = 80;
const BAR_X = 280;
const BAR_W = 36;
const BAR_BASE_Y = 210;

// Event positions on left lane
const EVENT_Y = [65, 110, 155];
const EVENT_COLORS = ['#3b82f6', '#3b82f6', '#3b82f6'];

// Output table geometry
const OUT_X = 370;
const OUT_ROW_H = 34;
const OUT_Y_START = 50;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OverWindowAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Determine how many C-001 events are visible
  const numVisible = phase >= 3 ? 3 : phase >= 2 ? 2 : phase >= 1 ? 1 : 0;
  const showC002 = phase >= 5;

  // Bar height for C-001 accumulator
  const targetBarIdx = Math.min(numVisible, 3);
  const prevBarIdx = Math.max(0, targetBarIdx - (phase >= 1 && phase <= 3 ? 1 : 0));
  const rawBarH = phase >= 1 && phase <= 3
    ? BAR_HEIGHTS[prevBarIdx] + (BAR_HEIGHTS[targetBarIdx] - BAR_HEIGHTS[prevBarIdx]) * eased
    : BAR_HEIGHTS[targetBarIdx];
  const barH = rawBarH * BAR_MAX_H;

  // C-002 bar height
  const c002BarH = showC002 ? eased * BAR_MAX_H * 0.33 : 0;

  // All-rows highlight in phase 4
  const rowHighlight = phase === 4 ? 0.15 + 0.15 * Math.sin(phaseProgress * Math.PI * 4) : 0;

  // Comparison text phase 6
  const showComparison = phase === 6;
  const compOpacity = showComparison ? easeInOutCubic(Math.min(phaseProgress * 2, 1)) : 0;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }} aria-label="OVER window animation: running aggregates per partition, all rows preserved">
        <defs>
          <filter id="ow-glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── HEADER LABEL ── */}
        <rect x="8" y="6" width="220" height="20" rx="4" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x="118" y="20" textAnchor="middle" fontSize="9.5" fontWeight="600" fontFamily="monospace"
          fill="var(--color-text-primary)" opacity={0.8}>
          PARTITION BY customer_id ORDER BY $rowtime
        </text>

        {/* ── LEFT LANE: EVENT STREAM ── */}
        <text x="45" y="42" textAnchor="middle" fontSize="9" fontWeight="700"
          fill="var(--color-text-primary)" opacity={0.6}>EVENTS</text>
        <line x1="45" y1="48" x2="45" y2="190"
          stroke="var(--color-text-primary)" strokeWidth="1" opacity={0.2} strokeDasharray="4 3" />

        {/* C-001 events */}
        {EVENT_Y.slice(0, numVisible).map((ey, i) => {
          const isNew = numVisible - 1 === i && phase >= 1 && phase <= 3;
          const arriveProgress = isNew ? eased : 1;
          const cy = ey;
          const cx = 45;
          const amounts = ['$10k', '$15k', '$8k'];
          return (
            <g key={`evt-${i}`} opacity={Math.min(1, arriveProgress + 0.1)}>
              {isNew && arriveProgress < 0.9 && (
                <circle cx={cx} cy={cy} r={16} fill={EVENT_COLORS[i]} opacity={(1 - arriveProgress) * 0.3} />
              )}
              <circle cx={cx} cy={cy} r={10} fill={EVENT_COLORS[i]} opacity={0.9} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff">
                {amounts[i]}
              </text>
              <text x={cx + 18} y={cy + 4} fontSize="8" fill="var(--color-text-primary)" opacity={0.6}>
                C-001
              </text>
              {/* Horizontal arrow to accumulator */}
              {arriveProgress > 0.6 && (
                <line x1={cx + 12} y1={cy} x2={BAR_X - 8} y2={cy}
                  stroke={EVENT_COLORS[i]} strokeWidth="1" opacity={0.3} strokeDasharray="3 2" />
              )}
            </g>
          );
        })}

        {/* C-002 event */}
        {showC002 && (
          <g opacity={eased}>
            <circle cx={45} cy={195} r={10} fill="#10b981" opacity={0.9} />
            <text x={45} y={199} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff">$12k</text>
            <text x={63} y={199} fontSize="8" fill="var(--color-text-primary)" opacity={0.6}>C-002</text>
          </g>
        )}

        {/* ── CENTER: ACCUMULATOR BAR CHART ── */}
        <text x={BAR_X + BAR_W / 2} y="38" textAnchor="middle" fontSize="9" fontWeight="700"
          fill="var(--color-text-primary)" opacity={0.6}>RUNNING TOTAL</text>

        {/* C-001 bar background */}
        <rect x={BAR_X} y={BAR_BASE_Y - BAR_MAX_H} width={BAR_W} height={BAR_MAX_H}
          rx="3" fill="rgba(59,130,246,0.08)" stroke="rgba(59,130,246,0.2)" strokeWidth="1" />
        {/* C-001 bar fill */}
        {barH > 0 && (
          <rect x={BAR_X} y={BAR_BASE_Y - barH} width={BAR_W} height={barH}
            rx="3" fill="#3b82f6" opacity={0.7}
            filter={phase >= 1 && phase <= 3 ? 'url(#ow-glow)' : undefined} />
        )}
        <text x={BAR_X + BAR_W / 2} y={BAR_BASE_Y + 12} textAnchor="middle"
          fontSize="8" fill="#3b82f6" opacity={0.8}>C-001</text>
        {barH > 0 && (
          <text x={BAR_X + BAR_W / 2} y={BAR_BASE_Y - barH - 5} textAnchor="middle"
            fontSize="8" fontWeight="700" fill="#3b82f6">
            {numVisible === 1 ? '$10k' : numVisible === 2 ? '$25k' : '$33k'}
          </text>
        )}

        {/* C-002 bar (separate, reset partition) */}
        {showC002 && (
          <g>
            <rect x={BAR_X + BAR_W + 10} y={BAR_BASE_Y - BAR_MAX_H} width={BAR_W} height={BAR_MAX_H}
              rx="3" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.2)" strokeWidth="1" />
            <rect x={BAR_X + BAR_W + 10} y={BAR_BASE_Y - c002BarH} width={BAR_W} height={c002BarH}
              rx="3" fill="#10b981" opacity={0.7} />
            <text x={BAR_X + BAR_W + 10 + BAR_W / 2} y={BAR_BASE_Y + 12} textAnchor="middle"
              fontSize="8" fill="#10b981" opacity={0.8}>C-002</text>
            {c002BarH > 5 && (
              <text x={BAR_X + BAR_W + 10 + BAR_W / 2} y={BAR_BASE_Y - c002BarH - 5} textAnchor="middle"
                fontSize="8" fontWeight="700" fill="#10b981">$12k</text>
            )}
            {/* "Resets!" label */}
            <g opacity={eased}>
              <rect x={BAR_X + BAR_W + 4} y={BAR_BASE_Y - BAR_MAX_H - 18} width="52" height="14" rx="7"
                fill="#10b981" opacity={0.9} />
              <text x={BAR_X + BAR_W + 30} y={BAR_BASE_Y - BAR_MAX_H - 8} textAnchor="middle"
                fontSize="8" fontWeight="700" fill="#fff">resets!</text>
            </g>
          </g>
        )}

        {/* ── RIGHT: OUTPUT TABLE ── */}
        <text x={OUT_X + 80} y="38" textAnchor="middle" fontSize="9" fontWeight="700"
          fill="var(--color-text-primary)" opacity={0.6}>OUTPUT (ALL ROWS KEPT)</text>

        {/* Table header */}
        <rect x={OUT_X} y={OUT_Y_START} width="170" height="20" rx="3"
          fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x={OUT_X + 8}  y={OUT_Y_START + 13} fontSize="7.5" fontWeight="700" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.5}>cust</text>
        <text x={OUT_X + 45} y={OUT_Y_START + 13} fontSize="7.5" fontWeight="700" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.5}>amt</text>
        <text x={OUT_X + 78} y={OUT_Y_START + 13} fontSize="7.5" fontWeight="700" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.5}>run_cnt</text>
        <text x={OUT_X + 130} y={OUT_Y_START + 13} fontSize="7.5" fontWeight="700" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.5}>run_tot</text>

        {/* Output rows */}
        {LOAN_ROWS.map((row, i) => {
          if (row.phase > phase) return null;
          const isNew = row.phase === phase;
          const rowOpacity = isNew ? eased : 1;
          const ry = OUT_Y_START + 20 + i * OUT_ROW_H;
          const highlightExtra = phase === 4 && row.customer === 'C-001' ? rowHighlight : 0;

          return (
            <g key={`row-${row.id}`} opacity={rowOpacity}>
              <rect x={OUT_X} y={ry} width="170" height={OUT_ROW_H - 2} rx="3"
                fill={row.color} fillOpacity={0.08 + highlightExtra}
                stroke={row.color} strokeWidth={isNew ? 1.5 : 0.5} strokeOpacity={0.4} />
              <text x={OUT_X + 8}  y={ry + 14} fontSize="8" fontFamily="monospace" fontWeight="600" fill={row.color}>{row.customer}</text>
              <text x={OUT_X + 45} y={ry + 14} fontSize="8" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.8}>{row.amount}</text>
              <text x={OUT_X + 82} y={ry + 14} fontSize="8" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.8}>{row.count}</text>
              <text x={OUT_X + 130} y={ry + 14} fontSize="8" fontFamily="monospace" fontWeight="700" fill={row.color}>{row.total}</text>
              {/* "NEW" badge on arrival */}
              {isNew && eased < 0.7 && (
                <rect x={OUT_X + 148} y={ry + 4} width="20" height="12" rx="6"
                  fill={row.color} opacity={0.9} />
              )}
              {isNew && eased < 0.7 && (
                <text x={OUT_X + 158} y={ry + 13} textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">NEW</text>
              )}
            </g>
          );
        })}

        {/* ── PHASE 6: COMPARISON TEXT ── */}
        {showComparison && (
          <g opacity={compOpacity}>
            <rect x="20" y="225" width="520" height="22" rx="4"
              fill="rgba(99,102,241,0.1)" stroke="#6366f1" strokeWidth="1" />
            <text x="280" y="240" textAnchor="middle" fontSize="9.5" fontWeight="600"
              fill="#6366f1">
              OVER → {phase >= 5 ? 4 : 3} rows emitted   vs   GROUP BY → {phase >= 5 ? 2 : 1} collapsed rows
            </text>
          </g>
        )}

        {/* ── STATUS BAR ── */}
        <rect x="0" y="255" width="560" height="40" fill="rgba(255,255,255,0.025)" />
        {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
          <circle key={i} cx={200 + i * 20} cy={265} r={i === phase ? 4 : 2.5}
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
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#3b82f6" /></svg>
          Customer C-001
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#10b981" /></svg>
          Customer C-002
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="2" fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth="1" /></svg>
          Running total bar
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="2" fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth="1" /></svg>
          Output row (row preserved)
        </span>
      </div>
    </div>
  );
}
