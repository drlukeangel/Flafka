import { useState, useEffect } from 'react';
import './animations.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventCircle {
  id: number;
  label: string;       // dollar amount label
  color: string;       // fill color
  timeLabel: string;   // e.g. "t=2s"
  windowIndex: number; // which window bucket this event belongs to
  slotIndex: number;   // position within the window (0, 1, 2...)
}

interface AnimatingEvent {
  id: number;
  label: string;
  color: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const TIMELINE_Y = 72;
const TIMELINE_X_START = 50;
const TIMELINE_X_END = 510;

const WINDOW_Y = 92;
const WINDOW_HEIGHT = 52;
const WINDOW_WIDTH = 140;
const WINDOW_GAP = 10;
const WINDOW_X_OFFSETS = [
  TIMELINE_X_START + 10,
  TIMELINE_X_START + 10 + WINDOW_WIDTH + WINDOW_GAP,
  TIMELINE_X_START + 10 + (WINDOW_WIDTH + WINDOW_GAP) * 2,
];

const RESULT_Y = 172;
const RESULT_HEIGHT = 22;

const EVENT_RADIUS = 10;
const EVENT_CIRCLE_SPACING = 36;

// Time tick positions on the timeline
const TIME_TICKS = [
  { label: '0s',  x: WINDOW_X_OFFSETS[0] },
  { label: '10s', x: WINDOW_X_OFFSETS[1] },
  { label: '20s', x: WINDOW_X_OFFSETS[2] },
  { label: '30s', x: WINDOW_X_OFFSETS[2] + WINDOW_WIDTH },
];

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

const W1_COLOR = '#3b82f6'; // blue
const W2_COLOR = '#10b981'; // green
const W3_COLOR = '#f59e0b'; // amber

const ALL_EVENTS: EventCircle[] = [
  { id: 1, label: '$150', color: W1_COLOR, timeLabel: 't=2s',  windowIndex: 0, slotIndex: 0 },
  { id: 2, label: '$100', color: W1_COLOR, timeLabel: 't=5s',  windowIndex: 0, slotIndex: 1 },
  { id: 3, label: '$175', color: W1_COLOR, timeLabel: 't=8s',  windowIndex: 0, slotIndex: 2 },
  { id: 4, label: '$130', color: W2_COLOR, timeLabel: 't=12s', windowIndex: 1, slotIndex: 0 },
  { id: 5, label: '$150', color: W2_COLOR, timeLabel: 't=17s', windowIndex: 1, slotIndex: 1 },
  { id: 6, label: '$200', color: W3_COLOR, timeLabel: 't=22s', windowIndex: 2, slotIndex: 0 },
];

// ---------------------------------------------------------------------------
// Phase config
// ---------------------------------------------------------------------------

const PHASE_DURATION = 1400;
const TOTAL_PHASES = 7;

// ---------------------------------------------------------------------------
// Results data
// ---------------------------------------------------------------------------

const RESULTS: Record<number, string> = {
  0: 'W1: count=3, sum=$425',
  1: 'W2: count=2, sum=$280',
};

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// Helper: compute center X for an event inside its window bucket
// ---------------------------------------------------------------------------

function eventSlotX(windowIndex: number, slotIndex: number): number {
  const winX = WINDOW_X_OFFSETS[windowIndex];
  const startPad = 24;
  return winX + startPad + slotIndex * EVENT_CIRCLE_SPACING;
}

function eventSlotY(): number {
  return WINDOW_Y + WINDOW_HEIGHT / 2 + 4;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TumbleWindowAnimation() {
  const [phase, setPhase] = useState(0);
  const [animProgress, setAnimProgress] = useState(0);

  // Track which events have been committed (landed) into windows
  const [landedEvents, setLandedEvents] = useState<Set<number>>(new Set());
  // Track which windows have been closed
  const [closedWindows, setClosedWindows] = useState<Set<number>>(new Set());
  // Track which results have been emitted
  const [emittedResults, setEmittedResults] = useState<Set<number>>(new Set());

  useEffect(() => {
    let frameId: number;
    let startTime = Date.now();
    let currentPhase = 0;

    const resetState = () => {
      setLandedEvents(new Set());
      setClosedWindows(new Set());
      setEmittedResults(new Set());
      currentPhase = 0;
      startTime = Date.now();
    };

    const applyPhase = (completedPhase: number) => {
      switch (completedPhase) {
        case 0:
          // Phase 0 complete: no events landed yet (just showed empty windows)
          break;
        case 1:
          // Phase 1 complete: 3 events have landed in W1
          setLandedEvents(new Set([1, 2, 3]));
          break;
        case 2:
          // Phase 2 complete: W1 closed, result emitted
          setClosedWindows(prev => new Set([...prev, 0]));
          setEmittedResults(prev => new Set([...prev, 0]));
          break;
        case 3:
          // Phase 3 complete: 2 events landed in W2
          setLandedEvents(prev => new Set([...prev, 4, 5]));
          break;
        case 4:
          // Phase 4 complete: W2 closed, result emitted
          setClosedWindows(prev => new Set([...prev, 1]));
          setEmittedResults(prev => new Set([...prev, 1]));
          break;
        case 5:
          // Phase 5 complete: 1 event landed in W3
          setLandedEvents(prev => new Set([...prev, 6]));
          break;
        default:
          break;
      }
    };

    const tick = () => {
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
  }, []);

  // ---------------------------------------------------------------------------
  // Compute animating events for the current phase
  // ---------------------------------------------------------------------------

  const getAnimatingEvents = (): AnimatingEvent[] => {
    const result: AnimatingEvent[] = [];

    switch (phase) {
      case 1: {
        // Three events drop from timeline into Window 1
        const evts = ALL_EVENTS.filter(e => e.windowIndex === 0);
        evts.forEach((evt, i) => {
          const delay = i * 0.25;
          const localProgress = Math.max(0, Math.min((animProgress - delay) * 1.8, 1));
          const localEased = easeInOutCubic(localProgress);
          // Arrive from above the timeline, staggered along the window
          const targetX = eventSlotX(evt.windowIndex, evt.slotIndex);
          const timelineEventX = targetX;
          result.push({
            id: evt.id,
            label: evt.label,
            color: evt.color,
            fromX: timelineEventX,
            fromY: TIMELINE_Y - 18,
            toX: targetX,
            toY: eventSlotY(),
            progress: localEased,
          });
        });
        break;
      }
      case 2: {
        // Window 1 closing animation — events are already landed (from applyPhase)
        // The closing flash and result slide are handled in render
        break;
      }
      case 3: {
        // Two events drop from timeline into Window 2
        const evts = ALL_EVENTS.filter(e => e.windowIndex === 1);
        evts.forEach((evt, i) => {
          const delay = i * 0.3;
          const localProgress = Math.max(0, Math.min((animProgress - delay) * 1.6, 1));
          const localEased = easeInOutCubic(localProgress);
          const targetX = eventSlotX(evt.windowIndex, evt.slotIndex);
          result.push({
            id: evt.id,
            label: evt.label,
            color: evt.color,
            fromX: targetX,
            fromY: TIMELINE_Y - 18,
            toX: targetX,
            toY: eventSlotY(),
            progress: localEased,
          });
        });
        break;
      }
      case 4: {
        // Window 2 closing animation
        break;
      }
      case 5: {
        // One event drops into Window 3
        const evt = ALL_EVENTS.find(e => e.windowIndex === 2)!;
        const localEased = easeInOutCubic(Math.min(animProgress * 1.4, 1));
        const targetX = eventSlotX(evt.windowIndex, evt.slotIndex);
        result.push({
          id: evt.id,
          label: evt.label,
          color: evt.color,
          fromX: targetX,
          fromY: TIMELINE_Y - 18,
          toX: targetX,
          toY: eventSlotY(),
          progress: localEased,
        });
        break;
      }
      default:
        break;
    }
    return result;
  };

  const animatingEvents = getAnimatingEvents();

  // ---------------------------------------------------------------------------
  // Status bar text
  // ---------------------------------------------------------------------------

  const getPhaseLabel = (): string => {
    switch (phase) {
      case 0: return 'Events arrive continuously along the timeline';
      case 1: return 'Events at t=2s, t=5s, t=8s land in Window 1 [0s-10s]';
      case 2: return 'Window 1 closes at t=10s and emits its result';
      case 3: return 'New events at t=12s, t=17s land in Window 2 [10s-20s]';
      case 4: return 'Window 2 closes at t=20s \u2014 non-overlapping, no gaps';
      case 5: return 'Window 3 is still open, collecting events...';
      case 6: return 'Fixed size. No overlap. Every event belongs to exactly one window.';
      default: return '';
    }
  };

  // ---------------------------------------------------------------------------
  // Window state helpers
  // ---------------------------------------------------------------------------

  const isWindowClosed = (wIdx: number): boolean => {
    if (closedWindows.has(wIdx)) return true;
    // Currently closing
    if (phase === 2 && wIdx === 0) return true;
    if (phase === 4 && wIdx === 1) return true;
    return false;
  };

  const isWindowClosing = (wIdx: number): boolean => {
    if (phase === 2 && wIdx === 0) return true;
    if (phase === 4 && wIdx === 1) return true;
    return false;
  };

  const windowHasEvents = (wIdx: number): boolean => {
    if (wIdx === 0 && (phase >= 2 || (phase === 1 && animProgress > 0.7))) return true;
    if (wIdx === 1 && (phase >= 4 || (phase === 3 && animProgress > 0.7))) return true;
    if (wIdx === 2 && (phase >= 6 || (phase === 5 && animProgress > 0.7))) return true;
    return landedEvents.size > 0 && ALL_EVENTS.some(e => e.windowIndex === wIdx && landedEvents.has(e.id));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Closing flash intensity (pulses during closing phase)
  const closingFlash = (wIdx: number): number => {
    if (!isWindowClosing(wIdx)) return 0;
    // Pulse: ramp up then stabilize
    const pulse = Math.sin(animProgress * Math.PI * 3) * 0.3;
    const ramp = easeInOutCubic(Math.min(animProgress * 2, 1));
    return Math.max(0, ramp * 0.25 + pulse * (1 - animProgress));
  };

  // Result slide-down progress
  const resultSlideProgress = (wIdx: number): number => {
    if (phase === 2 && wIdx === 0) {
      return easeInOutCubic(Math.max(0, (animProgress - 0.4) * 1.8));
    }
    if (phase === 4 && wIdx === 1) {
      return easeInOutCubic(Math.max(0, (animProgress - 0.4) * 1.8));
    }
    if (emittedResults.has(wIdx)) return 1;
    return 0;
  };

  // Window labels
  const windowLabels = ['0s - 10s', '10s - 20s', '20s - 30s'];
  const windowNames = ['Window 1', 'Window 2', 'Window 3'];
  const windowColors = [W1_COLOR, W2_COLOR, W3_COLOR];

  return (
    <div className="concept-animation">
      <h4>Tumbling Windows: Fixed-Size, Non-Overlapping</h4>
      <svg
        viewBox="0 0 560 260"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto' }}
        aria-label="Tumbling window animation: fixed-size non-overlapping windows collect events and emit aggregated results when each window closes"
        role="img"
      >
        <defs>
          <marker id="tw-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill="var(--color-border, #475569)" />
          </marker>
          {/* Glow filter for closing flash */}
          <filter id="tw-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Subtle drop shadow for event circles */}
          <filter id="tw-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* ================================================================
            TIMELINE ARROW
            ================================================================ */}
        <line
          x1={TIMELINE_X_START} y1={TIMELINE_Y}
          x2={TIMELINE_X_END} y2={TIMELINE_Y}
          stroke="var(--color-border, #475569)" strokeWidth="2"
          markerEnd="url(#tw-arrow)"
        />
        <text x={TIMELINE_X_END + 8} y={TIMELINE_Y + 4} fontSize="10" fontWeight="bold"
          fill="var(--color-text, #94a3b8)">time</text>

        {/* Timeline tick marks and labels */}
        {TIME_TICKS.map(tick => (
          <g key={tick.label}>
            <line
              x1={tick.x} y1={TIMELINE_Y - 6}
              x2={tick.x} y2={TIMELINE_Y + 6}
              stroke="var(--color-border, #475569)" strokeWidth="1.5"
            />
            <text x={tick.x} y={TIMELINE_Y - 12} textAnchor="middle" fontSize="8"
              fill="var(--color-text, #94a3b8)" opacity="0.8">
              {tick.label}
            </text>
          </g>
        ))}

        {/* Pulsing dots along timeline during phase 0 to suggest events arriving */}
        {phase === 0 && (
          <>
            {[0.15, 0.4, 0.65, 0.85].map((frac, i) => {
              const dotProgress = (animProgress + frac) % 1;
              const dotX = TIMELINE_X_START + dotProgress * (TIMELINE_X_END - TIMELINE_X_START - 30);
              const dotOpacity = Math.sin(dotProgress * Math.PI) * 0.6;
              const colors = [W1_COLOR, W1_COLOR, W2_COLOR, W3_COLOR];
              return (
                <circle key={`flow-${i}`} cx={dotX} cy={TIMELINE_Y} r={4}
                  fill={colors[i]} opacity={dotOpacity} />
              );
            })}
          </>
        )}

        {/* ================================================================
            WINDOW BUCKETS
            ================================================================ */}
        {[0, 1, 2].map(wIdx => {
          const wx = WINDOW_X_OFFSETS[wIdx];
          const closed = isWindowClosed(wIdx);
          const closing = isWindowClosing(wIdx);
          const flash = closingFlash(wIdx);
          const wColor = windowColors[wIdx];

          // Determine border style
          const isOpen = !closed || closing;
          const strokeDash = (wIdx === 2 && !closed) ? '6 4' : (isOpen && !closing ? '6 4' : 'none');
          const strokeW = closing ? 2.5 : (closed ? 2 : 1.5);
          const fillOpacity = closed ? 0.15 : (closing ? 0.08 + flash : 0.04);

          return (
            <g key={`window-${wIdx}`}>
              {/* Window rectangle */}
              <rect
                x={wx} y={WINDOW_Y}
                width={WINDOW_WIDTH} height={WINDOW_HEIGHT}
                rx="6"
                fill={wColor}
                fillOpacity={fillOpacity}
                stroke={wColor}
                strokeWidth={strokeW}
                strokeDasharray={strokeDash}
                filter={closing ? 'url(#tw-glow)' : undefined}
              />

              {/* Closing flash overlay */}
              {closing && (
                <rect
                  x={wx} y={WINDOW_Y}
                  width={WINDOW_WIDTH} height={WINDOW_HEIGHT}
                  rx="6"
                  fill={wColor}
                  fillOpacity={flash * 0.5}
                />
              )}

              {/* Window name label (top-left inside) */}
              <text x={wx + 8} y={WINDOW_Y + 14} fontSize="8" fontWeight="bold"
                fill={wColor} opacity={0.9}>
                {windowNames[wIdx]}
              </text>

              {/* Time range label (top-right inside) */}
              <text x={wx + WINDOW_WIDTH - 8} y={WINDOW_Y + 14} fontSize="7"
                textAnchor="end" fill={wColor} opacity={0.6}>
                [{windowLabels[wIdx]}]
              </text>

              {/* CLOSED badge */}
              {closed && !closing && (
                <g>
                  <rect x={wx + WINDOW_WIDTH / 2 - 24} y={WINDOW_Y - 10}
                    width="48" height="14" rx="7"
                    fill={wColor} opacity="0.9" />
                  <text x={wx + WINDOW_WIDTH / 2} y={WINDOW_Y - 1}
                    textAnchor="middle" fontSize="7" fontWeight="bold" fill="#fff">
                    CLOSED
                  </text>
                </g>
              )}
              {/* Closing badge appearing during close animation */}
              {closing && animProgress > 0.3 && (
                <g opacity={easeInOutCubic((animProgress - 0.3) * 1.5)}>
                  <rect x={wx + WINDOW_WIDTH / 2 - 24} y={WINDOW_Y - 10}
                    width="48" height="14" rx="7"
                    fill={wColor} opacity="0.9" />
                  <text x={wx + WINDOW_WIDTH / 2} y={WINDOW_Y - 1}
                    textAnchor="middle" fontSize="7" fontWeight="bold" fill="#fff">
                    CLOSED
                  </text>
                </g>
              )}

              {/* Event count badge (bottom-right) */}
              {windowHasEvents(wIdx) && (
                <g>
                  <rect x={wx + WINDOW_WIDTH - 50} y={WINDOW_Y + WINDOW_HEIGHT - 16}
                    width="42" height="12" rx="6"
                    fill={wColor} opacity="0.2" />
                  <text x={wx + WINDOW_WIDTH - 29} y={WINDOW_Y + WINDOW_HEIGHT - 7}
                    textAnchor="middle" fontSize="6.5" fill={wColor} fontWeight="bold">
                    {wIdx === 0 ? '3 events' : wIdx === 1 ? '2 events' : '1 event'}
                  </text>
                </g>
              )}

              {/* Landed (committed) event circles inside the window */}
              {ALL_EVENTS
                .filter(e => e.windowIndex === wIdx && landedEvents.has(e.id))
                .map(evt => (
                  <g key={`landed-${evt.id}`}>
                    {/* Subtle glow behind circle */}
                    <circle
                      cx={eventSlotX(wIdx, evt.slotIndex)}
                      cy={eventSlotY()}
                      r={EVENT_RADIUS + 4}
                      fill={evt.color} opacity="0.08"
                    />
                    <circle
                      cx={eventSlotX(wIdx, evt.slotIndex)}
                      cy={eventSlotY()}
                      r={EVENT_RADIUS}
                      fill={evt.color} opacity="0.85"
                      filter="url(#tw-shadow)"
                    />
                    <text
                      x={eventSlotX(wIdx, evt.slotIndex)}
                      y={eventSlotY() + 1}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="6.5" fontWeight="bold" fill="#fff">
                      {evt.label}
                    </text>
                    {/* Time label below circle */}
                    <text
                      x={eventSlotX(wIdx, evt.slotIndex)}
                      y={eventSlotY() + EVENT_RADIUS + 9}
                      textAnchor="middle" fontSize="6"
                      fill={evt.color} opacity="0.6">
                      {evt.timeLabel}
                    </text>
                  </g>
                ))
              }
            </g>
          );
        })}

        {/* ================================================================
            ANIMATING EVENT CIRCLES (dropping from timeline into windows)
            ================================================================ */}
        {animatingEvents.map(evt => {
          const cx = evt.fromX + (evt.toX - evt.fromX) * evt.progress;
          const cy = evt.fromY + (evt.toY - evt.fromY) * evt.progress;
          // Trail effect: subtle line from start to current position
          const trailOpacity = Math.max(0, 0.3 - evt.progress * 0.3);

          return (
            <g key={`anim-${evt.id}`}>
              {/* Motion trail */}
              {evt.progress > 0.05 && evt.progress < 0.95 && (
                <line
                  x1={evt.fromX} y1={evt.fromY + 4}
                  x2={cx} y2={cy}
                  stroke={evt.color} strokeWidth="1.5" opacity={trailOpacity}
                  strokeLinecap="round"
                />
              )}
              {/* Glow halo */}
              <circle cx={cx} cy={cy} r={EVENT_RADIUS + 5}
                fill={evt.color} opacity={0.12 * (1 - evt.progress * 0.5)} />
              {/* Main circle */}
              <circle cx={cx} cy={cy} r={EVENT_RADIUS}
                fill={evt.color} opacity="0.9"
                filter="url(#tw-shadow)" />
              {/* Dollar label */}
              <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                fontSize="6.5" fontWeight="bold" fill="#fff">
                {evt.label}
              </text>
            </g>
          );
        })}

        {/* ================================================================
            RESULT PILLS (slide down from closed windows)
            ================================================================ */}
        {[0, 1].map(wIdx => {
          const progress = resultSlideProgress(wIdx);
          if (progress <= 0) return null;

          const wx = WINDOW_X_OFFSETS[wIdx];
          const resultX = wx + 4;
          const resultStartY = WINDOW_Y + WINDOW_HEIGHT + 2;
          const resultEndY = RESULT_Y;
          const currentY = resultStartY + (resultEndY - resultStartY) * progress;
          const wColor = windowColors[wIdx];

          return (
            <g key={`result-${wIdx}`} opacity={progress}>
              {/* Connector line from window to result */}
              <line
                x1={wx + WINDOW_WIDTH / 2} y1={WINDOW_Y + WINDOW_HEIGHT}
                x2={wx + WINDOW_WIDTH / 2} y2={currentY}
                stroke={wColor} strokeWidth="1" strokeDasharray="3 2"
                opacity={0.4 * progress}
              />
              {/* Arrow head */}
              <polygon
                points={`${wx + WINDOW_WIDTH / 2 - 3},${currentY - 4} ${wx + WINDOW_WIDTH / 2 + 3},${currentY - 4} ${wx + WINDOW_WIDTH / 2},${currentY}`}
                fill={wColor} opacity={0.5 * progress}
              />
              {/* Result pill */}
              <rect
                x={resultX} y={currentY}
                width={WINDOW_WIDTH - 8} height={RESULT_HEIGHT}
                rx="11"
                fill={wColor} fillOpacity={0.12}
                stroke={wColor} strokeWidth="1.2"
              />
              <text
                x={resultX + (WINDOW_WIDTH - 8) / 2}
                y={currentY + RESULT_HEIGHT / 2 + 1}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="7.5" fontWeight="bold" fill={wColor}>
                {RESULTS[wIdx]}
              </text>
            </g>
          );
        })}

        {/* Result area label */}
        <text x={30} y={RESULT_Y + 10} fontSize="7" fill="var(--color-text, #64748b)" opacity="0.5">
          Results
        </text>

        {/* ================================================================
            PHASE 6: KEY INSIGHT CALLOUT
            ================================================================ */}
        {phase === 6 && (
          <g opacity={easeInOutCubic(Math.min(animProgress * 2, 1))}>
            <rect x="90" y="28" width="380" height="22" rx="11"
              fill="var(--color-accent, #6366f1)" fillOpacity="0.1"
              stroke="var(--color-accent, #6366f1)" strokeWidth="1" />
            <text x="280" y="42" textAnchor="middle" fontSize="8.5" fontWeight="bold"
              fill="var(--color-accent, #6366f1)">
              Fixed size. No overlap. Every event belongs to exactly one window.
            </text>
          </g>
        )}

        {/* Highlight borders on all three windows during phase 6 */}
        {phase === 6 && (
          <>
            {[0, 1, 2].map(wIdx => {
              const wx = WINDOW_X_OFFSETS[wIdx];
              const pulseOpacity = 0.15 + Math.sin(animProgress * Math.PI * 4) * 0.1;
              return (
                <rect key={`highlight-${wIdx}`}
                  x={wx - 2} y={WINDOW_Y - 2}
                  width={WINDOW_WIDTH + 4} height={WINDOW_HEIGHT + 4}
                  rx="8"
                  fill="none"
                  stroke="var(--color-accent, #6366f1)"
                  strokeWidth="1.5"
                  opacity={pulseOpacity}
                />
              );
            })}
          </>
        )}

        {/* ================================================================
            STATUS BAR
            ================================================================ */}
        <rect x="30" y="218" width="500" height="18" rx="4"
          fill="var(--color-surface, #1e293b)"
          stroke="var(--color-border, #334155)" strokeWidth="0.5" />
        <text x="280" y="230" textAnchor="middle" fontSize="7.5"
          fill="var(--color-text, #94a3b8)">
          {getPhaseLabel()}
        </text>

        {/* ================================================================
            LEGEND
            ================================================================ */}
        <g transform="translate(30, 245)">
          {/* W1 events */}
          <circle cx="6" cy="6" r="4" fill={W1_COLOR} opacity="0.85" />
          <text x="14" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">W1 events</text>

          {/* W2 events */}
          <circle cx="86" cy="6" r="4" fill={W2_COLOR} opacity="0.85" />
          <text x="94" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">W2 events</text>

          {/* W3 events */}
          <circle cx="166" cy="6" r="4" fill={W3_COLOR} opacity="0.85" />
          <text x="174" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">W3 events</text>

          {/* Open window */}
          <rect x="240" y="1" width="14" height="10" rx="2"
            fill="none" stroke="var(--color-border, #475569)" strokeWidth="1"
            strokeDasharray="3 2" />
          <text x="258" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">Open</text>

          {/* Closed window */}
          <rect x="290" y="1" width="14" height="10" rx="2"
            fill="var(--color-accent, #6366f1)" fillOpacity="0.15"
            stroke="var(--color-accent, #6366f1)" strokeWidth="1.5" />
          <text x="308" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">Closed</text>

          {/* Result */}
          <rect x="350" y="1" width="24" height="10" rx="5"
            fill="var(--color-accent, #6366f1)" fillOpacity="0.1"
            stroke="var(--color-accent, #6366f1)" strokeWidth="0.8" />
          <text x="378" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">Result</text>
        </g>
      </svg>
    </div>
  );
}
