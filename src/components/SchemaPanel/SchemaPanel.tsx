import React, { useEffect, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { env } from '../../config/environment';
import { FiArrowLeft, FiRefreshCw, FiLoader, FiAlertCircle } from 'react-icons/fi';
import SchemaList from './SchemaList';
import SchemaDetail from './SchemaDetail';

const MIN_PANEL_WIDTH = 260;
const MAX_PANEL_WIDTH = 800;

const SchemaPanel: React.FC = () => {
  const selectedSchemaSubject = useWorkspaceStore((s) => s.selectedSchemaSubject);
  const schemaRegistryLoading = useWorkspaceStore((s) => s.schemaRegistryLoading);
  const loadSchemaRegistrySubjects = useWorkspaceStore((s) => s.loadSchemaRegistrySubjects);
  const clearSelectedSchema = useWorkspaceStore((s) => s.clearSelectedSchema);
  const clearSchemaRegistryError = useWorkspaceStore((s) => s.clearSchemaRegistryError);
  const panelRef = useRef<HTMLDivElement>(null);

  const isConfigured = Boolean(env.schemaRegistryUrl && env.schemaRegistryKey);

  // Load subjects on mount only if env is configured
  useEffect(() => {
    if (isConfigured) {
      loadSchemaRegistrySubjects();
    }
  }, [isConfigured, loadSchemaRegistrySubjects]);

  // Clear stale errors when panel is unmounted
  useEffect(() => {
    return () => {
      clearSchemaRegistryError();
    };
  }, [clearSchemaRegistryError]);

  // Item 13: Panel resize handle drag logic
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const panel = panelRef.current;
    if (!panel) return;
    const startWidth = panel.getBoundingClientRect().width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      // Dragging left = make panel wider (panel is on the right)
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, startWidth + delta));
      document.documentElement.style.setProperty('--schema-panel-width', `${newWidth}px`);
      document.documentElement.style.setProperty('--side-panel-width', `${newWidth}px`);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <div
      ref={panelRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-surface)',
        overflow: 'hidden',
        position: 'relative',
      }}
      aria-label="Schema Registry panel"
    >
      {/* Item 13: Resize handle on the left edge */}
      <div
        onMouseDown={handleResizeStart}
        title="Drag to resize panel"
        aria-label="Resize schema panel"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          cursor: 'col-resize',
          zIndex: 10,
          background: 'transparent',
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-primary)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      />
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 40,
          padding: '0 12px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          gap: 8,
        }}
      >
        {selectedSchemaSubject ? (
          /* Detail view header: back button + subject name */
          <>
            <button
              onClick={clearSelectedSchema}
              title="Back to schema list"
              aria-label="Back to schema list"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-text-secondary)',
                borderRadius: 4,
                flexShrink: 0,
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
              }}
            >
              <FiArrowLeft size={16} aria-hidden="true" />
            </button>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
              }}
              title={selectedSchemaSubject.subject}
            >
              {selectedSchemaSubject.subject}
            </span>
          </>
        ) : (
          /* List view header: title + refresh button */
          <>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              Schema Registry
            </span>
            <button
              onClick={loadSchemaRegistrySubjects}
              title="Refresh schema list"
              aria-label="Refresh schema list"
              disabled={schemaRegistryLoading}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: schemaRegistryLoading ? 'default' : 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-text-secondary)',
                borderRadius: 4,
                flexShrink: 0,
                opacity: schemaRegistryLoading ? 0.5 : 1,
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                if (!schemaRegistryLoading) {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
              }}
            >
              {schemaRegistryLoading
                ? <FiLoader size={15} className="history-spin" aria-hidden="true" />
                : <FiRefreshCw size={15} aria-hidden="true" />}
            </button>
          </>
        )}
      </div>

      {/* Panel body */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {!isConfigured ? (
          /* Environment not configured warning state */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: 12,
              padding: 24,
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
            }}
            role="alert"
          >
            <FiAlertCircle size={28} style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: 6,
                }}
              >
                Schema Registry not configured
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                Add the following to your <code style={{ fontFamily: 'monospace', fontSize: 11 }}>.env</code> file:
              </div>
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  background: 'var(--color-surface-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: 'var(--color-text-primary)',
                  textAlign: 'left',
                  lineHeight: 1.8,
                }}
              >
                VITE_SCHEMA_REGISTRY_URL<br />
                VITE_SCHEMA_REGISTRY_KEY<br />
                VITE_SCHEMA_REGISTRY_SECRET
              </div>
            </div>
          </div>
        ) : selectedSchemaSubject ? (
          <SchemaDetail />
        ) : (
          <SchemaList />
        )}
      </div>
    </div>
  );
};

export default SchemaPanel;
