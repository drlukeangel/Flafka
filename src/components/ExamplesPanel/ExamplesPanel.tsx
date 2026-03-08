/**
 * @examples-panel
 * ExamplesPanel — Side panel showing importable SQL example cards.
 *
 * Features:
 * - Kickstarter example cards with SQL previews
 * - Search bar with debounced text filter across title/description/tags
 * - Multi-select collapsible filter sections (Type + Skill Level)
 * - OR within a section, AND between sections, AND with search
 * - Section headers between groups when no type filter active and no search
 * - Skill level badges on cards
 * - Import button: creates a new editor cell with the example SQL + label
 * - Copy button: copies SQL to clipboard
 * - Tag badges per card
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';

const EMPTY_ARTIFACTS: never[] = [];
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useLearnStore } from '../../store/learnStore';
import { getExampleCards } from '../../data/exampleCards';
import { FiCopy, FiCheck, FiPlay, FiSearch, FiX } from 'react-icons/fi';
import type { ExampleCard, ExampleCompletionModal, ExampleGroup, SkillLevel } from '../../types';
import { FilterFlyout } from '../ui/FilterFlyout';
import type { FilterCategory } from '../ui/FilterFlyout';

const ALL_GROUPS: ExampleGroup[] = ['Basics', 'Windows', 'Joins', 'Stateful', 'Schema', 'Views', 'Data Masking', 'UDFs', 'Kafka', 'Confluent'];
const ALL_SKILLS: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

const EXAMPLE_FILTER_CATEGORIES: FilterCategory[] = [
  { key: 'type', label: 'Type', options: ALL_GROUPS.map((g) => ({ value: g, label: g })) },
  { key: 'skill', label: 'Skill Level', options: ALL_SKILLS.map((s) => ({ value: s, label: s })) },
];

const SKILL_COLORS: Record<SkillLevel, string> = {
  Beginner: '#22c55e',
  Intermediate: '#f59e0b',
  Advanced: '#ef4444',
};

const GROUP_ACCENT_COLORS: Record<string, string> = {
  Basics: 'var(--color-success, #22c55e)',
  Windows: 'var(--color-warning, #f59e0b)',
  Joins: 'var(--color-info, #3b82f6)',
  Stateful: '#a855f7',
  Schema: '#f97316',
  UDFs: '#06b6d4',
  Views: '#ec4899',
  'Data Masking': '#64748b',
  Kafka: '#10b981',
  Confluent: '#6366f1',
};

const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
  gap: '10px',
  padding: '0 12px',
};

function stepsToNotes(modal: Omit<ExampleCompletionModal, 'title'>): string {
  const lines: string[] = [];
  if (modal.subtitle) {
    lines.push(modal.subtitle);
  }
  modal.steps.forEach((step, i) => {
    lines.push(`${i + 1}. ${step.label}${step.detail ? ' — ' + step.detail : ''}`);
  });
  return lines.join('\n');
}

export function ExamplesPanel() {
  const addToast = useWorkspaceStore((s) => s.addToast);
  const setActiveNavItem = useWorkspaceStore((s) => s.setActiveNavItem);
  const artifactList = useWorkspaceStore((s) => s.artifactList) ?? EMPTY_ARTIFACTS;
  const loadArtifacts = useWorkspaceStore((s) => s.loadArtifacts);
  const saveCurrentWorkspace = useWorkspaceStore((s) => s.saveCurrentWorkspace);
  const setWorkspaceName = useWorkspaceStore((s) => s.setWorkspaceName);
  const setWorkspaceNotes = useWorkspaceStore((s) => s.setWorkspaceNotes);
  const addTab = useWorkspaceStore((s) => s.addTab);
  const tabCount = useWorkspaceStore((s) => s.tabOrder.length);
  const selectedExampleId = useWorkspaceStore((s) => s.selectedExampleId);
  const navigateToExampleDetail = useWorkspaceStore((s) => s.navigateToExampleDetail);

  // Load artifacts on mount if not already loaded (needed for dynamic ID resolution)
  useEffect(() => {
    if (artifactList.length === 0) loadArtifacts();
  }, [artifactList.length, loadArtifacts]);

  const cards = useMemo(() => getExampleCards(artifactList), [artifactList]);

  // Only kickstart cards (snippets moved to SnippetsPanel)
  const kickstartCards = useMemo(() => cards.filter((c) => c.category === 'kickstart'), [cards]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [setupRunning, setSetupRunning] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<string>('');

  // Search + filter state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 300ms debounce for search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const selectedGroups = activeFilters['type'] ?? new Set<string>();
  const selectedSkills = activeFilters['skill'] ?? new Set<string>();

  const handleFilterChange = useCallback(
    (categoryKey: string, value: string, checked: boolean) => {
      setActiveFilters((prev) => {
        const prevSet = prev[categoryKey] ?? new Set<string>();
        const next = new Set(prevSet);
        if (checked) next.add(value);
        else next.delete(value);
        return { ...prev, [categoryKey]: next };
      });
    },
    [],
  );

  const handleClearCategory = useCallback((categoryKey: string) => {
    setActiveFilters((prev) => ({ ...prev, [categoryKey]: new Set<string>() }));
  }, []);

  const handleClearAll = useCallback(() => {
    setActiveFilters({});
  }, []);

  // Filtered cards: OR-within-section, AND-between-sections, AND with search
  const visibleCards = useMemo(() => {
    let filtered = kickstartCards;
    if (selectedGroups.size > 0) {
      filtered = filtered.filter((c) => c.group && selectedGroups.has(c.group));
    }
    if (selectedSkills.size > 0) {
      filtered = filtered.filter((c) => c.skillLevel && selectedSkills.has(c.skillLevel));
    }
    if (debouncedSearch) {
      const q = debouncedSearch;
      filtered = filtered.filter((c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [kickstartCards, activeFilters, debouncedSearch]);

  // Group visible cards for section headers (when no filters active and no search)
  const groupedCards = useMemo(() => {
    if (selectedGroups.size > 0 || debouncedSearch) return null;
    const groups: { group: ExampleGroup; cards: ExampleCard[] }[] = [];
    const seen = new Set<ExampleGroup>();
    for (const card of visibleCards) {
      const g = card.group;
      if (!g) continue;
      if (!seen.has(g)) {
        seen.add(g);
        groups.push({ group: g, cards: [] });
      }
      groups.find((gr) => gr.group === g)!.cards.push(card);
    }
    return groups;
  }, [visibleCards, activeFilters, debouncedSearch]);

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
        setWorkspaceName(wsName);
        setWorkspaceNotes(notes ?? null);
        saveCurrentWorkspace(wsName, card.id, card.title, notes);
        addToast({ type: 'success', message: `"${card.title}" workspace saved` });
        setActiveNavItem('workspace');
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
        setSetupRunning(null);
        setSetupStep('');
      }
  }, [addToast, setActiveNavItem, setWorkspaceName, setWorkspaceNotes, saveCurrentWorkspace]);

  const handleImport = useCallback(async (card: ExampleCard) => {
    if (!card.onImport) return;
    if (setupRunning) return;
    if (tabCount >= 8) {
      addToast({ type: 'error', message: 'Max 8 tabs — close one first' });
      return;
    }
    addTab();
    await runSetup(card);
  }, [setupRunning, tabCount, addTab, addToast, runSetup]);

  const completedExamples = useLearnStore((s) => s.progress.completedExamples);

  const renderCard = (card: ExampleCard) => {
    const isQuickStart = !!card.onImport;
    const isComingSoon = !!card.comingSoon;
    const isRunning = setupRunning === card.id;
    const hasDoc = !!card.documentation;
    const isComplete = completedExamples.includes(card.id);
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
          position: 'relative',
          margin: 0,
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
        {/* Completion checkmark overlay */}
        {isComplete && (
          <div style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'var(--success-color, #16a34a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}>
            <FiCheck size={14} color="#fff" />
          </div>
        )}
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
        {/* UDF banner */}
        {card.udf && (
          <div style={{
            background: 'linear-gradient(90deg, #0ea5e9, #0284c7)',
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
            <span style={{ fontSize: 12 }}>&#9830;</span> UDF — Uses Custom Functions
          </div>
        )}
        {/* Schema banner */}
        {card.schema && (
          <div style={{
            background: 'linear-gradient(90deg, #f59e0b, #d97706)',
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
            <span style={{ fontSize: 12 }}>&#9670;</span> Schema Injection — Custom Schema Handling
          </div>
        )}
        {/* View banner */}
        {card.view && (
          <div style={{
            background: 'linear-gradient(90deg, #14b8a6, #0d9488)',
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
            <span style={{ fontSize: 12 }}>&#9661;</span> View — Reusable Query Layer
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
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {card.title}
            {/* Skill level badge */}
            {card.skillLevel && (
              <span
                data-testid={`skill-badge-${card.id}`}
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: SKILL_COLORS[card.skillLevel] + '20',
                  color: SKILL_COLORS[card.skillLevel],
                  border: `1px solid ${SKILL_COLORS[card.skillLevel]}40`,
                  whiteSpace: 'nowrap',
                }}
              >
                {card.skillLevel}
              </span>
            )}
            {/* Learn More — top right of title row */}
            {hasDoc && !isRunning && (
              <span style={{
                marginLeft: 'auto',
                fontSize: 10,
                color: 'var(--color-primary)',
                fontWeight: 500,
                flexShrink: 0,
                paddingRight: isComplete ? 28 : 0,
              }}>
                Learn More →
              </span>
            )}
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
                title={isQuickStart ? 'Set up example environment' : 'Copy SQL'}
                style={{
                  border: 'none',
                  background: 'var(--color-success, #22c55e)',
                  color: '#1a1a1a',
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
                    <span style={{ display: 'inline-block', width: 11, height: 11, border: '2px solid rgba(0,0,0,0.2)', borderTop: '2px solid #1a1a1a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Setting up...
                  </>
                ) : (
                  <>
                    <FiPlay size={11} />
                    Set Up
                  </>
                )}
              </button>
            )}
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
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
      aria-label="Examples panel"
    >
      {/* Header: search + filter + count on one line */}
      <div
        style={{
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          padding: '8px 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Search bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--color-surface-secondary)',
            borderRadius: 4,
            padding: '3px 6px',
            border: '1px solid var(--color-border)',
            flex: 1,
          }}>
            <FiSearch size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search examples..."
              aria-label="Search examples"
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 11,
                color: 'var(--color-text-primary)',
                flex: 1,
                padding: '2px 0',
              }}
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                <FiX size={12} />
              </button>
            )}
          </div>

          {/* Filter flyout */}
          <FilterFlyout
            categories={EXAMPLE_FILTER_CATEGORIES}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            onClearCategory={handleClearCategory}
            onClearAll={handleClearAll}
          />

          {/* Result count */}
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
            {visibleCards.length} of {kickstartCards.length}
          </span>
        </div>
      </div>

      {/* Card list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {visibleCards.length === 0 ? (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: 12,
            }}
            role="status"
          >
            <FiSearch size={24} style={{ color: 'var(--color-text-tertiary)', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
            No examples match your search.
          </div>
        ) : groupedCards ? (
          // Render with section headers when no type filters active and no search
          groupedCards.map(({ group, cards: groupCards }, idx) => {
            const accent = GROUP_ACCENT_COLORS[group] || 'var(--color-text-tertiary)';
            return (
              <div key={group} style={idx > 0 ? { marginTop: 20 } : undefined}>
                <div
                  style={{
                    padding: '6px 12px 4px',
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--color-text-tertiary)',
                    borderBottom: '1px solid var(--color-border)',
                    marginBottom: 10,
                    borderLeft: `3px solid ${accent}`,
                    background: `color-mix(in srgb, ${accent} 10%, transparent)`,
                  }}
                >
                  {group}
                </div>
                <div style={GRID_STYLE}>
                  {groupCards.map(renderCard)}
                </div>
              </div>
            );
          })
        ) : (
          // Flat list when filters or search are active
          <div style={GRID_STYLE}>
            {visibleCards.map(renderCard)}
          </div>
        )}
      </div>
    </div>
  );
}
