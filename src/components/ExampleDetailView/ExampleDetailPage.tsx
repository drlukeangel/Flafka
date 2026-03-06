import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { FiCopy, FiCheck, FiPlay, FiChevronDown, FiArrowRight, FiDatabase, FiBookOpen, FiHelpCircle, FiTerminal, FiList } from 'react-icons/fi';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { getExampleCards } from '../../data/exampleCards';
import { DataFlowDiagram } from './DataFlowDiagram';
import { SqlHighlight } from './SqlHighlight';
import type { ExampleCard, ExampleCompletionModal } from '../../types';
import './ExampleDetailPage.css';

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

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
  accentColor,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`edp-section ${open ? 'edp-section--open' : ''}`}>
      <button
        className="edp-section__toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="edp-section__icon" style={accentColor ? { color: accentColor } : undefined}>
          {icon}
        </span>
        <span className="edp-section__title">{title}</span>
        <FiChevronDown
          size={16}
          className={`edp-section__chevron ${open ? 'edp-section__chevron--open' : ''}`}
        />
      </button>
      <div className={`edp-section__body ${open ? 'edp-section__body--open' : ''}`}>
        <div className="edp-section__body-inner">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ExampleDetailPage() {
  const selectedExampleId = useWorkspaceStore((s) => s.selectedExampleId);
  const navigateToExampleDetail = useWorkspaceStore((s) => s.navigateToExampleDetail);
  const artifactList = useWorkspaceStore((s) => s.artifactList) ?? [];
  const addToast = useWorkspaceStore((s) => s.addToast);
  const setActiveNavItem = useWorkspaceStore((s) => s.setActiveNavItem);
  const setWorkspaceName = useWorkspaceStore((s) => s.setWorkspaceName);
  const setWorkspaceNotes = useWorkspaceStore((s) => s.setWorkspaceNotes);
  const saveCurrentWorkspace = useWorkspaceStore((s) => s.saveCurrentWorkspace);

  const cards = useMemo(() => getExampleCards(artifactList), [artifactList]);
  const card = cards.find((c) => c.id === selectedExampleId);
  const doc = card?.documentation;

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [setupRunning, setSetupRunning] = useState(false);
  const [setupStep, setSetupStep] = useState('');

  const handleCopy = useCallback(async (sql: string, id: string) => {
    await navigator.clipboard.writeText(sql);
    setCopiedId(id);
    addToast({ type: 'success', message: 'SQL copied to clipboard' });
    setTimeout(() => setCopiedId(null), 2000);
  }, [addToast]);

  const handleSetUp = useCallback(async (c: ExampleCard) => {
    if (!c.onImport || setupRunning) return;
    setSetupRunning(true);
    setSetupStep('Starting...');
    try {
      const { runId } = await c.onImport((step) => setSetupStep(step));
      const cardSlug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const wsName = `${cardSlug}-${runId}`;
      const notes = c.completionModal ? stepsToNotes(c.completionModal) : undefined;
      setWorkspaceName(wsName);
      setWorkspaceNotes(notes ?? null);
      saveCurrentWorkspace(wsName, c.id, c.title, notes);
      addToast({ type: 'success', message: `"${c.title}" workspace saved` });
      setActiveNavItem('workspace');
      navigateToExampleDetail(null);
    } catch (err: unknown) {
      let msg: string;
      if (err instanceof Error) {
        msg = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        const apiErr = err as { status?: number; message?: string; details?: string };
        msg = `${apiErr.message}${apiErr.status ? ` (${apiErr.status})` : ''}${apiErr.details ? `: ${apiErr.details}` : ''}`;
      } else {
        msg = String(err);
      }
      addToast({ type: 'error', message: `Setup failed: ${msg}` });
    } finally {
      setSetupRunning(false);
      setSetupStep('');
    }
  }, [setupRunning, addToast, setActiveNavItem, setWorkspaceName, setWorkspaceNotes, saveCurrentWorkspace, navigateToExampleDetail]);

  // Escape to go back
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigateToExampleDetail(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [navigateToExampleDetail]);

  if (!card || !doc) return null;

  return (
    <div className="edp">
      <div className="edp__scroll">
        {/* Hero Section */}
        <div className="edp__hero">
          <div className="edp__hero-content">
            <div className="edp__hero-tags">
              {card.tags.map((tag) => (
                <span key={tag} className={`edp__tag ${tag === 'Quick Start' ? 'edp__tag--primary' : ''}`}>
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="edp__hero-title">{card.title}</h1>
            <p className="edp__hero-subtitle">{doc.subtitle}</p>
            <div className="edp__hero-actions">
              {card.onImport && !card.comingSoon && (
                <button
                  className="edp__btn edp__btn--setup"
                  onClick={() => handleSetUp(card)}
                  disabled={setupRunning}
                >
                  <FiPlay size={14} /> {setupRunning ? setupStep || 'Setting up...' : 'Set Up Environment'}
                </button>
              )}
              <button
                className="edp__btn edp__btn--copy"
                onClick={() => handleCopy(card.sql, card.id)}
              >
                {copiedId === card.id ? <FiCheck size={14} /> : <FiCopy size={14} />}
                {copiedId === card.id ? 'Copied!' : 'Copy SQL'}
              </button>
            </div>
          </div>

          {/* Data Flow Diagram — hero visual */}
          {doc.dataFlow && (
            <div className="edp__hero-diagram">
              <DataFlowDiagram def={doc.dataFlow} fullPage />
            </div>
          )}
        </div>

        {/* Business Context — always visible, prominent */}
        {doc.businessContext && (
          <div className="edp__context">
            <div className="edp__context-accent" />
            <p>{doc.businessContext}</p>
          </div>
        )}

        {/* Content Grid — two columns on wide screens */}
        <div className="edp__grid">
          {/* Left column: SQL + DDL */}
          <div className="edp__col">
            {/* DDL Blocks */}
            {doc.ddlBlocks && doc.ddlBlocks.length > 0 && (
              <CollapsibleSection title="DDL (CREATE TABLE)" icon={<FiDatabase size={16} />} defaultOpen accentColor="var(--color-info)">
                {doc.ddlBlocks.map((block, i) => (
                  <div key={i} className="edp__sql-block">
                    <div className="edp__sql-header">
                      <span className="edp__sql-label">{block.label}</span>
                      <button
                        className="edp__sql-copy"
                        onClick={() => handleCopy(block.sql, `ddl-${i}`)}
                        title="Copy SQL"
                      >
                        {copiedId === `ddl-${i}` ? <FiCheck size={12} /> : <FiCopy size={12} />}
                      </button>
                    </div>
                    <SqlHighlight sql={block.sql} />
                  </div>
                ))}
              </CollapsibleSection>
            )}

            {/* SQL Blocks */}
            {doc.sqlBlocks && doc.sqlBlocks.length > 0 && (
              <CollapsibleSection title="SQL Query" icon={<FiTerminal size={16} />} defaultOpen accentColor="var(--color-primary)">
                {doc.sqlBlocks.map((block, i) => (
                  <div key={i} className="edp__sql-block">
                    <div className="edp__sql-header">
                      <span className="edp__sql-label">{block.label}</span>
                      <button
                        className="edp__sql-copy"
                        onClick={() => handleCopy(block.sql, `sql-${i}`)}
                        title="Copy SQL"
                      >
                        {copiedId === `sql-${i}` ? <FiCheck size={12} /> : <FiCopy size={12} />}
                      </button>
                    </div>
                    <SqlHighlight sql={block.sql} />
                  </div>
                ))}
              </CollapsibleSection>
            )}

            {/* Example Input → Output (side by side) */}
            {(doc.exampleInput || doc.expectedOutput) && (
              <div className="edp__io-panel">
                {doc.exampleInput && doc.exampleInput.length > 0 && (
                  <div className="edp__io-col">
                    <div className="edp__io-header edp__io-header--input">
                      <FiDatabase size={14} />
                      <span>Example Input</span>
                    </div>
                    <div className="edp__io-rows">
                      {doc.exampleInput.map((row, i) => (
                        <div key={i} className="edp__io-row">{row}</div>
                      ))}
                    </div>
                  </div>
                )}
                {doc.exampleInput && doc.expectedOutput && (
                  <div className="edp__io-arrow" aria-hidden="true">
                    <FiArrowRight size={20} />
                  </div>
                )}
                {doc.expectedOutput && doc.expectedOutput.length > 0 && (
                  <div className="edp__io-col">
                    <div className="edp__io-header edp__io-header--output">
                      <FiList size={14} />
                      <span>Expected Output</span>
                    </div>
                    <div className="edp__io-rows">
                      {doc.expectedOutput.map((row, i) => (
                        <div key={i} className="edp__io-row">{row}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column: Concepts, Topics, Q&A */}
          <div className="edp__col">
            {/* Key Concepts */}
            {doc.concepts && doc.concepts.length > 0 && (
              <CollapsibleSection title="Key Concepts" icon={<FiBookOpen size={16} />} defaultOpen accentColor="var(--color-warning)">
                <div className="edp__concepts">
                  {doc.concepts.map((c, i) => (
                    <div key={i} className="edp__concept">
                      <div className="edp__concept-term">{c.term}</div>
                      <div className="edp__concept-explanation">{c.explanation}</div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Topics */}
            {doc.topics && doc.topics.length > 0 && (
              <CollapsibleSection title="Topics" icon={<FiDatabase size={16} />} defaultOpen accentColor="var(--color-info)">
                <div className="edp__topics">
                  {doc.topics.map((t, i) => (
                    <div key={i} className="edp__topic">
                      <span className={`edp__topic-badge edp__topic-badge--${t.type}`}>
                        {t.type === 'input' ? 'INPUT' : 'OUTPUT'}
                      </span>
                      <div className="edp__topic-info">
                        <span className="edp__topic-name">{t.name}</span>
                        <span className="edp__topic-desc">{t.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* What Happens If... */}
            {doc.whatHappensIf && doc.whatHappensIf.length > 0 && (
              <CollapsibleSection title="What Happens If..." icon={<FiHelpCircle size={16} />} accentColor="var(--color-error)">
                <div className="edp__qa-list">
                  {doc.whatHappensIf.map((qa, i) => (
                    <div key={i} className="edp__qa">
                      <div className="edp__qa-q">{qa.question}</div>
                      <div className="edp__qa-a">{qa.answer}</div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}
          </div>
        </div>

        {/* Use Cases — full width pills */}
        {doc.useCases && doc.useCases.length > 0 && (
          <div className="edp__use-cases">
            <span className="edp__use-cases-label">Use Cases</span>
            <div className="edp__use-cases-pills">
              {doc.useCases.map((uc, i) => (
                <span key={i} className="edp__pill">{uc}</span>
              ))}
            </div>
          </div>
        )}

        {/* Cross Reference */}
        {doc.crossReference && (
          <button
            className="edp__cross-ref"
            onClick={() => navigateToExampleDetail(doc.crossReference!.cardId)}
          >
            <FiArrowRight size={16} />
            <div>
              <div className="edp__cross-ref-label">{doc.crossReference.label}</div>
              <div className="edp__cross-ref-desc">{doc.crossReference.description}</div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
