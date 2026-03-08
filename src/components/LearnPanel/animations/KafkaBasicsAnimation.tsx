import { useState, useEffect } from 'react';
import './animations.css';
import { useAnimationSpeed } from './AnimationSpeedContext';

interface Message {
  id: number;
  key: string;
  partition: number;
  phase: number;
}

interface AnimatingMessage {
  id: number;
  key: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  type: 'produce' | 'consume';
  partition: number;
}

const PARTITION_Y = [88, 128, 168];
const PARTITION_X_START = 185;
const PARTITION_X_END = 375;
const PARTITION_WIDTH = PARTITION_X_END - PARTITION_X_START;
const CELL_WIDTH = 30;
const PRODUCER_X = 40;
const PRODUCER_1_Y = 95;
const PRODUCER_2_Y = 165;
const CONSUMER_X = 470;
const CONSUMER_1_Y = 95;
const CONSUMER_2_Y = 165;

const PHASE_DURATION = 1500;
const TOTAL_PHASES = 7;

export function KafkaBasicsAnimation() {
  const [phase, setPhase] = useState(0);
  const [animProgress, setAnimProgress] = useState(0);
  const { paused } = useAnimationSpeed();

  // Track offsets per partition
  const [offsets, setOffsets] = useState([0, 0, 0]);
  // Track consumer offsets per partition
  const [consumerOffsets, setConsumerOffsets] = useState([0, 0, 0]);
  // Messages stored in partitions
  const [partitionMessages, setPartitionMessages] = useState<Message[][]>([[], [], []]);

  useEffect(() => {
    let frameId: number;
    let startTime = Date.now();
    let currentPhase = 0;

    const resetState = () => {
      setOffsets([0, 0, 0]);
      setConsumerOffsets([0, 0, 0]);
      setPartitionMessages([[], [], []]);
      currentPhase = 0;
      startTime = Date.now();
    };

    const tick = () => {
      if (paused) { frameId = requestAnimationFrame(tick); return; }
      const elapsed = Date.now() - startTime;
      const phaseIndex = Math.floor(elapsed / PHASE_DURATION);
      const phaseProgress = (elapsed % PHASE_DURATION) / PHASE_DURATION;

      if (phaseIndex >= TOTAL_PHASES) {
        resetState();
        setPhase(0);
        setAnimProgress(0);
        frameId = requestAnimationFrame(tick);
        return;
      }

      if (phaseIndex !== currentPhase) {
        currentPhase = phaseIndex;
        // Apply state changes when entering a new phase (commit previous phase)
        applyPhase(phaseIndex - 1);
      }

      setPhase(phaseIndex);
      setAnimProgress(phaseProgress);
      frameId = requestAnimationFrame(tick);
    };

    const applyPhase = (completedPhase: number) => {
      switch (completedPhase) {
        case 0: // Producer 1: key=A -> P0
          setOffsets(prev => [prev[0] + 1, prev[1], prev[2]]);
          setPartitionMessages(prev => {
            const next = prev.map(p => [...p]);
            next[0].push({ id: 1, key: 'A', partition: 0, phase: 0 });
            return next;
          });
          break;
        case 1: // Producer 2: key=B -> P1
          setOffsets(prev => [prev[0], prev[1] + 1, prev[2]]);
          setPartitionMessages(prev => {
            const next = prev.map(p => [...p]);
            next[1].push({ id: 2, key: 'B', partition: 1, phase: 1 });
            return next;
          });
          break;
        case 2: // Producer 1: key=C -> P2
          setOffsets(prev => [prev[0], prev[1], prev[2] + 1]);
          setPartitionMessages(prev => {
            const next = prev.map(p => [...p]);
            next[2].push({ id: 3, key: 'C', partition: 2, phase: 2 });
            return next;
          });
          break;
        case 3: // Consumer 1 reads from P0
          setConsumerOffsets(prev => [1, prev[1], prev[2]]);
          break;
        case 4: // Producer 2: key=A -> P0 (same key = same partition!)
          setOffsets(prev => [prev[0] + 1, prev[1], prev[2]]);
          setPartitionMessages(prev => {
            const next = prev.map(p => [...p]);
            next[0].push({ id: 4, key: 'A', partition: 0, phase: 4 });
            return next;
          });
          break;
        case 5: // Consumer 1 reads P1, Consumer 2 reads P2
          setConsumerOffsets(prev => [prev[0], 1, 1]);
          break;
        default:
          break;
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [paused]);

  // Compute animated message position
  const getAnimatingMessage = (): AnimatingMessage[] => {
    const msgs: AnimatingMessage[] = [];
    const eased = easeInOutCubic(Math.min(animProgress * 1.2, 1));

    switch (phase) {
      case 0: { // Producer 1 -> P0
        msgs.push({
          id: 100, key: 'A', partition: 0, type: 'produce', progress: eased,
          fromX: PRODUCER_X + 60, fromY: PRODUCER_1_Y + 12,
          toX: PARTITION_X_START + offsets[0] * CELL_WIDTH + 4, toY: PARTITION_Y[0] + 4,
        });
        break;
      }
      case 1: { // Producer 2 -> P1
        msgs.push({
          id: 101, key: 'B', partition: 1, type: 'produce', progress: eased,
          fromX: PRODUCER_X + 60, fromY: PRODUCER_2_Y + 12,
          toX: PARTITION_X_START + offsets[1] * CELL_WIDTH + 4, toY: PARTITION_Y[1] + 4,
        });
        break;
      }
      case 2: { // Producer 1 -> P2
        msgs.push({
          id: 102, key: 'C', partition: 2, type: 'produce', progress: eased,
          fromX: PRODUCER_X + 60, fromY: PRODUCER_1_Y + 12,
          toX: PARTITION_X_START + offsets[2] * CELL_WIDTH + 4, toY: PARTITION_Y[2] + 4,
        });
        break;
      }
      case 3: { // Consumer 1 reads P0
        msgs.push({
          id: 103, key: 'A', partition: 0, type: 'consume', progress: eased,
          fromX: PARTITION_X_START + (consumerOffsets[0]) * CELL_WIDTH + 4, fromY: PARTITION_Y[0] + 4,
          toX: CONSUMER_X, toY: CONSUMER_1_Y + 12,
        });
        break;
      }
      case 4: { // Producer 2 -> P0 (key=A again!)
        msgs.push({
          id: 104, key: 'A', partition: 0, type: 'produce', progress: eased,
          fromX: PRODUCER_X + 60, fromY: PRODUCER_2_Y + 12,
          toX: PARTITION_X_START + offsets[0] * CELL_WIDTH + 4, toY: PARTITION_Y[0] + 4,
        });
        break;
      }
      case 5: { // Consumer 1 reads P1, Consumer 2 reads P2
        msgs.push({
          id: 105, key: 'B', partition: 1, type: 'consume', progress: eased,
          fromX: PARTITION_X_START + (consumerOffsets[1]) * CELL_WIDTH + 4, fromY: PARTITION_Y[1] + 4,
          toX: CONSUMER_X, toY: CONSUMER_1_Y + 12,
        });
        msgs.push({
          id: 106, key: 'C', partition: 2, type: 'consume', progress: eased,
          fromX: PARTITION_X_START + (consumerOffsets[2]) * CELL_WIDTH + 4, fromY: PARTITION_Y[2] + 4,
          toX: CONSUMER_X, toY: CONSUMER_2_Y + 12,
        });
        break;
      }
      case 6: { // Show final state - offset pointers visible
        break;
      }
    }
    return msgs;
  };

  const animatingMessages = getAnimatingMessage();

  // Phase label
  const getPhaseLabel = (): string => {
    switch (phase) {
      case 0: return 'Producer 1 sends key=A -> Partition 0';
      case 1: return 'Producer 2 sends key=B -> Partition 1';
      case 2: return 'Producer 1 sends key=C -> Partition 2';
      case 3: return 'Consumer 1 reads from Partition 0';
      case 4: return 'key=A -> Partition 0 again (same key = same partition!)';
      case 5: return 'Consumer 1 reads P1, Consumer 2 reads P2 (parallel!)';
      case 6: return 'All offsets advanced. Restarting...';
      default: return '';
    }
  };

  return (
    <div className="concept-animation">
      <h4>Kafka: Topics, Partitions &amp; Consumer Groups</h4>
      <svg viewBox="0 0 560 260" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
        <defs>
          <marker id="kafka-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-border)" />
          </marker>
        </defs>

        {/* Title */}
        <text x="280" y="18" textAnchor="middle" fontSize="11" fontWeight="bold" fill="var(--color-text, #e2e8f0)">
          Topic: &quot;orders&quot;
        </text>

        {/* === PRODUCERS (LEFT) === */}
        <rect x={PRODUCER_X} y={PRODUCER_1_Y} width="60" height="28" rx="4"
          fill="var(--color-accent)" opacity="0.15" stroke="var(--color-accent)" strokeWidth="1.5" />
        <text x={PRODUCER_X + 30} y={PRODUCER_1_Y + 12} textAnchor="middle" fontSize="8" fontWeight="bold"
          fill="var(--color-accent)">Producer 1</text>
        <text x={PRODUCER_X + 30} y={PRODUCER_1_Y + 22} textAnchor="middle" fontSize="7"
          fill="var(--color-accent)" opacity="0.7">keys: A, C</text>

        <rect x={PRODUCER_X} y={PRODUCER_2_Y} width="60" height="28" rx="4"
          fill="var(--color-accent)" opacity="0.15" stroke="var(--color-accent)" strokeWidth="1.5" />
        <text x={PRODUCER_X + 30} y={PRODUCER_2_Y + 12} textAnchor="middle" fontSize="8" fontWeight="bold"
          fill="var(--color-accent)">Producer 2</text>
        <text x={PRODUCER_X + 30} y={PRODUCER_2_Y + 22} textAnchor="middle" fontSize="7"
          fill="var(--color-accent)" opacity="0.7">keys: B, A</text>

        {/* Arrows from producers to partitions */}
        <line x1={PRODUCER_X + 62} y1={PRODUCER_1_Y + 14} x2={PARTITION_X_START - 8} y2={PRODUCER_1_Y + 14}
          stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3,2" markerEnd="url(#kafka-arrow)" opacity="0.4" />
        <line x1={PRODUCER_X + 62} y1={PRODUCER_2_Y + 14} x2={PARTITION_X_START - 8} y2={PRODUCER_2_Y + 14}
          stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3,2" markerEnd="url(#kafka-arrow)" opacity="0.4" />

        {/* === PARTITIONS (CENTER) === */}
        {[0, 1, 2].map(pIdx => {
          const y = PARTITION_Y[pIdx];
          return (
            <g key={`partition-${pIdx}`}>
              {/* Partition label */}
              <text x={PARTITION_X_START + PARTITION_WIDTH / 2} y={y - 5} textAnchor="middle"
                fontSize="7" fill="var(--color-text, #94a3b8)" opacity="0.7">
                Partition {pIdx}
              </text>
              {/* Partition background (highway lane) */}
              <rect x={PARTITION_X_START} y={y} width={PARTITION_WIDTH} height="24" rx="3"
                fill="var(--color-surface, #1e293b)" stroke="var(--color-border, #334155)" strokeWidth="1" />
              {/* Offset cells */}
              {Array.from({ length: 6 }).map((_, cellIdx) => (
                <rect key={cellIdx} x={PARTITION_X_START + cellIdx * CELL_WIDTH + 2} y={y + 2}
                  width={CELL_WIDTH - 4} height="20" rx="2"
                  fill="var(--color-border, #334155)" opacity="0.3"
                  stroke="var(--color-border, #334155)" strokeWidth="0.5" />
              ))}
              {/* Offset numbers along bottom */}
              {Array.from({ length: 6 }).map((_, cellIdx) => (
                <text key={`off-${cellIdx}`} x={PARTITION_X_START + cellIdx * CELL_WIDTH + CELL_WIDTH / 2}
                  y={y + 32} textAnchor="middle" fontSize="6" fill="var(--color-text, #64748b)" opacity="0.4">
                  {cellIdx}
                </text>
              ))}
              {/* Stored messages in partition */}
              {partitionMessages[pIdx].map((msg, mIdx) => (
                <g key={`stored-${msg.id}`}>
                  <rect x={PARTITION_X_START + mIdx * CELL_WIDTH + 4} y={y + 4}
                    width={CELL_WIDTH - 8} height="16" rx="2"
                    fill={msg.key === 'A' ? '#f59e0b' : msg.key === 'B' ? '#3b82f6' : '#10b981'} opacity="0.8" />
                  <text x={PARTITION_X_START + mIdx * CELL_WIDTH + CELL_WIDTH / 2} y={y + 15}
                    textAnchor="middle" fontSize="7" fontWeight="bold" fill="#fff">
                    {msg.key}
                  </text>
                </g>
              ))}
              {/* Write offset indicator */}
              <text x={PARTITION_X_START + PARTITION_WIDTH + 6} y={y + 15}
                fontSize="7" fill="var(--color-text, #94a3b8)" opacity="0.6">
                off:{offsets[pIdx]}
              </text>
            </g>
          );
        })}

        {/* Consumer offset pointers (triangles below partitions) */}
        {[0, 1, 2].map(pIdx => {
          const cOff = consumerOffsets[pIdx];
          if (cOff === 0) return null;
          const pointerX = PARTITION_X_START + cOff * CELL_WIDTH;
          const y = PARTITION_Y[pIdx] + 24;
          return (
            <g key={`cptr-${pIdx}`}>
              <polygon
                points={`${pointerX},${y + 2} ${pointerX - 4},${y + 8} ${pointerX + 4},${y + 8}`}
                fill="#8b5cf6" opacity="0.8"
              />
              <text x={pointerX} y={y + 16} textAnchor="middle" fontSize="6" fill="#8b5cf6">
                read
              </text>
            </g>
          );
        })}

        {/* === CONSUMERS (RIGHT) === */}
        {/* Arrows from partitions to consumers */}
        <line x1={PARTITION_X_END + 8} y1={PARTITION_Y[0] + 12} x2={CONSUMER_X - 2} y2={CONSUMER_1_Y + 14}
          stroke="#8b5cf6" strokeWidth="1" strokeDasharray="3,2" markerEnd="url(#kafka-arrow)" opacity="0.4" />
        <line x1={PARTITION_X_END + 8} y1={PARTITION_Y[1] + 12} x2={CONSUMER_X - 2} y2={CONSUMER_1_Y + 14}
          stroke="#8b5cf6" strokeWidth="1" strokeDasharray="3,2" markerEnd="url(#kafka-arrow)" opacity="0.4" />
        <line x1={PARTITION_X_END + 8} y1={PARTITION_Y[2] + 12} x2={CONSUMER_X - 2} y2={CONSUMER_2_Y + 14}
          stroke="#8b5cf6" strokeWidth="1" strokeDasharray="3,2" markerEnd="url(#kafka-arrow)" opacity="0.4" />

        <rect x={CONSUMER_X} y={CONSUMER_1_Y} width="68" height="28" rx="4"
          fill="#8b5cf6" opacity="0.15" stroke="#8b5cf6" strokeWidth="1.5" />
        <text x={CONSUMER_X + 34} y={CONSUMER_1_Y + 12} textAnchor="middle" fontSize="8" fontWeight="bold"
          fill="#8b5cf6">Consumer 1</text>
        <text x={CONSUMER_X + 34} y={CONSUMER_1_Y + 22} textAnchor="middle" fontSize="7"
          fill="#8b5cf6" opacity="0.7">reads P0, P1</text>

        <rect x={CONSUMER_X} y={CONSUMER_2_Y} width="68" height="28" rx="4"
          fill="#8b5cf6" opacity="0.15" stroke="#8b5cf6" strokeWidth="1.5" />
        <text x={CONSUMER_X + 34} y={CONSUMER_2_Y + 12} textAnchor="middle" fontSize="8" fontWeight="bold"
          fill="#8b5cf6">Consumer 2</text>
        <text x={CONSUMER_X + 34} y={CONSUMER_2_Y + 22} textAnchor="middle" fontSize="7"
          fill="#8b5cf6" opacity="0.7">reads P2</text>

        {/* Consumer group label */}
        <rect x={CONSUMER_X - 4} y={CONSUMER_1_Y - 14} width="76" height="12" rx="3"
          fill="#8b5cf6" opacity="0.1" />
        <text x={CONSUMER_X + 34} y={CONSUMER_1_Y - 5} textAnchor="middle" fontSize="7"
          fill="#8b5cf6" opacity="0.7">Consumer Group</text>

        {/* === ANIMATING MESSAGES === */}
        {animatingMessages.map(msg => {
          const x = msg.fromX + (msg.toX - msg.fromX) * msg.progress;
          const y = msg.fromY + (msg.toY - msg.fromY) * msg.progress;
          const color = msg.key === 'A' ? '#f59e0b' : msg.key === 'B' ? '#3b82f6' : '#10b981';
          return (
            <g key={msg.id}>
              {/* Glow effect */}
              <circle cx={x + 11} cy={y + 8} r="10" fill={color} opacity={0.15} />
              {/* Message rect */}
              <rect x={x} y={y} width="22" height="16" rx="3"
                fill={color} opacity="0.9" stroke={color} strokeWidth="0.5" />
              <text x={x + 11} y={y + 8} textAnchor="middle" dominantBaseline="middle"
                fontSize="7" fontWeight="bold" fill="#fff">
                {msg.key}
              </text>
              {/* Key label floating above */}
              {msg.type === 'produce' && msg.progress < 0.7 && (
                <text x={x + 11} y={y - 4} textAnchor="middle" fontSize="6"
                  fill={color} opacity={1 - msg.progress}>
                  key={msg.key}
                </text>
              )}
            </g>
          );
        })}

        {/* === PHASE ANNOTATION === */}
        {phase === 4 && (
          <g>
            <rect x="155" y="40" width="250" height="18" rx="4" fill="#f59e0b" opacity="0.12" />
            <text x="280" y="52" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#f59e0b">
              Same key &quot;A&quot; always routes to the same Partition 0!
            </text>
          </g>
        )}
        {phase === 5 && (
          <g>
            <rect x="155" y="40" width="250" height="18" rx="4" fill="#8b5cf6" opacity="0.12" />
            <text x="280" y="52" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#8b5cf6">
              Consumers read different partitions in parallel!
            </text>
          </g>
        )}

        {/* === STATUS BAR === */}
        <rect x="30" y="218" width="500" height="18" rx="4"
          fill="var(--color-surface, #1e293b)" stroke="var(--color-border, #334155)" strokeWidth="0.5" />
        <text x="280" y="230" textAnchor="middle" fontSize="7.5"
          fill="var(--color-text, #94a3b8)">
          {getPhaseLabel()}
        </text>

        {/* === LEGEND === */}
        <g transform="translate(30, 245)">
          {/* Producer */}
          <circle cx="6" cy="6" r="4" fill="var(--color-accent)" opacity="0.8" />
          <text x="14" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">Producer</text>
          {/* Consumer */}
          <circle cx="76" cy="6" r="4" fill="#8b5cf6" opacity="0.8" />
          <text x="84" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">Consumer</text>
          {/* Message */}
          <rect x="143" y="2" width="10" height="8" rx="1.5" fill="#f59e0b" opacity="0.8" />
          <text x="157" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">Message</text>
          {/* Partition */}
          <rect x="213" y="2" width="16" height="8" rx="1.5"
            fill="var(--color-surface, #1e293b)" stroke="var(--color-border, #334155)" strokeWidth="0.5" />
          <text x="233" y="9" fontSize="7" fill="var(--color-text, #94a3b8)">Partition</text>
          {/* Key colors */}
          <rect x="295" y="2" width="8" height="8" rx="1" fill="#f59e0b" />
          <text x="306" y="9" fontSize="6" fill="var(--color-text, #94a3b8)">A</text>
          <rect x="318" y="2" width="8" height="8" rx="1" fill="#3b82f6" />
          <text x="329" y="9" fontSize="6" fill="var(--color-text, #94a3b8)">B</text>
          <rect x="341" y="2" width="8" height="8" rx="1" fill="#10b981" />
          <text x="352" y="9" fontSize="6" fill="var(--color-text, #94a3b8)">C</text>
        </g>
      </svg>
    </div>
  );
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
