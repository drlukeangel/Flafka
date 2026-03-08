import { useState, useEffect } from 'react';
import './animations.css';

interface AnimationState {
  phase: number;
  tick: number;
  particles: Particle[];
}

interface Particle {
  id: number;
  x: number;
  y: number;
  progress: number;
  segment: number;
  color: string;
}

const PHASE_COUNT = 8;
const TICKS_PER_PHASE = 30; // ~1.5s at 50ms
const TOTAL_TICKS = PHASE_COUNT * TICKS_PER_PHASE;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const STATUS_MESSAGES: Record<number, string> = {
  0: 'Everything starts with an Environment',
  1: 'Kafka Clusters live inside Environments',
  2: 'Topics are named channels inside a Cluster',
  3: 'Flink runs as a separate compute layer',
  4: 'Schema Registry enforces data contracts',
  5: 'Connectors bridge external systems',
  6: 'Data flows through the entire stack',
  7: 'Fully managed. No infrastructure to operate.',
};

const LEGEND_ITEMS = [
  { label: 'Environment', color: '#8892a0' },
  { label: 'Kafka Cluster', color: '#1a73e8' },
  { label: 'Topics', color: '#0d9488' },
  { label: 'Flink', color: '#e8850c' },
  { label: 'Schema Registry', color: '#8b5cf6' },
  { label: 'Connectors', color: '#16a34a' },
];

// Data flow path segments: External -> Source -> Topic -> Flink -> Topic -> Sink -> External
const FLOW_PATH = [
  { x1: 10, y1: 252, x2: 80, y2: 252 },   // External to Source Connector
  { x1: 110, y1: 252, x2: 130, y2: 155 },  // Source Connector to Topic 1
  { x1: 210, y1: 135, x2: 330, y2: 105 },  // Topic 1 to Flink
  { x1: 420, y1: 105, x2: 210, y2: 175 },  // Flink to Topic 3
  { x1: 210, y1: 175, x2: 440, y2: 252 },  // Topic 3 to Sink Connector
  { x1: 470, y1: 252, x2: 550, y2: 252 },  // Sink to External
];

export function ConfluentArchitectureAnimation() {
  const [state, setState] = useState<AnimationState>({
    phase: 0,
    tick: 0,
    particles: [],
  });

  useEffect(() => {
    let particleIdCounter = 0;

    const interval = setInterval(() => {
      setState((prev) => {
        const nextTick = prev.tick + 1;
        const globalTick = nextTick >= TOTAL_TICKS ? 0 : nextTick;
        const phase = Math.floor(globalTick / TICKS_PER_PHASE);
        const phaseTick = globalTick % TICKS_PER_PHASE;

        let particles = [...prev.particles];

        // Spawn particles during phase 6 (data flow)
        if (phase === 6 && phaseTick % 4 === 0) {
          particles.push({
            id: particleIdCounter++,
            x: FLOW_PATH[0].x1,
            y: FLOW_PATH[0].y1,
            progress: 0,
            segment: 0,
            color: phaseTick % 8 < 4 ? '#1a73e8' : '#0d9488',
          });
        }

        // Update particles
        particles = particles
          .map((p) => {
            const newProgress = p.progress + 0.04;
            if (newProgress >= 1) {
              const nextSegment = p.segment + 1;
              if (nextSegment >= FLOW_PATH.length) return null;
              return {
                ...p,
                segment: nextSegment,
                progress: 0,
                x: FLOW_PATH[nextSegment].x1,
                y: FLOW_PATH[nextSegment].y1,
              };
            }
            const seg = FLOW_PATH[p.segment];
            const eased = easeInOutCubic(newProgress);
            return {
              ...p,
              progress: newProgress,
              x: lerp(seg.x1, seg.x2, eased),
              y: lerp(seg.y1, seg.y2, eased),
            };
          })
          .filter((p): p is Particle => p !== null);

        // Clear particles outside data flow phase
        if (phase !== 6 && phase !== 7) {
          particles = [];
        }

        return { phase, tick: globalTick, particles };
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const { phase, tick, particles } = state;
  const phaseTick = tick % TICKS_PER_PHASE;
  const phaseProgress = easeInOutCubic(Math.min(phaseTick / (TICKS_PER_PHASE * 0.6), 1));

  // Pulse effect for phase 7
  const pulseScale = phase === 7 ? 1 + 0.008 * Math.sin((phaseTick / TICKS_PER_PHASE) * Math.PI * 4) : 1;
  const pulseOpacity = phase === 7 ? 0.85 + 0.15 * Math.sin((phaseTick / TICKS_PER_PHASE) * Math.PI * 2) : 1;

  // Visibility & animation helpers
  const envOpacity = phase >= 0 ? (phase === 0 ? phaseProgress : 1) : 0;
  const clusterOpacity = phase >= 1 ? (phase === 1 ? phaseProgress : 1) : 0;
  const clusterSlideX = phase === 1 ? lerp(-60, 0, phaseProgress) : phase >= 1 ? 0 : -60;

  const topicOpacity = (index: number) => {
    if (phase < 2) return 0;
    if (phase === 2) {
      const stagger = index * 0.25;
      const adjusted = Math.max(0, Math.min(1, (phaseProgress - stagger) / (1 - stagger)));
      return adjusted;
    }
    return 1;
  };
  const topicSlideY = (index: number) => {
    if (phase < 2) return -15;
    if (phase === 2) {
      const stagger = index * 0.25;
      const adjusted = Math.max(0, Math.min(1, (phaseProgress - stagger) / (1 - stagger)));
      return lerp(-15, 0, easeInOutCubic(adjusted));
    }
    return 0;
  };

  const flinkOpacity = phase >= 3 ? (phase === 3 ? phaseProgress : 1) : 0;
  const flinkSlideX = phase === 3 ? lerp(60, 0, phaseProgress) : phase >= 3 ? 0 : 60;

  const schemaOpacity = phase >= 4 ? (phase === 4 ? phaseProgress : 1) : 0;
  const schemaScale = phase === 4 ? lerp(0.85, 1, phaseProgress) : 1;

  const connectorOpacity = phase >= 5 ? (phase === 5 ? phaseProgress : 1) : 0;
  const connectorScale = phase === 5 ? lerp(0.9, 1, phaseProgress) : 1;

  // Flow line opacity (lights up in phase 6)
  const flowLineOpacity = (segIdx: number) => {
    if (phase < 6) return 0.15;
    if (phase === 6) {
      const segDelay = segIdx * 0.12;
      return lerp(0.15, 0.8, Math.max(0, Math.min(1, (phaseProgress - segDelay) * 2)));
    }
    return 0.6;
  };

  return (
    <div className="concept-animation">
      <h4>Confluent Cloud Architecture</h4>
      <svg viewBox="0 0 560 300" style={{ width: '100%', height: 'auto' }}>
        <defs>
          <filter id="caa-shadow">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
          </filter>
          <filter id="caa-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="caa-flow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1a73e8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0.6" />
          </linearGradient>
          <marker
            id="caa-arrow"
            viewBox="0 0 10 10"
            refX="8" refY="5"
            markerWidth="6" markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" opacity="0.6" />
          </marker>
          <marker
            id="caa-arrow-active"
            viewBox="0 0 10 10"
            refX="8" refY="5"
            markerWidth="6" markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1a73e8" opacity="0.8" />
          </marker>
        </defs>

        {/* ── Phase 0: Environment Box ── */}
        <g opacity={envOpacity} transform={`scale(${pulseScale})`} style={{ transformOrigin: '280px 145px' }}>
          <rect
            x="18" y="22" width="524" height="250" rx="12"
            fill="none"
            stroke="#8892a0"
            strokeWidth="1.5"
            strokeDasharray="6 3"
            opacity={0.7}
          />
          <rect x="18" y="22" width="524" height="250" rx="12" fill="#8892a020" />
          <text x="32" y="42" fontSize="11" fontWeight="600" fill="#8892a0" fontFamily="sans-serif">
            Environment: production
          </text>
        </g>

        {/* ── Phase 1: Kafka Cluster Box ── */}
        <g
          opacity={clusterOpacity * pulseOpacity}
          transform={`translate(${clusterSlideX}, 0)`}
        >
          <rect
            x="32" y="58" width="236" height="170" rx="8"
            fill="#1a73e810"
            stroke="#1a73e8"
            strokeWidth="1.5"
            filter="url(#caa-shadow)"
          />
          <rect x="36" y="58" width="100" height="20" rx="4" fill="#1a73e8" />
          <text x="86" y="72" fontSize="10" fontWeight="600" fill="white" textAnchor="middle" fontFamily="sans-serif">
            Kafka Cluster
          </text>
          {/* Broker count indicator */}
          <g opacity="0.7">
            <rect x="190" y="59" width="68" height="16" rx="8" fill="#1a73e815" stroke="#1a73e8" strokeWidth="0.5" />
            <text x="224" y="71" fontSize="7.5" fill="#1a73e8" textAnchor="middle" fontFamily="sans-serif">
              3 Brokers (CKU)
            </text>
          </g>

          {/* ── Phase 2: Topics ── */}
          {[
            { name: 'topic-orders', partitions: 6, y: 95 },
            { name: 'topic-payments', partitions: 3, y: 130 },
            { name: 'topic-users', partitions: 4, y: 165 },
          ].map((topic, i) => (
            <g
              key={topic.name}
              opacity={topicOpacity(i)}
              transform={`translate(0, ${topicSlideY(i)})`}
            >
              <rect
                x="48" y={topic.y} width="200" height="26" rx="5"
                fill="#0d948815"
                stroke="#0d9488"
                strokeWidth="1"
              />
              <text
                x="58" y={topic.y + 17} fontSize="10" fill="#0d9488"
                fontWeight="500" fontFamily="monospace"
              >
                {topic.name}
              </text>
              <rect
                x="196" y={topic.y + 5} width="44" height="16" rx="8"
                fill="#0d9488"
              />
              <text
                x="218" y={topic.y + 17} fontSize="8" fill="white"
                textAnchor="middle" fontWeight="600" fontFamily="sans-serif"
              >
                P: {topic.partitions}
              </text>
            </g>
          ))}
        </g>

        {/* ── Phase 3: Flink Compute Pool ── */}
        <g
          opacity={flinkOpacity * pulseOpacity}
          transform={`translate(${flinkSlideX}, 0)`}
        >
          <rect
            x="290" y="58" width="240" height="90" rx="8"
            fill="#e8850c10"
            stroke="#e8850c"
            strokeWidth="1.5"
            filter="url(#caa-shadow)"
          />
          <rect x="294" y="58" width="120" height="20" rx="4" fill="#e8850c" />
          <text
            x="354" y="72" fontSize="10" fontWeight="600" fill="white"
            textAnchor="middle" fontFamily="sans-serif"
          >
            Flink Compute Pool
          </text>

          {/* Flink SQL badge */}
          <rect x="310" y="90" width="60" height="22" rx="4" fill="#e8850c20" stroke="#e8850c" strokeWidth="0.8" />
          <text x="340" y="105" fontSize="10" fontWeight="700" fill="#e8850c" textAnchor="middle" fontFamily="monospace">
            Flink SQL
          </text>

          {/* CFU count */}
          <rect x="385" y="90" width="55" height="22" rx="4" fill="#e8850c20" stroke="#e8850c" strokeWidth="0.8" />
          <text x="412" y="105" fontSize="9" fontWeight="600" fill="#e8850c" textAnchor="middle" fontFamily="sans-serif">
            10 CFUs
          </text>

          {/* Processing indicator */}
          <g opacity={phase >= 6 ? 0.9 : 0.4}>
            <rect x="310" y="120" width="128" height="16" rx="3" fill="#e8850c15" />
            <text x="374" y="131" fontSize="8" fill="#e8850c" textAnchor="middle" fontFamily="monospace">
              SELECT * FROM orders ...
            </text>
          </g>
        </g>

        {/* ── Phase 4: Schema Registry ── */}
        <g
          opacity={schemaOpacity * pulseOpacity}
          transform={`translate(0,0) scale(${schemaScale})`}
          style={{ transformOrigin: '410px 193px' }}
        >
          <rect
            x="290" y="162" width="240" height="66" rx="8"
            fill="#8b5cf610"
            stroke="#8b5cf6"
            strokeWidth="1.5"
            filter="url(#caa-shadow)"
          />
          <rect x="294" y="162" width="110" height="20" rx="4" fill="#8b5cf6" />
          <text
            x="349" y="176" fontSize="10" fontWeight="600" fill="white"
            textAnchor="middle" fontFamily="sans-serif"
          >
            Schema Registry
          </text>

          {/* Schema icon */}
          <g transform="translate(305, 190)">
            <rect width="14" height="14" rx="2" fill="#8b5cf630" stroke="#8b5cf6" strokeWidth="0.6" />
            <text x="7" y="11" fontSize="8" fill="#8b5cf6" textAnchor="middle" fontFamily="monospace">{'{}'}</text>
          </g>

          {/* Format badges */}
          <rect x="328" y="191" width="40" height="18" rx="9" fill="#8b5cf6" />
          <text x="348" y="204" fontSize="9" fontWeight="600" fill="white" textAnchor="middle" fontFamily="sans-serif">
            Avro
          </text>
          <rect x="375" y="191" width="42" height="18" rx="9" fill="#8b5cf6" opacity="0.8" />
          <text x="396" y="204" fontSize="9" fontWeight="600" fill="white" textAnchor="middle" fontFamily="sans-serif">
            JSON
          </text>
          <rect x="424" y="191" width="52" height="18" rx="9" fill="#8b5cf6" opacity="0.6" />
          <text x="450" y="204" fontSize="9" fontWeight="600" fill="white" textAnchor="middle" fontFamily="sans-serif">
            Protobuf
          </text>
        </g>

        {/* ── Phase 5: Connectors Bar ── */}
        <g
          opacity={connectorOpacity * pulseOpacity}
          transform={`scale(${connectorScale})`}
          style={{ transformOrigin: '280px 252px' }}
        >
          <rect
            x="54" y="238" width="452" height="30" rx="6"
            fill="#16a34a10"
            stroke="#16a34a"
            strokeWidth="1.5"
            filter="url(#caa-shadow)"
          />

          {/* Source Connector */}
          <g transform="translate(70, 243)">
            <rect width="86" height="20" rx="4" fill="#16a34a" />
            <text x="43" y="14" fontSize="9" fontWeight="600" fill="white" textAnchor="middle" fontFamily="sans-serif">
              Source Connector
            </text>
            {/* Arrow in icon */}
            <polygon points="8,10 14,6 14,14" fill="white" opacity="0.8" />
          </g>

          {/* Connectors label */}
          <text x="280" y="257" fontSize="10" fontWeight="500" fill="#16a34a" textAnchor="middle" fontFamily="sans-serif">
            Managed Connectors
          </text>

          {/* Sink Connector */}
          <g transform="translate(404, 243)">
            <rect width="86" height="20" rx="4" fill="#16a34a" />
            <text x="43" y="14" fontSize="9" fontWeight="600" fill="white" textAnchor="middle" fontFamily="sans-serif">
              Sink Connector
            </text>
            {/* Arrow out icon */}
            <polygon points="72,10 78,6 78,14" fill="white" opacity="0.8" />
          </g>
        </g>

        {/* ── Structural connection lines (visible once all layers built) ── */}
        {phase >= 5 && (
          <g opacity={phase >= 6 ? 0.5 : 0.25}>
            {/* Kafka Cluster to Schema Registry */}
            <line
              x1="268" y1="170" x2="290" y2="190"
              stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2"
              markerEnd="url(#caa-arrow)"
            />
            {/* Kafka Cluster to Flink */}
            <line
              x1="268" y1="108" x2="290" y2="105"
              stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2"
              markerEnd="url(#caa-arrow)"
            />
            {/* Flink to Schema Registry */}
            <line
              x1="410" y1="148" x2="410" y2="162"
              stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2"
              markerEnd="url(#caa-arrow)"
            />
          </g>
        )}

        {/* ── Phase 6+: Flow dashed lines ── */}
        {phase >= 6 && FLOW_PATH.map((seg, i) => (
          <line
            key={`flow-${i}`}
            x1={seg.x1} y1={seg.y1}
            x2={seg.x2} y2={seg.y2}
            stroke="url(#caa-flow-grad)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity={flowLineOpacity(i)}
            markerEnd={flowLineOpacity(i) > 0.4 ? 'url(#caa-arrow-active)' : 'url(#caa-arrow)'}
          />
        ))}

        {/* ── Phase 6: Data flow particles ── */}
        {particles.map((p) => (
          <g key={p.id} filter="url(#caa-glow)">
            <circle
              cx={p.x}
              cy={p.y}
              r="3.5"
              fill={p.color}
              opacity={0.9}
            >
              <animate
                attributeName="r"
                values="3;4.5;3"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Particle trail */}
            <circle
              cx={p.x - (FLOW_PATH[p.segment]
                ? (FLOW_PATH[p.segment].x2 - FLOW_PATH[p.segment].x1) * 0.03
                : 0)}
              cy={p.y - (FLOW_PATH[p.segment]
                ? (FLOW_PATH[p.segment].y2 - FLOW_PATH[p.segment].y1) * 0.03
                : 0)}
              r="2"
              fill={p.color}
              opacity={0.4}
            />
          </g>
        ))}

        {/* ── External system indicators (phase 6+) ── */}
        {phase >= 6 && (
          <>
            <g opacity={flowLineOpacity(0)}>
              <rect x="2" y="240" width="42" height="24" rx="4" fill="#64748b20" stroke="#64748b" strokeWidth="0.8" />
              <text x="23" y="256" fontSize="7" fill="#64748b" textAnchor="middle" fontFamily="sans-serif">DB / API</text>
            </g>
            <g opacity={flowLineOpacity(5)}>
              <rect x="516" y="240" width="38" height="24" rx="4" fill="#64748b20" stroke="#64748b" strokeWidth="0.8" />
              <text x="535" y="256" fontSize="7" fill="#64748b" textAnchor="middle" fontFamily="sans-serif">S3 / DW</text>
            </g>
          </>
        )}

        {/* ── Phase 7: Callout badge ── */}
        {phase === 7 && (
          <g opacity={phaseProgress}>
            <rect
              x="130" y="5" width="300" height="22" rx="11"
              fill="#1a73e8"
              opacity={pulseOpacity}
            />
            <text
              x="280" y="20" fontSize="10" fontWeight="700" fill="white"
              textAnchor="middle" fontFamily="sans-serif"
            >
              Fully managed. No infrastructure to operate.
            </text>
          </g>
        )}

        {/* ── Legend ── */}
        <g transform="translate(12, 284)">
          {LEGEND_ITEMS.map((item, i) => (
            <g key={item.label} transform={`translate(${i * 90}, 0)`}>
              <rect x="0" y="0" width="10" height="10" rx="2" fill={item.color} opacity="0.8" />
              <text x="14" y="9" fontSize="7.5" fill="var(--color-text, #64748b)" fontFamily="sans-serif">
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* ── Status Bar ── */}
      <div
        style={{
          marginTop: '8px',
          padding: '8px 14px',
          background: 'var(--color-surface, #f8fafc)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '6px',
          fontSize: '13px',
          color: 'var(--color-text, #334155)',
          textAlign: 'center',
          fontWeight: 500,
          minHeight: '20px',
          transition: 'opacity 0.2s ease',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: LEGEND_ITEMS[Math.min(phase, LEGEND_ITEMS.length - 1)].color,
            marginRight: '8px',
            verticalAlign: 'middle',
          }}
        />
        {STATUS_MESSAGES[phase]}
      </div>

      {/* ── Phase indicator dots ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '6px',
          marginTop: '6px',
        }}
      >
        {Array.from({ length: PHASE_COUNT }).map((_, i) => (
          <div
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: i === phase
                ? 'var(--color-accent, #1a73e8)'
                : 'var(--color-border, #cbd5e1)',
              transition: 'background-color 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}
