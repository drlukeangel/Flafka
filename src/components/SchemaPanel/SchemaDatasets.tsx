/**
 * @schema-datasets
 * SchemaDatasets — Test dataset management for a schema subject.
 * Rendered inside SchemaDetail when view === 'datasets'.
 */

import { useState, useRef } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { generateSyntheticRecord } from '../../utils/synthetic-data';
import { FiUpload, FiDatabase, FiTrash2, FiArrowLeft, FiDownload, FiSave } from 'react-icons/fi';
import type { SchemaDataset } from '../../types';

interface SchemaDatasetsProps {
  subject: string;
  schemaText: string;
  schemaType: string;
}

const MAX_RECORDS = 500;

export function SchemaDatasets({ subject, schemaText, schemaType }: SchemaDatasetsProps) {
  const schemaDatasets = useWorkspaceStore((s) => s.schemaDatasets);
  const addSchemaDataset = useWorkspaceStore((s) => s.addSchemaDataset);
  const updateSchemaDataset = useWorkspaceStore((s) => s.updateSchemaDataset);
  const deleteSchemaDataset = useWorkspaceStore((s) => s.deleteSchemaDataset);

  // Filter datasets for this subject
  const datasets = schemaDatasets.filter((ds) => ds.schemaSubject === subject);

  // Local UI state
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRecords, setEditRecords] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedDataset = datasets.find((ds) => ds.id === selectedDatasetId);

  // ── Upload flow ──
  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    try {
      const text = await file.text();
      let records: Record<string, unknown>[];

      // Try JSON array first
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          records = parsed;
        } else {
          throw new Error('not array');
        }
      } catch {
        // Try JSONL
        records = text
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line));
      }

      if (records.length > MAX_RECORDS) {
        setUploadError(`Too many records: ${records.length} (max ${MAX_RECORDS})`);
        e.target.value = '';
        return;
      }

      const name = file.name.replace(/\.(json|jsonl)$/i, '');
      const dataset: SchemaDataset = {
        id: crypto.randomUUID(),
        name,
        schemaSubject: subject,
        records,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addSchemaDataset(dataset);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to parse file');
    }

    e.target.value = '';
  };

  // ── Generate flow ──
  const handleGenerate = () => {
    const records: Record<string, unknown>[] = [];
    for (let i = 0; i < generateCount; i++) {
      const result = generateSyntheticRecord(schemaText, schemaType, i + 1);
      if ('error' in result) continue;
      records.push(result as Record<string, unknown>);
    }
    if (records.length === 0) return;

    const name = `Generated ${records.length}`;
    const dataset: SchemaDataset = {
      id: crypto.randomUUID(),
      name,
      schemaSubject: subject,
      records,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addSchemaDataset(dataset);
    setShowGenerate(false);
  };

  // ── Detail mode: edit + save ──
  const enterDetail = (ds: SchemaDataset) => {
    setSelectedDatasetId(ds.id);
    setEditName(ds.name);
    setEditRecords(JSON.stringify(ds.records, null, 2));
    setEditError(null);
  };

  const handleSave = () => {
    try {
      const parsed = JSON.parse(editRecords);
      if (!Array.isArray(parsed)) {
        setEditError('Records must be a JSON array');
        return;
      }
      if (parsed.length > MAX_RECORDS) {
        setEditError(`Too many records: ${parsed.length} (max ${MAX_RECORDS})`);
        return;
      }
      updateSchemaDataset(selectedDatasetId!, { name: editName, records: parsed });
      setEditError(null);
      setSelectedDatasetId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const handleDownload = () => {
    if (!selectedDataset) return;
    const blob = new Blob([JSON.stringify(selectedDataset.records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${subject}-${selectedDataset.name}-${selectedDataset.records.length}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id: string) => {
    deleteSchemaDataset(id);
    setConfirmDelete(null);
    if (selectedDatasetId === id) {
      setSelectedDatasetId(null);
    }
  };

  // ── Detail mode render ──
  if (selectedDataset) {
    return (
      <div style={{ padding: '8px 12px', fontSize: 13 }}>
        <button
          onClick={() => setSelectedDatasetId(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-primary)',
            fontSize: 12,
            padding: '4px 0',
            marginBottom: 8,
          }}
          aria-label="Back to dataset list"
        >
          <FiArrowLeft size={14} />
          Back
        </button>

        {/* Editable name */}
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            background: 'var(--color-input-bg)',
            color: 'var(--color-text-primary)',
            marginBottom: 8,
            boxSizing: 'border-box',
          }}
          aria-label="Dataset name"
        />

        {/* JSON editor */}
        <textarea
          value={editRecords}
          onChange={(e) => {
            setEditRecords(e.target.value);
            setEditError(null);
          }}
          style={{
            width: '100%',
            minHeight: 200,
            padding: '8px',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'monospace',
            background: 'var(--color-input-bg)',
            color: 'var(--color-text-primary)',
            resize: 'vertical',
            boxSizing: 'border-box',
            boxShadow: 'inset 0 1px 3px rgba(73,51,215,0.08)',
          }}
          aria-label="Dataset records JSON"
        />

        {editError && (
          <div style={{ color: 'var(--color-error)', fontSize: 11, marginTop: 4 }}>{editError}</div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            onClick={handleSave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              borderRadius: 4,
              border: '1px solid var(--color-primary)',
              background: 'var(--color-primary)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            <FiSave size={12} />
            Save
          </button>
          <button
            onClick={handleDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            <FiDownload size={12} />
            Download
          </button>
          <button
            onClick={() => handleDelete(selectedDataset.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              borderRadius: 4,
              border: '1px solid var(--color-error)',
              background: 'transparent',
              color: 'var(--color-error)',
              cursor: 'pointer',
              fontSize: 12,
              marginLeft: 'auto',
            }}
          >
            <FiTrash2 size={12} />
            Delete
          </button>
        </div>
      </div>
    );
  }

  // ── List mode render ──
  return (
    <div style={{ padding: '8px 12px', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Test Datasets {datasets.length > 0 && <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>({datasets.length})</span>}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleUpload}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 3,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: 11,
            }}
            title="Upload JSON or JSONL file"
          >
            <FiUpload size={12} />
            Upload
          </button>
          <button
            onClick={() => setShowGenerate(!showGenerate)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 3,
              border: '1px solid var(--color-border)',
              background: showGenerate ? 'var(--color-primary)' : 'var(--color-surface)',
              color: showGenerate ? '#fff' : 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: 11,
            }}
            title="Generate records from schema"
          >
            <FiDatabase size={12} />
            Generate
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.jsonl"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        data-testid="dataset-file-input"
      />

      {uploadError && (
        <div style={{ color: 'var(--color-error)', fontSize: 11, marginBottom: 8 }}>{uploadError}</div>
      )}

      {/* Generate inline panel */}
      {showGenerate && (
        <div
          style={{
            padding: 8,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            marginBottom: 8,
            background: 'var(--color-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Count:</span>
            <select
              value={generateCount}
              onChange={(e) => setGenerateCount(Number(e.target.value))}
              style={{
                fontSize: 11,
                padding: '2px 6px',
                border: '1px solid var(--color-border)',
                borderRadius: 3,
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-primary)',
              }}
              aria-label="Number of records to generate"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <button
            onClick={handleGenerate}
            style={{
              padding: '4px 10px',
              borderRadius: 3,
              border: '1px solid var(--color-primary)',
              background: 'var(--color-primary)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Generate {generateCount} records
          </button>
        </div>
      )}

      {/* Dataset list or empty state */}
      {datasets.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '24px 12px',
            color: 'var(--color-text-tertiary)',
            fontSize: 12,
          }}
        >
          <FiDatabase size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>No test datasets yet.</p>
          <p>Upload a JSON file or generate from this schema.</p>
        </div>
      ) : (
        <div>
          {datasets.map((ds) => (
            <div
              key={ds.id}
              onClick={() => enterDetail(ds)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 8px',
                borderBottom: '1px solid var(--color-border)',
                cursor: 'pointer',
                gap: 8,
                transition: 'background var(--transition-fast)',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
              onMouseOut={(e) => (e.currentTarget.style.background = '')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') enterDetail(ds); }}
              aria-label={`Dataset: ${ds.name}`}
            >
              <span style={{ flex: 1, fontWeight: 500, color: 'var(--color-text-primary)' }}>{ds.name}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{ds.records.length} records</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                {new Date(ds.updatedAt).toLocaleDateString()}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirmDelete === ds.id) {
                    handleDelete(ds.id);
                  } else {
                    setConfirmDelete(ds.id);
                    setTimeout(() => setConfirmDelete(null), 3000);
                  }
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: confirmDelete === ds.id ? 'var(--color-error)' : 'var(--color-text-secondary)',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={confirmDelete === ds.id ? 'Click again to confirm delete' : 'Delete dataset'}
                aria-label={`Delete ${ds.name}`}
              >
                <FiTrash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
