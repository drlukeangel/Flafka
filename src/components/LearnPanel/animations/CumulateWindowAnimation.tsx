import './animations.css';
import { useAnimationTick } from './useAnimationTick';

/**
 * CumulateWindowAnimation
 *
 * Phase-driven SVG animation teaching how cumulate windows work in Flink SQL.
 * A cumulate window emits a partial result at each step interval, but every
 * result includes ALL events from the window start — not just the latest step.
 * At the max boundary, everything resets for the next window.
 *
 * 8 phases, ~1.3s each. A 1-hour window divided into 6 × 10-minute steps.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26; // ~1.3s per phase
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

// Hour bar geometry
const BAR_X0 = 32;
const BAR_X1 = 520;
const BAR_Y = 60;
const BAR_H = 36;
const BAR_W = BAR_X1 - BAR_X0; // 488px
const NUM_STEPS = 6;
const STEP_W = BAR_W / NUM_STEPS; // ~81px per step

// Result pill geometry — placed below the bar
const RESULT_Y = BAR_Y + BAR_H + 16;
const RESULT_H = 20;

// Colors for each step (progress along a blue→purple gradient)
const STEP_COLORS = [
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#c026d3', // fuchsia
  '#ec4899', // pink
];

// Cumulative results emitted at each step boundary
const STEP_RESULTS = [
  { step: '0–10m',  count: 3,  sum: '$8k'  },
  { step: '0–20m',  count: 8,  sum: '$21k' },
  { step: '0–30m',  count: 12, sum: '$35k' },
  { step: '0–40m',  count: 16, sum: '$47k' },
  { step: '0–50m',  count: 19, sum: '$55k' },
  { step: '0–60m',  count: 22, sum: '$61k' },
];

// Event counts added per step (incremental, for visual dot display)
const STEP_INCREMENTAL = [3, 5, 4, 4, 3, 3];

const PHASE_STATUS: string[] = [
  '1-hour window with 6 × 10-minute steps — cumulate emits at every step',
  'Step 1 (0–10m): 3 events → emits count=3, sum=$8k',
  'Step 2 (0–20m): 5 more events → emits count=8, sum=$21k (includes Step 1!)',
  'Step 3 (0–30m): 4 more events → emits count=12, sum=$35k (still from window start)',
  'Steps 4–6: each result grows — every emission starts from T=0',
  'Max boundary at T=1h — window resets! All counters wipe to zero.',
  'New window begins — Step 1 of next hour starts fresh',
  'Each result includes EVERYTHING since the window started — not just its step.',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/** X position of the left edge of step i */
function stepX(i: number): number { return BAR_X0 + i * STEP_W; }
/** X center of step i */
function stepCX(i: number): number { return stepX(i) + STEP_W / 2; }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CumulateWindowAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // ── Which steps are "filled" (have events) ─────────────────────────────
  // Phases 1–3 each fill one step. Phase 4 rapidly fills steps 3–5.
  // Phase 5 is the reset. Phase 6 refills step 0.
  const getFilledSteps = (): number[] => {
    if (phase === 0) return [];
    if (phase === 1) return [0];
    if (phase === 2) return [0, 1];
    if (phase === 3) return [0, 1, 2];
    if (phase === 4) {
      // Rapid fill of steps 3-5 over the phase
      const extra = Math.floor(eased * 3);
      const filled = [0, 1, 2];
      for (let i = 0; i < extra; i++) filled.push(3 + i);
      return filled;
    }
    if (phase === 5) return []; // reset
    if (phase === 6) return [0]; // new window step 1
    if (phase === 7) return [0, 1, 2, 3, 4, 5]; // insight — show all filled
    return [];
  };

  // ── Which result pills are visible ─────────────────────────────────────
  const getVisibleResults = (): number[] => {
    if (phase === 0) return [];
    if (phase === 1) return [0];
    if (phase === 2) return [0, 1];
    if (phase === 3) return [0, 1, 2];
    if (phase === 4) {
      const extra = Math.min(3, Math.floor(eased * 3.5));
      const visible = [0, 1, 2];
      for (let i = 0; i < extra; i++) visible.push(3 + i);
      return visible;
    }
    if (phase === 5) return []; // wiping
    if (phase === 6) return [0]; // new window
    if (phase === 7) return [0, 1, 2, 3, 4, 5];
    return [];
  };

  const filledSteps = getFilledSteps();
  const visibleResults = getVisibleResults();

  // ── Currently filling step (animating fill) ─────────────────────────────
  // For phases 1, 2, 3: the last step being filled shows partial progress
  const fillingStepIndex = phase === 1 ? 0 : phase === 2 ? 1 : phase === 3 ? 2 : -1;
  const fillProgress = fillingStepIndex >= 0 ? eased : 1;

  // ── Emission dot: travels from step center to result pill ───────────────
  const showEmissionDot = phase >= 1 && phase <= 3 && phaseProgress > 0.45 && phaseProgress < 0.85;
  const emittingStep = phase === 1 ? 0 : phase === 2 ? 1 : phase === 3 ? 2 : -1;
  const emitProgress = showEmissionDot
    ? easeInOutCubic((phaseProgress - 0.45) / 0.4)
    : 0;

  // ── Reset animation (phase 5) ───────────────────────────────────────────
  const isResetting = phase === 5;
  const resetFlash = isResetting ? Math.max(0, 1 - eased * 2) : 0;
  const resetWipe = isResetting ? eased : 0;
  const resetLabelOpacity = isResetting && phaseProgress > 0.3
    ? easeInOutCubic((phaseProgress - 0.3) * 1.43)
    : 0;

  // ── New window (phase 6): counters label ───────────────────────────────
  const newWindowOpacity = phase === 6 ? eased : 0;

  // ── Insight callout (phase 7) ───────────────────────────────────────────
  const insightOpacity = phase === 7
    ? 0.7 + 0.3 * Math.sin(phaseProgress * Math.PI * 2)
    : 0;

  return (
    <div className="concept-animation">
      <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>
        Cumulate Windows: Growing Partial Results Within a Max Window
      </h4>

      <svg
        viewBox="0 0 560 320"
        style={{ width: '100%', height: 'auto' }}
        role="img"
        aria-label="Cumulate window animation showing a 1-hour window divided into 6 ten-minute steps, where each step emits a cumulative result that includes all events since the window start, then resets at the max boundary."
      >
        <defs>
          <filter id="cw-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="cw-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* ── CONFIG BADGE ── */}
        <rect x="8" y="6" width="224" height="22" rx="4"
          fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x="120" y="21" textAnchor="middle" fontSize="10" fontWeight="600"
          fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.7}>
          step=10min, max=1h, cumulate
        </text>

        {/* ── HOUR BAR BACKGROUND ── */}
        <rect x={BAR_X0} y={BAR_Y} width={BAR_W} height={BAR_H} rx="6"
          fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

        {/* ── STEP SEGMENTS ── */}
        {Array.from({ length: NUM_STEPS }).map((_, i) => {
          const x = stepX(i);
          const color = STEP_COLORS[i];
          const isFilled = filledSteps.includes(i);
          const isCurrentlyFilling = i === fillingStepIndex;

          // For the currently filling step, animate fill from left
          const fillW = isCurrentlyFilling ? STEP_W * fillProgress : (isFilled ? STEP_W : 0);

          return (
            <g key={`step-${i}`}>
              {/* Segment divider */}
              {i > 0 && (
                <line x1={x} y1={BAR_Y} x2={x} y2={BAR_Y + BAR_H}
                  stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              )}
              {/* Filled region */}
              {fillW > 0 && (
                <rect
                  x={x} y={BAR_Y}
                  width={fillW} height={BAR_H}
                  rx={i === 0 ? '5' : '0'}
                  fill={color} fillOpacity={0.28}
                />
              )}
              {/* Event count dots inside segment */}
              {isFilled && (
                <g>
                  {Array.from({ length: Math.min(STEP_INCREMENTAL[i], 5) }).map((_, di) => (
                    <circle key={`dot-${i}-${di}`}
                      cx={x + 10 + di * 13}
                      cy={BAR_Y + BAR_H / 2}
                      r={4}
                      fill={color} opacity={0.75}
                    />
                  ))}
                  {STEP_INCREMENTAL[i] > 5 && (
                    <text x={x + 10 + 5 * 13} y={BAR_Y + BAR_H / 2 + 4}
                      fontSize="7" fill={color} opacity={0.7}>
                      +{STEP_INCREMENTAL[i] - 5}
                    </text>
                  )}
                </g>
              )}
              {/* Step time label below bar */}
              <text x={stepCX(i)} y={BAR_Y + BAR_H + 12}
                textAnchor="middle" fontSize="8" fontFamily="monospace"
                fill="var(--color-text-primary)" opacity={0.5}>
                {i * 10}m
              </text>
              {/* Step boundary tick */}
              <line x1={x} y1={BAR_Y + BAR_H} x2={x} y2={BAR_Y + BAR_H + 6}
                stroke="var(--color-text-primary)" strokeWidth="0.8" opacity={0.3} />
            </g>
          );
        })}
        {/* Final tick at 60m */}
        <line x1={BAR_X1} y1={BAR_Y + BAR_H} x2={BAR_X1} y2={BAR_Y + BAR_H + 6}
          stroke="var(--color-text-primary)" strokeWidth="0.8" opacity={0.3} />
        <text x={BAR_X1} y={BAR_Y + BAR_H + 12} textAnchor="middle" fontSize="8"
          fontFamily="monospace" fill="var(--color-text-primary)" opacity={0.5}>
          60m
        </text>

        {/* ── BAR TOP LABEL ── */}
        <text x={(BAR_X0 + BAR_X1) / 2} y={BAR_Y - 7}
          textAnchor="middle" fontSize="9" fill="var(--color-text-primary)" opacity={0.5}>
          ← 1-hour max window →
        </text>

        {/* ── RESULT PILLS ── */}
        {visibleResults.map((i) => {
          const res = STEP_RESULTS[i];
          const color = STEP_COLORS[i];
          const cx = stepCX(i);
          const isNew = (
            (phase === 1 && i === 0) ||
            (phase === 2 && i === 1) ||
            (phase === 3 && i === 2)
          ) && phaseProgress < 0.75;
          const opacity = isNew ? easeInOutCubic(Math.max(0, (phaseProgress - 0.45) / 0.3)) : 1;

          return (
            <g key={`result-${i}`} opacity={opacity}>
              {/* Connector from step to result */}
              <line
                x1={cx} y1={BAR_Y + BAR_H + 14}
                x2={cx} y2={RESULT_Y}
                stroke={color} strokeWidth="1" strokeDasharray="3 2"
                opacity={0.45}
              />
              {/* Result pill */}
              <rect
                x={stepX(i) + 4} y={RESULT_Y}
                width={STEP_W - 8} height={RESULT_H} rx="10"
                fill={color} fillOpacity={0.12}
                stroke={color} strokeWidth={1.2}
              />
              <text x={cx} y={RESULT_Y + 9}
                textAnchor="middle" fontSize="6.5" fontWeight="600" fill={color}>
                {res.step}
              </text>
              <text x={cx} y={RESULT_Y + 18}
                textAnchor="middle" fontSize="6" fill={color} opacity={0.85}>
                n={res.count} · {res.sum}
              </text>
            </g>
          );
        })}

        {/* ── EMISSION DOT (travels from step to result) ── */}
        {showEmissionDot && emittingStep >= 0 && (
          <g>
            <circle
              cx={stepCX(emittingStep)}
              cy={BAR_Y + BAR_H + 14 + emitProgress * (RESULT_Y - BAR_Y - BAR_H - 14)}
              r={5}
              fill={STEP_COLORS[emittingStep]}
              opacity={0.9 * (1 - emitProgress * 0.7)}
              filter="url(#cw-shadow)"
            />
          </g>
        )}

        {/* ── CUMULATIVE ARROW (phases 2-4: show "includes everything since T=0") ── */}
        {(phase >= 2 && phase <= 3) && (
          <g opacity={easeInOutCubic(phaseProgress)}>
            <rect x={BAR_X0} y={RESULT_Y - 14} width={stepX(phase) + STEP_W - BAR_X0} height="12" rx="6"
              fill="rgba(99,102,241,0.08)" stroke="rgba(99,102,241,0.35)" strokeWidth="0.8" />
            <text x={BAR_X0 + (stepX(phase) + STEP_W - BAR_X0) / 2}
              y={RESULT_Y - 5}
              textAnchor="middle" fontSize="7" fill="#6366f1" opacity={0.85}>
              ← cumulative from window start (T=0) →
            </text>
          </g>
        )}

        {/* ── RESET FLASH (phase 5) ── */}
        {isResetting && (
          <g>
            {/* Flash overlay on the whole bar */}
            <rect x={BAR_X0} y={BAR_Y} width={BAR_W} height={BAR_H} rx="6"
              fill="#ef4444" fillOpacity={resetFlash * 0.45} />
            {/* Wipe animation sweeping from left */}
            <rect x={BAR_X0} y={BAR_Y} width={BAR_W * resetWipe} height={BAR_H}
              fill="rgba(239,68,68,0.12)" />
            {/* "Window Reset" badge */}
            <g opacity={resetLabelOpacity}>
              <rect x="160" y="145" width="240" height="28" rx="6"
                fill="rgba(239,68,68,0.12)" stroke="#ef4444" strokeWidth="1.5" />
              <text x="280" y="164" textAnchor="middle" fontSize="12" fontWeight="700"
                fill="#ef4444">
                Window Reset ⟳
              </text>
            </g>
          </g>
        )}

        {/* ── NEW WINDOW LABEL (phase 6) ── */}
        {phase === 6 && (
          <g opacity={newWindowOpacity}>
            <rect x="170" y="145" width="220" height="22" rx="4"
              fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth="0.8" />
            <text x="280" y="160" textAnchor="middle" fontSize="9" fontWeight="600"
              fill="#3b82f6">
              New window — counters back to 0
            </text>
          </g>
        )}

        {/* ── INSIGHT CALLOUT (phase 7) ── */}
        {phase === 7 && (
          <g opacity={insightOpacity}>
            {/* Arrow spanning all results */}
            <line x1={stepCX(0)} y1={RESULT_Y + RESULT_H + 8}
              x2={stepCX(5)} y2={RESULT_Y + RESULT_H + 8}
              stroke="#6366f1" strokeWidth="1.5"
              markerEnd="url(#cw-arr)" />
            <text x="280" y={RESULT_Y + RESULT_H + 22}
              textAnchor="middle" fontSize="9" fontStyle="italic"
              fill="#6366f1" opacity={0.9}>
              each result grows → all from window start
            </text>
            {/* Insight box */}
            <rect x="40" y="195" width="480" height="28" rx="6"
              fill="rgba(99,102,241,0.08)" stroke="#6366f1" strokeWidth="1" />
            <text x="280" y="213" textAnchor="middle" fontSize="10" fontWeight="600"
              fill="#6366f1">
              Each result includes EVERYTHING from the window start — not just its step.
            </text>
          </g>
        )}

        {/* ── VS TUMBLE CALLOUT (phase 4) ── */}
        {phase === 4 && (
          <g opacity={easeInOutCubic(phaseProgress)}>
            <rect x="155" y="195" width="250" height="22" rx="4"
              fill="rgba(234,179,8,0.08)" stroke="#eab308" strokeWidth="0.8" />
            <text x="280" y="210" textAnchor="middle" fontSize="8.5" fontWeight="600"
              fill="#eab308">
              Tumble sees only its window. Cumulate sees from T=0.
            </text>
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
              fill="rgba(59,130,246,0.25)" stroke="#3b82f6" strokeWidth="1" />
          </svg>
          Step segment
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="28" height="14">
            <rect x="1" y="2" width="26" height="10" rx="5"
              fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth="1" />
          </svg>
          Cumulative result
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="24" height="12">
            <rect x="0" y="3" width="24" height="6" rx="3" fill="#ef4444" opacity="0.6" />
          </svg>
          Window reset
        </span>
      </div>
    </div>
  );
}
