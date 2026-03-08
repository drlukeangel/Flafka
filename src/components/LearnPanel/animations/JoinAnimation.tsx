import './animations.css';
import { useAnimationTick } from './useAnimationTick';

/**
 * JoinAnimation
 *
 * Animated SVG showing how stream joins work in Flink SQL.
 * Two parallel streams (Orders on top, Payments on bottom) flow from left
 * to right. Events with matching keys connect via arcs and produce combined
 * results in a "Join Result" area on the right. Unmatched events fade out
 * with a timeout indicator.
 *
 * ~8-second cycle:
 *   Phase 1: Order events appear (O(K1), O(K2), O(K3))
 *   Phase 2: Payment events appear (P(K1), P(K3))
 *   Phase 3: K1 matches — arc + green glow + result
 *   Phase 4: K3 matches — arc + green glow + result
 *   Phase 5: K2 fades — no match, timeout indicator
 */

export function JoinAnimation() {
  const tick = useAnimationTick(80);

  // -- Geometry constants --
  const orderY = 70;
  const paymentY = 155;
  const resultAreaX = 390;

  // -- Easing helper --
  const easeOut = (progress: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, progress)), 3);

  // -- Order events slide in from left --
  const orderSlots = [
    { key: 'K1', targetX: 100, startTick: 2 },
    { key: 'K2', targetX: 190, startTick: 7 },
    { key: 'K3', targetX: 280, startTick: 12 },
  ];

  const getSlideX = (startTick: number, targetX: number) => {
    const elapsed = tick - startTick;
    if (elapsed < 0) return -60;
    const progress = easeOut(elapsed / 8);
    return 10 + progress * (targetX - 10);
  };

  // -- Payment events slide in --
  const paymentSlots = [
    { key: 'K1', targetX: 100, startTick: 18 },
    { key: 'K3', targetX: 280, startTick: 24 },
  ];

  // -- Match & fade state --
  const k1Matched = tick >= 34;
  const k3Matched = tick >= 48;
  const k2Fading = tick >= 62;

  const k1ArcProgress = k1Matched ? easeOut((tick - 34) / 6) : 0;
  const k3ArcProgress = k3Matched ? easeOut((tick - 48) / 6) : 0;
  const k2FadeOpacity = k2Fading ? Math.max(0.2, 1 - (tick - 62) / 12) : 1;
  const k2QuestionOpacity = k2Fading ? easeOut((tick - 62) / 6) : 0;

  // -- Result appearance --
  const k1ResultOpacity = k1Matched ? easeOut((tick - 36) / 5) : 0;
  const k3ResultOpacity = k3Matched ? easeOut((tick - 50) / 5) : 0;
  const k1Glowing = tick >= 34 && tick < 45;
  const k3Glowing = tick >= 48 && tick < 60;

  // -- Render helpers --
  const renderEventRect = (
    x: number,
    y: number,
    label: string,
    fill: string,
    opacity: number,
    glowing: boolean,
  ) => (
    <g>
      {glowing && (
        <rect x={x - 3} y={y - 17} width={56} height={30} rx={9} fill="#10b981" opacity={0.2}>
          <animate attributeName="opacity" values="0.15;0.35;0.15" dur="0.8s" repeatCount="indefinite" />
        </rect>
      )}
      <rect
        x={x}
        y={y - 14}
        width={50}
        height={26}
        rx={7}
        fill={fill}
        opacity={opacity * 0.9}
      />
      <text
        x={x + 25}
        y={y + 2}
        fontSize="11"
        fontWeight="600"
        fill="#fff"
        fontFamily="monospace"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );

  const renderArc = (
    x: number,
    progress: number,
    glowing: boolean,
  ) => {
    if (progress <= 0) return null;
    const midY = (orderY + paymentY) / 2;
    return (
      <g opacity={progress}>
        {/* Vertical connector arc between matched events */}
        <path
          d={`M ${x + 25} ${orderY + 12} C ${x + 50} ${midY}, ${x + 50} ${midY}, ${x + 25} ${paymentY - 14}`}
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Small matching indicator dot at arc midpoint */}
        {glowing && (
          <circle cx={x + 50} cy={midY} r="4" fill="#10b981">
            <animate attributeName="r" values="3;5;3" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;1;0.6" dur="0.8s" repeatCount="indefinite" />
          </circle>
        )}
        {/* Horizontal dashed line to result area */}
        <line
          x1={x + 50}
          y1={midY}
          x2={resultAreaX - 10}
          y2={midY}
          stroke="#10b981"
          strokeWidth="1.5"
          strokeDasharray="5 3"
          opacity={0.5}
        >
          <animate attributeName="stroke-dashoffset" values="16;0" dur="1.5s" repeatCount="indefinite" />
        </line>
        <polygon
          points={`${resultAreaX - 12},${midY - 3} ${resultAreaX - 4},${midY} ${resultAreaX - 12},${midY + 3}`}
          fill="#10b981"
          opacity={0.5}
        />
      </g>
    );
  };

  return (
    <div className="concept-animation">
      <p className="concept-animation__title">How Stream Joins Match Events</p>
      <svg
        className="concept-animation__svg"
        viewBox="0 0 560 240"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Stream join animation: two parallel event streams are joined by matching keys, producing combined results while unmatched events time out"
        role="img"
      >
        {/* Background */}
        <rect x="0" y="0" width="560" height="240" rx="12" fill="var(--color-surface, #1a1a2e)" />

        {/* Stream labels */}
        <text x="14" y={orderY - 22} fontSize="11" fontWeight="600" fill="var(--color-accent, #3b82f6)" fontFamily="sans-serif">
          Orders
        </text>
        <text x="14" y={paymentY - 22} fontSize="11" fontWeight="600" fill="#8b5cf6" fontFamily="sans-serif">
          Payments
        </text>

        {/* Stream lane lines */}
        <line x1="60" y1={orderY} x2="340" y2={orderY} stroke="var(--color-accent, #3b82f6)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3" />
        <line x1="60" y1={paymentY} x2="340" y2={paymentY} stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3" />

        {/* Lane arrow heads */}
        <polygon points="340,66 349,70 340,74" fill="var(--color-accent, #3b82f6)" opacity="0.4" />
        <polygon points="340,151 349,155 340,159" fill="#8b5cf6" opacity="0.4" />

        {/* Result area */}
        <rect x={resultAreaX} y="55" width="150" height="130" rx="10" fill="rgba(16,185,129,0.05)" stroke="#10b981" strokeWidth="1" strokeDasharray="5 3" opacity="0.5" />
        <text x={resultAreaX + 75} y="73" fontSize="10" fill="#10b981" fontFamily="sans-serif" textAnchor="middle" opacity="0.6" fontWeight="600">
          Join Result
        </text>

        {/* ── ORDER EVENTS ── */}
        {orderSlots.map((slot) => {
          const visible = tick >= slot.startTick;
          if (!visible) return null;
          const x = getSlideX(slot.startTick, slot.targetX);
          const isK2 = slot.key === 'K2';
          const fill = isK2 && k2Fading ? '#6b7280' : 'var(--color-accent, #3b82f6)';
          const opacity = isK2 ? k2FadeOpacity : 1;
          const glowing =
            (slot.key === 'K1' && k1Glowing) ||
            (slot.key === 'K3' && k3Glowing);
          return (
            <g key={`o-${slot.key}`}>
              {renderEventRect(x, orderY, `O(${slot.key})`, fill, opacity, glowing)}
              {/* K2 timeout indicator */}
              {isK2 && k2Fading && (
                <g opacity={k2QuestionOpacity}>
                  <text
                    x={x + 25}
                    y={orderY + 26}
                    fontSize="13"
                    fill="#9ca3af"
                    fontFamily="sans-serif"
                    textAnchor="middle"
                    fontWeight="600"
                  >
                    ?
                  </text>
                  <text
                    x={x + 25}
                    y={orderY + 38}
                    fontSize="8"
                    fill="#6b7280"
                    fontFamily="sans-serif"
                    textAnchor="middle"
                  >
                    timeout
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── PAYMENT EVENTS ── */}
        {paymentSlots.map((slot) => {
          const visible = tick >= slot.startTick;
          if (!visible) return null;
          const x = getSlideX(slot.startTick, slot.targetX);
          const glowing =
            (slot.key === 'K1' && k1Glowing) ||
            (slot.key === 'K3' && k3Glowing);
          return (
            <g key={`p-${slot.key}`}>
              {renderEventRect(x, paymentY, `P(${slot.key})`, '#8b5cf6', 1, glowing)}
            </g>
          );
        })}

        {/* ── MATCHING ARCS ── */}
        {renderArc(orderSlots[0].targetX, k1ArcProgress, k1Glowing)}
        {renderArc(orderSlots[2].targetX, k3ArcProgress, k3Glowing)}

        {/* ── JOIN RESULTS ── */}
        {/* K1 result */}
        {k1ResultOpacity > 0 && (
          <g opacity={k1ResultOpacity}>
            {k1Glowing && (
              <rect x={resultAreaX + 8} y="82" width="132" height="28" rx="8" fill="#10b981" opacity="0.12">
                <animate attributeName="opacity" values="0.08;0.2;0.08" dur="1s" repeatCount="indefinite" />
              </rect>
            )}
            <rect x={resultAreaX + 10} y="84" width="128" height="24" rx="7" fill="#10b981" opacity="0.85" />
            <text x={resultAreaX + 74} y="100" fontSize="10" fontWeight="700" fill="#fff" fontFamily="monospace" textAnchor="middle">
              O(K1) + P(K1)
            </text>
          </g>
        )}

        {/* K3 result */}
        {k3ResultOpacity > 0 && (
          <g opacity={k3ResultOpacity}>
            {k3Glowing && (
              <rect x={resultAreaX + 8} y="116" width="132" height="28" rx="8" fill="#10b981" opacity="0.12">
                <animate attributeName="opacity" values="0.08;0.2;0.08" dur="1s" repeatCount="indefinite" />
              </rect>
            )}
            <rect x={resultAreaX + 10} y="118" width="128" height="24" rx="7" fill="#10b981" opacity="0.85" />
            <text x={resultAreaX + 74} y="134" fontSize="10" fontWeight="700" fill="#fff" fontFamily="monospace" textAnchor="middle">
              O(K3) + P(K3)
            </text>
          </g>
        )}

        {/* K2 unmatched result placeholder */}
        {k2Fading && (
          <g opacity={k2QuestionOpacity * 0.5}>
            <rect x={resultAreaX + 10} y="152" width="128" height="24" rx="7" fill="#6b7280" opacity="0.3" strokeDasharray="4 3" stroke="#6b7280" strokeWidth="1" />
            <text x={resultAreaX + 74} y="168" fontSize="10" fontWeight="600" fill="#9ca3af" fontFamily="monospace" textAnchor="middle">
              O(K2) + ???
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="concept-animation__legend">
        <span className="concept-animation__legend-item">
          <span className="concept-animation__legend-dot" style={{ background: 'var(--color-accent, #3b82f6)' }} />
          Stream A
        </span>
        <span className="concept-animation__legend-item">
          <span className="concept-animation__legend-dot" style={{ background: '#8b5cf6' }} />
          Stream B
        </span>
        <span className="concept-animation__legend-item">
          <span className="concept-animation__legend-dot" style={{ background: '#10b981' }} />
          Matched
        </span>
        <span className="concept-animation__legend-item">
          <span className="concept-animation__legend-dot" style={{ background: '#6b7280' }} />
          Unmatched
        </span>
      </div>
    </div>
  );
}
