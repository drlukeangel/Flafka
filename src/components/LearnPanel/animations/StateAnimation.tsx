import { useState, useEffect } from 'react';
import './animations.css';

interface StateRow {
  key: string;
  count: number;
  total: number;
  status: 'inserting' | 'updating' | 'stable' | 'fading';
}

const EVENTS = [
  { key: 'user_1', value: 50, label: 'user_1: $50' },
  { key: 'user_2', value: 30, label: 'user_2: $30' },
  { key: 'user_1', value: 25, label: 'user_1: $25' },
  { key: 'user_3', value: 100, label: 'user_3: $100' },
  { key: 'user_2', value: 45, label: 'user_2: $45' },
];

const PHASE_MS = 1600;
const TTL_MS = 2400;
const PAUSE_MS = 500;
const CYCLE_MS = EVENTS.length * PHASE_MS + TTL_MS + PAUSE_MS;

export function StateAnimation() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => (prev + 50) % CYCLE_MS);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const eventPhaseEnd = EVENTS.length * PHASE_MS;
  const phaseIndex = Math.min(Math.floor(elapsed / PHASE_MS), EVENTS.length);
  const phaseProgress = (elapsed % PHASE_MS) / PHASE_MS;

  // Build the state table from all completed events
  const rowMap = new Map<string, StateRow>();
  const rowOrder: string[] = [];

  for (let i = 0; i < phaseIndex; i++) {
    const ev = EVENTS[i];
    const existing = rowMap.get(ev.key);
    if (existing) {
      existing.count += 1;
      existing.total += ev.value;
      existing.status = 'stable';
    } else {
      rowMap.set(ev.key, {
        key: ev.key,
        count: 1,
        total: ev.value,
        status: 'stable',
      });
      rowOrder.push(ev.key);
    }
  }

  // Handle current in-flight event
  let eventPill: { label: string; x: number } | null = null;
  const arrived = phaseProgress > 0.5;

  if (phaseIndex < EVENTS.length) {
    const ev = EVENTS[phaseIndex];
    const travelProgress = Math.min(phaseProgress / 0.5, 1);
    const eased = 1 - (1 - travelProgress) * (1 - travelProgress);
    const startX = 20;
    const endX = 225;
    const x = startX + (endX - startX) * eased;

    if (!arrived) {
      eventPill = { label: ev.label, x };
    }

    if (arrived) {
      const existing = rowMap.get(ev.key);
      if (existing) {
        existing.count += 1;
        existing.total += ev.value;
        existing.status = 'updating';
      } else {
        rowMap.set(ev.key, {
          key: ev.key,
          count: 1,
          total: ev.value,
          status: 'inserting',
        });
        rowOrder.push(ev.key);
      }
    }
  }

  // TTL phase
  const inTtlPhase = elapsed >= eventPhaseEnd;
  const ttlProgress = inTtlPhase ? Math.min((elapsed - eventPhaseEnd) / TTL_MS, 1) : 0;

  if (inTtlPhase && rowMap.has('user_3')) {
    rowMap.get('user_3')!.status = 'fading';
  }

  const rows = rowOrder.map((k) => rowMap.get(k)!);

  // Table layout constants
  const tableX = 265;
  const tableY = 38;
  const colWidths = [88, 60, 72];
  const tableW = colWidths[0] + colWidths[1] + colWidths[2];
  const rowH = 30;
  const headerH = 32;
  const headers = ['Key', 'Count', 'Total'];

  const flashIntensity = arrived ? Math.max(0, 1 - (phaseProgress - 0.5) * 2.5) : 0;

  const getRowBg = (row: StateRow, idx: number): string => {
    if (row.status === 'inserting') {
      return `rgba(16, 185, 129, ${flashIntensity * 0.4})`;
    }
    if (row.status === 'updating') {
      return `rgba(234, 179, 8, ${flashIntensity * 0.4})`;
    }
    return idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
  };

  const getRowOpacity = (row: StateRow): number => {
    if (row.status === 'fading') {
      if (ttlProgress < 0.25) return 1;
      if (ttlProgress < 0.45) return 0.55;
      return Math.max(0, 1 - (ttlProgress - 0.25) * 1.6);
    }
    if (row.status === 'inserting') {
      return Math.min(1, (phaseProgress - 0.5) * 4);
    }
    return 1;
  };

  const getRowTransformY = (row: StateRow): number => {
    if (row.status === 'inserting') {
      const p = Math.min((phaseProgress - 0.5) * 4, 1);
      return (1 - p) * 8;
    }
    return 0;
  };

  const getTextColor = (row: StateRow, isValue: boolean): string => {
    if (row.status === 'fading' && ttlProgress > 0.25) return '#666';
    if (isValue && row.status === 'updating') return '#eab308';
    return 'var(--color-text-primary)';
  };

  return (
    <div className="concept-animation">
      <h4
        style={{
          margin: '0 0 8px 0',
          color: 'var(--color-text-primary)',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        How Flink Manages Keyed State
      </h4>
      <svg
        viewBox="0 0 560 280"
        style={{ width: '100%', maxWidth: 560, background: 'transparent' }}
      >
        <defs>
          <filter id="sa-glow-green">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="sa-glow-yellow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Section label */}
        <text
          x="18"
          y="28"
          fontSize="11"
          fontWeight="600"
          fill="var(--color-text-primary)"
          opacity={0.6}
        >
          Incoming Events
        </text>

        {/* Arrow: events -> state table */}
        <line
          x1="210"
          y1="130"
          x2="255"
          y2="130"
          stroke="var(--color-text-primary)"
          strokeWidth="1.5"
          opacity={0.25}
          strokeDasharray="4 3"
        />
        <polygon
          points="253,126 260,130 253,134"
          fill="var(--color-text-primary)"
          opacity={0.25}
        />

        {/* Queued events (stacked behind current) */}
        {EVENTS.slice(phaseIndex + 1, Math.min(phaseIndex + 3, EVENTS.length)).map(
          (ev, i) => (
            <g
              key={`q-${ev.label}-${i}`}
              transform={`translate(20, ${100 + i * 28})`}
              opacity={0.25 - i * 0.08}
            >
              <rect
                x="0"
                y="0"
                width="115"
                height="24"
                rx="12"
                fill="var(--color-accent)"
                opacity={0.6}
              />
              <text
                x="57"
                y="16"
                textAnchor="middle"
                fontSize="10"
                fill="#fff"
                opacity={0.85}
              >
                {ev.label}
              </text>
            </g>
          )
        )}

        {/* Active event pill traveling toward the table */}
        {eventPill && (
          <g transform={`translate(${eventPill.x}, 118)`}>
            <rect
              x="0"
              y="0"
              width="115"
              height="24"
              rx="12"
              fill="var(--color-accent)"
              opacity={0.9}
            />
            <text
              x="57"
              y="16"
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#fff"
            >
              {eventPill.label}
            </text>
          </g>
        )}

        {/* STATE TABLE */}
        <g transform={`translate(${tableX}, ${tableY})`}>
          {/* Title */}
          <text
            x={tableW / 2}
            y="-10"
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="var(--color-text-primary)"
            letterSpacing="0.5"
          >
            STATE TABLE
          </text>

          {/* Outer border */}
          <rect
            x="0"
            y="0"
            width={tableW}
            height={headerH + Math.max(rows.length, 1) * rowH + 1}
            rx="4"
            fill="rgba(255,255,255,0.03)"
            stroke="var(--color-text-primary)"
            strokeWidth="1"
            strokeOpacity={0.2}
          />

          {/* Header background */}
          <rect x="0" y="0" width={tableW} height={headerH} rx="4" fill="rgba(255,255,255,0.08)" />
          <rect x="0" y={headerH - 6} width={tableW} height="6" fill="rgba(255,255,255,0.08)" />

          {/* Header divider */}
          <line
            x1="0"
            y1={headerH}
            x2={tableW}
            y2={headerH}
            stroke="var(--color-text-primary)"
            strokeWidth="1"
            strokeOpacity={0.25}
          />

          {/* Header text */}
          {headers.map((h, i) => {
            const cx = colWidths.slice(0, i).reduce((a, b) => a + b, 0) + colWidths[i] / 2;
            return (
              <text
                key={h}
                x={cx}
                y={21}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="var(--color-text-primary)"
                opacity={0.75}
              >
                {h}
              </text>
            );
          })}

          {/* Column dividers */}
          {[colWidths[0], colWidths[0] + colWidths[1]].map((cx, i) => (
            <line
              key={`cdiv-${i}`}
              x1={cx}
              y1="0"
              x2={cx}
              y2={headerH + Math.max(rows.length, 1) * rowH}
              stroke="var(--color-text-primary)"
              strokeWidth="0.5"
              strokeOpacity={0.12}
            />
          ))}

          {/* Data rows */}
          {rows.map((row, idx) => {
            const ry = headerH + idx * rowH;
            const opacity = getRowOpacity(row);
            const bg = getRowBg(row, idx);
            const translateY = getRowTransformY(row);
            const isTtlTarget = row.key === 'user_3' && row.status === 'fading';
            const showTtlLabel = isTtlTarget && ttlProgress > 0.12;

            return (
              <g
                key={row.key}
                transform={`translate(0, ${ry + translateY})`}
                opacity={opacity}
              >
                {/* Row background */}
                <rect x="1" y="1" width={tableW - 2} height={rowH - 1} fill={bg} />

                {/* Row bottom divider */}
                <line
                  x1="0"
                  y1={rowH}
                  x2={tableW}
                  y2={rowH}
                  stroke="var(--color-text-primary)"
                  strokeWidth="0.5"
                  strokeOpacity={0.08}
                />

                {/* Flash border: insert (green glow) */}
                {row.status === 'inserting' && flashIntensity > 0 && (
                  <rect
                    x="1"
                    y="1"
                    width={tableW - 2}
                    height={rowH - 1}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    opacity={flashIntensity}
                    filter="url(#sa-glow-green)"
                  />
                )}

                {/* Flash border: update (yellow glow) */}
                {row.status === 'updating' && flashIntensity > 0 && (
                  <rect
                    x="1"
                    y="1"
                    width={tableW - 2}
                    height={rowH - 1}
                    fill="none"
                    stroke="#eab308"
                    strokeWidth="2"
                    opacity={flashIntensity}
                    filter="url(#sa-glow-yellow)"
                  />
                )}

                {/* Key cell */}
                <text
                  x={colWidths[0] / 2}
                  y={rowH / 2 + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="monospace"
                  fill={getTextColor(row, false)}
                >
                  {row.key}
                </text>

                {/* Count cell */}
                <text
                  x={colWidths[0] + colWidths[1] / 2}
                  y={rowH / 2 + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={row.status === 'updating' ? 700 : 400}
                  fontFamily="monospace"
                  fill={getTextColor(row, true)}
                >
                  {row.count}
                </text>

                {/* Total cell */}
                <text
                  x={colWidths[0] + colWidths[1] + colWidths[2] / 2}
                  y={rowH / 2 + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={row.status === 'updating' ? 700 : 400}
                  fontFamily="monospace"
                  fill={getTextColor(row, true)}
                >
                  ${row.total}
                </text>

                {/* TTL expired label */}
                {showTtlLabel && (
                  <g opacity={Math.min(1, (ttlProgress - 0.12) * 4)}>
                    <rect
                      x={tableW + 10}
                      y={5}
                      width="68"
                      height="20"
                      rx="4"
                      fill="rgba(100,100,100,0.2)"
                      stroke="#777"
                      strokeWidth="0.7"
                    />
                    <text
                      x={tableW + 44}
                      y={19}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fontFamily="monospace"
                      fill="#999"
                    >
                      TTL expired
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Empty state placeholder */}
          {rows.length === 0 && (
            <text
              x={tableW / 2}
              y={headerH + 22}
              textAnchor="middle"
              fontSize="10"
              fill="var(--color-text-primary)"
              opacity={0.3}
              fontStyle="italic"
            >
              (empty)
            </text>
          )}
        </g>

        {/* Legend */}
        <g transform="translate(18, 250)">
          <circle cx="6" cy="6" r="5" fill="var(--color-accent)" />
          <text x="16" y="10" fontSize="9" fill="var(--color-text-primary)" opacity={0.55}>
            New Event
          </text>

          <circle cx="96" cy="6" r="5" fill="#10b981" />
          <text x="106" y="10" fontSize="9" fill="var(--color-text-primary)" opacity={0.55}>
            Insert
          </text>

          <circle cx="160" cy="6" r="5" fill="#eab308" />
          <text x="170" y="10" fontSize="9" fill="var(--color-text-primary)" opacity={0.55}>
            Update
          </text>

          <circle cx="230" cy="6" r="5" fill="#888" />
          <text x="240" y="10" fontSize="9" fill="var(--color-text-primary)" opacity={0.55}>
            TTL Expired
          </text>
        </g>
      </svg>
    </div>
  );
}
