import './animations.css';
import { useAnimationTick } from './useAnimationTick';

/**
 * HopWindowAnimation
 *
 * Phase-driven SVG animation teaching how hopping (sliding) windows work in
 * Flink SQL. Three overlapping windows (size=30s, hop=10s) demonstrate that a
 * single event can belong to multiple windows simultaneously — the key
 * conceptual difference from tumbling windows.
 *
 * 8 phases, ~1.3s each, ~10.4s cycle with setInterval(50ms) ticks.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26; // ~1.3s per phase
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

// Timeline geometry
const TL_Y = 58;
const TL_X0 = 70;
const TL_X1 = 510;
const TL_RANGE_S = 50; // 0s..50s visible range

// Window lane geometry (stacked vertically below timeline)
const LANE_Y0 = 82;
const LANE_H = 34;
const LANE_GAP = 6;
const LANE_RX = 5;

// Colors
const W_COLORS = ['#3b82f6', '#10b981', '#eab308'] as const; // blue, green, amber
const W_FILLS = ['rgba(59,130,246,0.12)', 'rgba(16,185,129,0.12)', 'rgba(234,179,8,0.12)'];
const W_FILLS_SOLID = ['rgba(59,130,246,0.25)', 'rgba(16,185,129,0.25)', 'rgba(234,179,8,0.25)'];
const OVERLAP_FILL_2 = 'rgba(255,255,255,0.045)';

// Window definitions: [startS, endS]
const WINDOWS: [number, number][] = [
  [0, 30],
  [10, 40],
  [20, 50],
];

// Events: [timeS, label]
interface EventDef {
  timeS: number;
  label: string;
  /** Which window indices this event belongs to */
  windows: number[];
}

const EVENTS: EventDef[] = [
  { timeS: 5, label: 'A', windows: [0] },
  { timeS: 15, label: 'B', windows: [0, 1] },
  { timeS: 25, label: 'C', windows: [0, 1, 2] },
  { timeS: 35, label: 'D', windows: [1, 2] },
];

// Phase status descriptions
const PHASE_STATUS: string[] = [
  'Hop windows overlap: size=30s, hop=10s',
  'Event at t=5s: belongs to Window 1 only',
  'Event at t=15s: belongs to BOTH Window 1 and Window 2!',
  'Event at t=25s: belongs to ALL THREE windows!',
  'Window 1 [0s-30s] closes with 3 events',
  'Event at t=35s: Window 1 closed, only W2 and W3',
  'Window 2 [10s-40s] closes with 3 events',
  'Same events, counted multiple times \u2014 that\u2019s hop windows.',
];

// Window counts per phase (cumulative)
// [W1, W2, W3]
const WIN_COUNTS: [number, number, number][] = [
  [0, 0, 0], // phase 0
  [1, 0, 0], // phase 1: event A
  [2, 1, 0], // phase 2: event B
  [3, 2, 1], // phase 3: event C
  [3, 2, 1], // phase 4: W1 closes
  [3, 3, 2], // phase 5: event D
  [3, 3, 2], // phase 6: W2 closes
  [3, 3, 2], // phase 7: insight
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function timeToX(s: number): number {
  return TL_X0 + ((s / TL_RANGE_S) * (TL_X1 - TL_X0));
}

function laneY(index: number): number {
  return LANE_Y0 + index * (LANE_H + LANE_GAP);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HopWindowAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Derived state
  const w1Closed = phase >= 4;
  const w2Closed = phase >= 6;
  const visibleEvents = EVENTS.filter((_, i) => {
    if (i === 0) return phase >= 1;
    if (i === 1) return phase >= 2;
    if (i === 2) return phase >= 3;
    if (i === 3) return phase >= 5;
    return false;
  });

  // Which event is "newly arriving" this phase (for glow effect)
  const newEventIndex = phase === 1 ? 0 : phase === 2 ? 1 : phase === 3 ? 2 : phase === 5 ? 3 : -1;

  // Connection lines: show dashed lines from event to each window it belongs to
  const showConnectionsFor = (evtIdx: number): boolean => {
    if (evtIdx === 0) return phase >= 1;
    if (evtIdx === 1) return phase >= 2;
    if (evtIdx === 2) return phase >= 3;
    if (evtIdx === 3) return phase >= 5;
    return false;
  };

  const counts = WIN_COUNTS[phase];

  // Window closing flash
  const w1CloseFlash = phase === 4 ? 1 - eased : 0;
  const w2CloseFlash = phase === 6 ? 1 - eased : 0;

  // Insight phase pulsing
  const insightPhase = phase === 7;
  const insightOpacity = insightPhase ? 0.7 + 0.3 * Math.sin(phaseProgress * Math.PI * 2) : 0;

  // Count badge animation: when a count just changed, scale the badge
  const countJustChanged = (wIdx: number): boolean => {
    if (phase === 0) return false;
    const prev = WIN_COUNTS[phase - 1] ?? [0, 0, 0];
    return counts[wIdx] !== prev[wIdx];
  };

  // Phase 0: staggered window appearance
  const windowOpacity = (wIdx: number): number => {
    if (phase > 0) return 1;
    // Stagger: each window fades in over 1/3 of the phase
    const stagger = wIdx * 0.28;
    const local = Math.max(0, phaseProgress - stagger) / 0.33;
    return easeInOutCubic(Math.min(local, 1));
  };

  // Time labels along the timeline
  const timeLabels = [0, 10, 20, 30, 40, 50];

  return (
    <div className="concept-animation">
      <h4
        style={{
          color: 'var(--color-text-primary)',
          margin: '0 0 8px 0',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        How Hop (Sliding) Windows Overlap
      </h4>

      <svg
        viewBox="0 0 560 280"
        style={{ width: '100%', height: 'auto' }}
        role="img"
        aria-label="Hop window animation: three overlapping sliding windows where events belong to multiple windows simultaneously"
      >
        <defs>
          {/* Glow filters for event arrival */}
          <filter id="hw-glow-blue">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="hw-glow-green">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="hw-glow-amber">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Crosshatch pattern for overlap zones */}
          <pattern id="hw-crosshatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* ── CONFIG BADGE ── */}
        <rect x="8" y="6" width="118" height="22" rx="4" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x="67" y="21" textAnchor="middle" fontSize="10" fontWeight="600" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.7}>
          size=30s hop=10s
        </text>

        {/* ── TIMELINE AXIS ── */}
        <line
          x1={TL_X0} y1={TL_Y} x2={TL_X1 + 16} y2={TL_Y}
          stroke="var(--color-text-primary)" strokeWidth="1.5" opacity={0.4}
        />
        <polygon
          points={`${TL_X1 + 16},${TL_Y} ${TL_X1 + 8},${TL_Y - 4} ${TL_X1 + 8},${TL_Y + 4}`}
          fill="var(--color-text-primary)" opacity={0.4}
        />
        <text x={TL_X1 + 22} y={TL_Y + 4} fontSize="10" fill="var(--color-text-primary)" opacity={0.4}>
          t
        </text>

        {/* Time tick marks */}
        {timeLabels.map((s) => {
          const x = timeToX(s);
          return (
            <g key={`tick-${s}`}>
              <line
                x1={x} y1={TL_Y - 4} x2={x} y2={TL_Y + 4}
                stroke="var(--color-text-primary)" strokeWidth="1" opacity={0.3}
              />
              <text
                x={x} y={TL_Y - 9}
                textAnchor="middle" fontSize="9"
                fill="var(--color-text-primary)" opacity={0.5}
                fontFamily="monospace"
              >
                {s}s
              </text>
            </g>
          );
        })}

        {/* ── WINDOW LANES ── */}
        {WINDOWS.map(([start, end], wIdx) => {
          const x = timeToX(start);
          const w = timeToX(end) - x;
          const y = laneY(wIdx);
          const op = windowOpacity(wIdx);
          const isClosed = (wIdx === 0 && w1Closed) || (wIdx === 1 && w2Closed);
          const flashIntensity = wIdx === 0 ? w1CloseFlash : wIdx === 1 ? w2CloseFlash : 0;
          const fillColor = isClosed ? W_FILLS_SOLID[wIdx] : W_FILLS[wIdx];
          const strokeW = isClosed ? 2 : 1.5;
          const strokeDash = isClosed ? 'none' : '6 3';

          return (
            <g key={`win-${wIdx}`} opacity={op}>
              {/* Window rect */}
              <rect
                x={x} y={y} width={w} height={LANE_H} rx={LANE_RX}
                fill={fillColor}
                stroke={W_COLORS[wIdx]}
                strokeWidth={strokeW}
                strokeDasharray={strokeDash}
                style={{ transition: 'fill 0.3s ease, stroke-width 0.3s ease' }}
              />

              {/* Close flash overlay */}
              {flashIntensity > 0 && (
                <rect
                  x={x} y={y} width={w} height={LANE_H} rx={LANE_RX}
                  fill={W_COLORS[wIdx]} opacity={flashIntensity * 0.35}
                />
              )}

              {/* Window label */}
              <text
                x={x + 8} y={y + 14}
                fontSize="9" fontWeight="700" fontFamily="monospace"
                fill={W_COLORS[wIdx]}
              >
                W{wIdx + 1}
              </text>
              <text
                x={x + 8} y={y + 26}
                fontSize="8" fontFamily="monospace"
                fill={W_COLORS[wIdx]} opacity={0.7}
              >
                [{start}s-{end}s]
              </text>

              {/* CLOSED badge */}
              {isClosed && (
                <g>
                  <rect
                    x={x + w - 58} y={y + 8} width="50" height="18" rx="3"
                    fill={W_COLORS[wIdx]} opacity={0.9}
                  />
                  <text
                    x={x + w - 33} y={y + 21}
                    textAnchor="middle" fontSize="9" fontWeight="700"
                    fill="#fff" fontFamily="monospace"
                  >
                    CLOSED
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── OVERLAP ZONE HIGHLIGHTS ── */}
        {/* 2-window overlap: W1 & W2 (10s-30s) */}
        {phase >= 0 && (
          <rect
            x={timeToX(10)} y={laneY(0)} width={timeToX(30) - timeToX(10)} height={LANE_H}
            fill={OVERLAP_FILL_2} rx={LANE_RX}
            opacity={windowOpacity(1) * 0.8}
          />
        )}
        {/* 2-window overlap: W2 & W3 (20s-40s) */}
        {phase >= 0 && (
          <rect
            x={timeToX(20)} y={laneY(1)} width={timeToX(40) - timeToX(20)} height={LANE_H}
            fill={OVERLAP_FILL_2} rx={LANE_RX}
            opacity={windowOpacity(2) * 0.8}
          />
        )}
        {/* 3-window overlap zone: (20s-30s) — crosshatch highlight */}
        {phase >= 0 && (
          <g opacity={windowOpacity(2) * 0.6}>
            <rect
              x={timeToX(20)} y={laneY(0)}
              width={timeToX(30) - timeToX(20)} height={LANE_H}
              fill="url(#hw-crosshatch)" rx={LANE_RX}
            />
            <rect
              x={timeToX(20)} y={laneY(1)}
              width={timeToX(30) - timeToX(20)} height={LANE_H}
              fill="url(#hw-crosshatch)" rx={LANE_RX}
            />
            <rect
              x={timeToX(20)} y={laneY(2)}
              width={timeToX(30) - timeToX(20)} height={LANE_H}
              fill="url(#hw-crosshatch)" rx={LANE_RX}
            />
          </g>
        )}

        {/* ── EVENTS ON TIMELINE ── */}
        {visibleEvents.map((evt) => {
          const evtIdx = EVENTS.indexOf(evt);
          const cx = timeToX(evt.timeS);
          const cy = TL_Y;
          const isNew = evtIdx === newEventIndex;
          const arrivalProgress = isNew ? eased : 1;
          const dotR = isNew ? 6 + (1 - arrivalProgress) * 4 : 6;
          const glowOpacity = isNew ? (1 - arrivalProgress) * 0.6 : 0;

          return (
            <g key={`evt-${evt.label}`}>
              {/* Glow ring on arrival */}
              {glowOpacity > 0 && (
                <circle
                  cx={cx} cy={cy} r={dotR + 8}
                  fill="none" stroke="#fff" strokeWidth="2"
                  opacity={glowOpacity}
                />
              )}

              {/* Event dot */}
              <circle
                cx={cx} cy={cy} r={dotR}
                fill="#fff" opacity={Math.min(1, arrivalProgress + 0.3)}
                stroke="var(--color-text-primary)" strokeWidth="1.5"
              />
              <text
                x={cx} y={cy + 4}
                textAnchor="middle" fontSize="9" fontWeight="700"
                fill="var(--color-surface, #1a1a2e)"
              >
                {evt.label}
              </text>

              {/* Timestamp label above */}
              <text
                x={cx} y={TL_Y - 18}
                textAnchor="middle" fontSize="8" fontFamily="monospace"
                fill="var(--color-text-primary)" opacity={0.6}
              >
                t={evt.timeS}s
              </text>
            </g>
          );
        })}

        {/* ── CONNECTION LINES from events to windows ── */}
        {EVENTS.map((evt, evtIdx) => {
          if (!showConnectionsFor(evtIdx)) return null;
          const cx = timeToX(evt.timeS);
          const isNew = evtIdx === newEventIndex;
          const lineProgress = isNew ? eased : 1;

          // For closed windows, dim the connection
          return evt.windows.map((wIdx) => {
            const isClosed = (wIdx === 0 && w1Closed) || (wIdx === 1 && w2Closed);
            const targetY = laneY(wIdx) + LANE_H / 2;
            const startY = TL_Y + 7;
            const currentY = startY + (targetY - startY) * lineProgress;
            const lineOpacity = isClosed ? 0.2 : (isNew ? eased * 0.8 : 0.55);

            return (
              <g key={`conn-${evt.label}-W${wIdx}`}>
                {/* Dashed connector line */}
                <line
                  x1={cx} y1={startY}
                  x2={cx} y2={currentY}
                  stroke={W_COLORS[wIdx]}
                  strokeWidth={isNew && lineProgress < 1 ? 2 : 1.5}
                  strokeDasharray="4 3"
                  opacity={lineOpacity}
                />
                {/* Small diamond at the target end */}
                {lineProgress >= 0.95 && (
                  <polygon
                    points={`${cx},${targetY - 4} ${cx + 4},${targetY} ${cx},${targetY + 4} ${cx - 4},${targetY}`}
                    fill={W_COLORS[wIdx]}
                    opacity={lineOpacity + 0.2}
                  />
                )}
              </g>
            );
          });
        })}

        {/* ── "ALL THREE" DRAMATIC HIGHLIGHT (Phase 3) ── */}
        {phase === 3 && (
          <g>
            {/* Pulsing ring around Event C */}
            <circle
              cx={timeToX(25)} cy={TL_Y} r={14 + eased * 4}
              fill="none" stroke="#eab308" strokeWidth="2"
              opacity={(1 - eased) * 0.7}
            />
            <circle
              cx={timeToX(25)} cy={TL_Y} r={20 + eased * 6}
              fill="none" stroke="#eab308" strokeWidth="1"
              opacity={(1 - eased) * 0.4}
            />
            {/* "x3" badge */}
            {eased > 0.4 && (
              <g opacity={easeInOutCubic((eased - 0.4) / 0.6)}>
                <rect
                  x={timeToX(25) + 12} y={TL_Y - 22}
                  width="26" height="16" rx="8"
                  fill="#eab308"
                />
                <text
                  x={timeToX(25) + 25} y={TL_Y - 11}
                  textAnchor="middle" fontSize="10" fontWeight="800"
                  fill="#000" fontFamily="monospace"
                >
                  x3
                </text>
              </g>
            )}
          </g>
        )}

        {/* ── COUNT BADGES per window ── */}
        {WINDOWS.map(([, end], wIdx: number) => {
          const count = counts[wIdx];
          if (count === 0) return null;
          const x = timeToX(end) + 8;
          const y = laneY(wIdx) + LANE_H / 2;
          const justChanged = countJustChanged(wIdx);
          const scale = justChanged ? 1 + (1 - eased) * 0.35 : 1;
          const isClosed = (wIdx === 0 && w1Closed) || (wIdx === 1 && w2Closed);

          return (
            <g
              key={`count-${wIdx}`}
              transform={`translate(${x}, ${y}) scale(${scale})`}
              style={{ transformOrigin: `${x}px ${y}px`, transformBox: 'fill-box' }}
            >
              {/* Badge background */}
              <rect
                x={-14} y={-10} width={28} height={20} rx="10"
                fill={W_COLORS[wIdx]}
                opacity={isClosed ? 0.9 : 0.8}
              />
              {/* Count text */}
              <text
                x={0} y={4}
                textAnchor="middle" fontSize="11" fontWeight="700"
                fill="#fff" fontFamily="monospace"
              >
                {count}
              </text>
            </g>
          );
        })}

        {/* ── WINDOW RESULT LABELS (after closing) ── */}
        {w1Closed && (
          <g opacity={phase === 4 ? eased : 1}>
            <text
              x={timeToX(30) + 40} y={laneY(0) + LANE_H + 14}
              fontSize="9" fontWeight="600" fontFamily="monospace"
              fill={W_COLORS[0]}
            >
              W1: count=3
            </text>
          </g>
        )}
        {w2Closed && (
          <g opacity={phase === 6 ? eased : 1}>
            <text
              x={timeToX(40) + 40} y={laneY(1) + LANE_H + 14}
              fontSize="9" fontWeight="600" fontFamily="monospace"
              fill={W_COLORS[1]}
            >
              W2: count=3
            </text>
          </g>
        )}

        {/* ── INSIGHT CALLOUT (Phase 7) ── */}
        {insightPhase && (
          <g opacity={insightOpacity}>
            <rect
              x="100" y="195" width="360" height="32" rx="6"
              fill="rgba(234,179,8,0.1)" stroke="#eab308" strokeWidth="1"
            />
            <text
              x="280" y="215"
              textAnchor="middle" fontSize="10" fontWeight="600"
              fill="#eab308" fontFamily="sans-serif"
            >
              Same events, counted multiple times. That's the power of hop windows.
            </text>
          </g>
        )}

        {/* ── STATUS BAR ── */}
        <rect
          x="0" y="245" width="560" height="35" rx="0"
          fill="rgba(255,255,255,0.03)"
        />
        <line
          x1="0" y1="245" x2="560" y2="245"
          stroke="var(--color-text-primary)" strokeWidth="0.5" opacity={0.1}
        />

        {/* Phase indicator dots */}
        {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
          <circle
            key={`dot-${i}`}
            cx={200 + i * 20} cy={254}
            r={i === phase ? 4 : 2.5}
            fill={i === phase ? 'var(--color-accent, #3b82f6)' : 'var(--color-text-primary)'}
            opacity={i === phase ? 0.9 : 0.25}
          />
        ))}

        {/* Status text */}
        <text
          x="280" y="273"
          textAnchor="middle" fontSize="10"
          fill="var(--color-text-primary)" opacity={0.7}
          fontStyle="italic"
        >
          {PHASE_STATUS[phase]}
        </text>
      </svg>

      {/* ── LEGEND ── */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          marginTop: 10,
          fontSize: 11,
          color: 'var(--color-text-primary)',
          opacity: 0.75,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="14" height="14">
            <rect x="1" y="1" width="12" height="12" rx="3" fill={W_FILLS[0]} stroke={W_COLORS[0]} strokeWidth="1" />
          </svg>
          Window 1 (blue)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="14" height="14">
            <rect x="1" y="1" width="12" height="12" rx="3" fill={W_FILLS[1]} stroke={W_COLORS[1]} strokeWidth="1" />
          </svg>
          Window 2 (green)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="14" height="14">
            <rect x="1" y="1" width="12" height="12" rx="3" fill={W_FILLS[2]} stroke={W_COLORS[2]} strokeWidth="1" />
          </svg>
          Window 3 (amber)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12">
            <circle cx="6" cy="6" r="5" fill="#fff" stroke="var(--color-text-primary)" strokeWidth="1" />
          </svg>
          Event
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="18" height="12">
            <line x1="0" y1="6" x2="18" y2="6" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
          Belongs to window
        </span>
      </div>
    </div>
  );
}
