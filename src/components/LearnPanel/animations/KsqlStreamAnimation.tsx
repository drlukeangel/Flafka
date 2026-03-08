import './animations.css';
import { useAnimationTick } from './useAnimationTick';

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const INDIGO = '#6366f1';
const TEAL = '#14b8a6';

const PHASE_STATUS = [
  'ksqlDB EMIT CHANGES: server pushes rows as they arrive',
  'Push query starts — cursor blinks in consumer panel',
  'First events stream in continuously',
  'WHERE clause filters — only matching rows pass',
  'More events arrive — continuous flow, no polling',
  'Pull query contrast: SELECT COUNT(*) — snapshot only',
  'Consumer cursor advances — row counter increments live',
  'EMIT CHANGES = server-push. Runs until you close it.',
];

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// Rows that stream in
interface StreamRow {
  id: string;
  loan: string;
  amount: string;
  filtered?: boolean;
}

const ROW_POOL: StreamRow[] = [
  { id: 'R-001', loan: 'MORTGAGE', amount: '$240k' },
  { id: 'R-002', loan: 'AUTO',     amount: '$18k', filtered: true },
  { id: 'R-003', loan: 'MORTGAGE', amount: '$310k' },
  { id: 'R-004', loan: 'HELOC',    amount: '$85k' },
  { id: 'R-005', loan: 'AUTO',     amount: '$22k', filtered: true },
  { id: 'R-006', loan: 'MORTGAGE', amount: '$195k' },
  { id: 'R-007', loan: 'MORTGAGE', amount: '$420k' },
];

export function KsqlStreamAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Cursor blink (independent of phase)
  const cursorVisible = tick % 10 < 5;

  // Visible rows in consumer panel: cumulative based on phase
  const rowCount =
    phase <= 1 ? 0 :
    phase === 2 ? Math.round(eased * 3) :
    phase === 3 ? 3 :
    phase === 4 ? 3 + Math.round(eased * 2) :
    phase >= 5 ? 5 : 0;

  const visibleRows = ROW_POOL.filter(r => !r.filtered).slice(0, Math.min(rowCount, 5));

  // Counter
  const counterVal =
    phase < 6 ? rowCount :
    phase === 6 ? 123 + Math.round(eased * 5) : 128;

  // Pull query panel opacity (phase 5+)
  const pullOpacity = phase >= 5 ? (phase === 5 ? eased : 1) : 0;

  // WHERE highlight pulse (phase 3)
  const wherePulse = phase === 3 ? 0.5 + 0.5 * Math.sin(phaseProgress * Math.PI * 6) : 1;

  const insightOpacity = phase === 7 ? eased : 0;

  // Source box glow when streaming
  const sourceGlow = phase >= 2 && phase <= 4
    ? 0.12 + 0.06 * Math.sin(phaseProgress * Math.PI * 4)
    : 0.08;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="ksqlDB EMIT CHANGES push query animation showing continuous server-pushed row streaming">
        <defs>
          <filter id="ks-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="ks-arr-t" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={TEAL} opacity="0.65" />
          </marker>
          <clipPath id="ks-consumer-clip">
            <rect x="370" y="40" width="175" height="165" />
          </clipPath>
        </defs>

        {/* ── LEFT: ksqlDB source box ── */}
        <rect x="15" y="50" width="130" height="100" rx="10"
          fill={TEAL} fillOpacity={sourceGlow}
          stroke={TEAL} strokeWidth="1.8"
          filter={phase >= 2 && phase <= 4 ? 'url(#ks-glow)' : undefined} />
        <text x="80" y="82" textAnchor="middle" fontSize="11" fontWeight="800"
          fill={TEAL}>ksqlDB</text>
        <text x="80" y="98" textAnchor="middle" fontSize="8"
          fill={TEAL} opacity={0.7}>STREAM source</text>
        <text x="80" y="114" textAnchor="middle" fontSize="8"
          fill={TEAL} opacity={0.6}>loan_applications</text>
        {/* Stream indicator dots */}
        {phase >= 2 && [0, 1, 2].map((i) => (
          <circle key={i} cx={50 + i * 20} cy={135} r={3}
            fill={TEAL}
            opacity={(tick + i * 7) % 20 < 10 ? 0.9 : 0.25} />
        ))}

        {/* ── CENTER: Query box ── */}
        <rect x="157" y="38" width="198" height="120" rx="9"
          fill="var(--color-bg-surface)" stroke={INDIGO} strokeWidth="1.5"
          strokeOpacity={0.6} />
        <text x="256" y="58" textAnchor="middle" fontSize="8.5" fontWeight="700"
          fill={INDIGO}>PUSH QUERY</text>
        <text x="175" y="74" fontSize="7.5" fill="var(--color-text-primary)"
          opacity={0.7} fontFamily="monospace">SELECT loan_type,</text>
        <text x="175" y="86" fontSize="7.5" fill="var(--color-text-primary)"
          opacity={0.7} fontFamily="monospace">  amount</text>
        <text x="175" y="98" fontSize="7.5" fill="var(--color-text-primary)"
          opacity={0.7} fontFamily="monospace">FROM applications</text>
        <text x="175" y="110" fontSize="7.5"
          fill={phase === 3 ? AMBER : 'var(--color-text-primary)'}
          opacity={phase === 3 ? wherePulse : 0.7}
          fontFamily="monospace"
          fontWeight={phase === 3 ? '700' : '400'}>
          WHERE loan_type=&apos;MORTGAGE&apos;
        </text>
        <text x="175" y="122" fontSize="7.5" fill={TEAL}
          opacity={0.85} fontFamily="monospace" fontWeight="700">EMIT CHANGES;</text>
        <text x="256" y="148" textAnchor="middle" fontSize="8"
          fill={INDIGO} opacity={0.6}>→ server-push query</text>

        {/* Arrow from ksqlDB to query */}
        <line x1="145" y1="100" x2="155" y2="100"
          stroke={TEAL} strokeWidth="1.5" opacity={0.4}
          markerEnd="url(#ks-arr-t)" />

        {/* Arrow from query to consumer */}
        <line x1="355" y1="100" x2="368" y2="100"
          stroke={TEAL} strokeWidth="1.5" opacity={0.4}
          markerEnd="url(#ks-arr-t)" />

        {/* ── RIGHT: Consumer panel ── */}
        <rect x="370" y="38" width="175" height="168" rx="9"
          fill="var(--color-bg-surface)" stroke={TEAL}
          strokeWidth="1.5" strokeOpacity={0.4} />
        <text x="457" y="55" textAnchor="middle" fontSize="8.5" fontWeight="700"
          fill={TEAL}>CONSUMER</text>

        {/* Column headers */}
        <line x1="370" y1="60" x2="545" y2="60"
          stroke="var(--color-text-primary)" strokeOpacity={0.1} strokeWidth="1" />
        <text x="400" y="72" fontSize="7.5" fill="var(--color-text-primary)"
          opacity={0.45} fontWeight="600">loan_type</text>
        <text x="480" y="72" fontSize="7.5" fill="var(--color-text-primary)"
          opacity={0.45} fontWeight="600">amount</text>

        {/* Streaming rows */}
        <g clipPath="url(#ks-consumer-clip)">
          {visibleRows.map((row, i) => {
            const rowY = 78 + i * 26;
            const isNew = i === visibleRows.length - 1 && phase >= 2;
            const rowOpacity = isNew && (phase === 2 || phase === 4)
              ? Math.min(eased * 2, 1)
              : 1;
            return (
              <g key={row.id} opacity={rowOpacity}>
                <rect x="372" y={rowY} width="171" height="22" rx="3"
                  fill={GREEN} fillOpacity={0.07}
                  stroke={GREEN} strokeWidth={isNew ? 1.2 : 0.5}
                  strokeOpacity={isNew ? 0.7 : 0.3}
                  filter={isNew && (phase === 2 || phase === 4) ? 'url(#ks-glow)' : undefined} />
                <text x="400" y={rowY + 15} fontSize="8" fill={GREEN}
                  fontWeight="600">{row.loan}</text>
                <text x="480" y={rowY + 15} fontSize="8" fill={GREEN}>{row.amount}</text>
              </g>
            );
          })}

          {/* Phase 1: cursor blink with "Waiting..." */}
          {phase <= 1 && (
            <g>
              <text x="385" y="92" fontSize="8" fill="var(--color-text-primary)"
                opacity={0.4}>Waiting for rows</text>
              <rect x="460" y="80" width="2" height="14" rx="1"
                fill={TEAL} opacity={cursorVisible ? 0.9 : 0} />
            </g>
          )}

          {/* Cursor after rows */}
          {phase >= 1 && (
            <rect x="372" y={78 + Math.max(visibleRows.length, 1) * 26}
              width="2" height="14" rx="1"
              fill={TEAL} opacity={cursorVisible ? 0.9 : 0} />
          )}
        </g>

        {/* Row counter */}
        {phase >= 2 && (
          <g opacity={phase === 2 ? eased : 1}>
            <text x="457" y="215" textAnchor="middle" fontSize="9" fontWeight="700"
              fill={TEAL}>{counterVal} rows received</text>
          </g>
        )}

        {/* ── PULL QUERY contrast panel (phase 5+) ── */}
        <g opacity={pullOpacity}>
          <rect x="15" y="175" width="200" height="48" rx="8"
            fill="var(--color-bg-surface)" stroke="var(--color-text-primary)"
            strokeOpacity={0.2} strokeWidth="1" />
          <text x="25" y="192" fontSize="8" fontWeight="600"
            fill="var(--color-text-primary)" opacity={0.5}>PULL QUERY (contrast)</text>
          <text x="25" y="207" fontSize="8" fill="var(--color-text-primary)"
            opacity={0.55} fontFamily="monospace">SELECT COUNT(*)</text>
          <text x="25" y="219" fontSize="8" fill={AMBER}
            fontWeight="700" fontFamily="monospace">→ 127  (snapshot only)</text>
        </g>

        {/* Phase 7 insight */}
        {phase === 7 && (
          <g opacity={insightOpacity}>
            <rect x="30" y="218" width="500" height="22" rx="5"
              fill="rgba(20,184,166,0.1)" stroke={TEAL} strokeWidth="1" />
            <text x="280" y="233" textAnchor="middle" fontSize="9" fontWeight="600"
              fill={TEAL}>
              EMIT CHANGES = server-push. Runs until you close it.
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

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--color-text-primary)', opacity: 0.75 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={TEAL} opacity="0.85" /></svg>
          push query (EMIT CHANGES)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={GREEN} opacity="0.85" /></svg>
          streamed row
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={AMBER} opacity="0.85" /></svg>
          pull query (snapshot)
        </span>
      </div>
    </div>
  );
}
