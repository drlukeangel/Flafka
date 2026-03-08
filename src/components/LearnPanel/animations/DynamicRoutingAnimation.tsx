import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

// Layout
const LE_X = 12;   // LOAN_EVENTS box left
const LE_Y = 30;   // LOAN_EVENTS box top
const LE_W = 148;  // box width
const LE_H = 52;   // box height
const LE_CY = LE_Y + LE_H / 2; // 56

const RT_X = 12;   // ROUTING_TABLE box left
const RT_Y = 155;  // ROUTING_TABLE box top
const RT_W = 148;
const RT_H = 52;
const RT_CY = RT_Y + RT_H / 2; // 181

const JOIN_X = 215;
const JOIN_Y = (LE_CY + RT_CY) / 2; // 118 — midpoint between the two sources

const SPLIT_X = 272;  // horizontal split point (trunk end)
const OUT_END  = 530; // right edge of output lanes

// 4 output lanes
const LANES = [
  { label: 'UNDERWRITING', color: '#3b82f6', y: 45 },
  { label: 'FRAUD OPS',    color: '#ef4444', y: 97 },
  { label: 'COMPLIANCE',   color: '#f97316', y: 152 },
  { label: 'ARCHIVE',      color: '#6366f1', y: 207 },
];

// Events: which lanes they route to (dynamic — different per event type)
const EVENTS = [
  { label: 'MORTGAGE', type: 'loan_type', routes: [0, 2, 3], color: '#3b82f6' }, // 3 of 4 lanes
  { label: 'AUTO',     type: 'loan_type', routes: [1, 3],    color: '#10b981' }, // 2 of 4 lanes
  { label: 'HELOC',    type: 'loan_type', routes: [3],        color: '#f59e0b' }, // 1 of 4 lanes
];

// Phase map: even phases = travel+join, odd phases = fan-out
// Phase 0: setup  1: MORTGAGE→JOIN  2: MORTGAGE fan-out(3)
// Phase 3: AUTO→JOIN  4: AUTO fan-out(2)  5: HELOC→JOIN
// Phase 6: HELOC fan-out(1)  Phase 7: insight
const PHASE_EVENT = [0, 0, 0, 1, 1, 2, 2, 2];

const PHASE_STATUS: string[] = [
  'LOAN_EVENTS + ROUTING_TABLE → JOIN → 4 output lanes',
  'MORTGAGE event joins routing table — 3 matching rules found',
  'MORTGAGE fans out to 3 lanes: UNDERWRITING, COMPLIANCE, ARCHIVE',
  'AUTO event arrives — routing table returns 2 rules',
  'AUTO routes to 2 lanes: FRAUD OPS, ARCHIVE',
  'HELOC event — routing table matches 1 rule only',
  'HELOC routes to 1 lane: ARCHIVE only',
  'Dynamic routing: the table decides at runtime — change rules without redeploying',
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

export function DynamicRoutingAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  const evtIdx = PHASE_EVENT[phase];
  const evt = EVENTS[evtIdx];

  // ── Travel phases: 1, 3, 5 ──
  // Event ball from LOAN_EVENTS right edge → JOIN node (diagonal)
  const isTravelPhase = phase === 1 || phase === 3 || phase === 5;
  const travelBallX = lerp(LE_X + LE_W, JOIN_X, eased);
  const travelBallY = lerp(LE_CY, JOIN_Y, eased);

  // Routing rule beam from ROUTING_TABLE → JOIN (particles pulse upward along diagonal)
  const isRuleActive = isTravelPhase;
  // Animate particles: 3 dots offset along the diagonal from RT to JOIN
  const rtToJoinDist = Math.sqrt(Math.pow(JOIN_X - (RT_X + RT_W), 2) + Math.pow(JOIN_Y - RT_CY, 2));
  const rtDirX = (JOIN_X - (RT_X + RT_W)) / rtToJoinDist;
  const rtDirY = (JOIN_Y - RT_CY) / rtToJoinDist;
  const ruleParticles = isRuleActive ? [0, 0.33, 0.67].map((offset) => {
    const t = (phaseProgress + offset) % 1;
    const dist = easeInOutCubic(t) * rtToJoinDist;
    return {
      x: (RT_X + RT_W) + rtDirX * dist,
      y: RT_CY + rtDirY * dist,
      opacity: t < 0.85 ? 0.7 : 0.7 * (1 - (t - 0.85) / 0.15),
    };
  }) : [];

  // JOIN node glow
  const joinGlow = isTravelPhase && eased > 0.8;

  // ── Fan-out phases: 2, 4, 6 ──
  const isFanPhase = phase === 2 || phase === 4 || phase === 6;
  // Fan-out progress: from JOIN → SPLIT → output end
  const fanP = isFanPhase ? eased : (phase > 2 && phase <= 3 && evtIdx === 0 ? 1 : 0);

  // For each lane in the current event's routes: compute ball position
  const activeFanBalls = isFanPhase ? evt.routes.map((laneIdx) => {
    const lane = LANES[laneIdx];
    // First 30%: trunk from JOIN → SPLIT (horizontal), all share same path
    // Next 70%: branch from SPLIT diagonally to lane Y, then horizontal to OUT_END
    let bx: number, by: number;
    if (fanP < 0.3) {
      const t = fanP / 0.3;
      bx = lerp(JOIN_X, SPLIT_X, t);
      by = JOIN_Y;
    } else {
      const t = (fanP - 0.3) / 0.7;
      const branchT = Math.min(t * 1.8, 1); // branch reaches lane Y quickly
      bx = lerp(SPLIT_X, OUT_END, t);
      by = lerp(JOIN_Y, lane.y, branchT);
    }
    return { bx, by, color: lane.color, label: lane.label.slice(0, 4), laneIdx };
  }) : [];

  // Burst glow at JOIN at fan-out start
  const burstOpacity = isFanPhase && eased < 0.15 ? (1 - eased / 0.15) * 0.8 : 0;

  // ── Routing table highlights ──
  // In travel phases: show which lanes are active for current event
  // Rows correspond to the 3 events in a mini routing table
  const routingHighlight = isTravelPhase || isFanPhase;

  // ── Insight ──
  const insightOpacity = phase === 7 ? eased : 0;

  // ── Settled balls (previously routed events, shown as faint indicators in lanes) ──
  // After phase 2: MORTGAGE events settled in lanes 0,2,3
  // After phase 4: AUTO settled in lanes 1,3
  const settledLanes: { laneIdx: number; color: string }[] = [];
  if (phase >= 3) {
    EVENTS[0].routes.forEach(li => settledLanes.push({ laneIdx: li, color: EVENTS[0].color }));
  }
  if (phase >= 5) {
    EVENTS[1].routes.forEach(li => {
      if (!settledLanes.find(s => s.laneIdx === li)) {
        settledLanes.push({ laneIdx: li, color: EVENTS[1].color });
      }
    });
  }

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="Dynamic routing animation — two sources merge at a JOIN node, then events fan out to 1–4 output lanes depending on runtime routing rules">
        <defs>
          <filter id="dr-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="dr-burst" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {LANES.map((lane, i) => (
            <marker key={i} id={`dr-arr-${i}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={lane.color} opacity="0.5" />
            </marker>
          ))}
          <marker id="dr-rt-arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(255,255,255,0.3)" />
          </marker>
        </defs>

        {/* ── LEFT: LOAN_EVENTS box ── */}
        <rect x={LE_X} y={LE_Y} width={LE_W} height={LE_H} rx="8"
          fill="var(--color-bg-surface)" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity={0.7} />
        <text x={LE_X + LE_W / 2} y={LE_Y + 16} textAnchor="middle" fontSize="8.5"
          fontWeight="700" fill="#3b82f6">LOAN_EVENTS</text>
        <text x={LE_X + LE_W / 2} y={LE_Y + 28} textAnchor="middle" fontSize="7.5"
          fill="var(--color-text-primary)" opacity={0.5} fontFamily="monospace">stream</text>
        {/* Current event label */}
        {isTravelPhase && (
          <text x={LE_X + LE_W / 2} y={LE_Y + 43} textAnchor="middle" fontSize="8"
            fontWeight="700" fill={evt.color}>
            {evt.label}
          </text>
        )}

        {/* ── LEFT: ROUTING_TABLE box ── */}
        <rect x={RT_X} y={RT_Y} width={RT_W} height={RT_H} rx="8"
          fill="var(--color-bg-surface)" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity={0.7} />
        <text x={RT_X + RT_W / 2} y={RT_Y + 16} textAnchor="middle" fontSize="8.5"
          fontWeight="700" fill="#f59e0b">ROUTING_TABLE</text>
        <text x={RT_X + RT_W / 2} y={RT_Y + 28} textAnchor="middle" fontSize="7.5"
          fill="var(--color-text-primary)" opacity={0.5} fontFamily="monospace">lookup table</text>
        {/* Route count badge */}
        {routingHighlight && (
          <g opacity={eased}>
            <rect x={RT_X + 30} y={RT_Y + 34} width={RT_W - 60} height="14" rx="4"
              fill="#f59e0b" fillOpacity={0.15} stroke="#f59e0b" strokeWidth="0.8" />
            <text x={RT_X + RT_W / 2} y={RT_Y + 45} textAnchor="middle" fontSize="8"
              fontWeight="700" fill="#f59e0b">
              {evt.routes.length} {evt.routes.length === 1 ? 'rule' : 'rules'} matched
            </text>
          </g>
        )}

        {/* ── Connecting lines: sources → JOIN ── */}
        {/* LOAN_EVENTS → JOIN */}
        <line x1={LE_X + LE_W} y1={LE_CY} x2={JOIN_X - 7} y2={JOIN_Y}
          stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        {/* ROUTING_TABLE → JOIN */}
        <line x1={RT_X + RT_W} y1={RT_CY} x2={JOIN_X - 7} y2={JOIN_Y}
          stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

        {/* ── JOIN node ── */}
        <circle cx={JOIN_X} cy={JOIN_Y} r="9"
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.4)" strokeWidth="2"
          filter={joinGlow ? 'url(#dr-glow)' : undefined} />
        <text x={JOIN_X} y={JOIN_Y + 4} textAnchor="middle" fontSize="8"
          fontWeight="700" fill="rgba(255,255,255,0.6)">⋈</text>

        {/* JOIN label */}
        <text x={JOIN_X} y={JOIN_Y - 14} textAnchor="middle" fontSize="7.5"
          fill="var(--color-text-primary)" opacity={0.4}>JOIN</text>

        {/* ── Trunk: JOIN → SPLIT_X ── */}
        <line x1={JOIN_X + 9} y1={JOIN_Y} x2={SPLIT_X} y2={JOIN_Y}
          stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

        {/* ── OUTPUT LANES: 4 branches from SPLIT_X ── */}
        {LANES.map((lane, i) => {
          const isActiveForCurrent = evt.routes.includes(i);
          const opacity = routingHighlight ? (isActiveForCurrent ? 0.8 : 0.18) : 0.3;
          return (
            <g key={i}>
              {/* Diagonal stub from SPLIT to lane Y */}
              <line x1={SPLIT_X} y1={JOIN_Y} x2={SPLIT_X + 18} y2={lane.y}
                stroke={lane.color} strokeWidth="1.2" opacity={opacity * 0.8} />
              {/* Horizontal lane arrow */}
              <line x1={SPLIT_X + 18} y1={lane.y} x2={OUT_END - 6} y2={lane.y}
                stroke={lane.color} strokeWidth={routingHighlight && isActiveForCurrent ? 2 : 1.2}
                opacity={opacity}
                markerEnd={`url(#dr-arr-${i})`} />
              {/* Lane label */}
              <text x={SPLIT_X + 22} y={lane.y - 8} fontSize="8" fontWeight="700"
                fill={lane.color} opacity={opacity * 1.1}>{lane.label}</text>
              {/* Route count indicator */}
              {routingHighlight && isActiveForCurrent && (
                <g opacity={eased}>
                  <rect x={SPLIT_X + 22} y={lane.y + 4} width="12" height="10" rx="3"
                    fill={lane.color} fillOpacity={0.2} />
                  <text x={SPLIT_X + 28} y={lane.y + 12} textAnchor="middle" fontSize="7"
                    fontWeight="700" fill={lane.color}>✓</text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Rule particles: ROUTING_TABLE → JOIN ── */}
        {ruleParticles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3"
            fill="#f59e0b" opacity={p.opacity} />
        ))}

        {/* ── Travel ball: event → JOIN ── */}
        {isTravelPhase && (
          <g filter={eased > 0.7 ? 'url(#dr-glow)' : undefined}>
            <circle cx={travelBallX} cy={travelBallY} r="13"
              fill={evt.color} fillOpacity={0.18} stroke={evt.color} strokeWidth="1.8" />
            <text x={travelBallX} y={travelBallY + 4} textAnchor="middle" fontSize="6.5"
              fontWeight="700" fill={evt.color}>{evt.label.slice(0, 4)}</text>
          </g>
        )}

        {/* ── Burst at JOIN on fan-out start ── */}
        {burstOpacity > 0.02 && (
          <circle cx={JOIN_X} cy={JOIN_Y} r="18" fill="rgba(255,255,255,0.2)"
            stroke="rgba(255,255,255,0.4)" strokeWidth="2"
            opacity={burstOpacity} filter="url(#dr-burst)" />
        )}

        {/* ── Fan-out balls ── */}
        {activeFanBalls.map((b, i) => (
          <g key={i}>
            <circle cx={b.bx} cy={b.by} r="11"
              fill={b.color} fillOpacity={0.2} stroke={b.color} strokeWidth="1.6"
              opacity={Math.min(fanP * 5, 1)} />
          </g>
        ))}

        {/* ── Settled lane indicators (previous events) ── */}
        {settledLanes.map((s, i) => {
          const lane = LANES[s.laneIdx];
          const xPos = OUT_END - 35 - (i % 3) * 18;
          return (
            <circle key={i} cx={xPos} cy={lane.y} r="6"
              fill={s.color} fillOpacity={0.15} stroke={s.color} strokeWidth="1.2"
              opacity={0.5} />
          );
        })}

        {/* ── Route count label at JOIN during fan-out ── */}
        {isFanPhase && fanP > 0.1 && (
          <g opacity={Math.min(fanP * 3, 1)}>
            <rect x={JOIN_X - 28} y={JOIN_Y + 13} width="56" height="16" rx="5"
              fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
            <text x={JOIN_X} y={JOIN_Y + 25} textAnchor="middle" fontSize="8.5"
              fontWeight="700" fill="rgba(255,255,255,0.75)">
              → {evt.routes.length} {evt.routes.length === 1 ? 'lane' : 'lanes'}
            </text>
          </g>
        )}

        {/* ── Phase 7: insight ── */}
        {phase === 7 && insightOpacity > 0 && (
          <g opacity={insightOpacity}>
            <rect x="20" y="228" width="520" height="22" rx="6"
              fill="rgba(245,158,11,0.08)" stroke="#f59e0b" strokeWidth="1" />
            <text x="280" y="243" textAnchor="middle" fontSize="9.5" fontWeight="600"
              fill="#f59e0b">
              Routing table decides at runtime — add rules without touching SQL
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

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--color-text-primary)', opacity: 0.75 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill="#3b82f6" opacity="0.7" /></svg>
          UNDERWRITING
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill="#ef4444" opacity="0.7" /></svg>
          FRAUD OPS
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill="#f97316" opacity="0.7" /></svg>
          COMPLIANCE
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill="#6366f1" opacity="0.7" /></svg>
          ARCHIVE
        </span>
      </div>
    </div>
  );
}
