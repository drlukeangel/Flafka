import './animations.css';
import { useAnimationTick } from './useAnimationTick';

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const HOLD_TICKS = 78; // ~4s pause on insight phase before cycling
const NORMAL_CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;
const CYCLE_TICKS = NORMAL_CYCLE_TICKS + HOLD_TICKS;

const GREEN = '#10b981';
const BLUE = '#3b82f6';
const INDIGO = '#6366f1';
const AMBER = '#f59e0b';

const PHASE_STATUS = [
  'UDF transforms one row at a time — scalar, stateless, inline',
  'Raw JSON payload arrives — 7-level nested structure',
  'UDF receives JSON — parsing begins',
  'applicant_name extracted from nested path',
  'loan_type, credit_score, risk_level extracted',
  'Clean flat row emerges from UDF box',
  'Called once per row — linear scale with zero state',
  'UDFs run in the task manager JVM. No network, no latency spikes.',
];

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

const JSON_LINES = [
  '{',
  '  "application": {',
  '    "applicant": {',
  '      "name": {',
  '        "first": "Alice"',
  '      },',
  '    },',
  '    "loan": {',
  '      "type": "MORTGAGE"',
  '    }',
  '  },',
  '  "underwriting": {',
  '    "risk_assessment": {',
  '      "credit_analysis": {',
  '        "score": 720',
  '      }',
  '    }',
  '  }',
  '}',
];

interface OutputField {
  name: string;
  value: string;
  color: string;
  appearsPhase: number;
}

const OUTPUT_FIELDS: OutputField[] = [
  { name: 'applicant_name', value: '"Alice"',    color: GREEN,  appearsPhase: 3 },
  { name: 'loan_type',      value: '"MORTGAGE"', color: BLUE,   appearsPhase: 4 },
  { name: 'credit_score',   value: '720',        color: AMBER,  appearsPhase: 4 },
  { name: 'risk_level',     value: '"LOW"',      color: INDIGO, appearsPhase: 5 },
];

export function UdfTransformAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const inHold = tick >= NORMAL_CYCLE_TICKS;
  const phase = inHold ? TOTAL_PHASES - 1 : Math.floor(tick / PHASE_TICKS);
  const phaseProgress = inHold ? 1 : (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // JSON input rect slides in from left in phase 1
  const inputRectX = phase === 0 ? -180 : phase === 1 ? -180 + eased * 198 : 18;
  const inputVisible = phase >= 1;

  // UDF box glow
  const udfGlow = phase === 2 || phase === 3 || phase === 4 || phase === 5
    ? 0.12 + 0.08 * Math.sin(phaseProgress * Math.PI * 4)
    : 0.07;

  // Arrow from input to UDF (phase 2+)
  const arrowInputOpacity = phase >= 2 ? Math.min((phase === 2 ? eased : 1), 1) : 0;

  // Scale label (phase 6)
  // Scale label only visible in phase 6 — hidden in phase 7 to avoid overlap with insight
  const scaleOpacity = phase === 6 ? eased : 0;

  // Insight fades in at phase 7 start, then holds full opacity during HOLD_TICKS
  const insightOpacity = phase === 7 ? (inHold ? 1 : eased) : 0;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="Scalar UDF animation showing nested JSON transformed into flat structured columns">
        <defs>
          <filter id="udf-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id="udf-input-clip">
            <rect x="18" y="35" width="165" height="175" />
          </clipPath>
          <marker id="udf-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={INDIGO} opacity="0.6" />
          </marker>
        </defs>

        {/* ── LEFT: Input JSON rect ── */}
        <g clipPath="url(#udf-input-clip)" opacity={inputVisible ? 1 : 0}>
          <rect x={inputRectX} y="35" width="165" height="175" rx="8"
            fill="var(--color-bg-surface)" stroke={BLUE} strokeWidth="1.5"
            strokeOpacity={0.5} />
          <text x={inputRectX + 8} y="52" fontSize="7.5" fontWeight="700"
            fill={BLUE} opacity={0.6} fontFamily="monospace">JSON payload</text>
          {JSON_LINES.map((line, i) => (
            <text key={i} x={inputRectX + 6} y={63 + i * 9.5}
              fontSize="7" fill="var(--color-text-primary)" opacity={0.65}
              fontFamily="monospace">{line}</text>
          ))}
        </g>

        {/* Input rect border (always visible as placeholder) */}
        {!inputVisible && (
          <rect x="18" y="35" width="165" height="175" rx="8"
            fill="none" stroke="var(--color-text-primary)" strokeWidth="1"
            strokeOpacity={0.12} strokeDasharray="4,3" />
        )}

        {/* ── ARROW: input → UDF ── */}
        <line x1="185" y1="122" x2="210" y2="122"
          stroke={INDIGO} strokeWidth="1.8" opacity={arrowInputOpacity}
          markerEnd="url(#udf-arr)" />

        {/* ── CENTER: UDF box ── */}
        <rect x="212" y="75" width="138" height="95" rx="10"
          fill={INDIGO} fillOpacity={udfGlow}
          stroke={INDIGO} strokeWidth="1.8"
          filter={phase >= 2 && phase <= 5 ? 'url(#udf-glow)' : undefined} />
        <text x="248" y="101" textAnchor="middle" fontSize="18"
          fill={INDIGO} opacity={0.85 + udfGlow * 0.1}>⚙</text>
        <text x="300" y="98" textAnchor="middle" fontSize="8.5" fontWeight="700"
          fill={INDIGO}>LoanDetail</text>
        <text x="300" y="112" textAnchor="middle" fontSize="8.5" fontWeight="700"
          fill={INDIGO}>Extract()</text>
        <text x="281" y="130" textAnchor="middle" fontSize="7.5"
          fill={INDIGO} opacity={0.7}>scalar UDF</text>
        <text x="281" y="143" textAnchor="middle" fontSize="7"
          fill={INDIGO} opacity={0.55}>
          {phase === 2 ? 'parsing JSON…' :
           phase === 3 ? 'extracting name…' :
           phase === 4 ? 'extracting fields…' :
           phase >= 5 ? 'done ✓' : 'waiting…'}
        </text>

        {/* ── ARROW: UDF → output ── */}
        {phase >= 3 && (
          <line x1="350" y1="122" x2="368" y2="122"
            stroke={INDIGO} strokeWidth="1.8" opacity={0.5}
            markerEnd="url(#udf-arr)" />
        )}

        {/* ── RIGHT: Output fields ── */}
        {OUTPUT_FIELDS.map((f, i) => {
          const visible = phase >= f.appearsPhase;
          const slideIn = phase === f.appearsPhase
            ? 368 + eased * 10
            : 378;
          const opacity = visible ? (phase === f.appearsPhase ? eased : 1) : 0;
          const y = 48 + i * 44;

          return (
            <g key={f.name} opacity={opacity}>
              <rect x={slideIn} y={y} width="168" height="36" rx="6"
                fill={f.color} fillOpacity={0.08}
                stroke={f.color} strokeWidth="1.5"
                filter={phase === f.appearsPhase ? 'url(#udf-glow)' : undefined} />
              <text x={slideIn + 8} y={y + 14} fontSize="8" fontWeight="700"
                fill={f.color} opacity={0.75}>{f.name}</text>
              <text x={slideIn + 8} y={y + 28} fontSize="9" fontWeight="600"
                fill={f.color} fontFamily="monospace">{f.value}</text>
            </g>
          );
        })}

        {/* ── PHASE 6: Scale label ── */}
        <g opacity={scaleOpacity}>
          <rect x="155" y="200" width="250" height="28" rx="7"
            fill={GREEN} fillOpacity={0.08} stroke={GREEN} strokeWidth="1.2" />
          <text x="280" y="214" textAnchor="middle" fontSize="9" fontWeight="700"
            fill={GREEN}>1:1 — called once per row</text>
          <text x="280" y="224" textAnchor="middle" fontSize="7.5"
            fill={GREEN} opacity={0.7}>linear scale · zero state · zero coordination</text>
        </g>

        {/* Phase 7 insight */}
        {phase === 7 && (
          <g opacity={insightOpacity}>
            <rect x="30" y="218" width="500" height="22" rx="5"
              fill="rgba(99,102,241,0.1)" stroke={INDIGO} strokeWidth="1" />
            <text x="280" y="233" textAnchor="middle" fontSize="9" fontWeight="600"
              fill={INDIGO}>
              UDFs run in the task manager JVM. No network, no latency spikes.
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
          nested JSON input
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={INDIGO} opacity="0.85" /></svg>
          scalar UDF
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={GREEN} opacity="0.85" /></svg>
          flat output columns
        </span>
      </div>
    </div>
  );
}
