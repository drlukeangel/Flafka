import React, { useMemo } from 'react';
import type { DataFlowDef } from '../../types';
import './DataFlowDiagram.css';

interface Props {
  def: DataFlowDef;
  fullPage?: boolean;
}

const NODE_COLORS: Record<string, { fill: string; stroke: string; dot: string }> = {
  source: { fill: 'var(--df-source-fill, #EFF6FF)', stroke: 'var(--df-source-stroke, #3B82F6)', dot: '#3B82F6' },
  processor: { fill: 'var(--df-proc-fill, #F3F0FF)', stroke: 'var(--df-proc-stroke, #4933D7)', dot: '#4933D7' },
  sink: { fill: 'var(--df-sink-fill, #ECFDF5)', stroke: 'var(--df-sink-stroke, #22C55E)', dot: '#22C55E' },
};

interface NodePos {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  type: string;
}

export const DataFlowDiagram: React.FC<Props> = ({ def, fullPage }) => {
  const { layout, nodes, edges } = def;

  // Compute node positions based on layout
  const { nodePositions, svgWidth, svgHeight } = useMemo(() => {
    if (!fullPage) {
      // Card thumbnail — small layout
      const w = 280; const nodeW = 140; const nodeH = 36; const gapY = 20; const padY = 16;
      const positions: NodePos[] = [];

      if (layout === 'fan-in') {
        const sources = nodes.filter(n => n.type === 'source');
        const rest = nodes.filter(n => n.type !== 'source');
        const sourceGap = 16;
        const totalSourceW = sources.length * nodeW + (sources.length - 1) * sourceGap;
        const fanInW = Math.max(w, totalSourceW + padY * 2);
        const centerX = fanInW / 2;
        sources.forEach((n, i) => {
          positions.push({ id: n.id, label: n.label, type: n.type,
            x: centerX - totalSourceW / 2 + i * (nodeW + sourceGap), y: padY, w: nodeW, h: nodeH });
        });
        rest.forEach((n, i) => {
          positions.push({ id: n.id, label: n.label, type: n.type,
            x: centerX - nodeW / 2, y: padY + nodeH + gapY + i * (nodeH + gapY), w: nodeW, h: nodeH });
        });
        const totalH = padY + nodeH + gapY + rest.length * (nodeH + gapY) + padY;
        return { nodePositions: positions, svgWidth: fanInW, svgHeight: totalH };
      }

      const centerX = w / 2;
      nodes.forEach((n, i) => {
        positions.push({ id: n.id, label: n.label, type: n.type,
          x: centerX - nodeW / 2, y: padY + i * (nodeH + gapY), w: nodeW, h: nodeH });
      });
      return { nodePositions: positions, svgWidth: w, svgHeight: padY + nodes.length * (nodeH + gapY) + padY };
    }

    // Full-page: target 400×400 square viewBox, auto-size nodes to fill
    const S = 400;
    const pad = 16;
    const positions: NodePos[] = [];

    if (layout === 'fan-in') {
      const sources = nodes.filter(n => n.type === 'source');
      const rest = nodes.filter(n => n.type !== 'source');
      const totalRows = 1 + rest.length; // source row + rest rows
      const gapY = 32;
      const nodeH = Math.min(90, (S - pad * 2 - (totalRows - 1) * gapY) / totalRows);
      const sourceGap = 20;
      const nodeW = (S - pad * 2 - (sources.length - 1) * sourceGap) / sources.length;
      const centerX = S / 2;
      const totalSourceW = sources.length * nodeW + (sources.length - 1) * sourceGap;

      sources.forEach((n, i) => {
        positions.push({ id: n.id, label: n.label, type: n.type,
          x: pad + i * (nodeW + sourceGap), y: pad, w: nodeW, h: nodeH });
      });
      const restW = Math.min(S - pad * 2, totalSourceW);
      rest.forEach((n, i) => {
        positions.push({ id: n.id, label: n.label, type: n.type,
          x: centerX - restW / 2, y: pad + nodeH + gapY + i * (nodeH + gapY), w: restW, h: nodeH });
      });
      return { nodePositions: positions, svgWidth: S, svgHeight: S };
    }

    // Linear: nodes fill the 400×400 square
    const gapY = 32;
    const nodeH = Math.min(90, (S - pad * 2 - (nodes.length - 1) * gapY) / nodes.length);
    const nodeW = S - pad * 2;
    const totalH = pad * 2 + nodes.length * nodeH + (nodes.length - 1) * gapY;
    const startY = (S - totalH + pad * 2) / 2;

    nodes.forEach((n, i) => {
      positions.push({ id: n.id, label: n.label, type: n.type,
        x: pad, y: startY + i * (nodeH + gapY), w: nodeW, h: nodeH });
    });
    return { nodePositions: positions, svgWidth: S, svgHeight: S };
  }, [layout, nodes, fullPage]);

  const nodeMap = useMemo(() => {
    const m: Record<string, NodePos> = {};
    nodePositions.forEach(n => { m[n.id] = n; });
    return m;
  }, [nodePositions]);

  const fontSize = fullPage ? 22 : 13;
  const dotRadius = fullPage ? 5.5 : 3;

  return (
    <div
      className={`dataflow-svg${fullPage ? ' dataflow-svg--full' : ''}`}
      role="img"
      aria-label={`Data flow: ${nodes.map(n => n.label).join(' → ')}`}
    >
      <svg
        width="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Animated dot markers for each edge */}
          {edges.map((edge, i) => {
            const from = nodeMap[edge.from];
            const to = nodeMap[edge.to];
            if (!from || !to) return null;
            const fromCx = from.x + from.w / 2;
            const fromCy = from.y + from.h;
            const toCx = to.x + to.w / 2;
            const toCy = to.y;
            return (
              <React.Fragment key={`def-${i}`}>
                <path
                  id={`path-${i}`}
                  d={`M ${fromCx} ${fromCy} C ${fromCx} ${fromCy + 20}, ${toCx} ${toCy - 20}, ${toCx} ${toCy}`}
                  fill="none"
                />
              </React.Fragment>
            );
          })}
        </defs>

        {/* Edge lines (curved paths) */}
        {edges.map((edge, i) => {
          const from = nodeMap[edge.from];
          const to = nodeMap[edge.to];
          if (!from || !to) return null;
          const fromCx = from.x + from.w / 2;
          const fromCy = from.y + from.h;
          const toCx = to.x + to.w / 2;
          const toCy = to.y;
          const midY = (fromCy + toCy) / 2;
          return (
            <g key={`edge-${i}`}>
              <path
                d={`M ${fromCx} ${fromCy} C ${fromCx} ${midY}, ${toCx} ${midY}, ${toCx} ${toCy}`}
                fill="none"
                stroke="var(--color-border)"
                strokeWidth={fullPage ? 2 : 1.5}
                strokeDasharray={edge.animated ? undefined : '4 4'}
              />
              {/* Animated flowing dot */}
              {edge.animated && (
                <>
                  <circle r={dotRadius} fill={NODE_COLORS.processor.dot} opacity="0.9">
                    <animateMotion
                      dur="2s"
                      repeatCount="indefinite"
                      path={`M ${fromCx} ${fromCy} C ${fromCx} ${midY}, ${toCx} ${midY}, ${toCx} ${toCy}`}
                    />
                  </circle>
                  <circle r={dotRadius} fill={NODE_COLORS.processor.dot} opacity="0.5">
                    <animateMotion
                      dur="2s"
                      repeatCount="indefinite"
                      begin="0.7s"
                      path={`M ${fromCx} ${fromCy} C ${fromCx} ${midY}, ${toCx} ${midY}, ${toCx} ${toCy}`}
                    />
                  </circle>
                  <circle r={dotRadius} fill={NODE_COLORS.processor.dot} opacity="0.3">
                    <animateMotion
                      dur="2s"
                      repeatCount="indefinite"
                      begin="1.3s"
                      path={`M ${fromCx} ${fromCy} C ${fromCx} ${midY}, ${toCx} ${midY}, ${toCx} ${toCy}`}
                    />
                  </circle>
                </>
              )}
              {/* Filter label on edge */}
              {edge.filterLabel && (
                <text
                  x={(fromCx + toCx) / 2 + (fullPage ? 16 : 12)}
                  y={midY}
                  fontSize={fullPage ? 18 : 9}
                  fill="var(--color-text-secondary)"
                  fontStyle="italic"
                  dominantBaseline="middle"
                >
                  {edge.filterLabel}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodePositions.map((node) => {
          const colors = NODE_COLORS[node.type] || NODE_COLORS.processor;
          return (
            <g key={node.id}>
              {/* Node background */}
              <rect
                x={node.x}
                y={node.y}
                width={node.w}
                height={node.h}
                rx={fullPage ? 10 : 6}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={fullPage ? 2 : 1.5}
              />
              {/* Left accent bar */}
              <rect
                x={node.x}
                y={node.y}
                width={fullPage ? 5 : 4}
                height={node.h}
                rx={fullPage ? 2 : 1.5}
                fill={colors.stroke}
              />
              {/* Pulsing dot */}
              <circle
                cx={node.x + (fullPage ? 20 : 16)}
                cy={node.y + node.h / 2}
                r={dotRadius}
                fill={colors.dot}
              >
                <animate
                  attributeName="opacity"
                  values="1;0.4;1"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Label */}
              {fullPage && node.label.includes(' ') ? (() => {
                const parts = node.label.split(' ');
                const mid = Math.ceil(parts.length / 2);
                const line1 = parts.slice(0, mid).join(' ');
                const line2 = parts.slice(mid).join(' ');
                const lineH = fontSize * 1.3;
                return (
                  <text
                    x={node.x + 34}
                    y={node.y + node.h / 2 - lineH / 2}
                    fontSize={fontSize}
                    fontWeight="600"
                    fontFamily="monospace"
                    fill="var(--color-text-primary)"
                    dominantBaseline="middle"
                  >
                    <tspan x={node.x + 34} dy="0">{line1}</tspan>
                    <tspan x={node.x + 34} dy={lineH}>{line2}</tspan>
                  </text>
                );
              })() : (
                <text
                  x={node.x + (fullPage ? 34 : 26)}
                  y={node.y + node.h / 2}
                  fontSize={fontSize}
                  fontWeight="600"
                  fontFamily="monospace"
                  fill="var(--color-text-primary)"
                  dominantBaseline="middle"
                >
                  {node.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
