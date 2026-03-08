import { useState, useEffect } from 'react';
import './animations.css';

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

interface StreamRow {
  time: string;
  key: string;
  action: string;
}

interface TableRow {
  key: string;
  count: number;
  lastAction: string;
  status: 'stable' | 'insert' | 'update';
}

interface EventDef {
  time: string;
  key: string;
  action: string;
}

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const PHASE_DURATION = 1200;
const TOTAL_PHASES = 8;
// Layout
const SVG_W = 560;
const SVG_H = 280;
const CENTER_X = SVG_W / 2;

// Stream panel (left)
const STREAM_X = 14;
const STREAM_W = 230;
const STREAM_TOP = 46;
const STREAM_ROW_H = 24;
const STREAM_HEADER_H = 22;

// Table panel (right)
const TABLE_X = 316;
const TABLE_W = 230;
const TABLE_TOP = 46;
const TABLE_ROW_H = 24;
const TABLE_HEADER_H = 22;

// Center arrow
const ARROW_X = 254;
const ARROW_W = 52;

// Colors
const BLUE = '#3b82f6';
const EMERALD = '#10b981';
const AMBER = '#f59e0b';
const CYAN = '#06b6d4';
const SLATE = '#64748b';

// Event sequence
const EVENTS: EventDef[] = [
  { time: '10:01', key: 'user_1', action: 'order' },
  { time: '10:02', key: 'user_2', action: 'click' },
  { time: '10:03', key: 'user_1', action: 'order' },
  { time: '10:04', key: 'user_3', action: 'signup' },
  { time: '10:05', key: 'user_2', action: 'order' },
];

// Which phases commit which events (0-indexed event -> phase it arrives)
const EVENT_PHASES = [1, 2, 3, 4, 5];

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function buildStreamRows(count: number, currentPhase: number): StreamRow[] {
  const rows: StreamRow[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      time: EVENTS[i].time,
      key: EVENTS[i].key,
      action: EVENTS[i].action,
    });
  }
  // If we're in an arrival phase, include the arriving event
  const arrivalIdx = EVENT_PHASES.indexOf(currentPhase);
  if (arrivalIdx !== -1 && arrivalIdx >= count) {
    rows.push({
      time: EVENTS[arrivalIdx].time,
      key: EVENTS[arrivalIdx].key,
      action: EVENTS[arrivalIdx].action,
    });
  }
  return rows;
}

function buildTableRows(count: number, currentPhase: number): TableRow[] {
  const map = new Map<string, { count: number; lastAction: string; order: number }>();
  let latestKey = '';
  let latestIsNew = false;

  for (let i = 0; i < count; i++) {
    const ev = EVENTS[i];
    const existing = map.get(ev.key);
    if (existing) {
      existing.count += 1;
      existing.lastAction = ev.action;
      latestIsNew = false;
    } else {
      map.set(ev.key, { count: 1, lastAction: ev.action, order: map.size });
      latestIsNew = true;
    }
    latestKey = ev.key;
  }

  const entries = Array.from(map.entries()).sort((a, b) => a[1].order - b[1].order);
  const arrivalIdx = EVENT_PHASES.indexOf(currentPhase);
  const isArriving = arrivalIdx !== -1 && arrivalIdx < count;

  return entries.map(([key, data]) => ({
    key,
    count: data.count,
    lastAction: data.lastAction,
    status: (key === latestKey && count > 0 && isArriving)
      ? (latestIsNew ? 'insert' : 'update')
      : 'stable' as const,
  }));
}

function committedCount(phase: number): number {
  let count = 0;
  for (const p of EVENT_PHASES) {
    if (phase > p) count++;
    else if (phase === p) count++; // commit at end of arrival phase
  }
  return count;
}

function keyColor(key: string): string {
  if (key === 'user_1') return BLUE;
  if (key === 'user_2') return CYAN;
  if (key === 'user_3') return AMBER;
  return SLATE;
}

// ---------------------------------------------------------------------------
//  Component
// ---------------------------------------------------------------------------

export function StreamsVsTablesAnimation() {
  const [phase, setPhase] = useState(0);
  const [animProgress, setAnimProgress] = useState(0);

  useEffect(() => {
    let frameId: number;
    let startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const phaseIndex = Math.floor(elapsed / PHASE_DURATION);
      const phaseProgress = (elapsed % PHASE_DURATION) / PHASE_DURATION;

      if (phaseIndex >= TOTAL_PHASES) {
        startTime = Date.now();
        setPhase(0);
        setAnimProgress(0);
        frameId = requestAnimationFrame(tick);
        return;
      }

      setPhase(phaseIndex);
      setAnimProgress(phaseProgress);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // -----------------------------------------------------------------------
  //  Derived state
  // -----------------------------------------------------------------------

  const committed = committedCount(phase);
  const arrivalIdx = EVENT_PHASES.indexOf(phase);
  const isEventArriving = arrivalIdx !== -1;
  const arrivingEvent = isEventArriving ? EVENTS[arrivalIdx] : null;
  const eased = easeInOutCubic(Math.min(animProgress * 1.4, 1));

  // Build rows: committed events populate both sides
  const streamRows = buildStreamRows(committed, phase);
  const tableRows = buildTableRows(committed, phase);

  // Detect insert vs update for the arriving event
  const isUpdate = isEventArriving && committed > 0 &&
    EVENTS.slice(0, arrivalIdx).some(e => e.key === EVENTS[arrivalIdx].key);

  // -----------------------------------------------------------------------
  //  Phase labels
  // -----------------------------------------------------------------------

  const getPhaseLabel = (): string => {
    switch (phase) {
      case 0: return 'A stream and a table start empty';
      case 1: return 'Event arrives: user_1 | order. Table row inserted (new key).';
      case 2: return 'Each new key creates a new table row';
      case 3: return 'Same key? Stream appends a row. Table updates in place.';
      case 4: return 'New key user_3 — another INSERT into the table';
      case 5: return 'Stream: 5 rows. Table: 3 rows. Same data, two views.';
      case 6: return 'Stream = every event. Table = latest state per key.';
      case 7: return 'Resetting...';
      default: return '';
    }
  };

  // -----------------------------------------------------------------------
  //  Render: Stream log (left side)
  // -----------------------------------------------------------------------

  const renderStreamPanel = () => {
    const headerY = STREAM_TOP;
    const bodyTop = headerY + STREAM_HEADER_H;

    return (
      <g>
        {/* Panel label */}
        <rect x={STREAM_X} y={STREAM_TOP - 22} width={STREAM_W} height={18} rx="4"
          fill={BLUE} opacity="0.12" />
        <text x={STREAM_X + STREAM_W / 2} y={STREAM_TOP - 10} textAnchor="middle"
          fontSize="9" fontWeight="bold" fill={BLUE}>
          STREAM (append-only log)
        </text>

        {/* Column headers */}
        <rect x={STREAM_X} y={headerY} width={STREAM_W} height={STREAM_HEADER_H} rx="3"
          fill="var(--color-surface, #1e293b)" stroke="var(--color-border, #334155)"
          strokeWidth="1" />
        <text x={STREAM_X + 30} y={headerY + 14} textAnchor="middle"
          fontSize="7" fontWeight="bold" fontFamily="monospace"
          fill="var(--color-text, #94a3b8)" opacity="0.7">
          Time
        </text>
        <line x1={STREAM_X + 58} y1={headerY + 3} x2={STREAM_X + 58} y2={headerY + STREAM_HEADER_H - 3}
          stroke="var(--color-border, #334155)" strokeWidth="0.5" opacity="0.5" />
        <text x={STREAM_X + 110} y={headerY + 14} textAnchor="middle"
          fontSize="7" fontWeight="bold" fontFamily="monospace"
          fill="var(--color-text, #94a3b8)" opacity="0.7">
          Key
        </text>
        <line x1={STREAM_X + 148} y1={headerY + 3} x2={STREAM_X + 148} y2={headerY + STREAM_HEADER_H - 3}
          stroke="var(--color-border, #334155)" strokeWidth="0.5" opacity="0.5" />
        <text x={STREAM_X + 190} y={headerY + 14} textAnchor="middle"
          fontSize="7" fontWeight="bold" fontFamily="monospace"
          fill="var(--color-text, #94a3b8)" opacity="0.7">
          Action
        </text>

        {/* Body background */}
        <rect x={STREAM_X} y={bodyTop} width={STREAM_W}
          height={Math.max(STREAM_ROW_H * 5 + 4, STREAM_ROW_H * streamRows.length + 4)}
          rx="0" fill="var(--color-surface, #1e293b)" opacity="0.35"
          stroke="var(--color-border, #334155)" strokeWidth="0.5" />

        {/* Rows */}
        {streamRows.map((row, idx) => {
          const rowY = bodyTop + idx * STREAM_ROW_H + 2;
          const isNewest = idx === streamRows.length - 1 && isEventArriving;
          const slideOffset = isNewest ? (1 - eased) * -16 : 0;
          const slideOpacity = isNewest ? eased : 1;

          return (
            <g key={`stream-${idx}`}
              transform={`translate(0, ${slideOffset})`} opacity={slideOpacity}>
              {/* Row bg */}
              <rect x={STREAM_X + 2} y={rowY} width={STREAM_W - 4} height={STREAM_ROW_H - 2}
                rx="2" fill="var(--color-border, #334155)" opacity="0.15" />

              {/* Newest row glow */}
              {isNewest && (
                <rect x={STREAM_X + 2} y={rowY} width={STREAM_W - 4} height={STREAM_ROW_H - 2}
                  rx="2" fill={BLUE} opacity={0.08 + 0.12 * Math.abs(Math.sin(animProgress * Math.PI * 2))}
                  stroke={BLUE} strokeWidth="1"
                  strokeOpacity={0.3 + 0.4 * Math.abs(Math.sin(animProgress * Math.PI * 2))} />
              )}

              {/* Alternating row stripe */}
              {idx % 2 === 0 && !isNewest && (
                <rect x={STREAM_X + 2} y={rowY} width={STREAM_W - 4} height={STREAM_ROW_H - 2}
                  rx="2" fill="var(--color-border, #334155)" opacity="0.06" />
              )}

              {/* Time */}
              <text x={STREAM_X + 30} y={rowY + STREAM_ROW_H / 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="7.5" fontFamily="monospace" fill={SLATE}>
                {row.time}
              </text>

              {/* Divider */}
              <line x1={STREAM_X + 58} y1={rowY + 2} x2={STREAM_X + 58} y2={rowY + STREAM_ROW_H - 4}
                stroke="var(--color-border, #334155)" strokeWidth="0.5" opacity="0.3" />

              {/* Key pill */}
              <rect x={STREAM_X + 72} y={rowY + 3} width={72} height={STREAM_ROW_H - 8}
                rx="3" fill={keyColor(row.key)} opacity="0.15" />
              <text x={STREAM_X + 108} y={rowY + STREAM_ROW_H / 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="7.5" fontFamily="monospace" fontWeight="bold"
                fill={keyColor(row.key)}>
                {row.key}
              </text>

              {/* Divider */}
              <line x1={STREAM_X + 148} y1={rowY + 2} x2={STREAM_X + 148} y2={rowY + STREAM_ROW_H - 4}
                stroke="var(--color-border, #334155)" strokeWidth="0.5" opacity="0.3" />

              {/* Action */}
              <text x={STREAM_X + 190} y={rowY + STREAM_ROW_H / 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="7.5" fontFamily="monospace"
                fill="var(--color-text, #e2e8f0)">
                {row.action}
              </text>
            </g>
          );
        })}

        {/* Empty row placeholders */}
        {streamRows.length < 5 && Array.from({ length: 5 - streamRows.length }).map((_, idx) => {
          const rowY = bodyTop + (streamRows.length + idx) * STREAM_ROW_H + 2;
          return (
            <rect key={`stream-empty-${idx}`} x={STREAM_X + 2} y={rowY}
              width={STREAM_W - 4} height={STREAM_ROW_H - 2} rx="2"
              fill="var(--color-border, #334155)" opacity="0.05" />
          );
        })}

        {/* Row count badge (phases 5-6) */}
        {phase >= 5 && phase <= 6 && (
          <g>
            <rect x={STREAM_X + STREAM_W - 56} y={STREAM_TOP - 22} width={50} height={18}
              rx="9" fill={BLUE} opacity="0.85" />
            <text x={STREAM_X + STREAM_W - 31} y={STREAM_TOP - 10} textAnchor="middle"
              fontSize="7.5" fontWeight="bold" fill="#fff">
              {streamRows.length} rows
            </text>
          </g>
        )}
      </g>
    );
  };

  // -----------------------------------------------------------------------
  //  Render: Table (right side)
  // -----------------------------------------------------------------------

  const renderTablePanel = () => {
    const headerY = TABLE_TOP;
    const bodyTop = headerY + TABLE_HEADER_H;

    return (
      <g>
        {/* Panel label */}
        <rect x={TABLE_X} y={TABLE_TOP - 22} width={TABLE_W} height={18} rx="4"
          fill={EMERALD} opacity="0.12" />
        <text x={TABLE_X + TABLE_W / 2} y={TABLE_TOP - 10} textAnchor="middle"
          fontSize="9" fontWeight="bold" fill={EMERALD}>
          TABLE (materialized state)
        </text>

        {/* Column headers */}
        <rect x={TABLE_X} y={headerY} width={TABLE_W} height={TABLE_HEADER_H} rx="3"
          fill="var(--color-surface, #1e293b)" stroke="var(--color-border, #334155)"
          strokeWidth="1" />
        <text x={TABLE_X + 48} y={headerY + 14} textAnchor="middle"
          fontSize="7" fontWeight="bold" fill="var(--color-text, #94a3b8)" opacity="0.7">
          Key
        </text>
        <line x1={TABLE_X + 90} y1={headerY + 3} x2={TABLE_X + 90} y2={headerY + TABLE_HEADER_H - 3}
          stroke="var(--color-border, #334155)" strokeWidth="0.5" opacity="0.5" />
        <text x={TABLE_X + 122} y={headerY + 14} textAnchor="middle"
          fontSize="7" fontWeight="bold" fill="var(--color-text, #94a3b8)" opacity="0.7">
          Count
        </text>
        <line x1={TABLE_X + 150} y1={headerY + 3} x2={TABLE_X + 150} y2={headerY + TABLE_HEADER_H - 3}
          stroke="var(--color-border, #334155)" strokeWidth="0.5" opacity="0.5" />
        <text x={TABLE_X + 190} y={headerY + 14} textAnchor="middle"
          fontSize="7" fontWeight="bold" fill="var(--color-text, #94a3b8)" opacity="0.7">
          Last Action
        </text>

        {/* Body background */}
        <rect x={TABLE_X} y={bodyTop} width={TABLE_W}
          height={Math.max(TABLE_ROW_H * 5 + 4, TABLE_ROW_H * tableRows.length + 4)}
          rx="0" fill="var(--color-surface, #1e293b)" opacity="0.35"
          stroke="var(--color-border, #334155)" strokeWidth="0.5" />

        {/* Rows */}
        {tableRows.map((row, idx) => {
          const rowY = bodyTop + idx * TABLE_ROW_H + 2;
          const isInsert = row.status === 'insert' && isEventArriving;
          const isUpdateRow = row.status === 'update' && isEventArriving;

          // Green glow for inserts
          const insertGlow = isInsert
            ? 0.15 + 0.25 * Math.abs(Math.sin(animProgress * Math.PI * 2.5))
            : 0;
          // Yellow glow for updates
          const updateGlow = isUpdateRow
            ? 0.15 + 0.25 * Math.abs(Math.sin(animProgress * Math.PI * 2.5))
            : 0;

          const slideOffset = isInsert ? (1 - eased) * -14 : 0;
          const slideOpacity = isInsert ? eased : 1;

          return (
            <g key={`table-${idx}-${row.key}`}
              transform={`translate(0, ${slideOffset})`} opacity={slideOpacity}>
              {/* Row bg */}
              <rect x={TABLE_X + 2} y={rowY} width={TABLE_W - 4} height={TABLE_ROW_H - 2}
                rx="2" fill="var(--color-border, #334155)" opacity="0.15" />

              {/* INSERT glow (green) */}
              {isInsert && (
                <rect x={TABLE_X + 2} y={rowY} width={TABLE_W - 4} height={TABLE_ROW_H - 2}
                  rx="2" fill={EMERALD} opacity={insertGlow}
                  stroke={EMERALD} strokeWidth="1.5"
                  strokeOpacity={0.4 + 0.5 * Math.abs(Math.sin(animProgress * Math.PI * 2.5))} />
              )}

              {/* UPDATE glow (yellow/amber) */}
              {isUpdateRow && (
                <rect x={TABLE_X + 2} y={rowY} width={TABLE_W - 4} height={TABLE_ROW_H - 2}
                  rx="2" fill={AMBER} opacity={updateGlow}
                  stroke={AMBER} strokeWidth="1.5"
                  strokeOpacity={0.4 + 0.5 * Math.abs(Math.sin(animProgress * Math.PI * 2.5))} />
              )}

              {/* Key pill */}
              <rect x={TABLE_X + 12} y={rowY + 3} width={72} height={TABLE_ROW_H - 8}
                rx="3" fill={keyColor(row.key)} opacity="0.18" />
              <text x={TABLE_X + 48} y={rowY + TABLE_ROW_H / 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="7.5" fontWeight="bold" fill={keyColor(row.key)}>
                {row.key}
              </text>

              {/* Divider */}
              <line x1={TABLE_X + 90} y1={rowY + 2} x2={TABLE_X + 90} y2={rowY + TABLE_ROW_H - 4}
                stroke="var(--color-border, #334155)" strokeWidth="0.5" opacity="0.3" />

              {/* Count */}
              <text x={TABLE_X + 122} y={rowY + TABLE_ROW_H / 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="8" fontWeight="bold"
                fill={isUpdateRow ? AMBER : 'var(--color-text, #e2e8f0)'}>
                {row.count}
              </text>

              {/* Divider */}
              <line x1={TABLE_X + 150} y1={rowY + 2} x2={TABLE_X + 150} y2={rowY + TABLE_ROW_H - 4}
                stroke="var(--color-border, #334155)" strokeWidth="0.5" opacity="0.3" />

              {/* Last Action */}
              <text x={TABLE_X + 190} y={rowY + TABLE_ROW_H / 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="7.5" fontFamily="monospace"
                fill={isUpdateRow ? AMBER : 'var(--color-text, #e2e8f0)'}>
                {row.lastAction}
              </text>
            </g>
          );
        })}

        {/* Empty row placeholders */}
        {tableRows.length < 5 && Array.from({ length: 5 - tableRows.length }).map((_, idx) => {
          const rowY = bodyTop + (tableRows.length + idx) * TABLE_ROW_H + 2;
          return (
            <rect key={`table-empty-${idx}`} x={TABLE_X + 2} y={rowY}
              width={TABLE_W - 4} height={TABLE_ROW_H - 2} rx="2"
              fill="var(--color-border, #334155)" opacity="0.05" />
          );
        })}

        {/* Row count badge (phases 5-6) */}
        {phase >= 5 && phase <= 6 && (
          <g>
            <rect x={TABLE_X + TABLE_W - 56} y={TABLE_TOP - 22} width={50} height={18}
              rx="9" fill={EMERALD} opacity="0.85" />
            <text x={TABLE_X + TABLE_W - 31} y={TABLE_TOP - 10} textAnchor="middle"
              fontSize="7.5" fontWeight="bold" fill="#fff">
              {tableRows.length} rows
            </text>
          </g>
        )}
      </g>
    );
  };

  // -----------------------------------------------------------------------
  //  Render: Center arrow
  // -----------------------------------------------------------------------

  const renderCenterArrow = () => {
    const arrowMidX = ARROW_X + ARROW_W / 2;
    const arrowY = STREAM_TOP + STREAM_HEADER_H + 40;
    const pulseOpacity = isEventArriving
      ? 0.5 + 0.5 * Math.abs(Math.sin(animProgress * Math.PI * 3))
      : 0.3;

    return (
      <g>
        {/* Dashed arrow line */}
        <line x1={ARROW_X} y1={arrowY} x2={ARROW_X + ARROW_W} y2={arrowY}
          stroke="var(--color-accent, #60a5fa)" strokeWidth="1.5"
          strokeDasharray="4,3" opacity={pulseOpacity}
          markerEnd="url(#streams-arrow)" />

        {/* Label */}
        <text x={arrowMidX} y={arrowY - 8} textAnchor="middle"
          fontSize="7" fontWeight="bold" fill="var(--color-accent, #60a5fa)"
          opacity={pulseOpacity}>
          materialize
        </text>

        {/* Subtle reverse arrow below */}
        <line x1={ARROW_X + ARROW_W} y1={arrowY + 18} x2={ARROW_X} y2={arrowY + 18}
          stroke="var(--color-border, #475569)" strokeWidth="0.8"
          strokeDasharray="3,4" opacity="0.2"
          markerEnd="url(#streams-arrow-dim)" />
        <text x={arrowMidX} y={arrowY + 32} textAnchor="middle"
          fontSize="6" fill="var(--color-border, #475569)" opacity="0.35">
          replay
        </text>
      </g>
    );
  };

  // -----------------------------------------------------------------------
  //  Render: Animated event pill
  // -----------------------------------------------------------------------

  const renderEventPill = () => {
    if (!isEventArriving || !arrivingEvent) return null;

    // Phase 1: pill flies from left edge to stream log (0 -> 0.45 progress)
    // Phase 2: arrow pulses, pill appears at table (0.45 -> 1.0 progress)
    const travelToStream = Math.min(animProgress / 0.45, 1);
    const travelToTable = animProgress > 0.45
      ? Math.min((animProgress - 0.45) / 0.45, 1)
      : 0;

    const streamEased = easeInOutCubic(travelToStream);
    const tableEased = easeInOutCubic(travelToTable);

    const pillStartX = -30;
    const pillStreamX = STREAM_X + STREAM_W / 2;
    const pillTableX = TABLE_X + TABLE_W / 2;

    const streamTargetY = STREAM_TOP + STREAM_HEADER_H + (committed - 1) * STREAM_ROW_H + STREAM_ROW_H / 2 + 2;
    const tableTargetRowIdx = tableRows.findIndex(r => r.key === arrivingEvent.key);
    const tableTargetY = TABLE_TOP + TABLE_HEADER_H +
      (tableTargetRowIdx >= 0 ? tableTargetRowIdx : tableRows.length - 1) * TABLE_ROW_H +
      TABLE_ROW_H / 2 + 2;

    const pillColor = keyColor(arrivingEvent.key);
    const label = `${arrivingEvent.key}`;

    return (
      <g>
        {/* Pill traveling to stream */}
        {travelToStream < 1 && (
          <g opacity={Math.min(1, (1 - travelToStream) * 2 + 0.3)}>
            <rect
              x={pillStartX + (pillStreamX - pillStartX) * streamEased - 28}
              y={streamTargetY - 9}
              width="56" height="18" rx="9"
              fill={pillColor} opacity="0.9" />
            <text
              x={pillStartX + (pillStreamX - pillStartX) * streamEased}
              y={streamTargetY}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="7" fontWeight="bold" fill="#fff">
              {label} | {arrivingEvent.action}
            </text>
          </g>
        )}

        {/* Pill traveling from arrow to table */}
        {travelToTable > 0 && travelToTable < 1 && (
          <g opacity={Math.min(1, (1 - travelToTable) * 2 + 0.3)}>
            <rect
              x={ARROW_X + ARROW_W + (pillTableX - ARROW_X - ARROW_W) * tableEased - 28}
              y={tableTargetY - 9}
              width="56" height="18" rx="9"
              fill={isUpdate ? AMBER : EMERALD} opacity="0.9" />
            <text
              x={ARROW_X + ARROW_W + (pillTableX - ARROW_X - ARROW_W) * tableEased}
              y={tableTargetY}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="7" fontWeight="bold" fill="#fff">
              {isUpdate ? 'UPDATE' : 'INSERT'}
            </text>
          </g>
        )}
      </g>
    );
  };

  // -----------------------------------------------------------------------
  //  Render: Insight callout (phase 6)
  // -----------------------------------------------------------------------

  const renderInsightCallout = () => {
    if (phase !== 6) return null;

    const calloutY = TABLE_TOP + TABLE_HEADER_H + 3 * TABLE_ROW_H + 14;
    const fadeIn = easeInOutCubic(Math.min(animProgress * 2, 1));

    return (
      <g opacity={fadeIn}>
        <rect x={CENTER_X - 170} y={calloutY} width={340} height={38} rx="8"
          fill="var(--color-surface, #0f172a)" stroke="var(--color-accent, #60a5fa)"
          strokeWidth="1.5" opacity="0.95" />

        {/* Top line */}
        <text x={CENTER_X} y={calloutY + 14} textAnchor="middle"
          fontSize="8.5" fontWeight="bold" fill="var(--color-text, #e2e8f0)">
          Stream has {streamRows.length} rows. Table has {tableRows.length}. Both are correct.
        </text>

        {/* Bottom line */}
        <text x={CENTER_X} y={calloutY + 28} textAnchor="middle"
          fontSize="7" fill="var(--color-text, #94a3b8)">
          Same data, two different views of the truth.
        </text>
      </g>
    );
  };

  // -----------------------------------------------------------------------
  //  Render
  // -----------------------------------------------------------------------

  return (
    <div className="concept-animation">
      <h4 className="concept-animation__title">Streams vs Tables: The Duality</h4>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto' }}
      >
        <defs>
          <marker id="streams-arrow" markerWidth="6" markerHeight="6"
            refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-accent, #60a5fa)" />
          </marker>
          <marker id="streams-arrow-dim" markerWidth="5" markerHeight="5"
            refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L5,2.5 L0,5 Z" fill="var(--color-border, #475569)" opacity="0.3" />
          </marker>
          {/* Glow filters */}
          <filter id="insert-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="update-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ============================================================
            TITLE
            ============================================================ */}
        <text x={CENTER_X} y={14} textAnchor="middle" fontSize="11" fontWeight="bold"
          fill="var(--color-text, #e2e8f0)">
          Stream = Log of Events &middot; Table = Accumulated State
        </text>

        {/* ============================================================
            LEFT: Stream Panel
            ============================================================ */}
        {renderStreamPanel()}

        {/* ============================================================
            RIGHT: Table Panel
            ============================================================ */}
        {renderTablePanel()}

        {/* ============================================================
            CENTER: Arrow
            ============================================================ */}
        {renderCenterArrow()}

        {/* ============================================================
            ANIMATED EVENT PILL
            ============================================================ */}
        {renderEventPill()}

        {/* ============================================================
            INSIGHT CALLOUT (phase 6)
            ============================================================ */}
        {renderInsightCallout()}

        {/* ============================================================
            STATUS BAR (bottom)
            ============================================================ */}
        <rect x="16" y={SVG_H - 42} width={SVG_W - 32} height={18} rx="4"
          fill="var(--color-surface, #1e293b)"
          stroke="var(--color-border, #334155)" strokeWidth="0.5" />
        <text x={CENTER_X} y={SVG_H - 30} textAnchor="middle" fontSize="7.5"
          fill="var(--color-text, #94a3b8)">
          {getPhaseLabel()}
        </text>

        {/* Phase progress dots */}
        <g transform={`translate(${CENTER_X - TOTAL_PHASES * 5}, ${SVG_H - 20})`}>
          {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
            <circle key={i} cx={i * 10 + 5} cy="4" r="2.5"
              fill={i === phase ? 'var(--color-accent, #60a5fa)' : 'var(--color-border, #334155)'}
              opacity={i === phase ? 1 : 0.4} />
          ))}
        </g>

        {/* ============================================================
            LEGEND
            ============================================================ */}
        <g transform={`translate(16, ${SVG_H - 8})`}>
          {/* Stream */}
          <rect x="0" y="0" width="8" height="8" rx="1.5" fill={BLUE} opacity="0.8" />
          <text x="12" y="7" fontSize="7" fill="var(--color-text, #94a3b8)">Stream</text>
          {/* Table */}
          <rect x="56" y="0" width="8" height="8" rx="1.5" fill={EMERALD} opacity="0.8" />
          <text x="68" y="7" fontSize="7" fill="var(--color-text, #94a3b8)">Table</text>
          {/* Insert */}
          <rect x="110" y="0" width="8" height="8" rx="1.5" fill={EMERALD} opacity="0.5"
            stroke={EMERALD} strokeWidth="1" />
          <text x="122" y="7" fontSize="7" fill="var(--color-text, #94a3b8)">Insert</text>
          {/* Update */}
          <rect x="162" y="0" width="8" height="8" rx="1.5" fill={AMBER} opacity="0.5"
            stroke={AMBER} strokeWidth="1" />
          <text x="174" y="7" fontSize="7" fill="var(--color-text, #94a3b8)">Update</text>
          {/* user_1 */}
          <rect x="220" y="0" width="8" height="8" rx="1" fill={BLUE} />
          <text x="232" y="7" fontSize="6" fill="var(--color-text, #94a3b8)">user_1</text>
          {/* user_2 */}
          <rect x="272" y="0" width="8" height="8" rx="1" fill={CYAN} />
          <text x="284" y="7" fontSize="6" fill="var(--color-text, #94a3b8)">user_2</text>
          {/* user_3 */}
          <rect x="322" y="0" width="8" height="8" rx="1" fill={AMBER} />
          <text x="334" y="7" fontSize="6" fill="var(--color-text, #94a3b8)">user_3</text>
        </g>
      </svg>
    </div>
  );
}
