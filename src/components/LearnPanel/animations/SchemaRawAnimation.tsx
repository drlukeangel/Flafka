import './animations.css';
import { useAnimationTick } from './useAnimationTick';

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const HOLD_TICKS = 78; // ~4s pause on insight phase
const NORMAL_CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;
const CYCLE_TICKS = NORMAL_CYCLE_TICKS + HOLD_TICKS;

const GREEN = '#10b981';
const BLUE = '#3b82f6';
const AMBER = '#f59e0b';
const INDIGO = '#6366f1';
const TEAL = '#14b8a6';

const PHASE_STATUS = [
  "value.format='raw': topic delivers raw VARBINARY bytes",
  'Raw bytes arrive: 0x7B 0x22 0x65 0x76...',
  "CAST(val AS STRING) → JSON string visible",
  "JSON_VALUE extracts event_id from '$.event_id'",
  'event_type, user_id, amount extracted via JSON_VALUE',
  'CAST(amount AS DOUBLE) — type conversion applied',
  'Clean typed output row — all columns extracted and named',
  "No schema registry? No problem. value.format='raw' + JSON_VALUE.",
];

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

const HEX_BYTES = ['0x7B', '0x22', '0x65', '0x76', '0x65', '0x6E', '0x74', '0x5F', '0x69', '0x64', '0x22', '0x3A'];

interface OutputCol {
  name: string;
  value: string;
  type: string;
  color: string;
  appearsPhase: number;
}

const OUTPUT_COLS: OutputCol[] = [
  { name: 'event_id',   value: '"E-001"',           type: 'STRING',  color: BLUE,   appearsPhase: 3 },
  { name: 'event_type', value: '"LOAN_APPLICATION"', type: 'STRING',  color: TEAL,   appearsPhase: 4 },
  { name: 'user_id',    value: '"U-042"',            type: 'STRING',  color: INDIGO, appearsPhase: 5 },
  { name: 'amount',     value: '1500.0',             type: 'DOUBLE',  color: AMBER,  appearsPhase: 6 },
];

const JSON_STR = '{"event_id":"E-001","event_type":"LOAN_APPLICATION","user_id":"U-042","amount":"1500.00"}';

export function SchemaRawAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const inHold = tick >= NORMAL_CYCLE_TICKS;
  const phase = inHold ? TOTAL_PHASES - 1 : Math.floor(tick / PHASE_TICKS);
  const phaseProgress = inHold ? 1 : (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Bytes appear in phase 1
  const bytesOpacity = phase >= 1 ? (phase === 1 ? eased : 1) : 0;

  // CAST box glow (phase 2)
  const castGlow = phase === 2
    ? 0.12 + 0.08 * Math.sin(phaseProgress * Math.PI * 4)
    : 0.07;

  // JSON string visible from phase 2
  const jsonStrOpacity = phase >= 2 ? (phase === 2 ? eased : 1) : 0;

  // Hex bytes fade out when JSON string appears
  const hexFadeOpacity = phase >= 2 ? Math.max(0, 1 - eased * 1.5) : 1;

  // JSON_VALUE arrows visible from phase 3
  const arrowOpacity = phase >= 3 ? (phase === 3 ? eased : 1) : 0;

  // Amount type label (phase 6) — hidden in phase 7 to avoid overlap with insight
  const typeOpacity = phase === 6 ? eased : 0;

  const insightOpacity = phase === 7 ? (inHold ? 1 : eased) : 0;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="value.format=raw animation showing raw VARBINARY bytes parsed via CAST and JSON_VALUE into typed columns">
        <defs>
          <filter id="sr-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="sr-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-text-primary)" opacity="0.35" />
          </marker>
          <marker id="sr-arr-g" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={GREEN} opacity="0.6" />
          </marker>
          <marker id="sr-arr-b" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={BLUE} opacity="0.6" />
          </marker>
        </defs>

        {/* ── TOP LABEL ── */}
        <text x="280" y="18" textAnchor="middle" fontSize="9.5" fontWeight="700"
          fill={BLUE} opacity={0.7} fontFamily="monospace">value.format=&apos;raw&apos;</text>

        {/* ── LEFT: Raw bytes panel ── */}
        <rect x="15" y="26" width="175" height="90" rx="8"
          fill="var(--color-bg-surface)" stroke={BLUE} strokeWidth="1.5"
          strokeOpacity={0.4} />
        <text x="25" y="42" fontSize="8.5" fontWeight="700"
          fill={BLUE} opacity={0.6}>RAW VARBINARY</text>

        {/* Hex bytes */}
        <g opacity={bytesOpacity * hexFadeOpacity}
          filter={phase === 1 ? 'url(#sr-glow)' : undefined}>
          {HEX_BYTES.map((byte, i) => (
            <text key={i}
              x={25 + (i % 4) * 43}
              y={57 + Math.floor(i / 4) * 16}
              fontSize="8.5" fontFamily="monospace"
              fill={BLUE} fontWeight="600">
              {byte}
            </text>
          ))}
          <text x="25" y="105" fontSize="7.5" fill={BLUE} opacity={0.5}
            fontFamily="monospace">... (cont.)</text>
        </g>

        {/* Arrow: hex → CAST box */}
        <line x1="192" y1="72" x2="208" y2="72"
          stroke={BLUE} strokeWidth="1.5" opacity={0.4}
          markerEnd="url(#sr-arr-b)" />

        {/* ── CENTER-LEFT: CAST box ── */}
        <rect x="210" y="48" width="115" height="48" rx="8"
          fill={BLUE} fillOpacity={castGlow}
          stroke={BLUE} strokeWidth="1.5"
          filter={phase === 2 ? 'url(#sr-glow)' : undefined} />
        <text x="267" y="67" textAnchor="middle" fontSize="8.5" fontWeight="700"
          fill={BLUE}>CAST(val AS</text>
        <text x="267" y="81" textAnchor="middle" fontSize="8.5" fontWeight="700"
          fill={BLUE}>STRING)</text>

        {/* JSON string result below CAST box */}
        <g opacity={jsonStrOpacity}>
          <rect x="15" y="125" width="310" height="36" rx="6"
            fill={GREEN} fillOpacity={0.07}
            stroke={GREEN} strokeWidth="1.2"
            filter={phase === 2 ? 'url(#sr-glow)' : undefined} />
          <text x="22" y="138" fontSize="7" fill={GREEN} fontFamily="monospace">
            {JSON_STR.slice(0, 48)}
          </text>
          <text x="22" y="152" fontSize="7" fill={GREEN} fontFamily="monospace">
            {JSON_STR.slice(48)}
          </text>
        </g>

        {/* Arrow from JSON string to JSON_VALUE box */}
        {phase >= 3 && (
          <line x1="327" y1="143" x2="342" y2="143"
            stroke={GREEN} strokeWidth="1.5" opacity={0.5}
            markerEnd="url(#sr-arr-g)" />
        )}

        {/* ── CENTER-RIGHT: JSON_VALUE extraction box ── */}
        <rect x="344" y="26" width="100" height="140" rx="8"
          fill="var(--color-bg-surface)" stroke={GREEN}
          strokeWidth="1.2" strokeOpacity={0.35} />
        <text x="394" y="44" textAnchor="middle" fontSize="8" fontWeight="700"
          fill={GREEN}>JSON_VALUE</text>

        {/* Extraction arrows */}
        {OUTPUT_COLS.map((col, i) => {
          const y = 60 + i * 28;
          const visible = phase >= col.appearsPhase;
          return (
            <g key={col.name} opacity={visible ? (phase === col.appearsPhase ? eased : 1) : 0.15}>
              <line x1="344" y1={y} x2="330" y2={y}
                stroke={col.color} strokeWidth="1.2" opacity={arrowOpacity * (visible ? 1 : 0.1)} />
              <text x="347" y={y + 4} fontSize="7.5" fill={col.color}
                fontFamily="monospace" fontWeight={visible ? '600' : '400'}>
                $.{col.name}
              </text>
            </g>
          );
        })}

        {/* ── RIGHT: Output columns ── */}
        {OUTPUT_COLS.map((col, i) => {
          const visible = phase >= col.appearsPhase;
          const y = 30 + i * 44;
          const opacity = visible ? (phase === col.appearsPhase ? eased : 1) : 0;

          return (
            <g key={`out-${col.name}`} opacity={opacity}>
              <rect x="450" y={y} width="95" height="36" rx="6"
                fill={col.color} fillOpacity={0.08}
                stroke={col.color} strokeWidth="1.3"
                filter={phase === col.appearsPhase ? 'url(#sr-glow)' : undefined} />
              <text x="458" y={y + 13} fontSize="7.5" fill={col.color}
                fontWeight="600" opacity={0.75}>{col.name}</text>
              <text x="458" y={y + 27} fontSize="8" fill={col.color}
                fontFamily="monospace" fontWeight="700">{col.value}</text>
            </g>
          );
        })}

        {/* ── PHASE 6: Type conversion label ── */}
        <g opacity={typeOpacity}>
          <rect x="450" y="206" width="95" height="20" rx="4"
            fill={AMBER} fillOpacity={0.1} stroke={AMBER} strokeWidth="1" />
          <text x="497" y="220" textAnchor="middle" fontSize="7.5"
            fill={AMBER} fontWeight="700">CAST → DOUBLE</text>
        </g>

        {/* Phase 7 insight */}
        {phase === 7 && (
          <g opacity={insightOpacity}>
            <rect x="20" y="218" width="520" height="22" rx="5"
              fill="rgba(59,130,246,0.1)" stroke={BLUE} strokeWidth="1" />
            <text x="280" y="233" textAnchor="middle" fontSize="9" fontWeight="600"
              fill={BLUE}>
              No schema registry? No problem. value.format=&apos;raw&apos; + JSON_VALUE.
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
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={BLUE} opacity="0.85" /></svg>
          raw VARBINARY bytes
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={GREEN} opacity="0.85" /></svg>
          CAST → STRING
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={AMBER} opacity="0.85" /></svg>
          typed output column
        </span>
      </div>
    </div>
  );
}
