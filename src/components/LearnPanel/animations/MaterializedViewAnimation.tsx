import './animations.css';
import { useAnimationTick } from './useAnimationTick';

const PHASE_TICKS = 36;
const TOTAL_PHASES = 8;
const CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;

const GREEN = '#10b981';
const RED = '#ef4444';
const BLUE = '#3b82f6';
const AMBER = '#f59e0b';
const INDIGO = '#6366f1';

const PHASE_STATUS = [
  'Materialized view: always-current GROUP BY result table',
  'Loan A SUBMITTED — view creates row A (INSERT)',
  'Loan A PENDING — view RETRACTS old row, EMITS updated row',
  'Loan B SUBMITTED — second row created',
  'Loan A APPROVED — retract + emit again',
  'Changelog stream shows retract (-) then emit (+)',
  'View snapshot: A=APPROVED, B=SUBMITTED — live state',
  'A materialized view is always current. No polling, no batch.',
];

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// Input events appearing on the left
const INPUT_EVENTS = [
  { label: 'A: SUBMITTED', color: BLUE },
  { label: 'A: PENDING',   color: AMBER },
  { label: 'B: SUBMITTED', color: BLUE },
  { label: 'A: APPROVED',  color: GREEN },
];

export function MaterializedViewAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const phase = Math.floor(tick / PHASE_TICKS);
  const phaseProgress = (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Which input events are visible
  const visibleEvents = phase >= 1 ? Math.min(phase, 4) : 0;

  // View row A state per phase
  const rowAStatus =
    phase === 0 ? null :
    phase === 1 ? 'SUBMITTED' :
    phase === 2 ? 'PENDING' :
    phase >= 3 && phase <= 4 ? 'PENDING' :
    'APPROVED';

  const rowBVisible = phase >= 3;

  // Flash color for retract/emit in phases 2 and 4
  const rowAFlash =
    (phase === 2 && phaseProgress < 0.45) ? RED :
    (phase === 2 && phaseProgress >= 0.45) ? GREEN :
    (phase === 4 && phaseProgress < 0.45) ? RED :
    (phase === 4 && phaseProgress >= 0.45) ? GREEN :
    null;

  const rowAFlashOpacity =
    (phase === 2 || phase === 4)
      ? (phaseProgress < 0.45 ? eased * 0.5 : (1 - eased) * 0.5)
      : 0;

  // Changelog entries visible in phase 5+
  const changelogEntries: { label: string; color: string }[] =
    phase >= 5 && phase < 7
      ? [
          { label: '-A(PENDING)', color: RED },
          { label: '+A(APPROVED)', color: GREEN },
        ]
      : [];

  // Final highlight in phase 6
  const finalHighlight = phase >= 6;

  const insightOpacity = phase === 7 ? eased : 0;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="Materialized view animation showing GROUP BY retract and emit changelog">
        <defs>
          <filter id="mv-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="mv-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-text-primary)" opacity="0.35" />
          </marker>
          <marker id="mv-arr-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={BLUE} opacity="0.7" />
          </marker>
        </defs>

        {/* ── LEFT: Input event stream ── */}
        <text x="20" y="18" fontSize="9" fill="var(--color-text-primary)" opacity={0.5} fontWeight="600">
          INPUT STREAM
        </text>
        {INPUT_EVENTS.map((ev, i) => {
          const visible = i < visibleEvents;
          const y = 30 + i * 36;
          return (
            <g key={i} opacity={visible ? 1 : 0.15}>
              <rect x="15" y={y} width="140" height="24" rx="5"
                fill={ev.color} fillOpacity={visible ? 0.12 : 0.05}
                stroke={ev.color} strokeWidth="1.2" />
              <text x="85" y={y + 15} textAnchor="middle" fontSize="9"
                fontWeight="600" fill={ev.color}>{ev.label}</text>
            </g>
          );
        })}

        {/* Arrow from input to SQL box */}
        <line x1="158" y1="95" x2="210" y2="95"
          stroke="var(--color-text-primary)" strokeWidth="1.5" opacity={0.25}
          markerEnd="url(#mv-arr)" />

        {/* ── CENTER: SQL GROUP BY box ── */}
        <rect x="210" y="60" width="140" height="70" rx="8"
          fill={INDIGO} fillOpacity={0.08} stroke={INDIGO} strokeWidth="1.5" />
        <text x="280" y="82" textAnchor="middle" fontSize="9" fontWeight="700"
          fill={INDIGO}>GROUP BY</text>
        <text x="280" y="97" textAnchor="middle" fontSize="8"
          fill={INDIGO} opacity={0.8} fontFamily="monospace">loan_id</text>
        <text x="280" y="113" textAnchor="middle" fontSize="8"
          fill={INDIGO} opacity={0.7}>→ materialized view</text>

        {/* Arrow from SQL box to view table */}
        <line x1="350" y1="95" x2="368" y2="95"
          stroke={BLUE} strokeWidth="1.5" opacity={0.4}
          markerEnd="url(#mv-arr-blue)" />

        {/* ── RIGHT: Live view table ── */}
        <rect x="370" y="45" width="170" height="120" rx="8"
          fill="var(--color-bg-surface)" stroke="var(--color-text-primary)" strokeOpacity={0.15}
          strokeWidth="1.5" />
        <text x="455" y="62" textAnchor="middle" fontSize="9" fontWeight="700"
          fill="var(--color-text-primary)" opacity={0.7}>LIVE VIEW</text>

        {/* Header row */}
        <line x1="370" y1="67" x2="540" y2="67" stroke="var(--color-text-primary)" strokeOpacity={0.1} strokeWidth="1" />
        <text x="395" y="80" fontSize="8" fill="var(--color-text-primary)" opacity={0.45} fontWeight="600">loan_id</text>
        <text x="465" y="80" fontSize="8" fill="var(--color-text-primary)" opacity={0.45} fontWeight="600">status</text>

        {/* Row A */}
        {rowAStatus && (
          <g>
            {/* Flash overlay */}
            {rowAFlash && (
              <rect x="372" y="83" width="166" height="22" rx="4"
                fill={rowAFlash} opacity={rowAFlashOpacity} />
            )}
            <rect x="372" y="83" width="166" height="22" rx="4"
              fill={finalHighlight && phase >= 6 ? GREEN : BLUE}
              fillOpacity={finalHighlight && phase >= 6 ? 0.12 : 0.08}
              stroke={finalHighlight && phase >= 6 ? GREEN : BLUE}
              strokeWidth={finalHighlight && phase >= 6 ? 1.5 : 1}
              opacity={phase === 1 ? eased : 1}
              filter={phase === 2 || phase === 4 ? 'url(#mv-glow)' : undefined} />
            <text x="395" y="98" fontSize="9" fontWeight="600"
              fill={finalHighlight && phase >= 6 ? GREEN : BLUE}>A</text>
            <text x="465" y="98" fontSize="9" fontWeight="600"
              fill={finalHighlight && phase >= 6 ? GREEN : BLUE}>{rowAStatus}</text>
          </g>
        )}

        {/* Row B */}
        {rowBVisible && (
          <g opacity={phase === 3 ? eased : 1}>
            <rect x="372" y="108" width="166" height="22" rx="4"
              fill={finalHighlight && phase >= 6 ? AMBER : BLUE}
              fillOpacity={finalHighlight && phase >= 6 ? 0.12 : 0.08}
              stroke={finalHighlight && phase >= 6 ? AMBER : BLUE}
              strokeWidth={finalHighlight && phase >= 6 ? 1.5 : 1} />
            <text x="395" y="123" fontSize="9" fontWeight="600"
              fill={finalHighlight && phase >= 6 ? AMBER : BLUE}>B</text>
            <text x="465" y="123" fontSize="9" fontWeight="600"
              fill={finalHighlight && phase >= 6 ? AMBER : BLUE}>SUBMITTED</text>
          </g>
        )}

        {/* ── BOTTOM: Changelog strip ── */}
        <rect x="15" y="195" width="530" height="50" rx="6"
          fill="rgba(255,255,255,0.07)" stroke="var(--color-text-primary)"
          strokeOpacity={0.25} strokeWidth="1" />
        <text x="25" y="211" fontSize="8" fill="var(--color-text-primary)"
          opacity={0.45} fontWeight="600">CHANGELOG STREAM</text>

        {changelogEntries.map((entry, i) => (
          <g key={i} opacity={phase === 5 ? Math.min(eased * 2 - i * 0.5, 1) : 1}>
            <rect x={25 + i * 140} y="217" width="130" height="22" rx="4"
              fill={entry.color} fillOpacity={0.1}
              stroke={entry.color} strokeWidth="1.2" />
            <text x={90 + i * 140} y="231" textAnchor="middle" fontSize="9"
              fontWeight="700" fill={entry.color} fontFamily="monospace">
              {entry.label}
            </text>
          </g>
        ))}

        {/* Phase 7 insight — replaces changelog entries in the strip */}
        {phase === 7 && (
          <g opacity={insightOpacity}>
            <rect x="20" y="205" width="520" height="30" rx="5"
              fill="rgba(99,102,241,0.14)" stroke={INDIGO} strokeWidth="1.2" />
            <text x="280" y="221" textAnchor="middle" fontSize="9.5" fontWeight="600"
              fill={INDIGO}>
              No polling, no batch. Flink recomputes on every event — always current.
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
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={GREEN} opacity="0.85" /></svg>
          INSERT / emit
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={RED} opacity="0.85" /></svg>
          RETRACT
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={INDIGO} opacity="0.85" /></svg>
          GROUP BY view
        </span>
      </div>
    </div>
  );
}
