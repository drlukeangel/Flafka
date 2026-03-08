/**
 * @help-system @help-search @help-focus
 * HelpPanel component for searchable FAQ/Help system
 * Features: search filtering, category tabs, focus management, clipboard copy
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { FiX, FiCopy, FiCheck } from 'react-icons/fi';
import { helpTopics } from '../../data/helpTopics';
import type { HelpTopic, ContentSection } from './types';
import { useWorkspaceStore } from '../../store/workspaceStore';
import './HelpPanel.css';

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTopicId?: string;
}

/**
 * Renders a single content section based on its type
 */
function renderContentSection(section: ContentSection, index: number) {
  switch (section.type) {
    case 'heading':
      return (
        <h3 key={index} className="help-heading">
          {section.text}
        </h3>
      );
    case 'paragraph':
      return (
        <p key={index} className="help-text">
          {section.text}
        </p>
      );
    case 'code-block':
      return <CodeBlock key={index} code={section.text} />;
    case 'list':
      return (
        <p key={index} className="help-text help-list-title">
          {section.text}
        </p>
      );
    case 'list-item':
      return (
        <li key={index} className="help-list-item">
          {section.text}
        </li>
      );
    default:
      return null;
  }
}

/**
 * Code block with copy-to-clipboard button
 */
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { addToast } = useWorkspaceStore();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      addToast({
        type: 'success',
        message: 'Code copied to clipboard',
        duration: 2000,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      try {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        addToast({
          type: 'success',
          message: 'Code copied to clipboard',
          duration: 2000,
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        addToast({
          type: 'error',
          message: 'Failed to copy code',
          duration: 2000,
        });
      }
    }
  };

  return (
    <div className="help-code-container">
      <pre>
        <code className="help-code-block">{code}</code>
      </pre>
      <button
        className="help-code-copy-btn"
        onClick={handleCopy}
        title="Copy code"
        aria-label="Copy code to clipboard"
      >
        {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
      </button>
    </div>
  );
}

/**
 * Single help topic display
 */
function HelpTopicDisplay({ topic }: { topic: HelpTopic }) {
  const contentNodes: (React.ReactNode | React.ReactNode[])[] = [];
  let listItems: React.ReactNode[] = [];

  topic.content.forEach((section, index) => {
    if (section.type === 'list-item') {
      listItems.push(renderContentSection(section, index));
    } else {
      if (listItems.length > 0) {
        contentNodes.push(
          <ul key={`list-${index}`} className="help-list">
            {listItems}
          </ul>
        );
        listItems = [];
      }
      contentNodes.push(renderContentSection(section, index));
    }
  });

  if (listItems.length > 0) {
    contentNodes.push(
      <ul key={`list-end`} className="help-list">
        {listItems}
      </ul>
    );
  }

  return <div className="help-topic-content">{contentNodes}</div>;
}

/**
 * Main HelpPanel component
 */
export function HelpPanel({ isOpen, onClose, activeTopicId }: HelpPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // @help-search: Filter topics by search query
  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) {
      return helpTopics;
    }

    const query = searchQuery.toLowerCase();
    return helpTopics.filter((topic) => {
      const titleMatch = topic.title.toLowerCase().includes(query);
      const keywordsMatch = topic.keywords.some((kw) => kw.toLowerCase().includes(query));
      const contentMatch = topic.content.some((section) =>
        section.text.toLowerCase().includes(query)
      );

      return titleMatch || keywordsMatch || contentMatch;
    });
  }, [searchQuery]);

  // Get unique categories from filtered topics
  const categories = useMemo(() => {
    const cats = new Set<string>(filteredTopics.map((t) => t.category));
    return Array.from(cats).sort();
  }, [filteredTopics]);

  // Set initial active category
  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  // Group topics by category
  const topicsByCategory = useMemo(() => {
    const grouped: Record<string, HelpTopic[]> = {};
    categories.forEach((cat) => {
      grouped[cat] = filteredTopics
        .filter((t) => t.category === cat)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    });
    return grouped;
  }, [filteredTopics, categories]);

  // @help-focus: Focus management
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // @help-focus: Focus trap (Tab navigation cycling)
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = Array.from(
        panelRef.current!.querySelectorAll(
          'input, button, [role="tab"], a, [tabindex="0"]'
        )
      ) as HTMLElement[];

      if (focusableElements.length === 0) return;

      const currentFocused = document.activeElement as HTMLElement;
      const currentIndex = focusableElements.indexOf(currentFocused);

      if (e.shiftKey) {
        // Shift+Tab: move backward
        if (currentIndex <= 0) {
          e.preventDefault();
          focusableElements[focusableElements.length - 1].focus();
        }
      } else {
        // Tab: move forward
        if (currentIndex === focusableElements.length - 1) {
          e.preventDefault();
          focusableElements[0].focus();
        }
      }
    };

    panelRef.current?.addEventListener('keydown', handleKeyDown);
    return () => panelRef.current?.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // @help-contextual: Respond to activeTopicId and navigate to the topic
  useEffect(() => {
    if (isOpen && activeTopicId) {
      const targetTopic = helpTopics.find(t => t.id === activeTopicId);
      if (targetTopic) {
        // Set the active category to the topic's category
        setActiveCategory(targetTopic.category);

        // Scroll to the topic in the content area
        setTimeout(() => {
          const element = document.getElementById(`topic-${activeTopicId}`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'start' });

          // Highlight the topic briefly
          if (element) {
            element.classList.add('help-topic-highlighted');
            setTimeout(() => element.classList.remove('help-topic-highlighted'), 1000);
          }
        }, 100); // Small delay to let content render
      }
    }
  }, [isOpen, activeTopicId]);

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    'editor': 'Editor',
    'results': 'Results',
    'sidebar': 'Sidebar',
    'keyboard-shortcuts': 'Keyboard Shortcuts',
    'flink-sql': 'Flink SQL',
    'ksqldb': 'ksqlDB',
    'troubleshooting': 'Troubleshooting',
    'tips': 'Tips & Tricks',
  };

  const topicsToShow = activeCategory ? topicsByCategory[activeCategory] || [] : [];
  const hasResults = filteredTopics.length > 0;

  return (
    <>
      <div className="help-panel-overlay" onClick={onClose} />
      <div
        className="help-panel-modal"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-panel-title"
      >
        {/* Header */}
        <div className="help-panel-header">
          <h2 id="help-panel-title" className="help-panel-title">
            Help & FAQ
          </h2>
          <button
            ref={closeButtonRef}
            className="help-panel-close-btn"
            onClick={onClose}
            aria-label="Close help panel"
            title="Close (Esc)"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="help-panel-search-container">
          <input
            ref={searchInputRef}
            type="text"
            className="help-panel-search-input"
            placeholder="Search help topics..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // Reset category when searching
              if (e.target.value.trim()) {
                setActiveCategory(null);
              }
            }}
            aria-label="Search help topics"
          />
        </div>

        {/* Category Tabs (only show when not searching) */}
        {!searchQuery.trim() && categories.length > 0 && (
          <div className="help-panel-tabs" role="tablist">
            {categories.map((cat) => (
              <button
                key={cat}
                role="tab"
                aria-selected={activeCategory === cat}
                className={`help-panel-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {categoryLabels[cat] || cat}
              </button>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="help-panel-content">
          {hasResults ? (
            <>
              {searchQuery.trim() ? (
                // Search results view
                <div className="help-topics-list">
                  {filteredTopics.map((topic) => (
                    <div key={topic.id} id={`topic-${topic.id}`} className="help-topic-card">
                      <h3 className="help-topic-title">{topic.title}</h3>
                      <HelpTopicDisplay topic={topic} />
                    </div>
                  ))}
                </div>
              ) : (
                // Category view
                topicsToShow.length > 0 ? (
                  <div className="help-topics-list">
                    {topicsToShow.map((topic) => (
                      <div key={topic.id} id={`topic-${topic.id}`} className="help-topic-card">
                        <h3 className="help-topic-title">{topic.title}</h3>
                        <HelpTopicDisplay topic={topic} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="help-empty-state">
                    <p>No topics in this category.</p>
                  </div>
                )
              )}
            </>
          ) : (
            <div className="help-empty-state">
              <p>No help topics match your search.</p>
              <p className="help-empty-suggestion">Try different keywords or browse categories.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
