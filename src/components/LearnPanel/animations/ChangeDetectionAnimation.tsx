import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const PHASE_STATUS = [
  'LAG() compares each row to its predecessor in the partition',
  'SUBMITTED arrives — LAG is NULL (no predecessor)',
  'PENDING: LAG=SUBMITTED → status changed → emit transition row',
  'APPROVED: LAG=PENDING → emit (PENDING → APPROVED)',
  'Status unchanged? LAG equals current → WHERE filters it out',
  'DECLINED path: SUBMITTED → DECLINED in one hop',
  'Transition rows accumulate — every flip captured',
  'LAG + WHERE prev_status <> status = change detection',
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

const TL_Y = 70;          // C-001 timeline Y
const TL2_Y = 155;        // C-002 timeline Y
const TL_X0 = 60;
const TL_X1 = 500;

// C-001 bubble positions
const BUBBLES_C001 = [
  { x: 110, label: 'SUBMITTED', color: '#f59e0b', abbr: 'SUB' },
  { x: 230, label: 'PENDING',   color: '#3b82f6', abbr: 'PEND' },
  { x: 350, label: 'APPROVED',  color: '#10b981', abbr: 'APPR' },
];

// C-002 bubbles (only phases 5+)
const BUBBLES_C002 = [
  { x: 110, label: 'SUBMITTED', color: '#f59e0b', abbr: 'SUB' },
  { x: 230, label: 'DECLINED',  color: '#ef4444', abbr: 'DECL' },
];

// Output rows: [fromLabel, toLabel, fromColor, toColor, arrowColor, visiblePhase]
const OUTPUT_ROWS = [
  { from: 'SUBMITTED', to: 'PENDING',   fromColor: '#f59e0b', toColor: '#3b82f6', visiblePhase: 2 },
  { from: 'PENDING',   to: 'APPROVED',  fromColor: '#3b82f6', toColor: '#10b981', visiblePhase: 3 },
  { from: 'SUBMITTED', to: 'DECLINED',  fromColor: '#f59e0b', toColor: '#ef4444', visiblePhase: 5 },
];

const OUT_X = 370;
const OUT_Y_START = 100;
const OUT_ROW_H = 30;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChangeDetectionAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // How many C-001 bubbles are visible
  const c001Count = phase >= 3 ? 3 : phase >= 2 ? 2 : phase >= 1 ? 1 : 0;
  const showC002 = phase >= 5;
  const c002Count = phase >= 5 ? Math.min(2, 1 + (phase >= 5 && phaseProgress > 0.5 ? 1 : 0)) : 0;

  // "No emit" duplicate effect: phase 4 — show faded duplicate bubble
  const showDuplicate = phase === 4;

  // Insight callout
  const showInsight = phase === 7;
  const insightOpacity = showInsight ? 0.7 + 0.3 * Math.sin(phaseProgress * Math.PI * 2) : 0;

  const renderBubble = (bx: number, by: number, bubble: typeof BUBBLES_C001[0], idx: number, visibleCount: number, isCurrent: boolean) => {
    if (idx >= visibleCount) return null;
    const isNew = idx === visibleCount - 1 && isCurrent;
    const op = isNew ? Math.max(0.2, eased) : 1;
    const r = 18;
    return (
      <g key={`bubble-${by}-${idx}`} opacity={op}>
        {isNew && eased < 0.7 && (
          <circle cx={bx} cy={by} r={r + 8} fill={bubble.color} opacity={(1 - eased) * 0.3} />
        )}
        <circle cx={bx} cy={by} r={r} fill={bubble.color} opacity={0.85} />
        <text x={bx} y={by + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">
          {bubble.abbr}
        </text>
        {/* Time label above */}
        <text x={bx} y={by - r - 5} textAnchor="middle" fontSize="8"
          fill="var(--color-text-primary)" opacity={0.55} fontFamily="monospace">
          t={idx * 2}
        </text>
        {/* LAG label below first bubble */}
        {idx === 0 && (
          <text x={bx} y={by + r + 12} textAnchor="middle" fontSize="8" fontStyle="italic"
            fill="var(--color-text-primary)" opacity={0.5}>
            LAG=NULL
          </text>
        )}
        {/* LAG arrow between bubbles: draw arrow from prev to this */}
        {idx > 0 && visibleCount > idx && (
          <g opacity={isNew ? eased : 1}>
            <line x1={BUBBLES_C001[idx - 1].x + r} y1={by}
              x2={bx - r - 4} y2={by}
              stroke={bubble.color} strokeWidth="1.5" markerEnd="url(#cd-arrow)" opacity={0.6} />
            <text x={(BUBBLES_C001[idx - 1].x + bx) / 2} y={by - 26} textAnchor="middle"
              fontSize="7.5" fontFamily="monospace" fill={bubble.color} opacity={0.8}>
              LAG={BUBBLES_C001[idx - 1].abbr}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="Change detection animation: LAG() compares adjacent status values to detect transitions">
        <defs>
          <marker id="cd-arrow" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
            <path d="M0,0 L7,2.5 L0,5 Z" fill="rgba(255,255,255,0.5)" />
          </marker>
          <filter id="cd-glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── LABELS ── */}
        <text x={TL_X0 - 6} y={TL_Y - 28} fontSize="9" fontWeight="700"
          fill="var(--color-text-primary)" opacity={0.6}>C-001 timeline</text>

        {/* ── C-001 TIMELINE LINE ── */}
        <line x1={TL_X0} y1={TL_Y} x2={TL_X1} y2={TL_Y}
          stroke="var(--color-text-primary)" strokeWidth="1" opacity={0.2} strokeDasharray="5 3" />
        <polygon points={`${TL_X1},${TL_Y - 4} ${TL_X1 + 10},${TL_Y} ${TL_X1},${TL_Y + 4}`}
          fill="var(--color-text-primary)" opacity={0.2} />

        {/* ── C-001 BUBBLES ── */}
        {BUBBLES_C001.map((b, i) => renderBubble(b.x, TL_Y, b, i, c001Count, phase >= 1 && phase <= 3))}

        {/* ── LAG() LABEL ── */}
        <rect x="8" y="6" width="130" height="20" rx="4"
          fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x="73" y="20" textAnchor="middle" fontSize="9.5" fontWeight="600" fontFamily="monospace"
          fill="var(--color-text-primary)" opacity={0.8}>LAG(status, 1) OVER ()</text>

        {/* ── PHASE 4: "NO EMIT" duplicate bubble ── */}
        {showDuplicate && (
          <g opacity={easeInOutCubic(Math.min(phaseProgress * 2, 1))}>
            <circle cx={350 + 60} cy={TL_Y} r={18} fill="#6b7280" opacity={0.35}
              strokeDasharray="4 3" stroke="#6b7280" strokeWidth="1.5" />
            <text x={350 + 60} y={TL_Y + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#9ca3af">
              APPR
            </text>
            <text x={350 + 60} y={TL_Y - 26} textAnchor="middle" fontSize="7.5" fontFamily="monospace"
              fill="#6b7280">LAG=APPR</text>
            <text x={350 + 60} y={TL_Y + 32} textAnchor="middle" fontSize="8"
              fill="#ef4444" opacity={0.8} fontWeight="600">no emit ✗</text>
          </g>
        )}

        {/* ── C-002 TIMELINE ── */}
        {showC002 && (
          <g opacity={easeInOutCubic(Math.min(phaseProgress * 2, 1))}>
            <text x={TL_X0 - 6} y={TL2_Y - 28} fontSize="9" fontWeight="700"
              fill="var(--color-text-primary)" opacity={0.6}>C-002 timeline</text>
            <line x1={TL_X0} y1={TL2_Y} x2={TL_X1} y2={TL2_Y}
              stroke="var(--color-text-primary)" strokeWidth="1" opacity={0.2} strokeDasharray="5 3" />
            <polygon points={`${TL_X1},${TL2_Y - 4} ${TL_X1 + 10},${TL2_Y} ${TL_X1},${TL2_Y + 4}`}
              fill="var(--color-text-primary)" opacity={0.2} />

            {/* C-002 bubbles */}
            {BUBBLES_C002.slice(0, c002Count + (phaseProgress > 0.45 ? 1 : 0)).map((b, i) => {
              const op = i === 1 && phaseProgress < 0.7 ? eased : 1;
              const r = 18;
              return (
                <g key={`c002-${i}`} opacity={Math.min(1, op)}>
                  <circle cx={b.x} cy={TL2_Y} r={r} fill={b.color} opacity={0.85} />
                  <text x={b.x} y={TL2_Y + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">
                    {b.abbr}
                  </text>
                  <text x={b.x} y={TL2_Y - r - 5} textAnchor="middle" fontSize="8"
                    fill="var(--color-text-primary)" opacity={0.55} fontFamily="monospace">
                    t={i * 2}
                  </text>
                  {i === 0 && (
                    <text x={b.x} y={TL2_Y + r + 12} textAnchor="middle" fontSize="8" fontStyle="italic"
                      fill="var(--color-text-primary)" opacity={0.5}>LAG=NULL</text>
                  )}
                  {i === 1 && (
                    <g>
                      <line x1={BUBBLES_C002[0].x + r} y1={TL2_Y} x2={b.x - r - 4} y2={TL2_Y}
                        stroke={b.color} strokeWidth="1.5" markerEnd="url(#cd-arrow)" opacity={0.6} />
                      <text x={(BUBBLES_C002[0].x + b.x) / 2} y={TL2_Y - 26} textAnchor="middle"
                        fontSize="7.5" fontFamily="monospace" fill={b.color} opacity={0.8}>
                        LAG=SUB
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* ── OUTPUT PANEL ── */}
        <text x={OUT_X + 75} y="38" textAnchor="middle" fontSize="9" fontWeight="700"
          fill="var(--color-text-primary)" opacity={0.6}>TRANSITIONS EMITTED</text>

        {/* Output table header */}
        <rect x={OUT_X} y={OUT_Y_START - 18} width="170" height="18" rx="3"
          fill="rgba(255,255,255,0.06)" />
        <text x={OUT_X + 8} y={OUT_Y_START - 5} fontSize="7.5" fontWeight="700" fontFamily="monospace"
          fill="var(--color-text-primary)" opacity={0.5}>prev_status → new_status</text>

        {OUTPUT_ROWS.map((row, i) => {
          if (row.visiblePhase > phase) return null;
          const isNew = row.visiblePhase === phase;
          const op = isNew ? eased : 1;
          const ry = OUT_Y_START + i * OUT_ROW_H;
          return (
            <g key={`out-${i}`} opacity={op}>
              <rect x={OUT_X} y={ry} width="170" height={OUT_ROW_H - 2} rx="4"
                fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
              <rect x={OUT_X + 4} y={ry + 4} width="56" height={OUT_ROW_H - 10} rx="3"
                fill={row.fromColor} opacity={0.75} />
              <text x={OUT_X + 32} y={ry + 13} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">
                {row.from.slice(0, 4)}
              </text>
              <text x={OUT_X + 67} y={ry + 13} textAnchor="middle" fontSize="10" fill="var(--color-text-primary)" opacity={0.6}>
                →
              </text>
              <rect x={OUT_X + 80} y={ry + 4} width="56" height={OUT_ROW_H - 10} rx="3"
                fill={row.toColor} opacity={0.75} />
              <text x={OUT_X + 108} y={ry + 13} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">
                {row.to.slice(0, 4)}
              </text>
              {isNew && eased < 0.65 && (
                <rect x={OUT_X + 142} y={ry + 4} width="24" height="14" rx="7"
                  fill="#10b981" opacity={0.9} />
              )}
              {isNew && eased < 0.65 && (
                <text x={OUT_X + 154} y={ry + 14} textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">emit</text>
              )}
            </g>
          );
        })}

        {/* ── INSIGHT (phase 7) ── */}
        {showInsight && (
          <g opacity={insightOpacity}>
            <rect x="30" y="215" width="500" height="24" rx="6"
              fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth="1" />
            <text x="280" y="231" textAnchor="middle" fontSize="10" fontWeight="600" fill="#3b82f6">
              LAG + WHERE prev_status &lt;&gt; status detects every status flip
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
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#f59e0b" /></svg>SUBMITTED
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#3b82f6" /></svg>PENDING
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#10b981" /></svg>APPROVED
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#ef4444" /></svg>DECLINED
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#6b7280" opacity={0.5} /></svg>No emit (same status)
        </span>
      </div>
    </div>
  );
}
