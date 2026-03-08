import { useState, useEffect, useRef } from 'react';
import './animations.css';

/* -----------------------------------------------------------------------
 * Types
 * --------------------------------------------------------------------- */

interface Message {
  offset: number;
  letter: string;
  color: string;
  visible: boolean;
  brightness: number;
  pulseT: number;
}

interface ReaderState {
  label: string;
  shortLabel: string;
  color: string;
  startOffset: number;
  cursorOffset: number;
  results: string[];
  active: boolean;
}

interface Particle {
  id: number;
  letter: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  readerIdx: number;
}

interface Snapshot {
  messages: Message[];
  readers: ReaderState[];
  particles: Particle[];
  phase: number;
  writeHead: number;
  lag: number;
}

/* -----------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------- */

const PHASE_COUNT = 8;
const PHASE_DURATION = 1300;
const TOTAL_CYCLE = PHASE_COUNT * PHASE_DURATION;

const MSG_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#eab308',
];
const MSG_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

const PARTITION_X = 42;
const PARTITION_Y = 40;
const CELL_W = 42;
const CELL_H = 28;
const CELL_GAP = 3;

const READER_LANE_Y_START = 118;
const READER_LANE_SPACING = 46;
const RESULTS_BOX_X = 438;
const RESULTS_BOX_W = 112;

const READER_CONFIGS: Omit<ReaderState, 'cursorOffset' | 'results' | 'active'>[] = [
  { label: 'earliest-offset', shortLabel: 'earliest', color: '#3b82f6', startOffset: 0 },
  { label: 'latest-offset', shortLabel: 'latest', color: '#a855f7', startOffset: 7 },
  { label: 'timestamp', shortLabel: 'timestamp', color: '#f59e0b', startOffset: 4 },
];

const STATUS_MESSAGES: string[] = [
  "Topic 'orders' has 7 existing messages",
  'Three consumers start with different startup modes',
  'earliest-offset: replays ALL history from offset 0',
  'latest-offset: reads new data immediately',
  'timestamp: jumps to a specific point in time (offset 4)',
  "earliest-offset has lag \u2014 it's still replaying history",
  'Eventually, earliest catches up to the live edge',
  'Same topic, same data. Starting position changes everything.',
];

/* -----------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------- */

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function cellX(offset: number): number {
  return PARTITION_X + offset * (CELL_W + CELL_GAP);
}

function cellCenterX(offset: number): number {
  return cellX(offset) + CELL_W / 2;
}

function readerLaneY(idx: number): number {
  return READER_LANE_Y_START + idx * READER_LANE_SPACING;
}

function buildInitialSnapshot(): Snapshot {
  return {
    messages: MSG_LETTERS.map((letter, i) => ({
      offset: i,
      letter,
      color: MSG_COLORS[i],
      visible: false,
      brightness: 0,
      pulseT: 0,
    })),
    readers: READER_CONFIGS.map((cfg) => ({
      ...cfg,
      cursorOffset: cfg.startOffset,
      results: [],
      active: false,
    })),
    particles: [],
    phase: 0,
    writeHead: 7,
    lag: 0,
  };
}

/* -----------------------------------------------------------------------
 * Component
 * --------------------------------------------------------------------- */

export function StartupModesAnimation() {
  const [snapshot, setSnapshot] = useState<Snapshot>(buildInitialSnapshot);
  const snapRef = useRef<Snapshot>(buildInitialSnapshot());
  const pidRef = useRef(0);

  useEffect(() => {
    let rafId: number;
    let startTime: number | null = null;
    let prevPhase = -1;
    const s = snapRef.current;

    /* ---- mutable helpers ---- */

    function emit(offset: number, ri: number) {
      s.particles.push({
        id: pidRef.current++,
        letter: MSG_LETTERS[offset],
        fromX: cellCenterX(offset),
        fromY: PARTITION_Y + CELL_H + 6,
        toX: RESULTS_BOX_X + 10,
        toY: readerLaneY(ri) + 12,
        t: 0,
        readerIdx: ri,
      });
    }

    function addRes(ri: number, letter: string) {
      if (!s.readers[ri].results.includes(letter)) {
        s.readers[ri].results.push(letter);
      }
    }

    function readUpTo(ri: number, from: number, to: number) {
      const limit = Math.floor(clamp(to, 0, 9));
      for (let i = from; i <= limit; i++) {
        s.messages[i].brightness = 1;
        if (!s.readers[ri].results.includes(MSG_LETTERS[i])) {
          addRes(ri, MSG_LETTERS[i]);
          emit(i, ri);
        }
      }
    }

    function resetSnap() {
      s.messages.forEach((m, i) => {
        m.visible = false;
        m.brightness = 0;
        m.pulseT = 0;
        m.color = MSG_COLORS[i];
      });
      s.readers.forEach((r, i) => {
        r.cursorOffset = READER_CONFIGS[i].startOffset;
        r.results = [];
        r.active = false;
      });
      s.particles.length = 0;
      s.writeHead = 7;
      s.lag = 0;
      s.phase = 0;
      prevPhase = -1;
    }

    /* ---- main loop ---- */

    function tick(ts: number) {
      if (startTime === null) startTime = ts;
      const elapsed = (ts - startTime) % TOTAL_CYCLE;
      const phase = Math.floor(elapsed / PHASE_DURATION);
      const phaseT = (elapsed % PHASE_DURATION) / PHASE_DURATION;
      const eased = easeInOutCubic(clamp(phaseT, 0, 1));

      if (phase !== prevPhase) {
        prevPhase = phase;
        if (phase === 0) resetSnap();
      }

      // Advance particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        s.particles[i].t += 0.05;
        if (s.particles[i].t >= 1) s.particles.splice(i, 1);
      }

      s.phase = phase;

      // ── Phase 0: Historical messages fade in ──────────────────────
      if (phase === 0) {
        for (let i = 0; i < 7; i++) {
          s.messages[i].visible = true;
          s.messages[i].brightness = lerp(
            0.05,
            0.55,
            easeInOutCubic(clamp(phaseT * 2.5 - i * 0.2, 0, 1)),
          );
        }
        s.lag = 0;
      }

      // ── Phase 1: Reader cursors appear ────────────────────────────
      if (phase === 1) {
        s.readers.forEach((r, i) => {
          r.active = true;
          r.cursorOffset = READER_CONFIGS[i].startOffset;
        });
        s.lag = 0;
      }

      // ── Phase 2: Earliest scans offsets 0..3 ─────────────────────
      if (phase === 2) {
        s.readers[0].cursorOffset = lerp(0, 3, eased);
        readUpTo(0, 0, s.readers[0].cursorOffset);
        s.lag = 7 - s.readers[0].cursorOffset;
      }

      // ── Phase 3: H arrives, latest reads it, earliest 3..5 ──────
      if (phase === 3) {
        s.messages[7].visible = true;
        s.messages[7].brightness = 1;
        s.messages[7].pulseT = clamp(1 - phaseT * 2.5, 0, 1);
        s.writeHead = 8;

        s.readers[1].cursorOffset = 7;
        if (phaseT > 0.25) {
          if (!s.readers[1].results.includes('H')) {
            addRes(1, 'H');
            emit(7, 1);
          }
        }

        s.readers[0].cursorOffset = lerp(3, 5, eased);
        readUpTo(0, 0, s.readers[0].cursorOffset);
        s.lag = s.writeHead - s.readers[0].cursorOffset;
      }

      // ── Phase 4: Timestamp scans 4..7, earliest 5..6 ─────────────
      if (phase === 4) {
        s.readers[2].cursorOffset = lerp(4, 7, eased);
        readUpTo(2, 4, Math.min(s.readers[2].cursorOffset, 6));
        if (Math.floor(s.readers[2].cursorOffset) >= 7) {
          if (!s.readers[2].results.includes('H')) {
            addRes(2, 'H');
            emit(7, 2);
          }
        }

        s.readers[0].cursorOffset = lerp(5, 6, eased);
        readUpTo(0, 0, s.readers[0].cursorOffset);
        s.lag = s.writeHead - s.readers[0].cursorOffset;
      }

      // ── Phase 5: I,J arrive — latest+timestamp read, earliest lags
      if (phase === 5) {
        s.messages[8].visible = true;
        s.messages[8].brightness = 1;
        s.messages[8].pulseT = clamp(1 - phaseT * 3, 0, 1);
        if (phaseT > 0.35) {
          s.messages[9].visible = true;
          s.messages[9].brightness = 1;
          s.messages[9].pulseT = clamp(1 - (phaseT - 0.35) * 3, 0, 1);
        }
        s.writeHead = phaseT > 0.35 ? 10 : 9;

        // Latest reads I then J
        s.readers[1].cursorOffset =
          phaseT < 0.35
            ? lerp(7, 8, phaseT / 0.35)
            : lerp(8, 9, (phaseT - 0.35) / 0.65);
        if (phaseT > 0.12 && !s.readers[1].results.includes('I')) {
          addRes(1, 'I');
          emit(8, 1);
        }
        if (phaseT > 0.5 && !s.readers[1].results.includes('J')) {
          addRes(1, 'J');
          emit(9, 1);
        }

        // Timestamp reads H, I, J
        s.readers[2].cursorOffset = lerp(7, 9, eased);
        if (phaseT > 0.15 && !s.readers[2].results.includes('H')) {
          addRes(2, 'H');
          emit(7, 2);
        }
        if (phaseT > 0.4 && !s.readers[2].results.includes('I')) {
          addRes(2, 'I');
          emit(8, 2);
        }
        if (phaseT > 0.65 && !s.readers[2].results.includes('J')) {
          addRes(2, 'J');
          emit(9, 2);
        }

        // Earliest: 6 -> 7
        s.readers[0].cursorOffset = lerp(6, 7, eased);
        readUpTo(0, 0, s.readers[0].cursorOffset);
        s.lag = s.writeHead - s.readers[0].cursorOffset;
      }

      // ── Phase 6: Earliest catches up 7..9 ────────────────────────
      if (phase === 6) {
        s.messages.forEach((m) => {
          if (m.visible) m.brightness = 1;
        });
        s.writeHead = 10;
        s.readers[0].cursorOffset = lerp(7, 9, eased);
        readUpTo(0, 0, s.readers[0].cursorOffset);
        s.readers[1].cursorOffset = 9;
        s.readers[2].cursorOffset = 9;
        s.lag = Math.max(0, 9 - s.readers[0].cursorOffset);
      }

      // ── Phase 7: All aligned — insight callout ───────────────────
      if (phase === 7) {
        s.messages.forEach((m) => {
          if (m.visible) m.brightness = 1;
        });
        s.readers[0].cursorOffset = 9;
        s.readers[1].cursorOffset = 9;
        s.readers[2].cursorOffset = 9;
        s.writeHead = 10;
        s.lag = 0;
      }

      // Push a shallow clone so React sees a new object
      setSnapshot({
        ...s,
        messages: s.messages.map((m) => ({ ...m })),
        readers: s.readers.map((r) => ({ ...r, results: [...r.results] })),
        particles: s.particles.map((p) => ({ ...p })),
      });

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  /* -----------------------------------------------------------------------
   * Render
   * --------------------------------------------------------------------- */

  const { messages, readers, particles, phase, lag, writeHead } = snapshot;

  return (
    <div className="concept-animation">
      <h4>Startup Modes: Where Flink Begins Reading</h4>
      <svg viewBox="0 0 560 280" style={{ width: '100%', height: 'auto' }}>
        <defs>
          <filter id="sma-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id="sma-arr"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-text, #e2e8f0)" opacity="0.4" />
          </marker>
        </defs>

        {/* ── Topic title ─────────────────────────────────────────── */}
        <text
          x={PARTITION_X}
          y={PARTITION_Y - 12}
          fill="var(--color-text, #e2e8f0)"
          fontSize="11"
          fontWeight="600"
          fontFamily="monospace"
        >
          Kafka Topic: orders (partition 0)
        </text>

        {/* ── Partition lane background ───────────────────────────── */}
        <rect
          x={PARTITION_X - 5}
          y={PARTITION_Y - 5}
          width={10 * (CELL_W + CELL_GAP) + 6}
          height={CELL_H + 10}
          rx="5"
          fill="var(--color-surface, #1e293b)"
          stroke="var(--color-border, #334155)"
          strokeWidth="1"
        />

        {/* ── Message cells ───────────────────────────────────────── */}
        {messages.map((msg) => {
          if (!msg.visible) return null;
          const x = cellX(msg.offset);
          const pulse = 1 + msg.pulseT * 0.15;
          const cx = x + CELL_W / 2;
          const cy = PARTITION_Y + CELL_H / 2;
          return (
            <g
              key={msg.offset}
              transform={`translate(${cx},${cy}) scale(${pulse}) translate(${-cx},${-cy})`}
              opacity={msg.brightness}
            >
              <rect x={x} y={PARTITION_Y} width={CELL_W} height={CELL_H} rx="3" fill={msg.color} opacity={0.85} />
              {msg.pulseT > 0 && (
                <rect
                  x={x - 2}
                  y={PARTITION_Y - 2}
                  width={CELL_W + 4}
                  height={CELL_H + 4}
                  rx="4"
                  fill="none"
                  stroke={msg.color}
                  strokeWidth="1.5"
                  opacity={msg.pulseT * 0.6}
                />
              )}
              <text
                x={cx}
                y={PARTITION_Y + 12}
                fill="#fff"
                fontSize="10"
                fontWeight="700"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {msg.letter}
              </text>
              <text
                x={cx}
                y={PARTITION_Y + 23}
                fill="#fff"
                fontSize="7"
                textAnchor="middle"
                fontFamily="monospace"
                opacity="0.65"
              >
                [{msg.offset}]
              </text>
            </g>
          );
        })}

        {/* ── Write-head marker ───────────────────────────────────── */}
        {phase >= 3 && writeHead <= 10 && (
          <g>
            <line
              x1={cellX(Math.min(writeHead, 10)) - 1}
              y1={PARTITION_Y - 3}
              x2={cellX(Math.min(writeHead, 10)) - 1}
              y2={PARTITION_Y + CELL_H + 3}
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="3,2"
              opacity="0.65"
            />
            <text
              x={cellX(Math.min(writeHead, 10)) + 2}
              y={PARTITION_Y - 6}
              fill="#ef4444"
              fontSize="7"
              fontFamily="monospace"
              fontWeight="600"
              opacity="0.8"
            >
              HEAD
            </text>
          </g>
        )}

        {/* ── Historical / live labels ────────────────────────────── */}
        {phase >= 1 && (
          <>
            <text
              x={cellX(3)}
              y={PARTITION_Y + CELL_H + 15}
              fill="var(--color-text, #e2e8f0)"
              fontSize="7"
              fontFamily="monospace"
              textAnchor="middle"
              opacity="0.45"
            >
              historical
            </text>
            <text
              x={cellX(8)}
              y={PARTITION_Y + CELL_H + 15}
              fill="var(--color-text, #e2e8f0)"
              fontSize="7"
              fontFamily="monospace"
              textAnchor="middle"
              opacity="0.45"
            >
              live edge
            </text>
          </>
        )}

        {/* ── Reader lanes ────────────────────────────────────────── */}
        {readers.map((reader, ri) => {
          if (!reader.active) return null;
          const laneY = readerLaneY(ri);
          const cursorX = cellCenterX(clamp(reader.cursorOffset, 0, 9));
          const partitionRight = PARTITION_X + 10 * (CELL_W + CELL_GAP);

          return (
            <g key={ri}>
              {/* Lane label */}
              <text
                x={PARTITION_X - 6}
                y={laneY + 14}
                fill={reader.color}
                fontSize="8"
                fontWeight="600"
                fontFamily="monospace"
                textAnchor="end"
              >
                {reader.shortLabel}
              </text>

              {/* Lane background */}
              <rect
                x={PARTITION_X - 5}
                y={laneY}
                width={partitionRight - PARTITION_X + 6}
                height={22}
                rx="3"
                fill={reader.color}
                opacity={0.07}
                stroke={reader.color}
                strokeWidth="0.5"
                strokeOpacity="0.25"
              />

              {/* Cursor triangle */}
              <g filter="url(#sma-glow)">
                <polygon
                  points={`${cursorX - 7},${laneY + 1} ${cursorX + 7},${laneY + 1} ${cursorX},${laneY + 14}`}
                  fill={reader.color}
                  opacity={0.9}
                />
              </g>
              {/* Offset label under cursor */}
              <text
                x={cursorX}
                y={laneY + 20}
                fill={reader.color}
                fontSize="7"
                fontWeight="600"
                textAnchor="middle"
                fontFamily="monospace"
                opacity="0.75"
              >
                @{Math.floor(reader.cursorOffset)}
              </text>

              {/* Dashed connector to results box */}
              <line
                x1={partitionRight + 4}
                y1={laneY + 11}
                x2={RESULTS_BOX_X - 4}
                y2={laneY + 11}
                stroke={reader.color}
                strokeWidth="1"
                strokeDasharray="4,3"
                opacity="0.3"
                markerEnd="url(#sma-arr)"
              />

              {/* Results box */}
              <rect
                x={RESULTS_BOX_X}
                y={laneY - 2}
                width={RESULTS_BOX_W}
                height={26}
                rx="4"
                fill="var(--color-surface, #1e293b)"
                stroke={reader.color}
                strokeWidth="1"
                opacity="0.9"
              />
              <text
                x={RESULTS_BOX_X + 6}
                y={laneY + 14}
                fill={reader.color}
                fontSize="9"
                fontFamily="monospace"
                fontWeight="500"
              >
                {reader.results.length > 0
                  ? reader.results.length > 7
                    ? reader.results.slice(-7).join(' ')
                    : reader.results.join(' ')
                  : '\u2014'}
              </text>
              {reader.results.length > 7 && (
                <text
                  x={RESULTS_BOX_X + 6}
                  y={laneY + 14}
                  fill={reader.color}
                  fontSize="8"
                  fontFamily="monospace"
                  opacity="0.5"
                >
                  ..
                </text>
              )}
            </g>
          );
        })}

        {/* ── Lag indicator (earliest reader) ─────────────────────── */}
        {phase >= 2 && phase <= 6 && lag > 0.8 && readers[0].active && (() => {
          const laneY = readerLaneY(0);
          const readX = cellCenterX(clamp(readers[0].cursorOffset, 0, 9));
          const writeX = cellCenterX(clamp(writeHead - 1, 0, 9));
          if (writeX - readX < 20) return null;
          const midX = (readX + writeX) / 2;
          const bracketY = laneY - 5;
          return (
            <g>
              {/* Horizontal bar */}
              <line
                x1={readX}
                y1={bracketY}
                x2={writeX}
                y2={bracketY}
                stroke="#ef4444"
                strokeWidth="2"
                opacity="0.65"
              />
              {/* Left tick */}
              <line
                x1={readX}
                y1={bracketY - 4}
                x2={readX}
                y2={bracketY + 4}
                stroke="#ef4444"
                strokeWidth="1.5"
                opacity="0.65"
              />
              {/* Right tick */}
              <line
                x1={writeX}
                y1={bracketY - 4}
                x2={writeX}
                y2={bracketY + 4}
                stroke="#ef4444"
                strokeWidth="1.5"
                opacity="0.65"
              />
              {/* Label */}
              <rect
                x={midX - 22}
                y={bracketY - 15}
                width="44"
                height="12"
                rx="2"
                fill="#ef4444"
                opacity="0.15"
              />
              <text
                x={midX}
                y={bracketY - 6}
                fill="#ef4444"
                fontSize="8"
                fontWeight="700"
                textAnchor="middle"
                fontFamily="monospace"
              >
                LAG: {Math.max(0, Math.round(lag))}
              </text>
            </g>
          );
        })()}

        {/* ── Particles ───────────────────────────────────────────── */}
        {particles.map((p) => {
          const t = easeInOutCubic(clamp(p.t, 0, 1));
          const px = lerp(p.fromX, p.toX, t);
          const py = lerp(p.fromY, p.toY, t);
          const reader = readers[p.readerIdx];
          return (
            <g key={p.id} opacity={1 - p.t * 0.5}>
              <circle cx={px} cy={py} r="5" fill={reader?.color ?? '#fff'} opacity="0.7" />
              <text
                x={px}
                y={py + 3}
                fill="#fff"
                fontSize="6"
                fontWeight="700"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {p.letter}
              </text>
            </g>
          );
        })}

        {/* ── Phase 7 insight callout ─────────────────────────────── */}
        {phase === 7 && (
          <g>
            <rect
              x="90"
              y="92"
              width="370"
              height="38"
              rx="6"
              fill="var(--color-accent, #3b82f6)"
              opacity="0.12"
              stroke="var(--color-accent, #3b82f6)"
              strokeWidth="1"
              strokeOpacity="0.4"
            />
            <text
              x="275"
              y="108"
              fill="var(--color-accent, #3b82f6)"
              fontSize="10"
              fontWeight="700"
              textAnchor="middle"
              fontFamily="monospace"
            >
              scan.startup.mode controls WHERE you start reading.
            </text>
            <text
              x="275"
              y="122"
              fill="var(--color-accent, #3b82f6)"
              fontSize="9"
              textAnchor="middle"
              fontFamily="monospace"
              opacity="0.75"
            >
              Same topic, same data. Starting position changes everything.
            </text>
          </g>
        )}

        {/* ── Legend ───────────────────────────────────────────────── */}
        <g transform="translate(16, 240)">
          {READER_CONFIGS.map((cfg, i) => (
            <g key={i} transform={`translate(${i * 180}, 0)`}>
              <rect x="0" y="0" width="10" height="10" rx="2" fill={cfg.color} opacity="0.9" />
              <text
                x="14"
                y="9"
                fill="var(--color-text, #e2e8f0)"
                fontSize="8"
                fontFamily="monospace"
              >
                {cfg.label}
              </text>
            </g>
          ))}
        </g>

        {/* ── Status bar ──────────────────────────────────────────── */}
        <rect x="0" y="256" width="560" height="24" fill="var(--color-surface, #1e293b)" opacity="0.95" />
        <line x1="0" y1="256" x2="560" y2="256" stroke="var(--color-border, #334155)" strokeWidth="1" />
        <text
          x="280"
          y="272"
          fill="var(--color-text, #e2e8f0)"
          fontSize="10"
          textAnchor="middle"
          fontFamily="monospace"
          fontWeight="500"
        >
          {STATUS_MESSAGES[phase] ?? ''}
        </text>
      </svg>
    </div>
  );
}
