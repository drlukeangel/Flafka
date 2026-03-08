import { useState, useEffect } from 'react';
import './animations.css';
import { useAnimationSpeed } from './AnimationSpeedContext';

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

interface TableRow {
  key: string;
  value: number;
  status: 'stable' | 'new' | 'updated';
}

interface IncomingEvent {
  key: string;
  value: number;
}

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const PHASE_DURATION = 1200;
const TOTAL_PHASES = 10;

// Layout constants
const SVG_W = 620;
const SVG_H = 360;
const CENTER_X = SVG_W / 2;
const DIVIDER_X = CENTER_X;

// Event source
const SOURCE_Y = 18;
const SOURCE_W = 140;
const SOURCE_H = 24;

// Table areas
const TABLE_TOP = 80;
const TABLE_LEFT_X = 24;
const TABLE_RIGHT_X = DIVIDER_X + 24;
const TABLE_W = 260;
const ROW_H = 22;
const HEADER_H = 22;

// Colors
const AMBER = '#f59e0b';
const EMERALD = '#10b981';
const BLUE = '#3b82f6';

// The event sequence
const EVENTS: IncomingEvent[] = [
  { key: 'A', value: 10 },  // Phase 0
  { key: 'B', value: 20 },  // Phase 2
  { key: 'A', value: 30 },  // Phase 3 — duplicate key!
  { key: 'B', value: 50 },  // Phase 5 — duplicate key!
  { key: 'A', value: 15 },  // Phase 6 — triplicate key!
];

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function buildAppendRows(eventCount: number): TableRow[] {
  const rows: TableRow[] = [];
  for (let i = 0; i < eventCount; i++) {
    rows.push({
      key: EVENTS[i].key,
      value: EVENTS[i].value,
      status: i === eventCount - 1 ? 'new' : 'stable',
    });
  }
  return rows;
}

function buildUpsertRows(eventCount: number): TableRow[] {
  const map = new Map<string, { value: number; order: number }>();
  let lastKey = '';
  for (let i = 0; i < eventCount; i++) {
    const ev = EVENTS[i];
    if (!map.has(ev.key)) {
      map.set(ev.key, { value: ev.value, order: map.size });
    } else {
      map.set(ev.key, { value: ev.value, order: map.get(ev.key)!.order });
    }
    lastKey = ev.key;
  }
  const entries = Array.from(map.entries()).sort((a, b) => a[1].order - b[1].order);
  return entries.map(([key, { value }]) => ({
    key,
    value,
    status: key === lastKey && eventCount > 0 ? 'updated' : 'stable',
  }));
}

// ---------------------------------------------------------------------------
//  Component
// ---------------------------------------------------------------------------

export function ChangelogModesAnimation() {
  const [phase, setPhase] = useState(0);
  const [animProgress, setAnimProgress] = useState(0);
  const { paused } = useAnimationSpeed();

  useEffect(() => {
    let frameId: number;
    let startTime = Date.now();

    const tick = () => {
      if (paused) { frameId = requestAnimationFrame(tick); return; }
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
  }, [paused]);

  // -----------------------------------------------------------------------
  //  Derive event count committed to tables per phase
  // -----------------------------------------------------------------------
  // Events commit at end of their "arrival" phase:
  //   Phase 0: event 0 arrives   -> committed count becomes 1 at phase 1
  //   Phase 2: event 1 arrives   -> committed count becomes 2 at phase 3
  //   Phase 3: event 2 arrives   -> committed count becomes 3 at phase 4
  //   Phase 5: event 3 arrives   -> committed count becomes 4 at phase 6
  //   Phase 6: event 4 arrives   -> committed count becomes 5 at phase 7

  const eventArrivalPhases = [0, 2, 3, 5, 6];

  function committedEventCount(p: number): number {
    let count = 0;
    for (const arrPhase of eventArrivalPhases) {
      if (p > arrPhase) count++;
    }
    return count;
  }

  const committed = committedEventCount(phase);
  const appendRows = buildAppendRows(committed);
  const upsertRows = buildUpsertRows(committed);

  // Is an event actively animating (flying in) during this phase?
  const arrivalIdx = eventArrivalPhases.indexOf(phase);
  const isEventArriving = arrivalIdx !== -1;
  const arrivingEvent = isEventArriving ? EVENTS[arrivalIdx] : null;

  const eased = easeInOutCubic(Math.min(animProgress * 1.3, 1));

  // -----------------------------------------------------------------------
  //  Phase label
  // -----------------------------------------------------------------------
  const getPhaseLabel = (): string => {
    switch (phase) {
      case 0: return 'Event {A: 10} arrives — first record for key A';
      case 1: return 'Both modes: 1 row each. Identical so far.';
      case 2: return 'Event {B: 20} arrives — new key B';
      case 3: return 'Event {A: 30} arrives — SAME key A! Watch the difference...';
      case 4: return 'Append: 3 rows (duplicates kept). Upsert: 2 rows (A updated).';
      case 5: return 'Event {B: 50} arrives — another duplicate key B';
      case 6: return 'Event {A: 15} arrives — third time for key A!';
      case 7: return `Row count: APPEND has ${appendRows.length} rows, UPSERT has ${upsertRows.length} rows`;
      case 8: return 'Same events. Different semantics. Choose wisely.';
      case 9: return 'Append = immutable log. Upsert = latest-value table.';
      default: return '';
    }
  };

  // Key color helper
  const keyColor = (key: string) => {
    if (key === 'A') return AMBER;
    if (key === 'B') return BLUE;
    return EMERALD;
  };

  // -----------------------------------------------------------------------
  //  Render a single table (append or upsert)
  // -----------------------------------------------------------------------
  const renderTable = (
    rows: TableRow[],
    x: number,
    label: string,
    labelColor: string,
    side: 'append' | 'upsert',
  ) => {
    const isAppend = side === 'append';
    // During phase 7+ show row count badge
    const showBadge = phase >= 7;
    const badgeCount = rows.length;

    return (
      <g>
        {/* Column label */}
        <rect x={x} y={TABLE_TOP - 30} width={TABLE_W} height={20} rx="4"
          fill={labelColor} opacity="0.12" />
        <text x={x + TABLE_W / 2} y={TABLE_TOP - 17} textAnchor="middle"
          fontSize="9" fontWeight="bold" fill={labelColor}>
          {label}
        </text>

        {/* Table header */}
        <rect x={x} y={TABLE_TOP} width={TABLE_W} height={HEADER_H} rx="3"
          fill="var(--color-surface, #1e293b)" stroke="var(--color-border, #334155)"
          strokeWidth="1" />
        <text x={x + 50} y={TABLE_TOP + 15} textAnchor="middle"
          fontSize="8" fontWeight="bold" fill="var(--color-text, #94a3b8)" opacity="0.7">
          Key
        </text>
        <text x={x + TABLE_W / 2 + 40} y={TABLE_TOP + 15} textAnchor="middle"
          fontSize="8" fontWeight="bold" fill="var(--color-text, #94a3b8)" opacity="0.7">
          Value
        </text>

        {/* Table body background */}
        <rect x={x} y={TABLE_TOP + HEADER_H} width={TABLE_W}
          height={Math.max(ROW_H * 6, ROW_H * rows.length + ROW_H)} rx="0"
          fill="var(--color-surface, #1e293b)" opacity="0.4"
          stroke="var(--color-border, #334155)" strokeWidth="0.5" />

        {/* Rows */}
        {rows.map((row, idx) => {
          const rowY = TABLE_TOP + HEADER_H + idx * ROW_H + 2;
          const isNewRow = row.status === 'new' && isEventArriving;
          const isUpdatedRow = !isAppend && row.status === 'updated' && isEventArriving;

          // Flash opacity for updated upsert rows
          const flashOpacity = isUpdatedRow
            ? 0.3 + 0.5 * Math.abs(Math.sin(animProgress * Math.PI * 3))
            : 0;

          // Slide-in for new append rows
          const slideOffset = isNewRow && isAppend
            ? (1 - eased) * -20
            : 0;
          const slideOpacity = isNewRow && isAppend
            ? eased
            : 1;

          return (
            <g key={`${side}-${idx}-${row.key}-${row.value}`}
              transform={`translate(0, ${slideOffset})`} opacity={slideOpacity}>
              {/* Row background */}
              <rect x={x + 2} y={rowY} width={TABLE_W - 4} height={ROW_H - 2} rx="3"
                fill={isUpdatedRow ? EMERALD : 'var(--color-border, #334155)'}
                opacity={isUpdatedRow ? flashOpacity : 0.2} />

              {/* Glow for upsert update */}
              {isUpdatedRow && (
                <rect x={x + 2} y={rowY} width={TABLE_W - 4} height={ROW_H - 2} rx="3"
                  fill="none" stroke={EMERALD}
                  strokeWidth="1.5"
                  opacity={0.4 + 0.5 * Math.abs(Math.sin(animProgress * Math.PI * 3))} />
              )}

              {/* Key cell */}
              <rect x={x + 10} y={rowY + 2} width={60} height={ROW_H - 6} rx="3"
                fill={keyColor(row.key)} opacity="0.2" />
              <text x={x + 40} y={rowY + ROW_H / 2 + 1} textAnchor="middle"
                dominantBaseline="middle" fontSize="8" fontWeight="bold"
                fill={keyColor(row.key)}>
                {row.key}
              </text>

              {/* Value cell */}
              <rect x={x + TABLE_W / 2 + 10} y={rowY + 2} width={80} height={ROW_H - 6} rx="3"
                fill="var(--color-border, #334155)" opacity="0.25" />
              <text x={x + TABLE_W / 2 + 50} y={rowY + ROW_H / 2 + 1} textAnchor="middle"
                dominantBaseline="middle" fontSize="8" fill="var(--color-text, #e2e8f0)">
                {row.value}
              </text>
            </g>
          );
        })}

        {/* Empty-state fill for unused rows (visual consistency) */}
        {rows.length < 5 && Array.from({ length: 5 - rows.length }).map((_, idx) => {
          const rowY = TABLE_TOP + HEADER_H + (rows.length + idx) * ROW_H + 2;
          return (
            <rect key={`empty-${side}-${idx}`} x={x + 2} y={rowY}
              width={TABLE_W - 4} height={ROW_H - 2} rx="3"
              fill="var(--color-border, #334155)" opacity="0.06" />
          );
        })}

        {/* Row count badge */}
        {showBadge && (
          <g>
            <rect x={x + TABLE_W - 70} y={TABLE_TOP - 30} width={64} height={20} rx="10"
              fill={labelColor} opacity="0.85" />
            <text x={x + TABLE_W - 38} y={TABLE_TOP - 17} textAnchor="middle"
              fontSize="8" fontWeight="bold" fill="#fff">
              {badgeCount} row{badgeCount !== 1 ? 's' : ''}
            </text>
          </g>
        )}
      </g>
    );
  };

  // -----------------------------------------------------------------------
  //  Render
  // -----------------------------------------------------------------------
  return (
    <div className="concept-animation">
      <h4>Changelog Modes: Append vs Upsert</h4>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto' }}
      >
        <defs>
          <marker id="changelog-arrow" markerWidth="6" markerHeight="6"
            refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-border)" />
          </marker>
          {/* Glow filter for upsert flash */}
          <filter id="upsert-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
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
          Same Events, Different Output
        </text>

        {/* ============================================================
            EVENT SOURCE (top center)
            ============================================================ */}
        <rect x={CENTER_X - SOURCE_W / 2} y={SOURCE_Y} width={SOURCE_W} height={SOURCE_H}
          rx="5" fill={BLUE} opacity="0.12" stroke={BLUE} strokeWidth="1.5" />
        <text x={CENTER_X} y={SOURCE_Y + 10} textAnchor="middle"
          fontSize="7" fontWeight="bold" fill={BLUE} opacity="0.7">
          Event Source
        </text>

        {/* Show current event inside the source box */}
        {arrivingEvent && (
          <text x={CENTER_X} y={SOURCE_Y + 20} textAnchor="middle"
            fontSize="8" fontWeight="bold" fill={BLUE}>
            &#123;key: &quot;{arrivingEvent.key}&quot;, value: {arrivingEvent.value}&#125;
          </text>
        )}
        {!arrivingEvent && committed > 0 && (
          <text x={CENTER_X} y={SOURCE_Y + 20} textAnchor="middle"
            fontSize="7" fill={BLUE} opacity="0.5">
            {committed}/{EVENTS.length} events sent
          </text>
        )}

        {/* ============================================================
            ANIMATED EVENT flying down to both tables
            ============================================================ */}
        {isEventArriving && arrivingEvent && (
          <>
            {/* Left branch — to Append table */}
            {(() => {
              const startX = CENTER_X;
              const startY = SOURCE_Y + SOURCE_H + 2;
              const endX = TABLE_LEFT_X + TABLE_W / 2;
              const endY = TABLE_TOP + HEADER_H + committed * ROW_H;
              const cx = startX + (endX - startX) * eased;
              const cy = startY + (endY - startY) * eased;
              const color = keyColor(arrivingEvent.key);
              return (
                <g opacity={Math.min(1, (1 - animProgress) * 3)}>
                  <circle cx={cx} cy={cy} r="10" fill={color} opacity={0.15} />
                  <rect x={cx - 16} y={cy - 8} width="32" height="16" rx="4"
                    fill={color} opacity="0.9" />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                    fontSize="7" fontWeight="bold" fill="#fff">
                    {arrivingEvent.key}:{arrivingEvent.value}
                  </text>
                </g>
              );
            })()}
            {/* Right branch — to Upsert table */}
            {(() => {
              const startX = CENTER_X;
              const startY = SOURCE_Y + SOURCE_H + 2;
              // For upsert, target the updated row if key exists
              const upsertTargetIdx = buildUpsertRows(committed + 1)
                .findIndex(r => r.key === arrivingEvent.key);
              const targetRowIdx = upsertTargetIdx >= 0 ? upsertTargetIdx : committed;
              const endX = TABLE_RIGHT_X + TABLE_W / 2;
              const endY = TABLE_TOP + HEADER_H + targetRowIdx * ROW_H + ROW_H / 2;
              const cx = startX + (endX - startX) * eased;
              const cy = startY + (endY - startY) * eased;
              const color = keyColor(arrivingEvent.key);
              return (
                <g opacity={Math.min(1, (1 - animProgress) * 3)}>
                  <circle cx={cx} cy={cy} r="10" fill={color} opacity={0.15} />
                  <rect x={cx - 16} y={cy - 8} width="32" height="16" rx="4"
                    fill={color} opacity="0.9" />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                    fontSize="7" fontWeight="bold" fill="#fff">
                    {arrivingEvent.key}:{arrivingEvent.value}
                  </text>
                </g>
              );
            })()}
          </>
        )}

        {/* ============================================================
            FLOW ARROWS from source to tables
            ============================================================ */}
        <line x1={CENTER_X - 20} y1={SOURCE_Y + SOURCE_H}
          x2={TABLE_LEFT_X + TABLE_W / 2} y2={TABLE_TOP - 34}
          stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3,2"
          markerEnd="url(#changelog-arrow)" opacity="0.35" />
        <line x1={CENTER_X + 20} y1={SOURCE_Y + SOURCE_H}
          x2={TABLE_RIGHT_X + TABLE_W / 2} y2={TABLE_TOP - 34}
          stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3,2"
          markerEnd="url(#changelog-arrow)" opacity="0.35" />

        {/* ============================================================
            DIVIDER LINE
            ============================================================ */}
        <line x1={DIVIDER_X} y1={TABLE_TOP - 38} x2={DIVIDER_X} y2={SVG_H - 58}
          stroke="var(--color-border, #334155)" strokeWidth="1" strokeDasharray="4,3"
          opacity="0.4" />
        <text x={DIVIDER_X} y={TABLE_TOP - 40} textAnchor="middle"
          fontSize="6" fill="var(--color-text, #94a3b8)" opacity="0.5">
          vs
        </text>

        {/* ============================================================
            APPEND TABLE (left)
            ============================================================ */}
        {renderTable(appendRows, TABLE_LEFT_X, 'APPEND Mode', AMBER, 'append')}

        {/* ============================================================
            UPSERT TABLE (right)
            ============================================================ */}
        {renderTable(upsertRows, TABLE_RIGHT_X, 'UPSERT Mode', EMERALD, 'upsert')}

        {/* ============================================================
            PHASE 4 ANNOTATION: key difference callout
            ============================================================ */}
        {phase === 4 && (
          <g>
            {/* Left annotation: append keeps duplicates */}
            <rect x={TABLE_LEFT_X} y={TABLE_TOP + HEADER_H + 3 * ROW_H + 8}
              width={TABLE_W} height={16} rx="4" fill={AMBER} opacity="0.1" />
            <text x={TABLE_LEFT_X + TABLE_W / 2}
              y={TABLE_TOP + HEADER_H + 3 * ROW_H + 19}
              textAnchor="middle" fontSize="7" fontWeight="bold" fill={AMBER}>
              3 rows — duplicates kept!
            </text>
            {/* Right annotation: upsert merges */}
            <rect x={TABLE_RIGHT_X} y={TABLE_TOP + HEADER_H + 2 * ROW_H + 8}
              width={TABLE_W} height={16} rx="4" fill={EMERALD} opacity="0.1" />
            <text x={TABLE_RIGHT_X + TABLE_W / 2}
              y={TABLE_TOP + HEADER_H + 2 * ROW_H + 19}
              textAnchor="middle" fontSize="7" fontWeight="bold" fill={EMERALD}>
              2 rows — key A updated in place!
            </text>
          </g>
        )}

        {/* ============================================================
            PHASE 7: ROW COUNT COMPARISON (big & prominent)
            ============================================================ */}
        {phase === 7 && (
          <g>
            {/* Append count */}
            <rect x={TABLE_LEFT_X + TABLE_W / 2 - 50}
              y={TABLE_TOP + HEADER_H + 6 * ROW_H + 2}
              width={100} height={28} rx="6"
              fill={AMBER} opacity="0.15" stroke={AMBER} strokeWidth="1.5" />
            <text x={TABLE_LEFT_X + TABLE_W / 2}
              y={TABLE_TOP + HEADER_H + 6 * ROW_H + 12}
              textAnchor="middle" fontSize="8" fontWeight="bold" fill={AMBER}
              opacity="0.7">
              APPEND
            </text>
            <text x={TABLE_LEFT_X + TABLE_W / 2}
              y={TABLE_TOP + HEADER_H + 6 * ROW_H + 24}
              textAnchor="middle" fontSize="12" fontWeight="bold" fill={AMBER}>
              {appendRows.length} rows
            </text>

            {/* Upsert count */}
            <rect x={TABLE_RIGHT_X + TABLE_W / 2 - 50}
              y={TABLE_TOP + HEADER_H + 6 * ROW_H + 2}
              width={100} height={28} rx="6"
              fill={EMERALD} opacity="0.15" stroke={EMERALD} strokeWidth="1.5" />
            <text x={TABLE_RIGHT_X + TABLE_W / 2}
              y={TABLE_TOP + HEADER_H + 6 * ROW_H + 12}
              textAnchor="middle" fontSize="8" fontWeight="bold" fill={EMERALD}
              opacity="0.7">
              UPSERT
            </text>
            <text x={TABLE_RIGHT_X + TABLE_W / 2}
              y={TABLE_TOP + HEADER_H + 6 * ROW_H + 24}
              textAnchor="middle" fontSize="12" fontWeight="bold" fill={EMERALD}>
              {upsertRows.length} rows
            </text>

            {/* Arrow between them */}
            <text x={CENTER_X} y={TABLE_TOP + HEADER_H + 6 * ROW_H + 20}
              textAnchor="middle" fontSize="14" fill="var(--color-text, #e2e8f0)"
              opacity="0.6">
              vs
            </text>
          </g>
        )}

        {/* ============================================================
            PHASE 8-9: Final annotation
            ============================================================ */}
        {(phase === 8 || phase === 9) && (
          <g>
            <rect x={CENTER_X - 160}
              y={TABLE_TOP + HEADER_H + 6 * ROW_H + 4}
              width={320} height={28} rx="6"
              fill="var(--color-surface, #1e293b)"
              stroke="var(--color-border, #475569)" strokeWidth="1" />
            <text x={CENTER_X}
              y={TABLE_TOP + HEADER_H + 6 * ROW_H + 14}
              textAnchor="middle" fontSize="8" fontWeight="bold"
              fill="var(--color-text, #e2e8f0)" opacity="0.9">
              {phase === 8
                ? 'Same data. Different semantics. Choose wisely.'
                : 'N events \u2192 N rows (Append) vs K unique keys (Upsert)'}
            </text>
            <text x={CENTER_X}
              y={TABLE_TOP + HEADER_H + 6 * ROW_H + 26}
              textAnchor="middle" fontSize="7"
              fill="var(--color-text, #94a3b8)" opacity="0.6">
              {phase === 8
                ? 'Append = immutable log \u00B7 Upsert = materialized view'
                : 'Restarting...'}
            </text>
          </g>
        )}

        {/* ============================================================
            STATUS BAR (bottom)
            ============================================================ */}
        <rect x="20" y={SVG_H - 50} width={SVG_W - 40} height={18} rx="4"
          fill="var(--color-surface, #1e293b)"
          stroke="var(--color-border, #334155)" strokeWidth="0.5" />
        <text x={CENTER_X} y={SVG_H - 38} textAnchor="middle" fontSize="7.5"
          fill="var(--color-text, #94a3b8)">
          {getPhaseLabel()}
        </text>

        {/* Phase progress dots */}
        <g transform={`translate(${CENTER_X - TOTAL_PHASES * 5}, ${SVG_H - 28})`}>
          {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
            <circle key={i} cx={i * 10 + 5} cy="4" r="2.5"
              fill={i === phase ? 'var(--color-accent, #60a5fa)' : 'var(--color-border, #334155)'}
              opacity={i === phase ? 1 : 0.4} />
          ))}
        </g>

        {/* ============================================================
            LEGEND
            ============================================================ */}
        <g transform={`translate(20, ${SVG_H - 16})`}>
          {/* Append */}
          <rect x="0" y="0" width="8" height="8" rx="1.5" fill={AMBER} opacity="0.8" />
          <text x="12" y="7" fontSize="7" fill="var(--color-text, #94a3b8)">Append</text>
          {/* Upsert */}
          <rect x="60" y="0" width="8" height="8" rx="1.5" fill={EMERALD} opacity="0.8" />
          <text x="72" y="7" fontSize="7" fill="var(--color-text, #94a3b8)">Upsert</text>
          {/* Event */}
          <rect x="120" y="0" width="8" height="8" rx="1.5" fill={BLUE} opacity="0.8" />
          <text x="132" y="7" fontSize="7" fill="var(--color-text, #94a3b8)">Event</text>
          {/* Key A */}
          <rect x="180" y="0" width="8" height="8" rx="1" fill={AMBER} />
          <text x="192" y="7" fontSize="6" fill="var(--color-text, #94a3b8)">Key A</text>
          {/* Key B */}
          <rect x="225" y="0" width="8" height="8" rx="1" fill={BLUE} />
          <text x="237" y="7" fontSize="6" fill="var(--color-text, #94a3b8)">Key B</text>
          {/* New row */}
          <rect x="275" y="0" width="8" height="8" rx="1" fill="var(--color-border)" opacity="0.3" />
          <text x="287" y="7" fontSize="6" fill="var(--color-text, #94a3b8)">New</text>
          {/* Updated */}
          <rect x="315" y="0" width="8" height="8" rx="1" fill={EMERALD} opacity="0.5"
            stroke={EMERALD} strokeWidth="1" />
          <text x="327" y="7" fontSize="6" fill="var(--color-text, #94a3b8)">Updated</text>
        </g>
      </svg>
    </div>
  );
}
