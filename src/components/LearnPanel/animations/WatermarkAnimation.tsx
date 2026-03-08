import { useState, useEffect } from 'react';
import './animations.css';

/*
 * Phases (6s cycle, 1.5s each):
 *   0: Events e1(t=1), e2(t=2), e3(t=3) arrive in order. Watermark at t=2.
 *   1: e4(t=5) arrives (gap). Watermark advances to t=4.
 *   2: e5(t=3) arrives LATE -- timestamp behind watermark. Highlighted orange.
 *   3: Window [0,5) closes as watermark reaches t=5. Results emitted.
 */

const PHASE_DURATION = 1500;
const TOTAL_PHASES = 4;

// Timeline geometry
const TIMELINE_Y = 120;
const TIMELINE_X_START = 60;
const TIMELINE_X_END = 520;
const TICK_SPACING = (TIMELINE_X_END - TIMELINE_X_START) / 6;

function timeToX(t: number): number {
  return TIMELINE_X_START + t * TICK_SPACING;
}

const EVENT_RADIUS = 10;

interface EventDot {
  id: string;
  eventTime: number;
  label: string;
  late: boolean;
}

const PHASE_EVENTS: EventDot[][] = [
  [
    { id: 'e1', eventTime: 1, label: 'e1(t=1)', late: false },
    { id: 'e2', eventTime: 2, label: 'e2(t=2)', late: false },
    { id: 'e3', eventTime: 3, label: 'e3(t=3)', late: false },
  ],
  [{ id: 'e4', eventTime: 5, label: 'e4(t=5)', late: false }],
  [{ id: 'e5', eventTime: 3, label: 'e5(t=3)', late: true }],
  [],
];

const WATERMARK_POS = [2, 4, 4, 5];

const PHASE_DESCRIPTIONS = [
  'Events arrive in order. Watermark follows at t=2.',
  'e4(t=5) arrives with a gap! Watermark advances to t=4.',
  'e5(t=3) arrives late \u2014 its time is behind the watermark!',
  'Watermark reaches t=5. Window [0,5) closes and emits results.',
];

const WINDOW_START = 0;
const WINDOW_END = 5;

export function WatermarkAnimation() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPhase((prev) => (prev + 1) % TOTAL_PHASES);
    }, PHASE_DURATION);
    return () => clearInterval(id);
  }, []);

  // Accumulate all visible events up through the current phase
  const visibleEvents: EventDot[] = [];
  for (let p = 0; p <= phase; p++) {
    visibleEvents.push(...PHASE_EVENTS[p]);
  }

  const watermarkX = timeToX(WATERMARK_POS[phase]);
  const windowSealed = phase >= 3;

  const winX = timeToX(WINDOW_START);
  const winWidth = timeToX(WINDOW_END) - winX;
  const winY = TIMELINE_Y - 45;
  const winHeight = 55;

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
        How Watermarks Track Progress
      </h4>

      <svg viewBox="0 0 560 200" width="100%" style={{ overflow: 'visible' }}>
        {/* Window [0,5) */}
        <rect
          x={winX}
          y={winY}
          width={winWidth}
          height={winHeight}
          rx={4}
          fill={windowSealed ? 'rgba(76,175,80,0.12)' : 'rgba(100,100,100,0.07)'}
          stroke={windowSealed ? '#4caf50' : 'rgba(150,150,150,0.4)'}
          strokeWidth={windowSealed ? 2 : 1}
          strokeDasharray={windowSealed ? 'none' : '6 3'}
          style={{ transition: 'all 0.5s ease' }}
        />
        <text
          x={winX + winWidth / 2}
          y={winY - 6}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-text-primary)"
          opacity={0.7}
        >
          Window [0, 5)
        </text>
        {windowSealed && (
          <text
            x={winX + winWidth / 2}
            y={winY + winHeight + 42}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="#4caf50"
            className="fadeInUp"
          >
            {'\u2714 Window closed \u2014 results emitted!'}
          </text>
        )}

        {/* Timeline axis */}
        <line
          x1={TIMELINE_X_START}
          y1={TIMELINE_Y}
          x2={TIMELINE_X_END}
          y2={TIMELINE_Y}
          stroke="var(--color-text-primary)"
          strokeWidth={1.5}
          opacity={0.5}
        />
        <polygon
          points={`${TIMELINE_X_END},${TIMELINE_Y} ${TIMELINE_X_END - 8},${TIMELINE_Y - 4} ${TIMELINE_X_END - 8},${TIMELINE_Y + 4}`}
          fill="var(--color-text-primary)"
          opacity={0.5}
        />
        <text
          x={TIMELINE_X_END + 4}
          y={TIMELINE_Y + 4}
          fontSize={10}
          fill="var(--color-text-primary)"
          opacity={0.5}
        >
          event time
        </text>

        {/* Tick marks 0-6 */}
        {[0, 1, 2, 3, 4, 5, 6].map((t) => (
          <g key={`tick-${t}`}>
            <line
              x1={timeToX(t)}
              y1={TIMELINE_Y - 4}
              x2={timeToX(t)}
              y2={TIMELINE_Y + 4}
              stroke="var(--color-text-primary)"
              strokeWidth={1}
              opacity={0.4}
            />
            <text
              x={timeToX(t)}
              y={TIMELINE_Y + 16}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-text-primary)"
              opacity={0.5}
            >
              {t}
            </text>
          </g>
        ))}

        {/* Watermark line */}
        <line
          x1={watermarkX}
          y1={TIMELINE_Y - 60}
          x2={watermarkX}
          y2={TIMELINE_Y + 25}
          stroke="#2196f3"
          strokeWidth={2}
          strokeDasharray="6 4"
          className="watermarkAdvance"
          style={{ transition: 'x1 0.6s ease, x2 0.6s ease' }}
        />
        <text
          x={watermarkX}
          y={TIMELINE_Y - 63}
          textAnchor="middle"
          fontSize={10}
          fontWeight={600}
          fill="#2196f3"
          style={{ transition: 'all 0.6s ease' }}
        >
          {`Watermark (t=${WATERMARK_POS[phase]})`}
        </text>

        {/* Event dots */}
        {visibleEvents.map((evt) => {
          const cx = timeToX(evt.eventTime);
          const cy = TIMELINE_Y - 22;
          const isNew = PHASE_EVENTS[phase].some((e) => e.id === evt.id);
          const color = evt.late ? 'orange' : 'var(--color-accent)';
          // Offset late event vertically so it does not overlap e3
          const yOffset = evt.late ? -18 : 0;

          return (
            <g key={evt.id} className={isNew ? 'fadeInUp' : ''}>
              <circle
                cx={cx}
                cy={cy + yOffset}
                r={EVENT_RADIUS}
                fill={color}
                opacity={0.9}
                stroke={evt.late ? '#e65100' : 'none'}
                strokeWidth={evt.late ? 1.5 : 0}
              />

              {/* Label above the circle */}
              <text
                x={cx}
                y={cy + yOffset - 14}
                textAnchor="middle"
                fontSize={9}
                fill="var(--color-text-primary)"
                fontWeight={500}
              >
                {evt.label}
              </text>

              {/* Status icon inside the circle */}
              {!evt.late ? (
                <text
                  x={cx}
                  y={cy + yOffset + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fill="white"
                  fontWeight={700}
                >
                  {'\u2713'}
                </text>
              ) : (
                <>
                  <text
                    x={cx}
                    y={cy + yOffset + 5}
                    textAnchor="middle"
                    fontSize={13}
                    fill="white"
                    fontWeight={700}
                  >
                    !
                  </text>
                  <text
                    x={cx + 16}
                    y={cy + yOffset + 4}
                    fontSize={9}
                    fontWeight={700}
                    fill="#e65100"
                  >
                    LATE
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Phase description */}
        <text
          x={280}
          y={192}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-text-primary)"
          opacity={0.8}
          fontStyle="italic"
        >
          {PHASE_DESCRIPTIONS[phase]}
        </text>
      </svg>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          marginTop: 8,
          fontSize: 11,
          color: 'var(--color-text-primary)',
          opacity: 0.75,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12">
            <circle cx="6" cy="6" r="5" fill="var(--color-accent)" />
          </svg>
          Normal Event
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12">
            <circle cx="6" cy="6" r="5" fill="orange" stroke="#e65100" strokeWidth="1" />
          </svg>
          Late Event
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="24" height="12">
            <line x1="0" y1="6" x2="24" y2="6" stroke="#2196f3" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          Watermark
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="16" height="12">
            <rect x="1" y="1" width="14" height="10" rx="2" fill="rgba(100,100,100,0.1)" stroke="rgba(150,150,150,0.5)" strokeWidth="1" strokeDasharray="3 2" />
          </svg>
          Window
        </span>
      </div>
    </div>
  );
}
