import './animations.css';
import { useAnimationTick } from './useAnimationTick';

const PHASE_TICKS = 26;
const TOTAL_PHASES = 8;
const HOLD_TICKS = 78; // ~4s pause on insight phase
const NORMAL_CYCLE_TICKS = TOTAL_PHASES * PHASE_TICKS;
const CYCLE_TICKS = NORMAL_CYCLE_TICKS + HOLD_TICKS;

const GREEN = '#10b981';
const RED = '#ef4444';
const BLUE = '#3b82f6';
const AMBER = '#f59e0b';
const INDIGO = '#6366f1';

const PHASE_STATUS = [
  'LoanValidator() checks every record — valid or invalid?',
  'Valid loan: credit_score=720, dti=0.35 → LoanValidator = VALID',
  'VALID route → green arc to output topic',
  'Invalid: credit_score=510, dti=0.60 → INVALID',
  'INVALID → red arc to DEAD-LETTER with rejection_reason',
  'EXECUTE STATEMENT SET runs both INSERT jobs in parallel',
  'Dead-letter accumulates rejected records with full context',
  'Dead-letter = nothing lost. Invalid records wait for retry.',
];

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// Validator box geometry
const VX1 = 218, VY1 = 92, VW = 118, VH = 56;
const VCX = VX1 + VW / 2;
const VCY = VY1 + VH / 2;

// Input lane
const INPUT_X_START = 20;
const INPUT_Y = VCY;

// Valid output lane
const VALID_X = 480;
const VALID_Y = 62;

// Dead-letter lane
const DL_X = 480;
const DL_Y = 182;

export function DataValidationAnimation() {
  const tick = useAnimationTick(CYCLE_TICKS);

  const inHold = tick >= NORMAL_CYCLE_TICKS;
  const phase = inHold ? TOTAL_PHASES - 1 : Math.floor(tick / PHASE_TICKS);
  const phaseProgress = inHold ? 1 : (tick % PHASE_TICKS) / PHASE_TICKS;
  const eased = easeInOutCubic(phaseProgress);

  // Event moving along input lane to validator
  const eventInputX = (ph: number) =>
    ph === 0 ? null :
    ph === 1 ? INPUT_X_START + eased * (VX1 - INPUT_X_START - 10) :
    ph === 3 ? INPUT_X_START + eased * (VX1 - INPUT_X_START - 10) :
    null;

  const validEventX = phase === 1 ? eventInputX(1) : null;
  const invalidEventX = phase === 3 ? eventInputX(3) : null;

  // Arc path from validator to output (quadratic bezier)
  // Valid arc: rises up-right
  const validArcPath = `M ${VX1 + VW} ${VCY} Q ${VX1 + VW + 40} ${VALID_Y - 10} ${VALID_X - 30} ${VALID_Y}`;
  // Dead-letter arc: curves down-right
  const dlArcPath = `M ${VX1 + VW} ${VCY} Q ${VX1 + VW + 40} ${DL_Y + 10} ${DL_X - 30} ${DL_Y}`;

  // Animated event dot on valid arc (phase 2)
  const validDotT = phase === 2 ? eased : phase > 2 ? 1 : 0;
  // Quadratic bezier point
  const bezierPoint = (t: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) => ({
    x: (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1,
    y: (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1,
  });

  const validDotPos = bezierPoint(validDotT, VX1 + VW, VCY, VX1 + VW + 40, VALID_Y - 10, VALID_X - 30, VALID_Y);
  const dlDotT = phase === 4 ? eased : phase > 4 ? 1 : 0;
  const dlDotPos = bezierPoint(dlDotT, VX1 + VW, VCY, VX1 + VW + 40, DL_Y + 10, DL_X - 30, DL_Y);

  // Validator glow
  const validatorColor =
    phase === 1 || phase === 2 ? GREEN :
    phase === 3 || phase === 4 ? RED :
    BLUE;
  const validatorGlow = (phase === 1 || phase === 2 || phase === 3 || phase === 4)
    ? 0.12 + 0.08 * Math.sin(phaseProgress * Math.PI * 4)
    : 0.08;

  // Counters phase 6
  const validCount = phase >= 6 ? 3 : 0;
  const dlCount = phase >= 6 ? 2 : 0;

  // Parallel label phase 5 — hidden in phase 7 to avoid overlap with insight
  const parallelOpacity = phase === 5 ? eased : phase === 6 ? 1 : 0;

  const insightOpacity = phase === 7 ? (inHold ? 1 : eased) : 0;

  return (
    <div>
      <svg viewBox="0 0 560 320" style={{ width: '100%', height: 'auto' }}
        aria-label="Dead-letter routing animation showing valid records to output and invalid to dead-letter queue">
        <defs>
          <filter id="dv-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="dv-arr-g" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={GREEN} opacity="0.7" />
          </marker>
          <marker id="dv-arr-r" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={RED} opacity="0.7" />
          </marker>
          <marker id="dv-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-text-primary)" opacity="0.35" />
          </marker>
        </defs>

        {/* ── INPUT LANE ── */}
        <line x1={INPUT_X_START + 50} y1={INPUT_Y} x2={VX1 - 2} y2={INPUT_Y}
          stroke="var(--color-text-primary)" strokeWidth="1.5" opacity={0.25}
          markerEnd="url(#dv-arr)" />
        <text x={INPUT_X_START} y={INPUT_Y - 15} fontSize="9"
          fill="var(--color-text-primary)" opacity={0.5} fontWeight="600">INPUT</text>

        {/* ── VALID OUTPUT LANE ── */}
        <path d={validArcPath} fill="none" stroke={GREEN} strokeWidth="1.5"
          opacity={0.35} markerEnd="url(#dv-arr-g)" />
        <rect x={VALID_X - 28} y={VALID_Y - 14} width="68" height="26" rx="5"
          fill={GREEN} fillOpacity={0.1} stroke={GREEN} strokeWidth="1.5" />
        <text x={VALID_X + 6} y={VALID_Y - 1} textAnchor="middle" fontSize="9"
          fontWeight="700" fill={GREEN}>VALID ✓</text>

        {/* ── DEAD-LETTER LANE ── */}
        <path d={dlArcPath} fill="none" stroke={RED} strokeWidth="1.5"
          opacity={0.35} markerEnd="url(#dv-arr-r)" />
        <rect x={VALID_X - 46} y={DL_Y - 14} width="106" height="26" rx="5"
          fill={RED} fillOpacity={0.1} stroke={RED} strokeWidth="1.5" />
        <text x={VALID_X + 7} y={DL_Y - 1} textAnchor="middle" fontSize="9"
          fontWeight="700" fill={RED}>DEAD-LETTER ✗</text>

        {/* ── VALIDATOR BOX ── */}
        <rect x={VX1} y={VY1} width={VW} height={VH} rx="10"
          fill={validatorColor} fillOpacity={validatorGlow}
          stroke={validatorColor} strokeWidth="1.8"
          filter={phase >= 1 && phase <= 4 ? 'url(#dv-glow)' : undefined} />
        <text x={VCX} y={VY1 + 20} textAnchor="middle" fontSize="9" fontWeight="700"
          fill={validatorColor}>LoanValidator()</text>
        <text x={VCX} y={VY1 + 35} textAnchor="middle" fontSize="8"
          fill={validatorColor} opacity={0.75}>
          {phase === 1 || phase === 2 ? '✓ VALID' :
           phase === 3 || phase === 4 ? '✗ INVALID' : 'checking...'}
        </text>
        <text x={VCX} y={VY1 + 50} textAnchor="middle" fontSize="7.5"
          fill={validatorColor} opacity={0.6}>
          {phase === 1 ? 'score=720, dti=0.35' :
           phase === 3 ? 'score=510, dti=0.60' : ''}
        </text>

        {/* ── MOVING EVENT DOT: valid input (phase 1) ── */}
        {validEventX && (
          <g filter="url(#dv-glow)">
            <circle cx={validEventX} cy={INPUT_Y} r="10"
              fill={GREEN} fillOpacity={0.2} stroke={GREEN} strokeWidth="2" />
            <text x={validEventX} y={INPUT_Y + 4} textAnchor="middle" fontSize="7"
              fontWeight="700" fill={GREEN}>720</text>
          </g>
        )}

        {/* ── MOVING EVENT DOT: invalid input (phase 3) ── */}
        {invalidEventX && (
          <g filter="url(#dv-glow)">
            <circle cx={invalidEventX} cy={INPUT_Y} r="10"
              fill={RED} fillOpacity={0.2} stroke={RED} strokeWidth="2" />
            <text x={invalidEventX} y={INPUT_Y + 4} textAnchor="middle" fontSize="7"
              fontWeight="700" fill={RED}>510</text>
          </g>
        )}

        {/* ── ANIMATED DOT: arcing to valid lane (phase 2) ── */}
        {(phase === 2 || phase > 2) && (
          <g opacity={phase === 2 ? 1 : phase === 3 ? 1 - eased : 0.7}>
            <circle cx={validDotPos.x} cy={validDotPos.y} r="9"
              fill={GREEN} fillOpacity={0.25} stroke={GREEN} strokeWidth="1.8"
              filter={phase === 2 ? 'url(#dv-glow)' : undefined} />
          </g>
        )}

        {/* ── ANIMATED DOT: arcing to dead-letter (phase 4) ── */}
        {(phase >= 4) && (
          <g opacity={phase === 4 ? 1 : 0.7}>
            <circle cx={dlDotPos.x} cy={dlDotPos.y} r="9"
              fill={RED} fillOpacity={0.25} stroke={RED} strokeWidth="1.8"
              filter={phase === 4 ? 'url(#dv-glow)' : undefined} />
          </g>
        )}

        {/* rejection_reason label near dead-letter (phase 4+) */}
        {phase >= 4 && (
          <g opacity={phase === 4 ? eased : 1}>
            <text x={VALID_X + 7} y={DL_Y + 20} textAnchor="middle" fontSize="7.5"
              fill={RED} opacity={0.7} fontFamily="monospace">rejection_reason</text>
          </g>
        )}

        {/* ── PHASE 5: EXECUTE STATEMENT SET ── */}
        <g opacity={parallelOpacity}>
          <rect x="160" y="205" width="240" height="28" rx="7"
            fill={INDIGO} fillOpacity={0.1} stroke={INDIGO} strokeWidth="1.5" />
          <text x="280" y="218" textAnchor="middle" fontSize="8.5" fontWeight="700"
            fill={INDIGO}>EXECUTE STATEMENT SET</text>
          <text x="280" y="228" textAnchor="middle" fontSize="7.5"
            fill={INDIGO} opacity={0.75}>2 INSERT jobs running in parallel</text>
        </g>

        {/* ── PHASE 6: Counters ── */}
        {phase === 6 && (
          <g opacity={eased}>
            <text x={VALID_X + 6} y={VALID_Y + 22} textAnchor="middle" fontSize="10"
              fontWeight="700" fill={GREEN}>VALID: {validCount}</text>
            <text x={VALID_X + 7} y={DL_Y + 36} textAnchor="middle" fontSize="10"
              fontWeight="700" fill={RED}>DEAD-LETTER: {dlCount}</text>
          </g>
        )}

        {/* Phase 7 insight */}
        {phase === 7 && (
          <g opacity={insightOpacity}>
            <rect x="30" y="218" width="500" height="22" rx="5"
              fill="rgba(99,102,241,0.1)" stroke={INDIGO} strokeWidth="1" />
            <text x="280" y="233" textAnchor="middle" fontSize="9" fontWeight="600"
              fill={INDIGO}>
              Dead-letter = nothing lost. Invalid records wait for retry.
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
          valid → output
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={RED} opacity="0.85" /></svg>
          invalid → dead-letter
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill={AMBER} opacity="0.85" /></svg>
          LoanValidator()
        </span>
      </div>
    </div>
  );
}
