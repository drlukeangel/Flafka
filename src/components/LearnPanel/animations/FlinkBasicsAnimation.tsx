import { useState, useEffect } from 'react';
import './animations.css';

interface EventData {
  id: string;
  label: string;
  amount: number;
  matched: boolean;
}

const EVENTS: EventData[] = [
  { id: 'A', label: '$150', amount: 150, matched: true },
  { id: 'B', label: '$50', amount: 50, matched: false },
  { id: 'C', label: '$200', amount: 200, matched: true },
  { id: 'D', label: '$30', amount: 30, matched: false },
  { id: 'E', label: '$175', amount: 175, matched: true },
];

type EventPhase = 'entering' | 'processing' | 'exiting' | 'done';

interface ActiveEvent {
  data: EventData;
  phase: EventPhase;
  x: number;
  opacity: number;
}

export function FlinkBasicsAnimation() {
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);
  const [matchedCount, setMatchedCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [tick, setTick] = useState(0);
  const [queryPulse, setQueryPulse] = useState(false);

  // Main animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 100); // 100ms ticks
    return () => clearInterval(interval);
  }, []);

  // Pulse the query box
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setQueryPulse((p) => !p);
    }, 1500);
    return () => clearInterval(pulseInterval);
  }, []);

  // Spawn events and animate them
  useEffect(() => {
    // Each cycle is 80 ticks (8 seconds). Events spawn at ticks 0, 16, 32, 48, 64
    const cyclePos = tick % 80;

    // Reset counters at cycle start
    if (cyclePos === 0) {
      setMatchedCount(0);
      setFilteredCount(0);
      setActiveEvents([]);
    }

    // Spawn events at staggered intervals
    const spawnTicks = [0, 16, 32, 48, 64];
    const spawnIndex = spawnTicks.indexOf(cyclePos);
    if (spawnIndex !== -1) {
      const eventData = EVENTS[spawnIndex];
      setActiveEvents((prev) => [
        ...prev,
        { data: eventData, phase: 'entering', x: 10, opacity: 1 },
      ]);
    }

    // Update positions of all active events
    setActiveEvents((prev) =>
      prev
        .map((evt) => {
          const newX = evt.x + 4.5;
          let newPhase = evt.phase;
          let newOpacity = evt.opacity;

          if (newX < 195) {
            newPhase = 'entering';
          } else if (newX < 365) {
            newPhase = 'processing';
          } else {
            newPhase = 'exiting';
            if (!evt.data.matched) {
              newOpacity = Math.max(0.25, evt.opacity - 0.05);
            }
          }

          if (newX > 540) {
            newPhase = 'done';
          }

          return { ...evt, x: newX, phase: newPhase, opacity: newOpacity };
        })
        .filter((evt) => evt.phase !== 'done')
    );

    // Count when events cross the output threshold
    const outputThreshold = 370;
    setActiveEvents((prev) => {
      prev.forEach((evt) => {
        if (evt.x >= outputThreshold && evt.x < outputThreshold + 4.5) {
          if (evt.data.matched) {
            setMatchedCount((c) => c + 1);
          } else {
            setFilteredCount((c) => c + 1);
          }
        }
      });
      return prev;
    });
  }, [tick]);

  const getEventColor = (evt: ActiveEvent) => {
    if (evt.phase === 'exiting' && !evt.data.matched) {
      return 'var(--color-text-tertiary)';
    }
    if (evt.phase === 'exiting' && evt.data.matched) {
      return 'var(--color-accent)';
    }
    return 'var(--color-accent)';
  };

  return (
    <div className="concept-animation">
      <div
        style={{
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '8px',
          color: 'var(--color-text-tertiary)',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}
      >
        Flink SQL: Continuous Query Processing
      </div>

      <svg viewBox="0 0 560 200" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%' }}>
        {/* Background */}
        <rect width="560" height="200" fill="none" />

        {/* === LEFT: Kafka Input Pipe === */}
        {/* Pipe body */}
        <rect x="15" y="65" width="175" height="40" rx="8" ry="8"
          fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="1.5"
          strokeDasharray="4 2" opacity="0.7"
        />
        {/* Pipe label */}
        <text x="102" y="55" textAnchor="middle" fontSize="11" fontWeight="600"
          fill="var(--color-text-tertiary)"
        >
          Kafka Topic (input)
        </text>
        {/* Flow arrows inside pipe */}
        {[40, 70, 100, 130, 160].map((ax) => (
          <text key={ax} x={ax} y="90" fontSize="12" fill="var(--color-accent)" opacity="0.35">
            {'\u203A'}
          </text>
        ))}

        {/* === CENTER: Flink SQL Query Box === */}
        <rect x="210" y="45" width="140" height="80" rx="10" ry="10"
          fill="var(--color-surface)"
          stroke="var(--color-accent)"
          strokeWidth={queryPulse ? '2.5' : '1.5'}
          opacity={queryPulse ? 1 : 0.85}
          style={{ transition: 'stroke-width 0.8s ease, opacity 0.8s ease' }}
        />
        {/* Flink logo area */}
        <text x="280" y="65" textAnchor="middle" fontSize="10" fontWeight="700"
          fill="var(--color-accent)"
        >
          Flink SQL
        </text>
        {/* Query text */}
        <text x="280" y="82" textAnchor="middle" fontSize="9" fontFamily="monospace"
          fill="var(--color-text-tertiary)"
        >
          SELECT * FROM tx
        </text>
        <text x="280" y="95" textAnchor="middle" fontSize="9" fontFamily="monospace"
          fill="var(--color-text-tertiary)"
        >
          WHERE amount &gt; 100
        </text>
        {/* "Always running" indicator */}
        <circle cx="225" cy="115" r="3"
          fill={queryPulse ? 'var(--color-accent)' : 'var(--color-text-tertiary)'}
          style={{ transition: 'fill 0.8s ease' }}
        />
        <text x="232" y="118" fontSize="7.5" fill="var(--color-text-tertiary)" fontStyle="italic">
          continuously running
        </text>

        {/* === RIGHT: Results Output === */}
        <rect x="370" y="65" width="175" height="40" rx="8" ry="8"
          fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="1.5"
          strokeDasharray="4 2" opacity="0.7"
        />
        <text x="457" y="55" textAnchor="middle" fontSize="11" fontWeight="600"
          fill="var(--color-text-tertiary)"
        >
          Output Stream (results)
        </text>
        {/* Flow arrows inside output pipe */}
        {[395, 425, 455, 485, 515].map((ax) => (
          <text key={ax} x={ax} y="90" fontSize="12" fill="var(--color-accent)" opacity="0.35">
            {'\u203A'}
          </text>
        ))}

        {/* === Connecting Arrows === */}
        {/* Left pipe -> Query box */}
        <line x1="190" y1="85" x2="210" y2="85"
          stroke="var(--color-accent)" strokeWidth="2" markerEnd="url(#arrowhead)"
        />
        {/* Query box -> Right pipe */}
        <line x1="350" y1="85" x2="370" y2="85"
          stroke="var(--color-accent)" strokeWidth="2" markerEnd="url(#arrowhead)"
        />

        {/* Arrow marker definition */}
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6"
            refX="8" refY="3" orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="var(--color-accent)" />
          </marker>
        </defs>

        {/* === Animated Events === */}
        {activeEvents.map((evt) => {
          const color = getEventColor(evt);
          const isRejected = evt.phase === 'exiting' && !evt.data.matched;
          const yPos = 85;

          return (
            <g key={`${evt.data.id}-${Math.floor(evt.x)}`} opacity={evt.opacity}
              style={{ transition: 'opacity 0.3s ease' }}
            >
              {/* Event circle */}
              <circle cx={evt.x} cy={yPos} r="11"
                fill={color} opacity={isRejected ? 0.35 : 0.9}
                stroke={isRejected ? 'var(--color-text-tertiary)' : 'var(--color-accent)'}
                strokeWidth="1"
              />
              {/* Amount label */}
              <text x={evt.x} y={yPos + 3.5} textAnchor="middle" fontSize="7"
                fontWeight="600" fontFamily="monospace"
                fill={isRejected ? 'var(--color-text-tertiary)' : '#fff'}
              >
                {evt.data.label}
              </text>
              {/* Rejection X mark */}
              {isRejected && (
                <>
                  <line x1={evt.x - 5} y1={yPos - 5} x2={evt.x + 5} y2={yPos + 5}
                    stroke="var(--color-text-tertiary)" strokeWidth="2" opacity="0.8"
                  />
                  <line x1={evt.x + 5} y1={yPos - 5} x2={evt.x - 5} y2={yPos + 5}
                    stroke="var(--color-text-tertiary)" strokeWidth="2" opacity="0.8"
                  />
                </>
              )}
            </g>
          );
        })}

        {/* === Running Counter === */}
        <rect x="370" y="115" width="175" height="22" rx="4" ry="4"
          fill="var(--color-surface)" opacity="0.8"
        />
        <text x="457" y="130" textAnchor="middle" fontSize="9" fill="var(--color-text-tertiary)">
          <tspan fill="var(--color-accent)" fontWeight="600">{matchedCount} matched</tspan>
          <tspan>, </tspan>
          <tspan fill="var(--color-text-tertiary)" fontWeight="600">{filteredCount} filtered</tspan>
        </text>

        {/* === Legend === */}
        <g transform="translate(15, 160)">
          {/* Input event */}
          <circle cx="8" cy="8" r="5" fill="var(--color-accent)" opacity="0.9" />
          <text x="18" y="11" fontSize="8.5" fill="var(--color-text-tertiary)">Input Event</text>

          {/* Matched */}
          <circle cx="108" cy="8" r="5" fill="var(--color-accent)" />
          <text x="118" y="11" fontSize="8.5" fill="var(--color-text-tertiary)">Matched</text>

          {/* Filtered */}
          <circle cx="193" cy="8" r="5" fill="var(--color-text-tertiary)" opacity="0.4" />
          <line x1="189" y1="4" x2="197" y2="12"
            stroke="var(--color-text-tertiary)" strokeWidth="1.5" opacity="0.7"
          />
          <line x1="197" y1="4" x2="189" y2="12"
            stroke="var(--color-text-tertiary)" strokeWidth="1.5" opacity="0.7"
          />
          <text x="203" y="11" fontSize="8.5" fill="var(--color-text-tertiary)">Filtered Out</text>
        </g>

        {/* === "Never stops" annotation === */}
        <text x="280" y="190" textAnchor="middle" fontSize="8" fontStyle="italic"
          fill="var(--color-text-tertiary)" opacity="0.7"
        >
          The query never stops. Events flow in, results flow out - continuously.
        </text>
      </svg>
    </div>
  );
}
