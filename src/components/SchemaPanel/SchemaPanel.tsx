import React, { useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { FiArrowLeft, FiRefreshCw, FiLoader } from 'react-icons/fi';
import SchemaList from './SchemaList';
import SchemaDetail from './SchemaDetail';

const SchemaPanel: React.FC = () => {
  const selectedSchemaSubject = useWorkspaceStore((s) => s.selectedSchemaSubject);
  const schemaRegistryLoading = useWorkspaceStore((s) => s.schemaRegistryLoading);
  const loadSchemaRegistrySubjects = useWorkspaceStore((s) => s.loadSchemaRegistrySubjects);
  const clearSelectedSchema = useWorkspaceStore((s) => s.clearSelectedSchema);

  // Load subjects on mount
  useEffect(() => {
    loadSchemaRegistrySubjects();
  }, [loadSchemaRegistrySubjects]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
      aria-label="Schema Registry panel"
    >
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
        {selectedSchemaSubject ? <SchemaDetail /> : <SchemaList />}
      </div>
    </div>
  );
};

export default SchemaPanel;
