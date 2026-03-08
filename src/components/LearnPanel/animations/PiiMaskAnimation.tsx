import './animations.css';
import { useAnimationTick } from './useAnimationTick';

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const HOLD_TICKS = 78; // ~4s pause on insight phase
const NORMAL_CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;
const CYCLE_TICKS = NORMAL_CYCLE_TICKS + HOLD_TICKS;

const GREEN = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const INDIGO = '#6366f1';

const PHASE_STATUS = [
  'Raw input: name, SSN, email, loan_id all visible',
  'Input row arrives — all fields exposed',
  'Name masked: John Doe → J*** D**',
  'SSN masked: 123-45-6789 → ***-**-6789',
  'Email masked: john@example.com → j***@example.com',
  'loan_id hashed: SHA-256 hex string replaces plain ID',
  'Masked output row — zero raw PII downstream',
  'Masking runs inline at ingest. Raw PII never reaches the output topic.',
];

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

interface FieldDef {
  label: string;
  rawValue: string;
  maskedValue: string;
  x: number;
  w: number;
  rawColor: string;
  maskedPhase: number;
}

const FIELDS: FieldDef[] = [
  { label: 'name',    rawValue: 'John Doe',          maskedValue: 'J*** D**',          x: 20,  w: 120, rawColor: RED,   maskedPhase: 2 },
  { label: 'ssn',     rawValue: '123-45-6789',        maskedValue: '***-**-6789',        x: 150, w: 110, rawColor: RED,   maskedPhase: 3 },
  { label: 'email',   rawValue: 'john@example.com',   maskedValue: 'j***@example.com',   x: 270, w: 150, rawColor: RED,   maskedPhase: 4 },
  { label: 'loan_id', rawValue: 'L-001',              maskedValue: 'a3f8...bc91',         x: 430, w: 100, rawColor: AMBER, maskedPhase: 5 },
];

export function PiiMaskAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const inHold = tick >= NORMAL_CYCLE_TICKS;
  const phase = inHold ? TOTAL_PHASES - 1 : Math.floor(tick / PHASE_TICKS);
  const phaseProgress = inHold ? 1 : (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  const inputRowOpacity = phase >= 1 ? (phase >= 6 ? 0.3 : 1) : 0;
  const gearGlow = phase >= 2 && phase <= 5
    ? 0.6 + 0.4 * Math.sin(phaseProgress * Math.PI * 4)
    : 0.5;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="PII masking animation showing sensitive fields being replaced before reaching the output topic">
        <defs>
          <filter id="pii-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── SECTION LABELS ── */}
        <text x="280" y="16" textAnchor="middle" fontSize="9" fontWeight="700"
          fill="var(--color-text-primary)" opacity={0.5}>RAW INPUT ROW</text>

        {/* ── INPUT FIELDS ── */}
        <g opacity={inputRowOpacity}>
          {FIELDS.map((f) => {
            const isMaskedPhase = phase >= f.maskedPhase;
            // Transition opacity: raw fades out, masked fades in
            const rawOpacity = isMaskedPhase
              ? (phase === f.maskedPhase ? Math.max(0, 1 - eased) : 0)
              : 1;
            const maskedOpacity = isMaskedPhase
              ? (phase === f.maskedPhase ? eased : 1)
              : 0;
            const borderColor = isMaskedPhase ? GREEN : f.rawColor;

            return (
              <g key={f.label}>
                <rect x={f.x} y={50} width={f.w} height={28} rx="5"
                  fill={borderColor} fillOpacity={0.07}
                  stroke={borderColor} strokeWidth="1.5" />
                <text x={f.x + f.w / 2} y={59} textAnchor="middle" fontSize="7.5"
                  fill={borderColor} opacity={0.65} fontWeight="600">{f.label}</text>
                {/* Raw value */}
                <text x={f.x + f.w / 2} y={72} textAnchor="middle" fontSize="8"
                  fill={f.rawColor} opacity={rawOpacity} fontFamily="monospace">
                  {f.rawValue.length > 12 ? f.rawValue.slice(0, 11) + '…' : f.rawValue}
                </text>
                {/* Masked value */}
                <text x={f.x + f.w / 2} y={72} textAnchor="middle" fontSize="8"
                  fill={GREEN} opacity={maskedOpacity} fontFamily="monospace"
                  filter={phase === f.maskedPhase ? 'url(#pii-glow)' : undefined}>
                  {f.maskedValue.length > 12 ? f.maskedValue.slice(0, 11) + '…' : f.maskedValue}
                </text>
              </g>
            );
          })}
        </g>

        {/* Input row border */}
        <rect x="15" y="42" width="530" height="42" rx="7"
          fill="none" stroke="var(--color-text-primary)" strokeOpacity={0.15} strokeWidth="1"
          opacity={inputRowOpacity} />

        {/* ── MASKING FUNCTION BOX ── */}
        <rect x="165" y="108" width="230" height="38" rx="8"
          fill={INDIGO} fillOpacity={0.08 + gearGlow * 0.06}
          stroke={INDIGO} strokeWidth="1.5"
          filter={phase >= 2 && phase <= 5 ? 'url(#pii-glow)' : undefined} />
        <text x="210" y="124" textAnchor="middle" fontSize="14"
          fill={INDIGO} opacity={gearGlow}>⚙</text>
        <text x="310" y="121" textAnchor="middle" fontSize="9" fontWeight="700"
          fill={INDIGO}>mask_pii()</text>
        <text x="310" y="136" textAnchor="middle" fontSize="8"
          fill={INDIGO} opacity={0.7}>SHA-256 hash · regex redact</text>

        {/* Arrows: input row → masking box */}
        <line x1="280" y1="84" x2="280" y2="107"
          stroke={INDIGO} strokeWidth="1.5" strokeDasharray="3,2" opacity={0.4} />

        {/* Arrows: masking box → output row */}
        <line x1="280" y1="146" x2="280" y2="162"
          stroke={INDIGO} strokeWidth="1.5" strokeDasharray="3,2" opacity={0.4} />

        {/* ── OUTPUT SECTION LABEL ── */}
        <text x="280" y="160" textAnchor="middle" fontSize="9" fontWeight="700"
          fill="var(--color-text-primary)" opacity={0.5}>MASKED OUTPUT ROW</text>

        {/* ── OUTPUT FIELDS ── */}
        {FIELDS.map((f) => {
          const visible = phase >= f.maskedPhase;
          const rowOpacity = visible
            ? (phase === f.maskedPhase ? eased : 1)
            : 0;
          return (
            <g key={`out-${f.label}`} opacity={rowOpacity}>
              <rect x={f.x} y={170} width={f.w} height={28} rx="5"
                fill={GREEN} fillOpacity={0.07}
                stroke={GREEN} strokeWidth="1.5" />
              <text x={f.x + f.w / 2} y={179} textAnchor="middle" fontSize="7.5"
                fill={GREEN} opacity={0.65} fontWeight="600">{f.label}</text>
              <text x={f.x + f.w / 2} y={192} textAnchor="middle" fontSize="8"
                fill={GREEN} fontFamily="monospace"
                filter={phase === f.maskedPhase ? 'url(#pii-glow)' : undefined}>
                {f.maskedValue.length > 12 ? f.maskedValue.slice(0, 11) + '…' : f.maskedValue}
              </text>
            </g>
          );
        })}

        {/* Output row border */}
        <rect x="15" y="163" width="530" height="42" rx="7"
          fill="none" stroke={GREEN} strokeOpacity={0.2} strokeWidth="1"
          opacity={phase >= 2 ? 1 : 0.2} />

        {/* Phase 6: "zero raw PII downstream" label — hidden in phase 7 to avoid overlap */}
        {phase === 6 && (
          <g opacity={eased}>
            <rect x="155" y="212" width="250" height="22" rx="6"
              fill={GREEN} fillOpacity={0.1} stroke={GREEN} strokeWidth="1" />
            <text x="280" y="227" textAnchor="middle" fontSize="9" fontWeight="600"
              fill={GREEN}>zero raw PII downstream ✓</text>
          </g>
        )}

        {/* Phase 7 insight — holds during HOLD_TICKS for reading time */}
        {phase === 7 && (
          <g opacity={inHold ? 1 : eased}>
            <rect x="30" y="218" width="500" height="22" rx="5"
              fill="rgba(99,102,241,0.1)" stroke={INDIGO} strokeWidth="1" />
            <text x="280" y="233" textAnchor="middle" fontSize="9" fontWeight="600"
              fill={INDIGO}>
              Masking runs inline at ingest. Raw PII never reaches the output topic.
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
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={RED} opacity="0.85" /></svg>
          sensitive PII field
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={AMBER} opacity="0.85" /></svg>
          hashed identifier
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={GREEN} opacity="0.85" /></svg>
          masked / safe output
        </span>
      </div>
    </div>
  );
}
