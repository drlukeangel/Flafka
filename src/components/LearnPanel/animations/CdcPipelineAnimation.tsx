import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const INSERT_COLOR = '#10b981';  // green — INSERT
const UPDATE_COLOR = '#f59e0b';  // amber — UPDATE
const RANK_COLOR   = '#6366f1';  // indigo — ROW_NUMBER rank
const OUTPUT_COLOR = '#3b82f6';  // blue — output table

// CDC event stream (left column)
interface CdcEvent {
  type: 'INSERT' | 'UPDATE';
  score: number;
  rank?: number;
}

const CDC_EVENTS: CdcEvent[] = [
  { type: 'INSERT', score: 720 },
  { type: 'UPDATE', score: 735 },
  { type: 'UPDATE', score: 748 },
  { type: 'UPDATE', score: 751 },
];

// Geometry
const CDC_X = 60;
const CDC_Y0 = 38;
const CDC_ROW_H = 36;
const CDC_ROW_W = 155;

const RANK_X = 270;

const OUT_X = 390;
const OUT_Y = 85;
const OUT_W = 160;
const OUT_H = 46;

const PHASE_STATUS: string[] = [
  'CDC stream: each database change produces an event',
  'INSERT score=720 arrives for customer C-001',
  'UPDATE score=735 — row glow, table updates',
  'UPDATE score=748 — latest supersedes previous',
  'ROW_NUMBER DESC: latest event gets rank 1',
  'WHERE rownum=1 filter — only latest passes through',
  'Output table: one clean row per customer, always current',
  'ORDER BY $rowtime DESC + WHERE rownum=1 = latest wins',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CdcPipelineAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Which CDC events are visible in the stream?
  // Phase 0: empty
  // Phase 1: INSERT visible, slides in
  // Phase 2: + UPDATE 735 slides in
  // Phase 3: + UPDATE 748 slides in
  // Phase 4+: all 4 visible with rank labels

  const eventsVisible = Math.min(
    phase === 0 ? 0 :
    phase === 1 ? Math.ceil(eased) :
    phase === 2 ? 1 + Math.ceil(eased) :
    phase === 3 ? 2 + Math.ceil(eased) :
    4,
    4
  );

  // Slide-in animation for the newest event
  const slideInIdx = phase === 1 ? 0 : phase === 2 ? 1 : phase === 3 ? 2 : -1;
  const slideInProgress = eased;

  // Output table: what score to show
  const outputScore =
    phase <= 0 ? null :
    phase === 1 ? 720 :
    phase === 2 ? 735 :
    phase >= 3 ? 748 : 748;

  // Output table glow (when just updated)
  const outputGlow = phase === 1 || phase === 2 || phase === 3;
  const outputGlowIntensity = outputGlow ? (1 - eased) * 0.7 : 0;

  // ROW_NUMBER ranking visible (phase 4+)
  const showRankings = phase >= 4;
  const rankOpacity = phase === 4 ? eased : phase > 4 ? 1 : 0;

  // Filter gate visible (phase 5+)
  const showFilter = phase >= 5;
  const filterOpacity = phase === 5 ? eased : phase > 5 ? 1 : 0;

  // Output table visibility
  const showOutput = phase >= 1;
  const outputOpacity = phase === 1 ? eased : 1;

  // Score update flash
  const scoreFlash = (phase === 2 || phase === 3) && eased < 0.4 ? (0.4 - eased) / 0.4 : 0;

  // Phase 7: insight
  const insightOpacity = phase === 7 ? eased : 0;

  // Color for output score
  const currentColor = phase >= 5 ? INSERT_COLOR : UPDATE_COLOR;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }} aria-label="CDC pipeline animation showing ROW_NUMBER DESC deduplication keeping only the latest row per customer">
        <defs>
          <filter id="cdc-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="cdc-flash" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="cdc-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={RANK_COLOR} opacity="0.5" />
          </marker>
          <marker id="cdc-out-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={OUTPUT_COLOR} opacity="0.5" />
          </marker>
        </defs>

        {/* ── CDC STREAM HEADER ── */}
        <text x={CDC_X + CDC_ROW_W / 2} y="22" textAnchor="middle" fontSize="9" fontWeight="700"
          fill="var(--color-text-primary)" opacity={0.5}>CDC Stream (C-001)</text>

        {/* ── CDC EVENT ROWS ── */}
        {CDC_EVENTS.slice(0, eventsVisible).map((evt, i) => {
          const isSliding = i === slideInIdx;
          const slideOffset = isSliding ? (1 - slideInProgress) * -40 : 0;
          const opacity = isSliding ? slideInProgress : 1;
          const y = CDC_Y0 + i * CDC_ROW_H + slideOffset;
          const color = evt.type === 'INSERT' ? INSERT_COLOR : UPDATE_COLOR;
          const prefix = evt.type === 'INSERT' ? '+' : '\u0394';

          // Latest event (most recent) = row 0 in rank desc ordering
          // Phase 4: rank = CDC_EVENTS length - i (rank 1 = most recent = last arrived)
          const rank = showRankings ? (eventsVisible - i) : null;
          const isRank1 = rank === 1;

          return (
            <g key={i} opacity={opacity}>
              {/* Row background */}
              <rect x={CDC_X} y={y} width={CDC_ROW_W} height={CDC_ROW_H - 4} rx="5"
                fill={color} fillOpacity={isRank1 && showRankings ? 0.15 : 0.07}
                stroke={color} strokeWidth={isRank1 && showRankings ? 1.8 : 1}
                filter={isRank1 && phase >= 5 ? 'url(#cdc-glow)' : undefined} />
              {/* Type prefix */}
              <text x={CDC_X + 14} y={y + 15} textAnchor="middle" fontSize="13"
                fontWeight="900" fill={color} opacity={0.9}>{prefix}</text>
              {/* Score */}
              <text x={CDC_X + 80} y={y + 15} textAnchor="middle" fontSize="10"
                fontWeight="700" fontFamily="monospace" fill={color}>
                score={evt.score}
              </text>
              {/* Timestamp hint */}
              <text x={CDC_X + 8} y={y + 27} fontSize="7"
                fill="var(--color-text-primary)" opacity={0.35} fontFamily="monospace">
                t={i}
              </text>
              {/* Rank badge */}
              {showRankings && rank !== null && (
                <g opacity={rankOpacity}>
                  <rect x={CDC_X + CDC_ROW_W + 4} y={y + 4} width="30" height="18" rx="4"
                    fill={isRank1 ? RANK_COLOR : 'rgba(255,255,255,0.05)'}
                    stroke={RANK_COLOR} strokeWidth={isRank1 ? 1.5 : 0.8}
                    opacity={isRank1 ? 1 : 0.5} />
                  <text x={CDC_X + CDC_ROW_W + 19} y={y + 16} textAnchor="middle"
                    fontSize="8" fontWeight="700" fill={isRank1 ? '#fff' : RANK_COLOR}
                    opacity={isRank1 ? 1 : 0.6}>
                    #{rank}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── ROW_NUMBER LOGIC LABEL ── */}
        {showRankings && (
          <g opacity={rankOpacity}>
            <rect x={CDC_X} y={CDC_Y0 + 4 * CDC_ROW_H + 4} width={CDC_ROW_W + 40} height="26" rx="5"
              fill={RANK_COLOR} fillOpacity={0.07}
              stroke={RANK_COLOR} strokeWidth="1" />
            <text x={CDC_X + (CDC_ROW_W + 40) / 2} y={CDC_Y0 + 4 * CDC_ROW_H + 12}
              textAnchor="middle" fontSize="7.5" fontFamily="monospace" fill={RANK_COLOR} opacity={0.7}>
              ROW_NUMBER() OVER
            </text>
            <text x={CDC_X + (CDC_ROW_W + 40) / 2} y={CDC_Y0 + 4 * CDC_ROW_H + 23}
              textAnchor="middle" fontSize="7.5" fontFamily="monospace" fill={RANK_COLOR} opacity={0.7}>
              (ORDER BY $rowtime DESC)
            </text>
          </g>
        )}

        {/* ── ARROW from CDC to ranking to output ── */}
        <line x1={CDC_X + CDC_ROW_W + 38} y1={CDC_Y0 + CDC_ROW_H}
          x2={OUT_X - 6} y2={OUT_Y + OUT_H / 2}
          stroke={RANK_COLOR} strokeWidth="1.2" opacity={0.25}
          markerEnd="url(#cdc-arr)" strokeDasharray="5 3" />

        {/* ── FILTER GATE ── */}
        {showFilter && (
          <g opacity={filterOpacity}>
            <rect x={RANK_X - 10} y={OUT_Y + 8} width="120" height="28" rx="6"
              fill={INSERT_COLOR} fillOpacity={0.08}
              stroke={INSERT_COLOR} strokeWidth="1.5" />
            <text x={RANK_X + 50} y={OUT_Y + 20} textAnchor="middle" fontSize="8"
              fontFamily="monospace" fontWeight="700" fill={INSERT_COLOR}>
              WHERE rownum = 1
            </text>
            <text x={RANK_X + 50} y={OUT_Y + 31} textAnchor="middle" fontSize="7.5"
              fill={INSERT_COLOR} opacity={0.6}>only latest passes</text>
            {/* Arrow to output */}
            <line x1={RANK_X + 110} y1={OUT_Y + 20}
              x2={OUT_X - 6} y2={OUT_Y + OUT_H / 2}
              stroke={INSERT_COLOR} strokeWidth="1" opacity={0.4}
              markerEnd="url(#cdc-out-arr)" />
          </g>
        )}

        {/* ── OUTPUT TABLE ── */}
        {showOutput && (
          <g opacity={outputOpacity}>
            {/* Output table background */}
            <rect x={OUT_X} y={OUT_Y - 28} width={OUT_W} height={OUT_H + 32} rx="6"
              fill="rgba(255,255,255,0.03)"
              stroke={OUTPUT_COLOR} strokeWidth="1.5" />
            {/* Header */}
            <rect x={OUT_X} y={OUT_Y - 28} width={OUT_W} height="20" rx="5"
              fill={OUTPUT_COLOR} fillOpacity={0.15} />
            <text x={OUT_X + OUT_W / 2} y={OUT_Y - 14} textAnchor="middle" fontSize="8.5"
              fontWeight="700" fill={OUTPUT_COLOR}>Output Table</text>
            {/* Column headers */}
            <text x={OUT_X + 30} y={OUT_Y - 2} textAnchor="middle" fontSize="7.5"
              fill="var(--color-text-primary)" opacity={0.5} fontFamily="monospace">cust_id</text>
            <line x1={OUT_X + 65} y1={OUT_Y - 10} x2={OUT_X + 65} y2={OUT_Y + OUT_H}
              stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <text x={OUT_X + 110} y={OUT_Y - 2} textAnchor="middle" fontSize="7.5"
              fill="var(--color-text-primary)" opacity={0.5} fontFamily="monospace">credit_score</text>
            {/* Divider */}
            <line x1={OUT_X + 6} y1={OUT_Y + 5} x2={OUT_X + OUT_W - 6} y2={OUT_Y + 5}
              stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            {/* Data row */}
            {outputScore !== null && (
              <g filter={outputGlowIntensity > 0.1 ? 'url(#cdc-flash)' : undefined}>
                <rect x={OUT_X + 4} y={OUT_Y + 8} width={OUT_W - 8} height={24} rx="4"
                  fill={currentColor} fillOpacity={0.08 + outputGlowIntensity * 0.2}
                  stroke={currentColor} strokeWidth={scoreFlash > 0.3 ? 1.5 : 0.8}
                  opacity={1} />
                <text x={OUT_X + 30} y={OUT_Y + 23} textAnchor="middle" fontSize="9.5"
                  fontWeight="700" fontFamily="monospace" fill={OUTPUT_COLOR}>C-001</text>
                <text x={OUT_X + 115} y={OUT_Y + 23} textAnchor="middle" fontSize="11"
                  fontWeight="800" fontFamily="monospace" fill={currentColor}>
                  {outputScore}
                </text>
                {/* "LATEST" badge on phase 5+ */}
                {phase >= 5 && (
                  <g>
                    <rect x={OUT_X + OUT_W - 50} y={OUT_Y + 11} width="44" height="14" rx="4"
                      fill={INSERT_COLOR} fillOpacity={0.2}
                      stroke={INSERT_COLOR} strokeWidth="1" />
                    <text x={OUT_X + OUT_W - 28} y={OUT_Y + 21} textAnchor="middle" fontSize="7.5"
                      fontWeight="700" fill={INSERT_COLOR}>LATEST</text>
                  </g>
                )}
              </g>
            )}
          </g>
        )}

        {/* ── PHASE 7: INSIGHT ── */}
        {phase === 7 && (
          <g opacity={insightOpacity}>
            <rect x="35" y="218" width="490" height="24" rx="6"
              fill="rgba(99,102,241,0.08)" stroke={RANK_COLOR} strokeWidth="1" />
            <text x="280" y="234" textAnchor="middle" fontSize="9" fontWeight="600"
              fill={RANK_COLOR}>
              ORDER BY $rowtime DESC + WHERE rownum=1 = latest wins
            </text>
          </g>
        )}

        {/* ── STATUS BAR ── */}
        <rect x="0" y="255" width="560" height="40" fill="rgba(255,255,255,0.025)" />
        {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
          <circle key={i} cx={200 + i * 20} cy={265}
            r={i === phase ? 4 : 2.5}
            fill={i === phase ? '#3b82f6' : 'var(--color-text-primary)'}
            opacity={i === phase ? 0.9 : 0.25} />
        ))}
        <text x="280" y="284" textAnchor="middle" fontSize="10"
          fill="var(--color-text-primary)" opacity={0.7} fontStyle="italic">
          {PHASE_STATUS[phase]}
        </text>
      </svg>

      {/* HTML legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--color-text-primary)', opacity: 0.75 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="14" height="14">
            <text x="7" y="11" textAnchor="middle" fontSize="13" fontWeight="900" fill={INSERT_COLOR}>+</text>
          </svg>
          INSERT
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="14" height="14">
            <text x="7" y="11" textAnchor="middle" fontSize="12" fontWeight="700" fill={UPDATE_COLOR}>&Delta;</text>
          </svg>
          UPDATE
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="2" fill={RANK_COLOR} fillOpacity="0.2" stroke={RANK_COLOR} strokeWidth="1" /></svg>
          rownum=1 — latest only
        </span>
      </div>
    </div>
  );
}
