import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { FiChevronDown } from 'react-icons/fi';
import './ScanModePanel.css';

interface ScanMode {
  value: string;
  label: string;
  shortLabel: string;
  extraField?: 'timestamp' | 'offsets' | 'groupId';
  extraPlaceholder?: string;
}

const SCAN_MODES: ScanMode[] = [
  { value: 'earliest-offset', label: 'Read from Beginning', shortLabel: 'Earliest' },
  { value: 'latest-offset', label: 'Read from End (Latest)', shortLabel: 'Latest' },
  {
    value: 'group-offsets',
    label: 'Resume from Group Offsets',
    shortLabel: 'Group',
    extraField: 'groupId',
    extraPlaceholder: 'Consumer group ID',
  },
  {
    value: 'timestamp',
    label: 'Read from Timestamp',
    shortLabel: 'Timestamp',
    extraField: 'timestamp',
    extraPlaceholder: 'e.g. 1609459200000',
  },
  {
    value: 'specific-offsets',
    label: 'Read from Specific Offsets',
    shortLabel: 'Offsets',
    extraField: 'offsets',
    extraPlaceholder: 'e.g. partition:0,offset:42;...',
  },
];

interface ScanModePanelProps {
  statementId: string;
}

export function ScanModePanel({ statementId }: ScanModePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const statement = useWorkspaceStore((s) => s.statements.find((st) => st.id === statementId));
  const setStatementScanMode = useWorkspaceStore((s) => s.setStatementScanMode);

  const currentMode = statement?.scanMode || 'earliest-offset';
  const selectedDef = SCAN_MODES.find((m) => m.value === currentMode)!;
  const triggerLabel = selectedDef.shortLabel;

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, []);

  // Position menu when opening
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  // Click-outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleScroll = () => setIsOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    // Close on scroll in the editor-cells container
    const scrollContainer = triggerRef.current?.closest('.editor-cells');
    scrollContainer?.addEventListener('scroll', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      scrollContainer?.removeEventListener('scroll', handleScroll);
    };
  }, [isOpen]);

  const getParams = (mode: ScanMode, override?: { field: string; value: string }) => ({
    timestampMillis: mode.extraField === 'timestamp'
      ? (override?.field === 'timestamp' ? override.value : (statement?.scanTimestampMillis ?? ''))
      : undefined,
    specificOffsets: mode.extraField === 'offsets'
      ? (override?.field === 'offsets' ? override.value : (statement?.scanSpecificOffsets ?? ''))
      : undefined,
    groupId: mode.extraField === 'groupId'
      ? (override?.field === 'groupId' ? override.value : (statement?.scanGroupId ?? ''))
      : undefined,
  });

  const handleSelectMode = (mode: ScanMode) => {
    setStatementScanMode(statementId, mode.value, getParams(mode));
  };

  const handleExtraChange = (mode: ScanMode, value: string) => {
    setStatementScanMode(statementId, mode.value, getParams(mode, { field: mode.extraField!, value }));
  };

  const menu = isOpen ? createPortal(
    <div
      className="scan-mode-menu"
      ref={menuRef}
      style={{ top: menuPos.top, right: menuPos.right }}
    >
      {SCAN_MODES.map((mode) => {
        const isSelected = currentMode === mode.value;
        return (
          <div key={mode.value} className="scan-mode-option-group">
            <button
              className={`scan-mode-option ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelectMode(mode)}
            >
              <span className={`scan-mode-radio ${isSelected ? 'checked' : ''}`} />
              <span className="scan-mode-option-label">{mode.label}</span>
            </button>
            {isSelected && mode.extraField && (
              <div className="scan-mode-extra">
                <input
                  type="text"
                  className="scan-mode-extra-input"
                  placeholder={mode.extraPlaceholder}
                  value={
                    mode.extraField === 'timestamp'
                      ? (statement?.scanTimestampMillis ?? '')
                      : mode.extraField === 'groupId'
                        ? (statement?.scanGroupId ?? '')
                        : (statement?.scanSpecificOffsets ?? '')
                  }
                  onChange={(e) => handleExtraChange(mode, e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </div>
        );
      })}
    </div>,
    document.body
  ) : null;

  return (
    <div className="scan-mode-panel">
      <button
        ref={triggerRef}
        className={`scan-mode-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Table scan startup mode"
      >
        <span className="scan-mode-trigger-label">{triggerLabel}</span>
        <FiChevronDown size={12} className={`scan-mode-chevron ${isOpen ? 'rotated' : ''}`} />
      </button>
      {menu}
    </div>
  );
}
