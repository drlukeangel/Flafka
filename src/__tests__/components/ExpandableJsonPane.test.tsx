import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ExpandableJsonPane } from '../../components/shared/ExpandableJsonPane';

describe('[@expandable-json-pane] ExpandableJsonPane', () => {
  const mockAnchorRect = {
    bottom: 100,
    left: 200,
    width: 150,
    height: 30,
    top: 70,
    right: 350,
    x: 200,
    y: 70,
    toJSON: () => {},
  } as DOMRect;

  const mockOnClose = vi.fn();
  const jsonValue = '{"name":"test","value":42}';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    // Clean up any portals left in document.body
    document.querySelectorAll('.json-expander-pane').forEach((el) => el.remove());
  });

  it('renders portal into document.body', () => {
    render(<ExpandableJsonPane value={jsonValue} anchorRect={mockAnchorRect} onClose={mockOnClose} />);
    const pane = document.body.querySelector('.json-expander-pane');
    expect(pane).toBeTruthy();
    expect(document.body.contains(pane)).toBe(true);
  });

  it('pretty-prints JSON value in the pane', () => {
    render(<ExpandableJsonPane value={jsonValue} anchorRect={mockAnchorRect} onClose={mockOnClose} />);
    const pane = document.body.querySelector('.json-viewer');
    expect(pane?.textContent).toContain('"name"');
    expect(pane?.textContent).toContain('"test"');
    // Should be formatted (multi-line)
    expect(pane?.textContent).toContain('42');
  });

  it('copy button calls navigator.clipboard.writeText with formatted JSON', async () => {
    render(<ExpandableJsonPane value={jsonValue} anchorRect={mockAnchorRect} onClose={mockOnClose} />);
    const copyBtn = document.body.querySelector('.json-expander-copy-btn') as HTMLButtonElement;
    expect(copyBtn).toBeTruthy();

    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      JSON.stringify(JSON.parse(jsonValue), null, 2)
    );
  });

  it('Escape keydown calls onClose', () => {
    render(<ExpandableJsonPane value={jsonValue} anchorRect={mockAnchorRect} onClose={mockOnClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('click outside pane calls onClose', () => {
    render(<ExpandableJsonPane value={jsonValue} anchorRect={mockAnchorRect} onClose={mockOnClose} />);
    fireEvent.mouseDown(document.body);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('window scroll event calls onClose', () => {
    render(<ExpandableJsonPane value={jsonValue} anchorRect={mockAnchorRect} onClose={mockOnClose} />);
    // Dispatch scroll on window with capture (our listener uses capture: true)
    window.dispatchEvent(new Event('scroll'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does NOT call onClose when clicking inside the pane', () => {
    render(<ExpandableJsonPane value={jsonValue} anchorRect={mockAnchorRect} onClose={mockOnClose} />);
    const pane = document.body.querySelector('.json-expander-pane') as HTMLElement;
    expect(pane).toBeTruthy();

    // Click inside the pane
    fireEvent.mouseDown(pane);
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
