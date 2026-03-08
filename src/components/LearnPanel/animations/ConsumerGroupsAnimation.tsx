import { useState, useEffect } from 'react';
import './animations.css';
import { useAnimationSpeed } from './AnimationSpeedContext';

/* ---------------------------------------------------------------------------
   Layout constants
   --------------------------------------------------------------------------- */
const TOPIC_X = 20;
const TOPIC_Y = 38;
const TOPIC_W = 280;
const TOPIC_H = 160;

const PART_X = TOPIC_X + 14;
const PART_W = TOPIC_W - 28;
const PART_H = 18;
const PART_GAP = 6;
const PART_Y0 = TOPIC_Y + 28;

const CG_X = 370;
const CG_Y = 32;
const CG_W = 230;
const CG_H = 174;

const CONSUMER_W = 86;
const CONSUMER_H = 34;
const CONSUMER_X = CG_X + 18;

const PHASE_DURATION = 2200;
const TOTAL_PHASES = 7;

/* Partition colours — six distinct but harmonious hues */
const PART_COLORS = ['#3b82f6', '#6366f1', '#0ea5e9', '#8b5cf6', '#2563eb', '#7c3aed'];

/* Consumer fill */
const CONSUMER_COLOR = '#8b5cf6';

/* ---------------------------------------------------------------------------
   Easing
   --------------------------------------------------------------------------- */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ---------------------------------------------------------------------------
   Helper: partition Y position
   --------------------------------------------------------------------------- */
function partY(idx: number): number {
  return PART_Y0 + idx * (PART_H + PART_GAP);
}

/* ---------------------------------------------------------------------------
   Assignment configurations per phase-group
   --------------------------------------------------------------------------- */
interface Assignment {
  consumers: string[];          // labels
  map: Record<number, number>; // partition -> consumer index
  crashed?: number;            // index of crashed consumer (undefined = none)
}

const ASSIGN_INITIAL: Assignment = {
  consumers: ['C1', 'C2'],
  map: { 0: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 },
};

const ASSIGN_THREE: Assignment = {
  consumers: ['C1', 'C2', 'C3'],
  map: { 0: 0, 1: 0, 2: 1, 3: 1, 4: 2, 5: 2 },
};

const ASSIGN_AFTER_CRASH: Assignment = {
  consumers: ['C1', 'C2', 'C3'],
  map: { 0: 0, 1: 0, 2: 0, 3: 2, 4: 2, 5: 2 },
  crashed: 1,
};

/* ---------------------------------------------------------------------------
   Consumer Y positions for 2- and 3-consumer layouts
   --------------------------------------------------------------------------- */
function consumerYPositions(count: number): number[] {
  if (count === 2) return [CG_Y + 30, CG_Y + 80];
  return [CG_Y + 22, CG_Y + 70, CG_Y + 118];
}

/* ---------------------------------------------------------------------------
   Component
   --------------------------------------------------------------------------- */
export function ConsumerGroupsAnimation() {
  const [phase, setPhase] = useState(0);
  const [animProgress, setAnimProgress] = useState(0);
  const { paused } = useAnimationSpeed();

  /* Committed offsets per consumer (by label): partition -> offset */
  const [offsets, setOffsets] = useState<Record<string, Record<number, number>>>({
    C1: {}, C2: {}, C3: {},
  });

  useEffect(() => {
    let frameId: number;
    let startTime = Date.now();
    let currentPhase = 0;

    const resetState = () => {
      setOffsets({ C1: {}, C2: {}, C3: {} });
      currentPhase = 0;
      startTime = Date.now();
    };

    const applyPhase = (completed: number) => {
      if (completed === 6) {
        // Phase 6 completed — show offsets advancing
        setOffsets({
          C1: { 0: 42, 1: 37 },
          C2: { 2: 18, 3: 25 },
          C3: { 4: 31, 5: 12 },
        });
      }
    };

    const tick = () => {
      if (paused) { frameId = requestAnimationFrame(tick); return; }
      const elapsed = Date.now() - startTime;
      const phaseIndex = Math.floor(elapsed / PHASE_DURATION);
      const phaseProgress = (elapsed % PHASE_DURATION) / PHASE_DURATION;

      if (phaseIndex >= TOTAL_PHASES) {
        resetState();
        setPhase(0);
        setAnimProgress(0);
        frameId = requestAnimationFrame(tick);
        return;
      }

      if (phaseIndex !== currentPhase) {
        applyPhase(currentPhase);
        currentPhase = phaseIndex;
      }

      setPhase(phaseIndex);
      setAnimProgress(phaseProgress);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [paused]);

  /* -----------------------------------------------------------------------
     Derived state based on current phase
     ----------------------------------------------------------------------- */
  const eased = easeInOutCubic(Math.min(animProgress * 1.3, 1));

  // Which assignment is active?
  let assign: Assignment;
  if (phase <= 1) assign = ASSIGN_INITIAL;
  else if (phase <= 3) assign = ASSIGN_THREE;
  else assign = ASSIGN_AFTER_CRASH;

  // Is a rebalance happening right now?
  const isRebalancing = phase === 2 || phase === 4;

  // During rebalancing phases, interpolate between old and new assignments
  let prevAssign: Assignment | null = null;
  if (phase === 2) prevAssign = ASSIGN_INITIAL;
  if (phase === 4) prevAssign = ASSIGN_THREE;

  const consumerCount = assign.consumers.length;
  const cYPositions = consumerYPositions(consumerCount);

  // Previous consumer Y positions for rebalancing interpolation
  const prevCYPositions = prevAssign ? consumerYPositions(prevAssign.consumers.length) : cYPositions;

  /* -----------------------------------------------------------------------
     Phase labels
     ----------------------------------------------------------------------- */
  const getPhaseLabel = (): string => {
    switch (phase) {
      case 0: return 'Consumer Group "processors" — 2 consumers share 6 partitions';
      case 1: return 'Messages flow from partitions to assigned consumers';
      case 2: return 'Consumer 3 joins — rebalancing partitions...';
      case 3: return 'Balanced: C1->P0,P1  C2->P2,P3  C3->P4,P5';
      case 4: return 'Consumer 2 crashed — rebalancing!';
      case 5: return 'Rebalanced: C1->P0,P1,P2  C3->P3,P4,P5';
      case 6: return 'Each consumer tracks its own committed offsets independently';
      default: return '';
    }
  };

  /* -----------------------------------------------------------------------
     Compute assignment line endpoints
     ----------------------------------------------------------------------- */
  interface AssignLine {
    px: number; py: number; cx: number; cy: number; opacity: number;
    partIdx: number; consumerIdx: number;
  }

  const getAssignmentLines = (): AssignLine[] => {
    const lines: AssignLine[] = [];

    if (isRebalancing && prevAssign) {
      // Fade out old lines, fade in new lines
      const fadeOut = 1 - eased;
      const fadeIn = eased;

      // Old lines fading out
      for (let p = 0; p < 6; p++) {
        const ci = prevAssign.map[p];
        const yArr = prevCYPositions;
        if (ci < yArr.length) {
          lines.push({
            px: PART_X + PART_W, py: partY(p) + PART_H / 2,
            cx: CONSUMER_X, cy: CG_Y + yArr[ci] - CG_Y + CONSUMER_H / 2,
            opacity: fadeOut * 0.5,
            partIdx: p, consumerIdx: ci,
          });
        }
      }

      // New lines fading in
      for (let p = 0; p < 6; p++) {
        const ci = assign.map[p];
        if (assign.crashed !== undefined && ci === assign.crashed) continue;
        lines.push({
          px: PART_X + PART_W, py: partY(p) + PART_H / 2,
          cx: CONSUMER_X, cy: cYPositions[ci] + CONSUMER_H / 2,
          opacity: fadeIn * 0.5,
          partIdx: p, consumerIdx: ci,
        });
      }
    } else {
      // Static assignment lines
      for (let p = 0; p < 6; p++) {
        const ci = assign.map[p];
        if (assign.crashed !== undefined && ci === assign.crashed) continue;
        lines.push({
          px: PART_X + PART_W, py: partY(p) + PART_H / 2,
          cx: CONSUMER_X, cy: cYPositions[ci] + CONSUMER_H / 2,
          opacity: 0.45,
          partIdx: p, consumerIdx: ci,
        });
      }
    }

    return lines;
  };

  /* -----------------------------------------------------------------------
     Messages flowing from partitions to consumers (phases 1, 3, 5)
     ----------------------------------------------------------------------- */
  interface FlowingMessage {
    id: number; fromX: number; fromY: number; toX: number; toY: number;
    progress: number; color: string; partIdx: number;
  }

  const getFlowingMessages = (): FlowingMessage[] => {
    const msgs: FlowingMessage[] = [];
    if (phase !== 1 && phase !== 3 && phase !== 5) return msgs;

    // Stagger messages across partitions
    for (let p = 0; p < 6; p++) {
      const ci = assign.map[p];
      if (assign.crashed !== undefined && ci === assign.crashed) continue;

      // Two waves of messages per phase
      const waveOffset = (p % 3) * 0.15;
      const rawProgress1 = animProgress * 1.4 - waveOffset;
      const rawProgress2 = animProgress * 1.4 - waveOffset - 0.5;

      for (const rawP of [rawProgress1, rawProgress2]) {
        const clampedP = Math.max(0, Math.min(1, rawP));
        if (clampedP <= 0 || clampedP >= 1) continue;
        const ep = easeInOutCubic(clampedP);

        msgs.push({
          id: phase * 100 + p * 10 + (rawP === rawProgress1 ? 0 : 1),
          fromX: PART_X + PART_W - 4,
          fromY: partY(p) + PART_H / 2 - 5,
          toX: CONSUMER_X - 4,
          toY: cYPositions[ci] + CONSUMER_H / 2 - 5,
          progress: ep,
          color: PART_COLORS[p],
          partIdx: p,
        });
      }
    }
    return msgs;
  };

  /* -----------------------------------------------------------------------
     Offset display (phase 6)
     ----------------------------------------------------------------------- */
  const showOffsets = phase === 6;

  const assignmentLines = getAssignmentLines();
  const flowingMessages = getFlowingMessages();

  /* For phase 6, use ASSIGN_AFTER_CRASH without crash styling */
  const phase6Assign: Assignment = {
    consumers: ['C1', 'C2', 'C3'],
    map: { 0: 0, 1: 0, 2: 0, 3: 2, 4: 2, 5: 2 },
  };
  const offsetAssign = showOffsets ? phase6Assign : assign;

  return (
    <div className="concept-animation">
      <h4>Consumer Groups: Scaling &amp; Fault Tolerance</h4>
      <svg viewBox="0 0 620 320" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
        <defs>
          <marker id="cg-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-border)" />
          </marker>
          <marker id="cg-arrow-purple" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={CONSUMER_COLOR} />
          </marker>
          {/* Glow filter for messages */}
          <filter id="cg-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Pulse filter for rebalancing */}
          <filter id="cg-pulse">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ============================================================
            TOPIC BOX (LEFT)
            ============================================================ */}
        <rect x={TOPIC_X} y={TOPIC_Y} width={TOPIC_W} height={TOPIC_H} rx="6"
          fill="var(--color-surface, #1e293b)" stroke="#3b82f6" strokeWidth="1.5" opacity="0.9" />
        <text x={TOPIC_X + TOPIC_W / 2} y={TOPIC_Y + 16} textAnchor="middle"
          fontSize="9" fontWeight="bold" fill="#3b82f6">
          Topic: &quot;loan-events&quot;  (6 partitions)
        </text>

        {/* Partitions */}
        {Array.from({ length: 6 }).map((_, p) => {
          const y = partY(p);
          return (
            <g key={`part-${p}`}>
              {/* Partition slot */}
              <rect x={PART_X} y={y} width={PART_W} height={PART_H} rx="3"
                fill={PART_COLORS[p]} opacity="0.12"
                stroke={PART_COLORS[p]} strokeWidth="1" />
              {/* Label */}
              <text x={PART_X + 6} y={y + PART_H / 2 + 1} dominantBaseline="middle"
                fontSize="7.5" fontWeight="bold" fill={PART_COLORS[p]}>
                P{p}
              </text>
              {/* Mini message cells inside partition */}
              {Array.from({ length: 8 }).map((_, c) => (
                <rect key={c} x={PART_X + 24 + c * 28} y={y + 3} width="24" height={PART_H - 6} rx="2"
                  fill={PART_COLORS[p]} opacity={0.15 + (c % 3) * 0.08}
                  stroke={PART_COLORS[p]} strokeWidth="0.4" />
              ))}
              {/* Offset marker for phase 6 */}
              {showOffsets && (
                <g>
                  {/* Advancing offset indicator */}
                  {(() => {
                    const ci = offsetAssign.map[p];
                    const cLabel = offsetAssign.consumers[ci];
                    const off = offsets[cLabel]?.[p];
                    if (off === undefined) return null;
                    const markerProgress = easeInOutCubic(Math.min(animProgress * 1.5, 1));
                    const markerX = PART_X + 24 + markerProgress * (PART_W - 48);
                    return (
                      <g>
                        <line x1={markerX} y1={y - 1} x2={markerX} y2={y + PART_H + 1}
                          stroke="#f59e0b" strokeWidth="2" opacity={0.9} />
                        <polygon
                          points={`${markerX - 4},${y - 4} ${markerX + 4},${y - 4} ${markerX},${y}`}
                          fill="#f59e0b" opacity="0.9" />
                        <text x={markerX} y={y - 7} textAnchor="middle"
                          fontSize="6" fontWeight="bold" fill="#f59e0b">
                          off:{off}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              )}
            </g>
          );
        })}

        {/* ============================================================
            ASSIGNMENT LINES (CENTER)
            ============================================================ */}
        {assignmentLines.map((line, i) => (
          <line key={`aline-${i}`}
            x1={line.px + 4} y1={line.py}
            x2={line.cx - 2} y2={line.cy}
            stroke={CONSUMER_COLOR} strokeWidth="1"
            strokeDasharray="4,3" opacity={line.opacity}
            markerEnd="url(#cg-arrow-purple)" />
        ))}

        {/* ============================================================
            CONSUMER GROUP BOX (RIGHT)
            ============================================================ */}
        <rect x={CG_X} y={CG_Y} width={CG_W} height={CG_H} rx="6"
          fill={CONSUMER_COLOR} opacity="0.06"
          stroke={CONSUMER_COLOR} strokeWidth="1.5" strokeDasharray="6,3" />
        <text x={CG_X + CG_W / 2} y={CG_Y + 14} textAnchor="middle"
          fontSize="8" fontWeight="bold" fill={CONSUMER_COLOR} opacity="0.8">
          Consumer Group: &quot;processors&quot;
        </text>

        {/* Consumers */}
        {assign.consumers.map((label, ci) => {
          const isCrashed = assign.crashed === ci;
          const yPos = cYPositions[ci];

          // Which partitions does this consumer own?
          const ownedParts = Object.entries(assign.map)
            .filter(([, v]) => v === ci)
            .map(([k]) => `P${k}`)
            .join(', ');

          // For phase 2 rebalancing, animate consumer 3 appearing
          let consumerOpacity = 1;
          if (phase === 2 && ci === 2) {
            consumerOpacity = eased; // fade in
          }

          // Crashed consumer styling (phase 4-5)
          const crashOpacity = isCrashed
            ? Math.max(0.15, 1 - eased * 0.85)
            : consumerOpacity;
          const fillColor = isCrashed ? '#ef4444' : CONSUMER_COLOR;
          const strokeColor = isCrashed ? '#ef4444' : CONSUMER_COLOR;

          return (
            <g key={`consumer-${ci}`} opacity={crashOpacity}>
              <rect x={CONSUMER_X} y={yPos} width={CONSUMER_W} height={CONSUMER_H} rx="5"
                fill={fillColor} opacity="0.15"
                stroke={strokeColor} strokeWidth="1.5" />
              <text x={CONSUMER_X + CONSUMER_W / 2} y={yPos + 13} textAnchor="middle"
                fontSize="8.5" fontWeight="bold" fill={fillColor}>
                {label}
                {isCrashed ? ' (crashed)' : ''}
              </text>
              {!isCrashed && (
                <text x={CONSUMER_X + CONSUMER_W / 2} y={yPos + 24} textAnchor="middle"
                  fontSize="6.5" fill={fillColor} opacity="0.7">
                  {ownedParts || 'none'}
                </text>
              )}
              {isCrashed && (
                <text x={CONSUMER_X + CONSUMER_W / 2} y={yPos + 24} textAnchor="middle"
                  fontSize="6.5" fill="#ef4444" opacity="0.7">
                  disconnected
                </text>
              )}
              {/* Offset display for phase 6 */}
              {showOffsets && !isCrashed && (
                <g>
                  {(() => {
                    const cOffsets = offsets[label];
                    if (!cOffsets || Object.keys(cOffsets).length === 0) return null;
                    const offsetProgress = easeInOutCubic(Math.min(animProgress * 1.5, 1));
                    const entries = Object.entries(cOffsets);
                    return entries.map(([pIdx, off], oi) => {
                      const displayOff = Math.round(off * offsetProgress);
                      return (
                        <text key={`off-${oi}`}
                          x={CONSUMER_X + CONSUMER_W + 6}
                          y={yPos + 10 + oi * 10}
                          fontSize="6" fontWeight="bold" fill="#f59e0b" opacity="0.9">
                          P{pIdx}:off={displayOff}
                        </text>
                      );
                    });
                  })()}
                </g>
              )}
            </g>
          );
        })}

        {/* ============================================================
            FLOWING MESSAGES
            ============================================================ */}
        {flowingMessages.map(msg => {
          const x = msg.fromX + (msg.toX - msg.fromX) * msg.progress;
          const y = msg.fromY + (msg.toY - msg.fromY) * msg.progress;
          return (
            <g key={msg.id} filter="url(#cg-glow)">
              {/* Glow backdrop */}
              <circle cx={x + 5} cy={y + 5} r="7" fill={msg.color} opacity={0.2} />
              {/* Message rectangle */}
              <rect x={x} y={y} width="10" height="10" rx="2"
                fill={msg.color} opacity="0.9" stroke={msg.color} strokeWidth="0.5" />
              <text x={x + 5} y={y + 5} textAnchor="middle" dominantBaseline="middle"
                fontSize="5" fontWeight="bold" fill="#fff" opacity="0.9">
                {msg.partIdx}
              </text>
            </g>
          );
        })}

        {/* ============================================================
            ANNOTATIONS — Rebalancing overlays
            ============================================================ */}
        {phase === 2 && (
          <g>
            <rect x="140" y="210" width="340" height="22" rx="5"
              fill="#f59e0b" opacity={0.08 + Math.sin(animProgress * Math.PI * 4) * 0.06} />
            <text x="310" y="224" textAnchor="middle"
              fontSize="9" fontWeight="bold" fill="#f59e0b"
              opacity={0.7 + Math.sin(animProgress * Math.PI * 4) * 0.3}>
              Rebalancing... partitions redistributing
            </text>
          </g>
        )}

        {phase === 4 && (
          <g>
            <rect x="120" y="210" width="380" height="22" rx="5"
              fill="#ef4444" opacity={0.08 + Math.sin(animProgress * Math.PI * 4) * 0.06} />
            <text x="310" y="224" textAnchor="middle"
              fontSize="9" fontWeight="bold" fill="#ef4444"
              opacity={0.7 + Math.sin(animProgress * Math.PI * 4) * 0.3}>
              Consumer 2 left — rebalancing!
            </text>
          </g>
        )}

        {phase === 6 && (
          <g>
            <rect x="130" y="210" width="360" height="22" rx="5"
              fill="#f59e0b" opacity="0.1" />
            <text x="310" y="224" textAnchor="middle"
              fontSize="8.5" fontWeight="bold" fill="#f59e0b">
              Each consumer independently tracks committed offsets
            </text>
          </g>
        )}

        {/* ============================================================
            STATUS BAR
            ============================================================ */}
        <rect x="30" y="245" width="560" height="20" rx="4"
          fill="var(--color-surface, #1e293b)" stroke="var(--color-border, #334155)" strokeWidth="0.5" />
        {/* Phase progress pips */}
        {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
          <circle key={`pip-${i}`}
            cx={50 + i * 14} cy="255"
            r={i === phase ? 3.5 : 2.5}
            fill={i === phase ? 'var(--color-accent)' : 'var(--color-border, #334155)'}
            opacity={i <= phase ? 1 : 0.3} />
        ))}
        <text x="160" y="258" fontSize="7.5"
          fill="var(--color-text, #94a3b8)">
          {getPhaseLabel()}
        </text>

        {/* ============================================================
            LEGEND
            ============================================================ */}
        <g transform="translate(30, 280)">
          {/* Topic / Partition */}
          <rect x="0" y="2" width="10" height="8" rx="2" fill="#3b82f6" opacity="0.8" />
          <text x="14" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">Partition</text>

          {/* Consumer */}
          <rect x="70" y="2" width="10" height="8" rx="2" fill={CONSUMER_COLOR} opacity="0.8" />
          <text x="84" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">Consumer</text>

          {/* Assignment */}
          <line x1="148" y1="6" x2="168" y2="6"
            stroke={CONSUMER_COLOR} strokeWidth="1" strokeDasharray="3,2" />
          <text x="172" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">Assignment</text>

          {/* Message */}
          <rect x="238" y="2" width="8" height="8" rx="1.5" fill="#3b82f6" opacity="0.9" />
          <text x="250" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">Message</text>

          {/* Crashed */}
          <rect x="305" y="2" width="10" height="8" rx="2" fill="#ef4444" opacity="0.7" />
          <text x="319" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">Crashed</text>

          {/* Offset */}
          <line x1="375" y1="6" x2="385" y2="6" stroke="#f59e0b" strokeWidth="2" />
          <text x="389" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">Offset</text>
        </g>

        {/* ============================================================
            SECONDARY LEGEND — partition colour key
            ============================================================ */}
        <g transform="translate(30, 298)">
          {PART_COLORS.map((c, i) => (
            <g key={`leg-p-${i}`} transform={`translate(${i * 58}, 0)`}>
              <rect x="0" y="2" width="8" height="8" rx="1" fill={c} opacity="0.8" />
              <text x="12" y="9" fontSize="6.5" fill="var(--color-text, #94a3b8)">P{i}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
