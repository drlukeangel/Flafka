/**
 * @examples-panel
 * ExamplesPanel — Side panel showing importable SQL example cards.
 *
 * Features:
 * - 8 example cards with SQL previews
 * - Import button: creates a new editor cell with the example SQL + label
 * - Copy button: copies SQL to clipboard
 * - Tag badges per card
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { getExampleCards } from '../../data/exampleCards';
import { FiCopy, FiCheck, FiDownload, FiPlay } from 'react-icons/fi';
import type { ExampleCard } from '../../types';

export function ExamplesPanel() {
  const addStatement = useWorkspaceStore((s) => s.addStatement);
  const addToast = useWorkspaceStore((s) => s.addToast);
  const setActiveNavItem = useWorkspaceStore((s) => s.setActiveNavItem);
  const artifactList = useWorkspaceStore((s) => s.artifactList);
  const loadArtifacts = useWorkspaceStore((s) => s.loadArtifacts);

  // Load artifacts on mount if not already loaded (needed for dynamic ID resolution)
  useEffect(() => {
    if (artifactList.length === 0) loadArtifacts();
  }, [artifactList.length, loadArtifacts]);

  const cards = useMemo(() => getExampleCards(artifactList), [artifactList]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [setupRunning, setSetupRunning] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<string>('');

  const handleCopy = useCallback(async (sql: string, id: string) => {
    await navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleImport = useCallback(async (card: ExampleCard) => {
    if (card.onImport) {
      if (setupRunning) return;
      setSetupRunning(card.id);
      try {
        await card.onImport((step) => setSetupStep(step));
        addToast({ type: 'success', message: `"${card.title}" ready — run the query!` });
        setActiveNavItem('workspace');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        addToast({ type: 'error', message: `Setup failed: ${msg}` });
      } finally {
        setSetupRunning(null);
        setSetupStep('');
      }
      return;
    }
    // Default: simple import
    const jobName = card.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    addStatement(card.sql, undefined, jobName);
    addToast({ type: 'success', message: `Imported "${card.title}"` });
    setActiveNavItem('workspace');
  }, [addStatement, addToast, setActiveNavItem, setupRunning]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
      aria-label="Examples panel"
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 40,
          padding: '0 12px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}
        >
          Examples ({cards.length})
        </span>
      </div>

      {/* Card list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {cards.map((card) => {
          const isQuickStart = !!card.onImport;
          const isRunning = setupRunning === card.id;
          return (
          <div
            key={card.id}
            data-testid={`example-card-${card.id}`}
            onMouseEnter={() => setHoveredId(card.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              margin: '0 12px 10px',
              border: `1px solid ${hoveredId === card.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderLeft: isQuickStart ? '3px solid var(--color-primary)' : undefined,
              borderRadius: 6,
              overflow: 'hidden',
              background: 'var(--color-surface)',
              transition: 'border-color 0.15s ease',
            }}
          >
            {/* Card header */}
            <div style={{ padding: '8px 10px 4px' }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: 2,
                }}
              >
                {card.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.4,
                }}
              >
                {card.description}
              </div>
            </div>

            {/* SQL preview */}
            <pre
              style={{
                margin: '6px 10px',
                padding: '6px 8px',
                fontSize: 11,
                fontFamily: 'monospace',
                lineHeight: 1.4,
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-primary)',
                borderRadius: 4,
                overflow: 'hidden',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                maxHeight: 80,
              }}
            >
              {card.sql}
            </pre>

            {/* Footer: tags + actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 10px 8px',
                gap: 6,
              }}
            >
              {/* Tags */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: tag === 'Quick Start' ? 'var(--color-primary)' : 'var(--color-hover)',
                      borderRadius: 3,
                      padding: '1px 5px',
                      fontSize: 10,
                      fontWeight: 500,
                      color: tag === 'Quick Start' ? '#fff' : 'var(--color-text-secondary)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => handleCopy(card.sql, card.id)}
                  title="Copy SQL to clipboard"
                  style={{
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-input-bg)',
                    cursor: 'pointer',
                    padding: '3px 7px',
                    borderRadius: 3,
                    fontSize: 11,
                    color: 'var(--color-text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  {copiedId === card.id ? (
                    <FiCheck size={11} style={{ color: 'var(--color-success)' }} />
                  ) : (
                    <FiCopy size={11} />
                  )}
                  {copiedId === card.id ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => handleImport(card)}
                  disabled={isQuickStart && !!setupRunning}
                  aria-busy={isRunning}
                  title={isQuickStart ? 'Set up example environment' : 'Import into workspace'}
                  style={{
                    border: 'none',
                    background: isQuickStart ? 'var(--color-success, #22c55e)' : 'var(--color-primary)',
                    color: '#fff',
                    cursor: isQuickStart && !!setupRunning ? 'not-allowed' : 'pointer',
                    opacity: isQuickStart && !!setupRunning && !isRunning ? 0.5 : 1,
                    padding: '3px 7px',
                    borderRadius: 3,
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  {isRunning ? (
                    <>
                      <span style={{ display: 'inline-block', width: 11, height: 11, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Setting up...
                    </>
                  ) : isQuickStart ? (
                    <>
                      <FiPlay size={11} />
                      Set Up
                    </>
                  ) : (
                    <>
                      <FiDownload size={11} />
                      Import
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Progress text for Quick Start cards */}
            {isRunning && setupStep && (
              <div
                style={{
                  padding: '0 10px 6px',
                  fontSize: 11,
                  color: 'var(--color-text-secondary)',
                  fontStyle: 'italic',
                }}
                data-testid={`setup-progress-${card.id}`}
              >
                {setupStep}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
