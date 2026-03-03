import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface ExpandableJsonPaneProps {
  value: string;
  anchorRect: DOMRect;
  onClose: () => void;
}

// Helper function to format values as pretty-printed JSON
const formatJSON = (value: string): string => {
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // If it's not valid JSON, try to pretty-print as-is
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
};

export function ExpandableJsonPane({ value, anchorRect, onClose }: ExpandableJsonPaneProps) {
  const formattedJSON = useMemo(() => formatJSON(value), [value]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const pane = document.querySelector('.json-expander-pane');
      if (pane && !pane.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    // Attach scroll listener to window (not a container ref) — covers all usage contexts
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(formattedJSON).catch(() => {
      // Silently fail - parent can handle toast notifications
    });
  };

  return createPortal(
    <div
      className="json-expander-pane"
      style={{
        position: 'fixed',
        top: anchorRect.bottom + 4,
        left: anchorRect.left,
        minWidth: Math.max(anchorRect.width, 300),
        maxWidth: 600,
        zIndex: 9999,
      }}
    >
      <div className="json-expander-header">
        <span className="json-expander-title">JSON Viewer</span>
        <button className="json-expander-copy-btn" onClick={handleCopyJSON}>
          Copy JSON
        </button>
      </div>
      <pre className="json-viewer">{formattedJSON}</pre>
    </div>,
    document.body
  );
}
