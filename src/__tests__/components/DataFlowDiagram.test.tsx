import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataFlowDiagram } from '../../components/ExampleDetailView/DataFlowDiagram';
import type { DataFlowDef } from '../../types';

describe('[@data-flow-diagram] DataFlowDiagram', () => {
  const linearDef: DataFlowDef = {
    layout: 'linear',
    nodes: [
      { id: 'src', label: 'Source Topic', type: 'source' },
      { id: 'proc', label: 'Filter', type: 'processor' },
      { id: 'sink', label: 'Output Topic', type: 'sink' },
    ],
    edges: [
      { from: 'src', to: 'proc', animated: true },
      { from: 'proc', to: 'sink', animated: false },
    ],
  };

  it('renders with role="img" and aria-label', () => {
    render(<DataFlowDiagram def={linearDef} />);
    const diagram = screen.getByRole('img');
    expect(diagram).toBeInTheDocument();
    expect(diagram.getAttribute('aria-label')).toContain('Source Topic');
    expect(diagram.getAttribute('aria-label')).toContain('Filter');
    expect(diagram.getAttribute('aria-label')).toContain('Output Topic');
  });

  it('renders all node labels', () => {
    render(<DataFlowDiagram def={linearDef} />);
    expect(screen.getByText('Source Topic')).toBeInTheDocument();
    expect(screen.getByText('Filter')).toBeInTheDocument();
    expect(screen.getByText('Output Topic')).toBeInTheDocument();
  });

  it('renders SVG wrapper with dataflow-svg class', () => {
    const { container } = render(<DataFlowDiagram def={linearDef} />);
    expect(container.querySelector('.dataflow-svg')).toBeInTheDocument();
  });

  it('applies fullPage class when fullPage prop is true', () => {
    const { container } = render(<DataFlowDiagram def={linearDef} fullPage />);
    expect(container.querySelector('.dataflow-svg--full')).toBeInTheDocument();
  });

  it('does not apply fullPage class when not provided', () => {
    const { container } = render(<DataFlowDiagram def={linearDef} />);
    expect(container.querySelector('.dataflow-svg--full')).not.toBeInTheDocument();
  });

  it('renders SVG rect elements for each node', () => {
    const { container } = render(<DataFlowDiagram def={linearDef} />);
    // Each node has 2 rects (background + accent), so 3 nodes = 6 rects
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(6);
  });

  it('renders animateMotion for animated edges', () => {
    const { container } = render(<DataFlowDiagram def={linearDef} />);
    // animated: true edge produces 3 circles with animateMotion
    const motions = container.querySelectorAll('animateMotion');
    expect(motions.length).toBe(3);
  });

  it('renders edge filter label when provided', () => {
    const defWithLabel: DataFlowDef = {
      layout: 'linear',
      nodes: [
        { id: 'a', label: 'A', type: 'source' },
        { id: 'b', label: 'B', type: 'sink' },
      ],
      edges: [
        { from: 'a', to: 'b', filterLabel: 'APPROVED only' },
      ],
    };
    render(<DataFlowDiagram def={defWithLabel} />);
    expect(screen.getByText('APPROVED only')).toBeInTheDocument();
  });

  it('renders dashed stroke for non-animated edges', () => {
    const { container } = render(<DataFlowDiagram def={linearDef} />);
    // The second edge (animated: false) should have strokeDasharray
    const paths = container.querySelectorAll('g > path[stroke-dasharray]');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('renders fan-in layout with source nodes side by side', () => {
    const fanInDef: DataFlowDef = {
      layout: 'fan-in',
      nodes: [
        { id: 'a', label: 'A', type: 'source' },
        { id: 'b', label: 'B', type: 'source' },
        { id: 'c', label: 'C', type: 'sink' },
      ],
      edges: [
        { from: 'a', to: 'c' },
        { from: 'b', to: 'c' },
      ],
    };
    render(<DataFlowDiagram def={fanInDef} />);
    // All 3 labels should render
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });
});
