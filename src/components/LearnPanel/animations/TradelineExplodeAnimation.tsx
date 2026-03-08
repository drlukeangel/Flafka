import './animations.css';
import { useAnimationTick } from './useAnimationTick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_TICKS = 28;
const TOTAL_PHASES = 8;
const HOLD_TICKS = 78; // ~4s pause on insight phase
const NORMAL_CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;
const CYCLE_TICKS = NORMAL_CYCLE_TICKS + HOLD_TICKS;

const JAVA   = '#f59e0b';   // amber — Java UDF
const BLUE   = '#3b82f6';   // blue  — input row
const GREEN  = '#10b981';   // green — output rows
const INDIGO = '#6366f1';   // indigo — insight / LATERAL TABLE

const PHASE_STATUS = [
  'Java TableFunction: LATERAL TABLE explodes an array field into rows',
  'Loan arrives with tradelines array: [MORTGAGE, HELOC, AUTO]',
  'Java ExplodeTradelines() receives the array',
  'MORTGAGE tradeline emitted — row 1 of 3',
  'HELOC tradeline emitted — row 2 of 3',
  'AUTO tradeline emitted — row 3 of 3',
  '1 input row → 3 output rows. LATERAL TABLE joins them back to the loan',
  'LATERAL TABLE(UDF): array explosion with full loan context on every row',
];

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// Tradeline data
// ---------------------------------------------------------------------------

const TRADELINES = [
  { label: 'MORTGAGE', amount: '$285k', color: GREEN,   appearsPhase: 3 },
  { label: 'HELOC',    amount: '$50k',  color: '#14b8a6', appearsPhase: 4 },
  { label: 'AUTO',     amount: '$25k',  color: BLUE,    appearsPhase: 5 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TradelineExplodeAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const inHold = tick >= NORMAL_CYCLE_TICKS;
  const phase = inHold ? TOTAL_PHASES - 1 : Math.floor(tick / PHASE_TICKS);
  const phaseProgress = inHold ? 1 : (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Input row slides in
  const inputX = phase === 0 ? -190 : phase === 1 ? -190 + eased * 195 : 5;
  const inputVisible = phase >= 1;

  // UDF box glow during processing
  const udfGlow = (phase >= 2 && phase <= 5)
    ? 0.15 + 0.1 * Math.sin(phaseProgress * Math.PI * 4)
    : 0.08;
  const udfProcessing = phase >= 2 && phase <= 5;

  // LATERAL TABLE label only visible in phase 6 — hidden in phase 7 to avoid overlap
  const lateralOpacity = phase === 6 ? eased : 0;

  // Insight
  const insightOpacity = phase === 7 ? (inHold ? 1 : eased) : 0;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="Java table UDF LATERAL TABLE animation exploding tradeline array into individual rows">
        <defs>
          <filter id="tl-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id="tl-input-clip">
            <rect x="5" y="25" width="168" height="185" />
          </clipPath>
          <marker id="tl-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={INDIGO} opacity="0.6" />
          </marker>
        </defs>

        {/* ── HEADER BADGE ── */}
        <rect x="8" y="6" width="195" height="16" rx="4"
          fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x="105" y="18" textAnchor="middle" fontSize="8.5" fontWeight="600" fontFamily="monospace"
          fill="var(--color-text-primary)" opacity={0.8}>LATERAL TABLE(ExplodeTradelines())</text>

        {/* ── INPUT ROW ── */}
        <g clipPath="url(#tl-input-clip)" opacity={inputVisible ? 1 : 0}>
          <rect x={inputX} y="25" width="168" height="185" rx="8"
            fill="var(--color-bg-surface)" stroke={BLUE} strokeWidth="1.5" strokeOpacity={0.5} />
          <text x={inputX + 8} y="40" fontSize="7.5" fontWeight="700"
            fill={BLUE} opacity={0.6} fontFamily="monospace">loan_id: L-001</text>
          <text x={inputX + 8} y="52" fontSize="7" fill="var(--color-text-primary)" opacity={0.5} fontFamily="monospace">
            amount: $360k
          </text>
          <text x={inputX + 8} y="64" fontSize="7.5" fontWeight="700"
            fill={JAVA} opacity={0.8} fontFamily="monospace">tradelines: [</text>
          {/* MORTGAGE */}
          <rect x={inputX + 10} y="68" width="140" height="26" rx="4"
            fill={GREEN} fillOpacity={0.08} stroke={GREEN} strokeWidth="1" />
          <text x={inputX + 18} y="80" fontSize="7" fill={GREEN} fontFamily="monospace">type: MORTGAGE</text>
          <text x={inputX + 18} y="89" fontSize="7" fill={GREEN} fontFamily="monospace">balance: $285k</text>
          {/* HELOC */}
          <rect x={inputX + 10} y="97" width="140" height="26" rx="4"
            fill="#14b8a6" fillOpacity={0.08} stroke="#14b8a6" strokeWidth="1" />
          <text x={inputX + 18} y="109" fontSize="7" fill="#14b8a6" fontFamily="monospace">type: HELOC</text>
          <text x={inputX + 18} y="118" fontSize="7" fill="#14b8a6" fontFamily="monospace">balance: $50k</text>
          {/* AUTO */}
          <rect x={inputX + 10} y="126" width="140" height="26" rx="4"
            fill={BLUE} fillOpacity={0.08} stroke={BLUE} strokeWidth="1" />
          <text x={inputX + 18} y="138" fontSize="7" fill={BLUE} fontFamily="monospace">type: AUTO</text>
          <text x={inputX + 18} y="147" fontSize="7" fill={BLUE} fontFamily="monospace">balance: $25k</text>
          <text x={inputX + 8} y="160" fontSize="7.5" fontWeight="700"
            fill={JAVA} opacity={0.8} fontFamily="monospace">]</text>
        </g>

        {!inputVisible && (
          <rect x="5" y="25" width="168" height="185" rx="8"
            fill="none" stroke="var(--color-text-primary)" strokeWidth="1"
            strokeOpacity={0.12} strokeDasharray="4,3" />
        )}

        {/* ── ARROW input → UDF ── */}
        {phase >= 2 && (
          <line x1="175" y1="117" x2="198" y2="117"
            stroke={INDIGO} strokeWidth="1.8" opacity={0.6}
            markerEnd="url(#tl-arr)" />
        )}

        {/* ── UDF BOX ── */}
        <rect x="200" y="72" width="120" height="90" rx="10"
          fill={JAVA} fillOpacity={udfGlow}
          stroke={JAVA} strokeWidth="1.8"
          filter={udfProcessing ? 'url(#tl-glow)' : undefined} />
        {/* Java badge */}
        <rect x="210" y="78" width="30" height="12" rx="4"
          fill={JAVA} opacity={0.85} />
        <text x="225" y="88" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">Java</text>
        <text x="260" y="95" textAnchor="middle" fontSize="8" fontWeight="700" fill={JAVA}>ExplodeTradelines</text>
        <text x="260" y="107" textAnchor="middle" fontSize="8" fontWeight="700" fill={JAVA}>()</text>
        <text x="260" y="121" textAnchor="middle" fontSize="7.5" fill={JAVA} opacity={0.7}>TableFunction</text>
        <text x="260" y="133" textAnchor="middle" fontSize="7" fill={JAVA} opacity={0.55}>
          {phase <= 1 ? 'waiting…' :
           phase === 2 ? 'receiving array…' :
           phase === 3 ? 'emitting row 1…' :
           phase === 4 ? 'emitting row 2…' :
           phase === 5 ? 'emitting row 3…' :
           'done ✓ (3 rows)'}
        </text>

        {/* ── ARROW UDF → output ── */}
        {phase >= 3 && (
          <line x1="320" y1="117" x2="338" y2="117"
            stroke={INDIGO} strokeWidth="1.8" opacity={0.5}
            markerEnd="url(#tl-arr)" />
        )}

        {/* ── OUTPUT ROWS ── */}
        {TRADELINES.map((tl, i) => {
          const visible = phase >= tl.appearsPhase;
          const slideIn = phase === tl.appearsPhase ? 340 + eased * 8 : 348;
          const opacity = visible ? (phase === tl.appearsPhase ? eased : 1) : 0;
          const y = 38 + i * 56;

          return (
            <g key={tl.label} opacity={opacity}>
              <rect x={slideIn} y={y} width="190" height="46" rx="6"
                fill={tl.color} fillOpacity={0.08}
                stroke={tl.color} strokeWidth="1.5"
                filter={phase === tl.appearsPhase ? 'url(#tl-glow)' : undefined} />
              <text x={slideIn + 8} y={y + 14} fontSize="7.5" fontWeight="700"
                fill={tl.color} opacity={0.75}>loan_id: L-001</text>
              <text x={slideIn + 8} y={y + 26} fontSize="8" fontWeight="700"
                fill={tl.color} fontFamily="monospace">type: {tl.label}</text>
              <text x={slideIn + 8} y={y + 38} fontSize="8" fontWeight="600"
                fill={tl.color} fontFamily="monospace">balance: {tl.amount}</text>
              <text x={slideIn + 178} y={y + 12} textAnchor="end" fontSize="7"
                fill={tl.color} opacity={0.55}>row {i + 1}/3</text>
            </g>
          );
        })}

        {/* ── LATERAL TABLE label (phase 6) ── */}
        <g opacity={lateralOpacity}>
          <rect x="140" y="208" width="280" height="30" rx="7"
            fill={INDIGO} fillOpacity={0.07} stroke={INDIGO} strokeWidth="1.2" />
          <text x="280" y="221" textAnchor="middle" fontSize="9" fontWeight="700"
            fill={INDIGO}>1 input row → 3 output rows</text>
          <text x="280" y="232" textAnchor="middle" fontSize="7.5"
            fill={INDIGO} opacity={0.7}>LATERAL TABLE joins each emitted row back to the loan</text>
        </g>

        {/* ── INSIGHT (phase 7) ── */}
        {phase === 7 && (
          <g opacity={insightOpacity}>
            <rect x="30" y="213" width="500" height="28" rx="6"
              fill="rgba(245,158,11,0.08)" stroke={JAVA} strokeWidth="1.2" />
            <text x="280" y="225" textAnchor="middle" fontSize="9" fontWeight="700" fill={JAVA}>
              LATERAL TABLE(UDF): Java generates N rows, SQL joins them back
            </text>
            <text x="280" y="237" textAnchor="middle" fontSize="8" fill={JAVA} opacity={0.75}>
              loan_id and amount appear on every output row — full context preserved
            </text>
          </g>
        )}

        {/* ── STATUS BAR ── */}
        <rect x="0" y="255" width="560" height="40" fill="rgba(255,255,255,0.025)" />
        {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
          <circle key={i} cx={200 + i * 20} cy={265} r={i === phase ? 4 : 2.5}
            fill={i === phase ? JAVA : 'var(--color-text-primary)'}
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
          input row (with array)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={JAVA} opacity="0.85" /></svg>
          Java TableFunction
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={GREEN} opacity="0.85" /></svg>
          exploded output rows
        </span>
      </div>
    </div>
  );
}
