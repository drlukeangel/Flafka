import './animations.css';
import { useAnimationTick } from './useAnimationTick';

/**
 * SessionWindowAnimation
 *
 * Phase-driven SVG animation teaching how session windows work in Flink SQL.
 * Sessions group events by inactivity gaps — the window boundary is set by
 * the data, not by the clock.
 *
 * 8 phases, ~1.3s each. Two sessions show that the same 30s gap threshold
 * can produce very different window sizes depending on event patterns.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26; // ~1.3s per phase
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

// Timeline geometry
const TL_Y = 68;
const TL_X0 = 50;
const TL_X1 = 510;
const TL_RANGE_S = 90; // 0s..90s visible

// Session rectangle geometry
const SESS_Y = 88;
const SESS_H = 32;

// Colors
const S1_COLOR = '#f97316'; // orange
const S2_COLOR = '#14b8a6'; // teal

const GAP_S = 30; // session gap threshold in seconds
const S1_LAST_EVENT_S = 28; // last event in session 1
const S1_CLOSE_S = S1_LAST_EVENT_S + GAP_S; // 58s

// Session 1 events: t=0, 10, 20, 25, 28
interface SessionEvt { timeS: number; label: string; }
const S1_EVENTS: SessionEvt[] = [
  { timeS: 0,  label: '$4k' },
  { timeS: 10, label: '$6k' },
  { timeS: 20, label: '$8k' },
  { timeS: 25, label: '$5k' },
  { timeS: 28, label: '$5k' },
];

// Session 2 events: t=65, 72, 80
const S2_EVENTS: SessionEvt[] = [
  { timeS: 65, label: '$12k' },
  { timeS: 72, label: '$9k'  },
  { timeS: 80, label: '$7k'  },
];

const PHASE_STATUS: string[] = [
  'Session windows group events by inactivity — gap threshold = 30s',
  'Events at t=0s, t=10s, t=20s arrive — Session 1 grows with each event',
  'Events at t=25s, t=28s arrive — Session 1 still active, window expands',
  'Silence... 10s... 20s... 30s — gap threshold exceeded!',
  'Session 1 closes → count=5, duration=28s, sum=$28k',
  'New activity at t=65s — Session 2 starts fresh after the long gap',
  'Session 2 closes after its own 30s gap — count=3, duration=15s',
  'Same 30s gap → very different window sizes. Events decide the boundary.',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function timeToX(s: number): number {
  return TL_X0 + (s / TL_RANGE_S) * (TL_X1 - TL_X0);
}

/** Linear color blend green→yellow→red based on 0-1 progress */
function gapColor(t: number): string {
  if (t <= 0.5) {
    const f = t * 2;
    return `rgb(${Math.round(34 + (234 - 34) * f)}, ${Math.round(197 + (179 - 197) * f)}, ${Math.round(94 + (8 - 94) * f)})`;
  }
  const f = (t - 0.5) * 2;
  return `rgb(${Math.round(234 + (239 - 234) * f)}, ${Math.round(179 + (68 - 179) * f)}, ${Math.round(8 + (68 - 8) * f)})`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionWindowAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // ── Session 1 visible events ────────────────────────────────────────────
  const s1Visible: number[] = [];
  if (phase >= 1) { s1Visible.push(0, 1, 2); } // first burst
  if (phase >= 2) { s1Visible.push(3, 4); }     // second burst

  // ── Session 2 visible events ────────────────────────────────────────────
  const s2Visible: number[] = [];
  if (phase >= 5) { s2Visible.push(0, 1); }
  if (phase >= 6) { s2Visible.push(2); }

  // ── Session 1 rectangle right edge ─────────────────────────────────────
  let s1EndX = timeToX(0);
  if (phase === 1) {
    s1EndX = timeToX(eased * 20); // grow 0 → t=20
  } else if (phase === 2) {
    s1EndX = timeToX(20 + eased * 8); // grow t=20 → t=28
  } else if (phase >= 3) {
    s1EndX = timeToX(28);
  }
  const s1StartX = timeToX(0);

  // ── Session 2 rectangle right edge ─────────────────────────────────────
  const s2StartX = timeToX(65);
  let s2EndX = s2StartX;
  if (phase === 5) {
    s2EndX = timeToX(65 + eased * 7); // grow t=65 → t=72
  } else if (phase === 6) {
    s2EndX = timeToX(72 + eased * 8); // grow t=72 → t=80
  } else if (phase >= 7) {
    s2EndX = timeToX(80);
  }

  // ── Session states ──────────────────────────────────────────────────────
  const s1Closed = phase >= 4;
  const s1Closing = phase === 4;
  const s1CloseFlash = s1Closing ? (1 - eased) * 0.55 : 0;
  const s1ResultProgress = phase === 4
    ? easeInOutCubic(Math.max(0, (phaseProgress - 0.4) * 1.7))
    : phase > 4 ? 1 : 0;

  const s2Closing = phase === 6 && phaseProgress > 0.55;
  const s2Closed = phase >= 7 || s2Closing;
  const s2CloseFlash = s2Closing ? (1 - (phaseProgress - 0.55) * 2.2) * 0.55 : 0;
  const s2ResultProgress = phase === 6 && phaseProgress > 0.7
    ? easeInOutCubic((phaseProgress - 0.7) * 3.3)
    : phase >= 7 ? 1 : 0;

  // ── Gap countdown (phase 3) ─────────────────────────────────────────────
  const gapProgress = phase === 3 ? phaseProgress : phase > 3 ? 1 : 0;
  const gapBarX0 = timeToX(S1_LAST_EVENT_S);
  const gapBarX1 = timeToX(S1_LAST_EVENT_S + gapProgress * GAP_S);
  const gapExceeded = gapProgress > 0.92;
  const currentGapColor = gapColor(gapProgress);

  // ── Active pulse (phase 2) ──────────────────────────────────────────────
  const activePulse = phase === 2 ? Math.sin(phaseProgress * Math.PI * 4) * 0.12 + 0.1 : 0;

  // ── Insight (phase 7) ───────────────────────────────────────────────────
  const insightOpacity = phase === 7
    ? 0.7 + 0.3 * Math.sin(phaseProgress * Math.PI * 2)
    : 0;

  const timeLabels = [0, 15, 30, 45, 60, 75, 90];

  // Helper: draw session rectangle
  const drawSession = (
    startX: number, endX: number,
    color: string,
    label: string,
    closed: boolean,
    closing: boolean,
    closeFlash: number,
    showActive: boolean,
    phaseP: number,
  ) => {
    if (endX <= startX) return null;
    const width = endX - startX;
    return (
      <g>
        <rect
          x={startX} y={SESS_Y}
          width={width} height={SESS_H} rx="5"
          fill={color} fillOpacity={closed ? 0.22 : 0.10 + activePulse}
          stroke={color} strokeWidth={closed ? 2 : 1.5}
          strokeDasharray={closed ? 'none' : '6 3'}
          filter={closing ? 'url(#sw-glow)' : undefined}
        />
        {closeFlash > 0 && (
          <rect x={startX} y={SESS_Y} width={width} height={SESS_H} rx="5"
            fill={color} fillOpacity={closeFlash} />
        )}
        {/* Label */}
        <text x={startX + 6} y={SESS_Y + 15} fontSize="8" fontWeight="700"
          fontFamily="monospace" fill={color}>{label}</text>
        {/* Active badge */}
        {showActive && (
          <g opacity={0.85 + activePulse}>
            <rect x={startX + 18} y={SESS_Y + 6} width="40" height="13" rx="6"
              fill={color} fillOpacity={0.28} />
            <text x={startX + 38} y={SESS_Y + 16} textAnchor="middle" fontSize="7"
              fontWeight="600" fill={color}>ACTIVE</text>
          </g>
        )}
        {/* Closing badge */}
        {closing && phaseP > 0.3 && (
          <g opacity={easeInOutCubic((phaseP - 0.3) * 1.43)}>
            <rect x={startX + 18} y={SESS_Y + 6} width="44" height="13" rx="6"
              fill={color} opacity={0.9} />
            <text x={startX + 40} y={SESS_Y + 16} textAnchor="middle" fontSize="7"
              fontWeight="700" fill="#fff">CLOSED</text>
          </g>
        )}
        {/* Closed badge (persistent) */}
        {closed && !closing && (
          <g>
            <rect x={startX + 18} y={SESS_Y + 6} width="44" height="13" rx="6"
              fill={color} opacity={0.9} />
            <text x={startX + 40} y={SESS_Y + 16} textAnchor="middle" fontSize="7"
              fontWeight="700" fill="#fff">CLOSED</text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div>
      <svg
        viewBox="0 0 560 320"
        style={{ width: '100%', height: 'auto' }}
        role="img"
        aria-label="Session window animation showing events grouping into sessions based on inactivity gaps. Two sessions with different sizes are formed from the same 30-second gap threshold."
      >
        <defs>
          <filter id="sw-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="sw-arr-r" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(255,255,255,0.5)" />
          </marker>
          <marker id="sw-arr-l" markerWidth="5" markerHeight="5" refX="1" refY="2.5" orient="auto-start-reverse">
            <path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(255,255,255,0.5)" />
          </marker>
        </defs>

        {/* ── CONFIG BADGE ── */}
        <rect x="8" y="6" width="150" height="22" rx="4"
          fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x="83" y="21" textAnchor="middle" fontSize="10" fontWeight="600"
          fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.7}>
          session gap = {GAP_S}s
        </text>

        {/* ── TIMELINE AXIS ── */}
        <line x1={TL_X0} y1={TL_Y} x2={TL_X1 + 16} y2={TL_Y}
          stroke="var(--color-text-primary)" strokeWidth="1.5" opacity={0.4} />
        <polygon
          points={`${TL_X1 + 16},${TL_Y} ${TL_X1 + 8},${TL_Y - 4} ${TL_X1 + 8},${TL_Y + 4}`}
          fill="var(--color-text-primary)" opacity={0.4} />
        <text x={TL_X1 + 22} y={TL_Y + 4} fontSize="10"
          fill="var(--color-text-primary)" opacity={0.4}>t</text>

        {/* Time ticks */}
        {timeLabels.map((s) => {
          const x = timeToX(s);
          return (
            <g key={`tick-${s}`}>
              <line x1={x} y1={TL_Y - 4} x2={x} y2={TL_Y + 4}
                stroke="var(--color-text-primary)" strokeWidth="1" opacity={0.3} />
              <text x={x} y={TL_Y - 9} textAnchor="middle" fontSize="9"
                fill="var(--color-text-primary)" opacity={0.5} fontFamily="monospace">
                {s}s
              </text>
            </g>
          );
        })}

        {/* ── SESSION 1 RECTANGLE ── */}
        {phase >= 1 && drawSession(
          s1StartX, s1EndX, S1_COLOR, 'S1',
          s1Closed, s1Closing, s1CloseFlash,
          phase >= 1 && phase <= 2,
          phaseProgress,
        )}

        {/* ── SESSION 2 RECTANGLE ── */}
        {phase >= 5 && drawSession(
          s2StartX, s2EndX, S2_COLOR, 'S2',
          s2Closed, s2Closing, s2CloseFlash,
          phase === 5,
          phaseProgress,
        )}

        {/* ── EVENT DOTS on timeline ── */}
        {s1Visible.map((i) => {
          const evt = S1_EVENTS[i];
          const cx = timeToX(evt.timeS);
          const isJustArrived =
            (phase === 1 && i <= 2 && phaseProgress < 0.45) ||
            (phase === 2 && i >= 3 && phaseProgress < 0.45);
          const r = isJustArrived ? 7 + (0.45 - phaseProgress) * 10 : 7;
          return (
            <g key={`s1evt-${i}`}>
              <circle cx={cx} cy={TL_Y} r={r + 4}
                fill={S1_COLOR} opacity={0.08} />
              <circle cx={cx} cy={TL_Y} r={r}
                fill={S1_COLOR} opacity={0.88} />
              <text x={cx} y={TL_Y + 4} textAnchor="middle" fontSize="6.5"
                fontWeight="700" fill="#fff">{evt.label}</text>
              <text x={cx} y={TL_Y - 14} textAnchor="middle" fontSize="8"
                fontFamily="monospace" fill={S1_COLOR} opacity={0.75}>
                t={evt.timeS}s
              </text>
            </g>
          );
        })}

        {s2Visible.map((i) => {
          const evt = S2_EVENTS[i];
          const cx = timeToX(evt.timeS);
          const isJustArrived =
            (phase === 5 && i <= 1 && phaseProgress < 0.45) ||
            (phase === 6 && i === 2 && phaseProgress < 0.45);
          const r = isJustArrived ? 7 + (0.45 - phaseProgress) * 10 : 7;
          return (
            <g key={`s2evt-${i}`}>
              <circle cx={cx} cy={TL_Y} r={r + 4}
                fill={S2_COLOR} opacity={0.08} />
              <circle cx={cx} cy={TL_Y} r={r}
                fill={S2_COLOR} opacity={0.88} />
              <text x={cx} y={TL_Y + 4} textAnchor="middle" fontSize="6.5"
                fontWeight="700" fill="#fff">{evt.label}</text>
              <text x={cx} y={TL_Y - 14} textAnchor="middle" fontSize="8"
                fontFamily="monospace" fill={S2_COLOR} opacity={0.75}>
                t={evt.timeS}s
              </text>
            </g>
          );
        })}

        {/* ── GAP COUNTDOWN BAR (Phase 3) ── */}
        {phase === 3 && (
          <g>
            {/* Gap sweep bar */}
            <rect
              x={gapBarX0} y={SESS_Y + SESS_H + 8}
              width={Math.max(0, gapBarX1 - gapBarX0)} height={10} rx="5"
              fill={currentGapColor} opacity={0.85}
            />
            {/* Dashed "max gap" marker at S1_CLOSE_S */}
            <line
              x1={timeToX(S1_CLOSE_S)} y1={SESS_Y}
              x2={timeToX(S1_CLOSE_S)} y2={SESS_Y + SESS_H + 24}
              stroke={currentGapColor} strokeWidth="1.5" strokeDasharray="4 3"
              opacity={0.6}
            />
            {/* Timer label */}
            <text
              x={gapBarX0 + 4} y={SESS_Y + SESS_H + 28}
              fontSize="8" fill={currentGapColor} fontFamily="monospace" fontWeight="700">
              gap: {Math.round(gapProgress * GAP_S)}s / {GAP_S}s
            </text>
            {/* "Gap exceeded!" flash */}
            {gapExceeded && (
              <g opacity={(gapProgress - 0.92) * 12.5}>
                <rect x={timeToX(S1_CLOSE_S) - 55} y={SESS_Y + SESS_H + 30}
                  width="110" height="18" rx="4"
                  fill="#ef4444" fillOpacity={0.15} stroke="#ef4444" strokeWidth="1" />
                <text x={timeToX(S1_CLOSE_S)} y={SESS_Y + SESS_H + 43}
                  textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#ef4444">
                  Gap exceeded!
                </text>
              </g>
            )}
          </g>
        )}

        {/* ── SESSION 1 RESULT ── */}
        {s1ResultProgress > 0 && phase >= 4 && (
          <g opacity={s1ResultProgress}>
            <rect x={s1StartX} y={SESS_Y + SESS_H + 8}
              width={s1EndX - s1StartX} height={20} rx="10"
              fill={S1_COLOR} fillOpacity={0.12}
              stroke={S1_COLOR} strokeWidth={1.2} />
            <text x={(s1StartX + s1EndX) / 2} y={SESS_Y + SESS_H + 22}
              textAnchor="middle" fontSize="7.5" fontWeight="600" fill={S1_COLOR}>
              count=5 · duration=28s · sum=$28k
            </text>
          </g>
        )}

        {/* ── SESSION 2 RESULT ── */}
        {s2ResultProgress > 0 && (
          <g opacity={s2ResultProgress}>
            <rect x={s2StartX} y={SESS_Y + SESS_H + 8}
              width={s2EndX - s2StartX} height={20} rx="10"
              fill={S2_COLOR} fillOpacity={0.12}
              stroke={S2_COLOR} strokeWidth={1.2} />
            <text x={(s2StartX + s2EndX) / 2} y={SESS_Y + SESS_H + 22}
              textAnchor="middle" fontSize="7.5" fontWeight="600" fill={S2_COLOR}>
              count=3 · duration=15s
            </text>
          </g>
        )}

        {/* ── PHASE 7 COMPARISON CALLOUT ── */}
        {phase === 7 && (
          <g>
            {/* S1 size label */}
            <g opacity={insightOpacity * 0.9}>
              <line x1={s1StartX} y1={SESS_Y - 10} x2={s1EndX} y2={SESS_Y - 10}
                stroke={S1_COLOR} strokeWidth="1" markerEnd="url(#sw-arr-r)"
                markerStart="url(#sw-arr-l)" />
              <text x={(s1StartX + s1EndX) / 2} y={SESS_Y - 16}
                textAnchor="middle" fontSize="8" fontWeight="700" fill={S1_COLOR}>
                28s window
              </text>
            </g>
            {/* S2 size label */}
            <g opacity={insightOpacity * 0.9}>
              <line x1={s2StartX} y1={SESS_Y - 10} x2={s2EndX} y2={SESS_Y - 10}
                stroke={S2_COLOR} strokeWidth="1" />
              <text x={(s2StartX + s2EndX) / 2} y={SESS_Y - 16}
                textAnchor="middle" fontSize="8" fontWeight="700" fill={S2_COLOR}>
                15s window
              </text>
            </g>
            {/* Insight box */}
            <g opacity={insightOpacity}>
              <rect x="55" y="165" width="450" height="30" rx="6"
                fill="rgba(249,115,22,0.08)" stroke="#f97316" strokeWidth="1" />
              <text x="280" y="185" textAnchor="middle" fontSize="10" fontWeight="600"
                fill="#f97316">
                Same 30s gap → very different window sizes. Events decide the boundary.
              </text>
            </g>
          </g>
        )}

        {/* ── STATUS BAR ── */}
        <rect x="0" y="255" width="560" height="40" rx="0"
          fill="rgba(255,255,255,0.025)" />
        <line x1="0" y1="255" x2="560" y2="255"
          stroke="var(--color-text-primary)" strokeWidth="0.5" opacity={0.1} />

        {/* Phase dots */}
        {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
          <circle key={`dot-${i}`}
            cx={200 + i * 20} cy={265}
            r={i === phase ? 4 : 2.5}
            fill={i === phase ? 'var(--color-accent, #3b82f6)' : 'var(--color-text-primary)'}
            opacity={i === phase ? 0.9 : 0.25}
          />
        ))}

        {/* Status text */}
        <text x="280" y="284" textAnchor="middle" fontSize="10"
          fill="var(--color-text-primary)" opacity={0.7} fontStyle="italic">
          {PHASE_STATUS[phase]}
        </text>
      </svg>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10,
        fontSize: 11, color: 'var(--color-text-primary)', opacity: 0.75,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="14" height="14">
            <rect x="1" y="1" width="12" height="12" rx="3"
              fill="rgba(249,115,22,0.2)" stroke="#f97316" strokeWidth="1" />
          </svg>
          Session 1 (orange)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="14" height="14">
            <rect x="1" y="1" width="12" height="12" rx="3"
              fill="rgba(20,184,166,0.2)" stroke="#14b8a6" strokeWidth="1" />
          </svg>
          Session 2 (teal)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="14" height="14">
            <circle cx="7" cy="7" r="6" fill="#f97316" opacity="0.85" />
          </svg>
          Event
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="34" height="10">
            <rect x="0" y="2" width="34" height="6" rx="3" fill="#22c55e" opacity="0.7" />
          </svg>
          Gap timer
        </span>
      </div>
    </div>
  );
}
