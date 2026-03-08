import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const PHASE_STATUS = [
  'MATCH_RECOGNIZE watches for PATTERN (A{3,}) — 3+ apps in 10s',
  'App #1 at t=0 — watching... (1 of 3 needed)',
  'App #2 at t=5s — bracket grows... (2 of 3)',
  'App #3 at t=8s — BURST! MATCH fires (red alert)',
  'Alert row emits: count=3, first_time, last_time, total_amount',
  'SKIP PAST LAST ROW — cursor resets for next sequence',
  'New burst: 4 apps in 7s — second alert fires',
  'MATCH_RECOGNIZE = SQL-level CEP. Pattern (A{3,}) catches fraud bursts.',
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

const TL_Y = 90;   // timeline bar Y
const TL_X0 = 60;
const TL_X1 = 500;

// First burst: 3 dots
const DOTS_1 = [
  { x: 120, label: '#1', t: 't=0' },
  { x: 240, label: '#2', t: 't=5s' },
  { x: 330, label: '#3', t: 't=8s' },
];

// Second burst (phase 6): 4 dots
const DOTS_2 = [
  { x: 130, label: '#4', t: 't=0' },
  { x: 195, label: '#5', t: 't=2s' },
  { x: 270, label: '#6', t: 't=5s' },
  { x: 340, label: '#7', t: 't=7s' },
];

const ALERT_X = 390;
const ALERT_Y = 70;
const ALERT_W = 140;
const ALERT_H = 52;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PatternMatchAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // How many first-burst dots visible
  const dot1Count = phase >= 3 ? 3 : phase >= 2 ? 2 : phase >= 1 ? 1 : 0;
  // Bracket width (grows under timeline as dots appear)
  const bracketRightX = dot1Count === 1 ? DOTS_1[0].x + 30
    : dot1Count === 2 ? DOTS_1[1].x + 30
    : dot1Count >= 3 ? DOTS_1[2].x + 30 : TL_X0 + 10;

  const bracketProgress = phase === 1 ? eased * 0.35
    : phase === 2 ? 0.35 + eased * 0.35
    : phase >= 3 ? 1.0 : 0;

  // Burst flash (phase 3)
  const burstFlash = phase === 3 ? Math.sin(phaseProgress * Math.PI * 6) * 0.5 + 0.5 : 0;

  // Alert pill (phase 3+)
  const alertVisible = phase >= 3;
  const alertSlideX = phase === 3
    ? ALERT_X + (1 - eased) * 80
    : ALERT_X;
  const alertOpacity = phase === 3 ? eased : 1;

  // Cursor reset (phase 5)
  const showCursorReset = phase === 5;
  const cursorX = showCursorReset ? TL_X0 + (DOTS_1[2].x - TL_X0) * (1 - eased) : DOTS_1[2].x + 30;

  // Second burst (phase 6)
  const showBurst2 = phase >= 6;
  const burst2Count = phase === 6 ? Math.floor(eased * 4 + 0.1) : 4;
  const alert2Visible = phase >= 6 && eased > 0.65;
  const alert2Opacity = phase === 6 ? Math.max(0, (eased - 0.65) / 0.35) : 1;

  // Insight
  const showInsight = phase === 7;
  const insightOpacity = showInsight ? 0.7 + 0.3 * Math.sin(phaseProgress * Math.PI * 2) : 0;

  const bracketEndX = TL_X0 + bracketProgress * (DOTS_1[2].x + 30 - TL_X0);

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="MATCH_RECOGNIZE pattern animation: detecting 3+ loan applications within 10 seconds">
        <defs>
          <filter id="pm-glow-red">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="pm-glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── HEADER BADGE ── */}
        <rect x="8" y="6" width="180" height="20" rx="4"
          fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x="98" y="20" textAnchor="middle" fontSize="9.5" fontWeight="700" fontFamily="monospace"
          fill="var(--color-text-primary)" opacity={0.8}>PATTERN (A&#123;3,&#125;)</text>

        {/* ── 10s WINDOW BRACKET (top) ── */}
        <rect x={TL_X0} y={TL_Y - 28} width={TL_X1 - TL_X0} height="14" rx="3"
          fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        <text x={TL_X0 + (TL_X1 - TL_X0) / 2} y={TL_Y - 18} textAnchor="middle"
          fontSize="8" fill="var(--color-text-primary)" opacity={0.4} fontFamily="monospace">
          10 second matching window
        </text>

        {/* ── TIMELINE ── */}
        <line x1={TL_X0} y1={TL_Y} x2={TL_X1} y2={TL_Y}
          stroke="var(--color-text-primary)" strokeWidth="2" opacity={0.25} />
        <polygon points={`${TL_X1},${TL_Y - 4} ${TL_X1 + 12},${TL_Y} ${TL_X1},${TL_Y + 4}`}
          fill="var(--color-text-primary)" opacity={0.25} />
        <text x={TL_X1 + 16} y={TL_Y + 4} fontSize="9" fill="var(--color-text-primary)" opacity={0.4}>t</text>

        {/* ── GROWING BRACKET UNDER TIMELINE ── */}
        {bracketProgress > 0 && (
          <g>
            {/* Bracket fill */}
            <rect x={TL_X0} y={TL_Y + 4} width={bracketEndX - TL_X0} height="10" rx="2"
              fill={phase >= 3 ? '#ef4444' : '#f59e0b'} opacity={phase >= 3 ? 0.35 : 0.2} />
            {/* Bracket border */}
            <rect x={TL_X0} y={TL_Y + 4} width={bracketEndX - TL_X0} height="10" rx="2"
              fill="none" stroke={phase >= 3 ? '#ef4444' : '#f59e0b'} strokeWidth="1.5"
              filter={phase === 3 ? 'url(#pm-glow-red)' : undefined} />
            {/* Count badge */}
            <text x={(TL_X0 + bracketEndX) / 2} y={TL_Y + 13} textAnchor="middle"
              fontSize="8" fontWeight="700" fill={phase >= 3 ? '#ef4444' : '#f59e0b'}>
              {dot1Count} / 3
            </text>
          </g>
        )}

        {/* ── BURST FLASH (phase 3) ── */}
        {phase === 3 && burstFlash > 0.3 && (
          <rect x={TL_X0 - 10} y={TL_Y - 35} width={bracketRightX - TL_X0 + 20} height="60" rx="6"
            fill="#ef4444" opacity={burstFlash * 0.12} />
        )}

        {/* ── FIRST BURST DOTS ── */}
        {!showBurst2 && DOTS_1.slice(0, dot1Count).map((dot, i) => {
          const isNew = i === dot1Count - 1 && phase >= 1 && phase <= 3;
          const op = isNew ? Math.max(0.2, eased) : 1;
          const isMatch = phase >= 3 && i === 2;
          const dotColor = isMatch ? '#ef4444' : '#f59e0b';
          const r = 9;
          return (
            <g key={`dot1-${i}`} opacity={op}>
              {isNew && eased < 0.8 && (
                <circle cx={dot.x} cy={TL_Y} r={r + 8} fill={dotColor} opacity={(1 - eased) * 0.4} />
              )}
              {isMatch && (
                <circle cx={dot.x} cy={TL_Y} r={r + 5} fill="#ef4444" opacity={0.3}
                  filter="url(#pm-glow-red)" />
              )}
              <circle cx={dot.x} cy={TL_Y} r={r} fill={dotColor} opacity={0.9} />
              <text x={dot.x} y={TL_Y + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">
                {dot.label}
              </text>
              <text x={dot.x} y={TL_Y - r - 6} textAnchor="middle" fontSize="8"
                fill="var(--color-text-primary)" opacity={0.55} fontFamily="monospace">
                {dot.t}
              </text>
            </g>
          );
        })}

        {/* ── "BURST!" TEXT (phase 3) ── */}
        {phase === 3 && eased > 0.3 && (
          <g opacity={easeInOutCubic((eased - 0.3) / 0.7)}>
            <text x={DOTS_1[2].x} y={TL_Y - 46} textAnchor="middle" fontSize="18"
              fontWeight="900" fill="#ef4444" filter="url(#pm-glow-red)">
              BURST!
            </text>
          </g>
        )}

        {/* ── ALERT PILL ── */}
        {alertVisible && !showBurst2 && (
          <g opacity={alertOpacity} transform={`translate(${alertSlideX - ALERT_X}, 0)`}>
            <rect x={ALERT_X} y={ALERT_Y} width={ALERT_W} height={ALERT_H} rx="8"
              fill="rgba(239,68,68,0.12)" stroke="#ef4444" strokeWidth="1.5"
              filter={phase === 3 ? 'url(#pm-glow-red)' : undefined} />
            <text x={ALERT_X + ALERT_W / 2} y={ALERT_Y + 14} textAnchor="middle"
              fontSize="10" fontWeight="800" fill="#ef4444">FRAUD ALERT</text>
            <text x={ALERT_X + ALERT_W / 2} y={ALERT_Y + 28} textAnchor="middle"
              fontSize="8" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.7}>
              count=3
            </text>
            <text x={ALERT_X + ALERT_W / 2} y={ALERT_Y + 41} textAnchor="middle"
              fontSize="8" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.7}>
              total=$47k
            </text>
          </g>
        )}

        {/* ── CURSOR RESET (phase 5) ── */}
        {showCursorReset && (
          <g>
            <line x1={cursorX} y1={TL_Y - 20} x2={cursorX} y2={TL_Y + 25}
              stroke="#6366f1" strokeWidth="2" strokeDasharray="4 3" />
            <polygon points={`${cursorX - 5},${TL_Y - 20} ${cursorX + 5},${TL_Y - 20} ${cursorX},${TL_Y - 12}`}
              fill="#6366f1" opacity={0.8} />
            <text x={cursorX} y={TL_Y + 38} textAnchor="middle" fontSize="9"
              fill="#6366f1" fontWeight="600">cursor reset</text>
          </g>
        )}

        {/* ── SECOND BURST (phase 6+) ── */}
        {showBurst2 && (
          <g>
            {DOTS_2.slice(0, Math.min(burst2Count, 4)).map((dot, i) => {
              const isNew = i === burst2Count - 1 && phase === 6;
              const op = isNew ? Math.max(0.3, eased) : 1;
              const isAlerted = i >= 2 && alert2Visible;
              const dotColor = isAlerted ? '#ef4444' : '#f97316';
              const r = 9;
              return (
                <g key={`dot2-${i}`} opacity={op}>
                  {isNew && eased < 0.7 && (
                    <circle cx={dot.x} cy={TL_Y} r={r + 8} fill={dotColor} opacity={(1 - eased) * 0.4} />
                  )}
                  <circle cx={dot.x} cy={TL_Y} r={r} fill={dotColor} opacity={0.9} />
                  <text x={dot.x} y={TL_Y + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">
                    {dot.label}
                  </text>
                  <text x={dot.x} y={TL_Y - r - 6} textAnchor="middle" fontSize="8"
                    fill="var(--color-text-primary)" opacity={0.55} fontFamily="monospace">
                    {dot.t}
                  </text>
                </g>
              );
            })}

            {/* Second alert */}
            {alert2Visible && (
              <g opacity={alert2Opacity}>
                <rect x={ALERT_X} y={ALERT_Y} width={ALERT_W} height={ALERT_H} rx="8"
                  fill="rgba(249,115,22,0.12)" stroke="#f97316" strokeWidth="1.5" />
                <text x={ALERT_X + ALERT_W / 2} y={ALERT_Y + 14} textAnchor="middle"
                  fontSize="10" fontWeight="800" fill="#f97316">FRAUD ALERT #2</text>
                <text x={ALERT_X + ALERT_W / 2} y={ALERT_Y + 28} textAnchor="middle"
                  fontSize="8" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.7}>
                  count=4
                </text>
                <text x={ALERT_X + ALERT_W / 2} y={ALERT_Y + 41} textAnchor="middle"
                  fontSize="8" fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.7}>
                  total=$62k
                </text>
              </g>
            )}
          </g>
        )}

        {/* ── INSIGHT (phase 7) ── */}
        {showInsight && (
          <g opacity={insightOpacity}>
            <rect x="30" y="165" width="500" height="24" rx="6"
              fill="rgba(239,68,68,0.08)" stroke="#ef4444" strokeWidth="1" />
            <text x="280" y="181" textAnchor="middle" fontSize="10" fontWeight="600" fill="#ef4444">
              MATCH_RECOGNIZE = SQL-level CEP. A&#123;3,&#125; fires on 3+ consecutive matches.
            </text>
          </g>
        )}

        {/* ── STATUS BAR ── */}
        <rect x="0" y="255" width="560" height="40" fill="rgba(255,255,255,0.025)" />
        {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
          <circle key={i} cx={200 + i * 20} cy={265} r={i === phase ? 4 : 2.5}
            fill={i === phase ? '#ef4444' : 'var(--color-text-primary)'}
            opacity={i === phase ? 0.9 : 0.25} />
        ))}
        <text x="280" y="284" textAnchor="middle" fontSize="10"
          fill="var(--color-text-primary)" opacity={0.7} fontStyle="italic">
          {PHASE_STATUS[phase]}
        </text>
      </svg>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--color-text-primary)', opacity: 0.75 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#f59e0b" /></svg>
          Loan application (A)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="14" height="10"><rect x="0" y="1" width="14" height="8" rx="2" fill="rgba(245,158,11,0.25)" stroke="#f59e0b" strokeWidth="1" /></svg>
          Growing bracket
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="3" fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="1.5" /></svg>
          Alert (3+ matched)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="2" height="12"><line x1="1" y1="0" x2="1" y2="12" stroke="#6366f1" strokeWidth="2" strokeDasharray="3 2" /></svg>
          Cursor reset
        </span>
      </div>
    </div>
  );
}
