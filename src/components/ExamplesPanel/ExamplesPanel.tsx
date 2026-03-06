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

const EMPTY_ARTIFACTS: never[] = [];
import { useWorkspaceStore } from '../../store/workspaceStore';
import { getExampleCards } from '../../data/exampleCards';
import { generateFunName } from '../../utils/names';
import { FiCopy, FiCheck, FiDownload, FiPlay } from 'react-icons/fi';
import type { ExampleCard, ExampleCompletionModal } from '../../types';

function stepsToNotes(modal: Omit<ExampleCompletionModal, 'title'>): string {
  const lines: string[] = [];
  if (modal.subtitle) {
    lines.push(modal.subtitle, '');
  }
  modal.steps.forEach((step, i) => {
    lines.push(`${i + 1}. ${step.label}${step.detail ? ' — ' + step.detail : ''}`);
  });
  return lines.join('\n');
}

export function ExamplesPanel() {
  const addStatement = useWorkspaceStore((s) => s.addStatement);
  const addToast = useWorkspaceStore((s) => s.addToast);
  const setActiveNavItem = useWorkspaceStore((s) => s.setActiveNavItem);
  const artifactList = useWorkspaceStore((s) => s.artifactList) ?? EMPTY_ARTIFACTS;
  const loadArtifacts = useWorkspaceStore((s) => s.loadArtifacts);
  const saveCurrentWorkspace = useWorkspaceStore((s) => s.saveCurrentWorkspace);
  const setWorkspaceName = useWorkspaceStore((s) => s.setWorkspaceName);
  const setWorkspaceNotes = useWorkspaceStore((s) => s.setWorkspaceNotes);
  const clearWorkspace = useWorkspaceStore((s) => s.clearWorkspace);
  const statementCount = useWorkspaceStore((s) => s.statements.length);
  const selectedExampleId = useWorkspaceStore((s) => s.selectedExampleId);
  const navigateToExampleDetail = useWorkspaceStore((s) => s.navigateToExampleDetail);

  // Load artifacts on mount if not already loaded (needed for dynamic ID resolution)
  useEffect(() => {
    if (artifactList.length === 0) loadArtifacts();
  }, [artifactList.length, loadArtifacts]);

  const cards = useMemo(() => getExampleCards(artifactList), [artifactList]);

  const [tab, setTab] = useState<'kickstart' | 'snippet'>('kickstart');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [setupRunning, setSetupRunning] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<string>('');
  // Card awaiting "clear workspace?" confirmation before running
  const [confirmCardId, setConfirmCardId] = useState<string | null>(null);

  const visibleCards = useMemo(() => cards.filter((c) => c.category === tab), [cards, tab]);

  // comingSoon cards are not Quick Start (no onImport) even if they have the tag

  const handleCopy = useCallback(async (sql: string, id: string) => {
    await navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const runSetup = useCallback(async (card: ExampleCard) => {
    if (!card.onImport) return;
    setSetupRunning(card.id);
    try {
      const { runId } = await card.onImport((step) => setSetupStep(step));
        const cardSlug = card.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const wsName = `${cardSlug}-${runId}`;
        const notes = card.completionModal ? stepsToNotes(card.completionModal) : undefined;
        // Set workspace name + notes in store (auto-expands notes panel)
        setWorkspaceName(wsName);
        setWorkspaceNotes(notes ?? null);
        // Save with template provenance (store will NOT show its own toast)
        saveCurrentWorkspace(wsName, card.id, card.title, notes);
        addToast({ type: 'success', message: `"${card.title}" workspace saved` });
        // Navigate to SQL editor — notes panel auto-expands above cells
        setActiveNavItem('workspace');
      } catch (err: unknown) {
        let msg: string;
        if (err instanceof Error) {
          msg = err.message;
        } else if (err && typeof err === 'object' && 'message' in err) {
          // ApiError { status, message, details } from handleApiError
          const apiErr = err as { status?: number; message?: string; details?: string };
          msg = `${apiErr.message}${apiErr.status ? ` (${apiErr.status})` : ''}${apiErr.details ? `: ${apiErr.details}` : ''}`;
        } else {
          msg = String(err);
        }
        addToast({ type: 'error', message: `Setup failed: ${msg}` });
      } finally {
        setSetupRunning(null);
        setSetupStep('');
      }
  }, [addToast, setActiveNavItem, setWorkspaceName, setWorkspaceNotes, saveCurrentWorkspace]);

  const handleImport = useCallback(async (card: ExampleCard) => {
    if (card.onImport) {
      if (setupRunning) return;
      // If workspace has existing statements, confirm before clearing
      if (statementCount > 0) {
        setConfirmCardId(card.id);
        return;
      }
      await runSetup(card);
      return;
    }
    // Default: simple import (snippets — no confirmation needed)
    const rid = generateFunName();
    const titleSlug = card.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    addStatement(card.sql, undefined, `${titleSlug}-${rid}`);
    addToast({ type: 'success', message: `Imported "${card.title}"` });
    setActiveNavItem('workspace');
  }, [addStatement, addToast, setActiveNavItem, setupRunning, statementCount, runSetup]);

  const handleConfirmClear = useCallback(async (card: ExampleCard) => {
    setConfirmCardId(null);
    clearWorkspace();
    await runSetup(card);
  }, [clearWorkspace, runSetup]);

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
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          padding: '8px 12px 0',
        }}
      >
        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {(['kickstart', 'snippet'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                border: 'none',
                borderRadius: 4,
                padding: '3px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: tab === t ? 'var(--color-primary)' : 'var(--color-bg-hover)',
                color: tab === t ? '#fff' : 'var(--color-text-secondary)',
                transition: 'background 0.15s',
              }}
            >
              {t === 'kickstart' ? 'Kickstarters' : 'Snippets'}
            </button>
          ))}
        </div>
        {/* Subtitle */}
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 7 }}>
          {tab === 'kickstart'
            ? 'One-click setups — spin up a full environment in seconds'
            : 'Quick SQL to copy or import into your workspace'}
        </div>
      </div>

      {/* Card list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {visibleCards.map((card) => {
          const isQuickStart = !!card.onImport;
          const isComingSoon = !!card.comingSoon;
          const isRunning = setupRunning === card.id;
          const isConfirming = confirmCardId === card.id;
          const hasDoc = !!card.documentation;
          return (
          <div
            key={card.id}
            data-testid={`example-card-${card.id}`}
            tabIndex={hasDoc ? 0 : undefined}
            role={hasDoc ? 'button' : undefined}
            aria-label={hasDoc ? `View details for ${card.title}` : undefined}
            onClick={hasDoc ? () => navigateToExampleDetail(card.id) : undefined}
            onKeyDown={hasDoc ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToExampleDetail(card.id); } } : undefined}
            onMouseEnter={() => setHoveredId(card.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              margin: '0 12px 10px',
              border: `1px solid ${selectedExampleId === card.id ? 'var(--color-primary)' : hoveredId === card.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderLeft: (isQuickStart || isComingSoon) ? '3px solid var(--color-primary)' : undefined,
              borderRadius: 6,
              overflow: 'hidden',
              background: 'var(--color-surface)',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              cursor: hasDoc ? 'pointer' : undefined,
              boxShadow: hasDoc && hoveredId === card.id ? 'var(--shadow-sm)' : undefined,
            }}
          >
            {/* Stateful banner */}
            {card.stateful && (
              <div style={{
                background: 'linear-gradient(90deg, #7c3aed, #6d28d9)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                padding: '3px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}>
                <span style={{ fontSize: 12 }}>&#9679;</span> Stateful — Uses Managed State
              </div>
            )}
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
              {card.comingSoon && (
                <p
                  className="card-coming-soon-detail"
                  style={{
                    fontSize: 11,
                    color: 'var(--color-warning, #c59b00)',
                    margin: '4px 0 0',
                  }}
                >
                  {card.comingSoon}
                </p>
              )}
            </div>

            {/* SQL preview — shorter for kickstarter cards with docs */}
            <pre
              style={{
                margin: '6px 10px',
                padding: '6px 8px',
                fontSize: 11,
                fontFamily: 'monospace',
                lineHeight: 1.4,
                background: 'var(--color-surface-secondary)',
                color: 'var(--color-text-primary)',
                borderRadius: 4,
                overflow: 'hidden',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                maxHeight: hasDoc ? 40 : 80,
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
                      background: tag === 'Quick Start' ? 'var(--color-primary)' : 'var(--color-bg-hover)',
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
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleCopy(card.sql, card.id)}
                  title="Copy SQL to clipboard"
                  style={{
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-secondary)',
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
                {isComingSoon ? (
                  <button
                    className="card-setup-btn card-setup-btn--disabled"
                    disabled
                    aria-disabled="true"
                    title={card.comingSoon}
                    style={{
                      border: 'none',
                      background: 'var(--color-border)',
                      color: 'var(--color-text-tertiary, var(--color-text-secondary))',
                      cursor: 'not-allowed',
                      opacity: 0.45,
                      padding: '3px 7px',
                      borderRadius: 3,
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    Coming Soon
                  </button>
                ) : (
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
                        <span style={{ display: 'inline-block', width: 11, height: 11, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid var(--color-button-danger-text)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
                )}
              </div>
            </div>

            {/* Workspace clear confirmation */}
            {isConfirming && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: '6px 10px 8px',
                  background: 'var(--color-bg-hover)',
                  borderTop: '1px solid var(--color-border)',
                  fontSize: 11,
                }}
                data-testid={`confirm-clear-${card.id}`}
              >
                <div style={{ color: 'var(--color-text-primary)', marginBottom: 6 }}>
                  Your current workspace will be cleared. Start fresh with this example?
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => handleConfirmClear(card)}
                    style={{
                      border: 'none',
                      background: 'var(--color-success, #22c55e)',
                      color: '#fff',
                      cursor: 'pointer',
                      padding: '3px 8px',
                      borderRadius: 3,
                      fontSize: 11,
                    }}
                  >
                    Clear &amp; Set Up
                  </button>
                  <button
                    onClick={() => setConfirmCardId(null)}
                    style={{
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface-secondary)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      padding: '3px 8px',
                      borderRadius: 3,
                      fontSize: 11,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Learn More cue for cards with documentation */}
            {hasDoc && !isConfirming && !isRunning && (
              <div
                style={{
                  padding: '2px 10px 6px',
                  fontSize: 10,
                  color: 'var(--color-primary)',
                  fontWeight: 500,
                }}
              >
                Learn More &rarr;
              </div>
            )}

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
