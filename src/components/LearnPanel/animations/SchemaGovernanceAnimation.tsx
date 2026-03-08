import { useState, useEffect } from 'react';
import './animations.css';
import { useAnimationSpeed } from './AnimationSpeedContext';

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

type Phase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface SchemaField {
  name: string;
  type: string;
  status?: 'normal' | 'added' | 'removed';
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const PHASE_DURATION = 2500;
const TOTAL_PHASES = 8;
const PAUSE_MS = 800;
const SVG_W = 560;
const SVG_H = 300;

// Layout regions
const SCHEMA_X = 16;
const SCHEMA_W = 150;
const SCHEMA_Y = 42;
const GATE_X = 210;
const GATE_W = 140;
const GATE_Y = 36;
const GATE_H = 180;
const GATE_CX = GATE_X + GATE_W / 2;
const GATE_CY = GATE_Y + GATE_H / 2;
const PROP_X = 394;
const PROP_W = 150;
const PROP_Y = 42;

// Colors
const GREEN = '#10b981';
const RED = '#ef4444';
const BLUE = '#3b82f6';
const AMBER = '#f59e0b';
const PURPLE = '#8b5cf6';

// Schema definitions
const V1: SchemaField[] = [
  { name: 'user_id', type: 'INT' },
  { name: 'name', type: 'STRING' },
  { name: 'email', type: 'STRING' },
];
const V2: SchemaField[] = [
  ...V1,
  { name: 'phone', type: 'STRING', status: 'added' },
];

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
//  Component
// ---------------------------------------------------------------------------

export function SchemaGovernanceAnimation() {
  const [phase, setPhase] = useState<Phase>(0);
  const [progress, setProgress] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const { paused } = useAnimationSpeed();

  useEffect(() => {
    let frameId: number;
    let start = Date.now();

    const tick = () => {
      if (paused) { frameId = requestAnimationFrame(tick); return; }
      const elapsed = Date.now() - start;
      const cycle = TOTAL_PHASES * PHASE_DURATION + PAUSE_MS;

      if (elapsed >= cycle) {
        start = Date.now();
        setPhase(0);
        setProgress(0);
        setParticles([]);
        frameId = requestAnimationFrame(tick);
        return;
      }

      const pi = Math.min(Math.floor(elapsed / PHASE_DURATION), TOTAL_PHASES - 1) as Phase;
      const pp = Math.min((elapsed % PHASE_DURATION) / PHASE_DURATION, 1);
      setPhase(pi);
      setProgress(pp);

      // Spawn particles during compatibility-check phases
      if (pi === 3 || pi === 6) {
        setParticles(prev => {
          const alive = prev
            .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.02 }))
            .filter(p => p.life > 0);
          if (Math.random() > 0.5 && alive.length < 20) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 1.5;
            const mul = pi === 3 ? 1 : 0.6;
            alive.push({
              id: Date.now() + Math.random(),
              x: GATE_CX, y: GATE_CY,
              vx: Math.cos(angle) * speed * mul,
              vy: Math.sin(angle) * speed * mul,
              life: 1,
            });
          }
          return alive;
        });
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [paused]);

  const eased = easeInOutCubic(Math.min(progress * 1.3, 1));

  // Phase-dependent booleans
  const showProposal1 = phase >= 2 && phase <= 4;
  const showApproved = phase === 4;
  const showProposal2 = phase >= 5 && phase <= 7;
  const showRejected = phase >= 7;
  const fields = phase >= 5 ? V2 : V1;
  const ver = phase >= 5 ? 'v2' : 'v1';
  const gateColor = phase === 6 || phase === 7 ? RED : phase === 3 || phase === 4 ? GREEN : BLUE;
  const gatePulse = (phase === 3 || phase === 6)
    ? 0.7 + 0.3 * Math.sin(progress * Math.PI * 6) : 1;
  const slide1 = phase === 2 ? eased : phase > 2 && phase <= 4 ? 1 : 0;
  const slide2 = phase === 5 ? eased : phase > 5 ? 1 : 0;
  const arrowY = GATE_CY;

  const getLabel = (): string => {
    switch (phase) {
      case 0: return 'Schema v1 is registered and in use by consumers';
      case 1: return 'Schema Registry enforces BACKWARD compatibility';
      case 2: return 'A producer wants to add an optional field';
      case 3: return 'Checking: Can existing consumers still read this?';
      case 4: return 'APPROVED: Adding an optional field is backward compatible';
      case 5: return 'Another producer wants to remove a field';
      case 6: return 'Checking: Can existing consumers still read this?';
      case 7: return 'REJECTED: Removing a required field breaks backward compatibility';
      default: return '';
    }
  };

  // -----------------------------------------------------------------------
  //  Render: schema document
  // -----------------------------------------------------------------------
  const renderDoc = (
    x: number, y: number, w: number, f: SchemaField[],
    title: string, color: string, op: number,
  ) => {
    const lh = 16;
    const hh = 22;
    const h = hh + lh * (f.length + 2) + 6;
    return (
      <g opacity={op}>
        <rect x={x} y={y} width={w} height={h} rx="5"
          fill="var(--color-surface, #1e293b)" stroke={color} strokeWidth="1.5" />
        <rect x={x} y={y} width={w} height={hh} rx="5" fill={color} opacity="0.15" />
        <rect x={x} y={y + hh - 3} width={w} height={3} fill={color} opacity="0.15" />
        <text x={x + w / 2} y={y + 15} textAnchor="middle"
          fontSize="8" fontWeight="bold" fill={color}>{title}</text>
        <text x={x + 10} y={y + hh + 14}
          fontSize="8" fontFamily="monospace" fill="var(--color-text, #94a3b8)">{'{'}</text>
        {f.map((fd, i) => {
          const fy = y + hh + 14 + (i + 1) * lh;
          const nc = fd.status === 'added' ? GREEN : fd.status === 'removed' ? RED : 'var(--color-accent, #60a5fa)';
          const tc = fd.status === 'removed' ? RED : AMBER;
          return (
            <g key={fd.name} opacity={fd.status === 'removed' ? 0.6 : 1}>
              {fd.status === 'added' && (
                <rect x={x + 4} y={fy - 10} width={w - 8} height={lh - 1} rx="2" fill={GREEN} opacity="0.1" />
              )}
              {fd.status === 'removed' && (
                <rect x={x + 4} y={fy - 10} width={w - 8} height={lh - 1} rx="2" fill={RED} opacity="0.1" />
              )}
              {fd.status === 'removed' && (
                <line x1={x + 16} y1={fy - 3} x2={x + w - 16} y2={fy - 3}
                  stroke={RED} strokeWidth="1" opacity="0.6" />
              )}
              <text x={x + 18} y={fy} fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill={nc}>
                {fd.name}
              </text>
              <text x={x + 18} y={fy} fontSize="7.5" fontFamily="monospace" fill={tc}>
                <tspan dx={`${fd.name.length * 4.5 + 2}px`}>: {fd.type}</tspan>
              </text>
              {fd.status === 'added' && (
                <text x={x + w - 12} y={fy} textAnchor="end" fontSize="6" fill={GREEN} fontStyle="italic">+new</text>
              )}
            </g>
          );
        })}
        <text x={x + 10} y={y + hh + 14 + (f.length + 1) * lh}
          fontSize="8" fontFamily="monospace" fill="var(--color-text, #94a3b8)">{'}'}</text>
      </g>
    );
  };

  // -----------------------------------------------------------------------
  //  Render: Schema Registry gate
  // -----------------------------------------------------------------------
  const renderGate = () => {
    if (phase < 1) return null;
    const fadeIn = phase === 1 ? eased : 1;
    const sCY = GATE_Y + 60;
    const s = 1 + (gatePulse - 1) * 0.15;
    return (
      <g opacity={fadeIn}>
        <rect x={GATE_X} y={GATE_Y} width={GATE_W} height={GATE_H} rx="8"
          fill="var(--color-surface, #1e293b)" stroke={gateColor} strokeWidth="2" opacity="0.9"
          strokeDasharray={phase === 3 || phase === 6 ? 'none' : '6,3'} />
        <text x={GATE_CX} y={GATE_Y + 16} textAnchor="middle"
          fontSize="8" fontWeight="bold" fill={gateColor}>Schema Registry</text>

        {/* Shield */}
        <g transform={`translate(${GATE_CX}, ${sCY}) scale(${s})`}>
          <path d="M0,-22 L18,-14 L18,4 C18,16 0,26 0,26 C0,26 -18,16 -18,4 L-18,-14 Z"
            fill={gateColor} opacity="0.15" stroke={gateColor} strokeWidth="1.5" />
          <path d="M0,-16 L13,-10 L13,2 C13,11 0,19 0,19 C0,19 -13,11 -13,2 L-13,-10 Z"
            fill={gateColor} opacity="0.25" />
          {phase === 4 && (
            <path d="M-7,0 L-2,5 L7,-5" fill="none"
              stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {phase === 7 && (
            <g>
              <line x1="-5" y1="-5" x2="5" y2="5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              <line x1="5" y1="-5" x2="-5" y2="5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            </g>
          )}
          {(phase === 3 || phase === 6) && (
            <g>
              <circle cx="0" cy="0" r="14" fill="none" stroke={gateColor} strokeWidth="2"
                opacity="0.4" strokeDasharray="12,8" transform={`rotate(${progress * 360})`} />
              <circle cx="0" cy="0" r="10" fill="none" stroke={gateColor} strokeWidth="1.5"
                opacity="0.3" strokeDasharray="6,6" transform={`rotate(${-progress * 540})`} />
            </g>
          )}
        </g>

        {/* Compatibility badge */}
        <rect x={GATE_CX - 38} y={sCY + 30} width="76" height="18" rx="9"
          fill={gateColor} opacity="0.85" />
        <text x={GATE_CX} y={sCY + 42} textAnchor="middle"
          fontSize="7.5" fontWeight="bold" fill="#fff" letterSpacing="0.5">BACKWARD</text>
        <text x={GATE_CX} y={sCY + 58} textAnchor="middle"
          fontSize="6.5" fill="var(--color-text, #94a3b8)" opacity="0.7">compatibility mode</text>

        {/* Check-phase particles */}
        {(phase === 3 || phase === 6) && particles.map(p => (
          <circle key={p.id} cx={p.x} cy={p.y} r={2}
            fill={phase === 3 ? GREEN : RED} opacity={p.life * 0.7} />
        ))}
      </g>
    );
  };

  // -----------------------------------------------------------------------
  //  Render: animated arrow
  // -----------------------------------------------------------------------
  const renderArrow = (color: string, fromX: number, toX: number, y: number, t: number) => {
    const tipX = lerp(fromX, toX, easeInOutCubic(Math.min(t * 1.2, 1)));
    return (
      <g>
        <line x1={fromX} y1={y} x2={tipX} y2={y} stroke={color} strokeWidth="2" opacity="0.8" />
        <polygon points={`${tipX},${y - 4} ${tipX - 8},${y} ${tipX},${y + 4}`}
          fill={color} opacity="0.8" />
        <line x1={fromX} y1={y} x2={tipX} y2={y} stroke={color} strokeWidth="4" opacity="0.15" />
      </g>
    );
  };

  // -----------------------------------------------------------------------
  //  Render: result icon (large check / X)
  // -----------------------------------------------------------------------
  const renderResult = (cx: number, cy: number, type: 'ok' | 'fail', t: number) => {
    const sc = easeInOutCubic(Math.min(t * 1.5, 1));
    const c = type === 'ok' ? GREEN : RED;
    const bgOp = 0.15 + 0.1 * Math.sin(t * Math.PI * 4);
    return (
      <g transform={`translate(${cx}, ${cy}) scale(${sc})`}>
        <circle cx="0" cy="0" r="18" fill={c} opacity={bgOp} />
        <circle cx="0" cy="0" r="18" fill="none" stroke={c} strokeWidth="2.5" opacity="0.9" />
        {type === 'ok' ? (
          <path d="M-8,0 L-3,6 L8,-6" fill="none"
            stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <g>
            <line x1="-6" y1="-6" x2="6" y2="6" stroke={c} strokeWidth="3" strokeLinecap="round" />
            <line x1="6" y1="-6" x2="-6" y2="6" stroke={c} strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
      </g>
    );
  };

  // -----------------------------------------------------------------------
  //  Render: flow / block particles
  // -----------------------------------------------------------------------
  const renderFlowParticles = () => {
    if (phase !== 4) return null;
    return (<>{Array.from({ length: 6 }).map((_, i) => {
      const bp = (progress + i / 6) % 1;
      const px = lerp(PROP_X - 10, SCHEMA_X + SCHEMA_W + 10, bp);
      const py = GATE_CY + Math.sin(bp * Math.PI * 3) * 12;
      return <circle key={`fl-${i}`} cx={px} cy={py} r="3"
        fill={GREEN} opacity={0.4 + 0.4 * Math.sin(bp * Math.PI)} />;
    })}</>);
  };

  const renderBlockParticles = () => {
    if (phase !== 7) return null;
    return (<>{Array.from({ length: 8 }).map((_, i) => {
      const bt = (progress * 1.5 + i / 8) % 1;
      const px = GATE_X + GATE_W + bt * (PROP_X - GATE_X - GATE_W + 30);
      const py = GATE_CY + Math.sin(bt * Math.PI * 2 + i) * (15 + i * 3);
      return <circle key={`bl-${i}`} cx={px} cy={py} r={2 + (i % 3) * 0.5}
        fill={RED} opacity={0.5 * (1 - bt)} />;
    })}</>);
  };

  // -----------------------------------------------------------------------
  //  Main render
  // -----------------------------------------------------------------------
  return (
    <div className="concept-animation">
      <h4>Schema Governance: Evolution &amp; Compatibility</h4>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto' }}>
        <defs>
          <filter id="sg-glow-g" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="sg-glow-r" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Title */}
        <text x={SVG_W / 2} y={14} textAnchor="middle" fontSize="11" fontWeight="bold"
          fill="var(--color-text, #e2e8f0)">Schema Evolution with Compatibility Gate</text>

        {/* Scenario label */}
        {phase >= 2 && phase <= 4 && (
          <text x={SVG_W / 2} y={28} textAnchor="middle" fontSize="8"
            fill={GREEN} fontWeight="bold" opacity="0.8">Scenario 1: Adding an optional field</text>
        )}
        {phase >= 5 && (
          <text x={SVG_W / 2} y={28} textAnchor="middle" fontSize="8"
            fill={RED} fontWeight="bold" opacity="0.8">Scenario 2: Removing a required field</text>
        )}

        {/* ==================== CURRENT SCHEMA (LEFT) ==================== */}
        {renderDoc(SCHEMA_X, SCHEMA_Y, SCHEMA_W, fields,
          `Current Schema (${ver})`, PURPLE, phase === 0 ? eased : 1)}
        <g opacity={phase === 0 ? eased : 0.8}>
          <rect x={SCHEMA_X + 4} y={SCHEMA_Y + (fields.length + 3) * 16 + 28}
            width={SCHEMA_W - 8} height="14" rx="7" fill={PURPLE} opacity="0.12" />
          <text x={SCHEMA_X + SCHEMA_W / 2} y={SCHEMA_Y + (fields.length + 3) * 16 + 38}
            textAnchor="middle" fontSize="6.5" fill={PURPLE} opacity="0.8">3 consumers reading</text>
        </g>

        {/* ==================== REGISTRY GATE (CENTER) ==================== */}
        {renderGate()}

        {/* ==================== PROPOSAL 1: Add field (phases 2-4) ==================== */}
        {showProposal1 && (
          <g opacity={slide1} transform={`translate(${(1 - slide1) * 60}, 0)`}>
            <rect x={PROP_X} y={PROP_Y} width={PROP_W} height={68} rx="5"
              fill="var(--color-surface, #1e293b)"
              stroke={showApproved ? GREEN : 'var(--color-border, #475569)'}
              strokeWidth={showApproved ? 2.5 : 1.5} />
            <rect x={PROP_X} y={PROP_Y} width={PROP_W} height={20} rx="5" fill={GREEN} opacity="0.12" />
            <rect x={PROP_X} y={PROP_Y + 17} width={PROP_W} height={3} fill={GREEN} opacity="0.12" />
            <text x={PROP_X + PROP_W / 2} y={PROP_Y + 14} textAnchor="middle"
              fontSize="7.5" fontWeight="bold" fill={GREEN}>Proposed: Add Field</text>
            <text x={PROP_X + 14} y={PROP_Y + 36}
              fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill={GREEN}>+ phone</text>
            <text x={PROP_X + 14} y={PROP_Y + 36}
              fontSize="7.5" fontFamily="monospace" fill={AMBER}>
              <tspan dx="48px">: STRING</tspan></text>
            <text x={PROP_X + 14} y={PROP_Y + 50}
              fontSize="6.5" fontStyle="italic" fill="var(--color-text, #94a3b8)" opacity="0.7">
              (optional, default: null)</text>
            {showApproved && (
              <g filter="url(#sg-glow-g)">
                {renderResult(PROP_X + PROP_W / 2, PROP_Y + 90, 'ok', progress)}
                <text x={PROP_X + PROP_W / 2} y={PROP_Y + 114}
                  textAnchor="middle" fontSize="7.5" fontWeight="bold" fill={GREEN}>COMPATIBLE</text>
              </g>
            )}
          </g>
        )}

        {/* Arrow for proposal 1 */}
        {phase >= 2 && phase <= 3 && renderArrow(GREEN, PROP_X - 6, GATE_X + GATE_W + 6,
          arrowY, phase === 2 ? progress : 1)}
        {renderFlowParticles()}

        {/* ==================== PROPOSAL 2: Remove field (phases 5-7) ==================== */}
        {showProposal2 && (
          <g opacity={slide2} transform={`translate(${(1 - slide2) * 60}, 0)`}>
            <rect x={PROP_X} y={PROP_Y} width={PROP_W} height={68} rx="5"
              fill="var(--color-surface, #1e293b)"
              stroke={showRejected ? RED : 'var(--color-border, #475569)'}
              strokeWidth={showRejected ? 2.5 : 1.5} />
            <rect x={PROP_X} y={PROP_Y} width={PROP_W} height={20} rx="5" fill={RED} opacity="0.12" />
            <rect x={PROP_X} y={PROP_Y + 17} width={PROP_W} height={3} fill={RED} opacity="0.12" />
            <text x={PROP_X + PROP_W / 2} y={PROP_Y + 14} textAnchor="middle"
              fontSize="7.5" fontWeight="bold" fill={RED}>Proposed: Remove Field</text>
            <text x={PROP_X + 14} y={PROP_Y + 36}
              fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill={RED}>- name</text>
            <text x={PROP_X + 14} y={PROP_Y + 36}
              fontSize="7.5" fontFamily="monospace" fill={RED} opacity="0.6">
              <tspan dx="42px">: STRING</tspan></text>
            <line x1={PROP_X + 12} y1={PROP_Y + 33} x2={PROP_X + PROP_W - 16} y2={PROP_Y + 33}
              stroke={RED} strokeWidth="1" opacity="0.5" />
            <text x={PROP_X + 14} y={PROP_Y + 50}
              fontSize="6.5" fontStyle="italic" fill={RED} opacity="0.7">(required by consumers!)</text>
            {showRejected && (
              <g filter="url(#sg-glow-r)">
                {renderResult(PROP_X + PROP_W / 2, PROP_Y + 90, 'fail', progress)}
                <text x={PROP_X + PROP_W / 2} y={PROP_Y + 114}
                  textAnchor="middle" fontSize="7.5" fontWeight="bold" fill={RED}>INCOMPATIBLE</text>
              </g>
            )}
          </g>
        )}

        {/* Arrow for proposal 2 */}
        {phase >= 5 && phase <= 6 && renderArrow(RED, PROP_X - 6, GATE_X + GATE_W + 6,
          arrowY, phase === 5 ? progress : 1)}
        {renderBlockParticles()}

        {/* ==================== CALLOUTS ==================== */}
        {showRejected && (
          <g opacity={easeInOutCubic(Math.min(progress * 2, 1))}>
            <rect x={PROP_X - 10} y={PROP_Y + 138} width={PROP_W + 20} height={28} rx="5"
              fill={RED} opacity="0.08" stroke={RED} strokeWidth="1" strokeDasharray="3,2" />
            <text x={PROP_X + PROP_W / 2} y={PROP_Y + 150} textAnchor="middle"
              fontSize="6.5" fontWeight="bold" fill={RED}>
              Consumers expect &apos;name&apos;</text>
            <text x={PROP_X + PROP_W / 2} y={PROP_Y + 160} textAnchor="middle"
              fontSize="6" fill={RED} opacity="0.8">Removing it would break them</text>
          </g>
        )}
        {showApproved && (
          <g opacity={easeInOutCubic(Math.min(progress * 2, 1))}>
            <rect x={PROP_X - 10} y={PROP_Y + 118} width={PROP_W + 20} height={28} rx="5"
              fill={GREEN} opacity="0.08" stroke={GREEN} strokeWidth="1" strokeDasharray="3,2" />
            <text x={PROP_X + PROP_W / 2} y={PROP_Y + 130} textAnchor="middle"
              fontSize="6.5" fontWeight="bold" fill={GREEN}>Old consumers ignore new field</text>
            <text x={PROP_X + PROP_W / 2} y={PROP_Y + 140} textAnchor="middle"
              fontSize="6" fill={GREEN} opacity="0.8">Schema evolves safely to v2</text>
          </g>
        )}

        {/* ==================== STATUS BAR ==================== */}
        <rect x="20" y={SVG_H - 52} width={SVG_W - 40} height="20" rx="4"
          fill="var(--color-surface, #1e293b)" stroke="var(--color-border, #334155)" strokeWidth="0.5" />
        <text x={SVG_W / 2} y={SVG_H - 39} textAnchor="middle"
          fontSize="7.5" fill="var(--color-text, #94a3b8)">{getLabel()}</text>

        {/* Phase dots */}
        <g transform={`translate(${SVG_W / 2 - TOTAL_PHASES * 5}, ${SVG_H - 28})`}>
          {Array.from({ length: TOTAL_PHASES }).map((_, i) => (
            <circle key={i} cx={i * 10 + 5} cy="4" r="2.5"
              fill={i === phase
                ? (i >= 5 ? RED : i >= 2 ? GREEN : 'var(--color-accent, #60a5fa)')
                : 'var(--color-border, #334155)'}
              opacity={i === phase ? 1 : i < phase ? 0.6 : 0.3} />
          ))}
        </g>

        {/* ==================== LEGEND ==================== */}
        <g transform={`translate(20, ${SVG_H - 14})`}>
          <rect x="0" y="0" width="8" height="8" rx="1.5" fill={PURPLE} opacity="0.8" />
          <text x="12" y="7" fontSize="7" fill="var(--color-text, #94a3b8)">Schema</text>
          <rect x="60" y="0" width="8" height="8" rx="1.5" fill={BLUE} opacity="0.8" />
          <text x="72" y="7" fontSize="7" fill="var(--color-text, #94a3b8)">Registry</text>
          <rect x="130" y="0" width="8" height="8" rx="1.5" fill={GREEN} opacity="0.8" />
          <text x="142" y="7" fontSize="7" fill="var(--color-text, #94a3b8)">Compatible</text>
          <rect x="210" y="0" width="8" height="8" rx="1.5" fill={RED} opacity="0.8" />
          <text x="222" y="7" fontSize="7" fill="var(--color-text, #94a3b8)">Incompatible</text>
          <rect x="300" y="0" width="8" height="8" rx="1.5" fill={AMBER} opacity="0.8" />
          <text x="312" y="7" fontSize="7" fill="var(--color-text, #94a3b8)">Type</text>
          <rect x="350" y="1" width="40" height="7" rx="3.5" fill={BLUE} opacity="0.6" />
          <text x="370" y="7" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#fff">BACKWARD</text>
          <text x="396" y="7" fontSize="7" fill="var(--color-text, #94a3b8)">Mode</text>
        </g>
      </svg>
    </div>
  );
}
