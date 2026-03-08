/**
 * @filter-flyout
 * Reusable multi-category filter flyout.
 *
 * Renders a compact filter icon button. Clicking it opens a flyout panel
 * that expands to the right with categories on the left and checkbox
 * options on the right — modelled after the Confluent Cloud filter pattern.
 *
 * Usage:
 *   <FilterFlyout
 *     categories={[{
 *       key: 'status',
 *       label: 'Statement Status',
 *       options: [
 *         { value: 'RUNNING', label: 'Running' },
 *         { value: 'COMPLETED', label: 'Completed' },
 *       ],
 *     }]}
 *     activeFilters={{ status: new Set(['RUNNING']) }}
 *     onFilterChange={(catKey, value, checked) => { ... }}
 *   />
 */
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FiFilter, FiChevronUp } from 'react-icons/fi';
import './FilterFlyout.css';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterCategory {
  key: string;
  label: string;
  options: FilterOption[];
}

export interface FilterFlyoutProps {
  categories: FilterCategory[];
  /** Map of categoryKey -> Set of selected option values */
  activeFilters: Record<string, Set<string>>;
  onFilterChange: (categoryKey: string, value: string, checked: boolean) => void;
  onClearCategory?: (categoryKey: string) => void;
  onClearAll?: () => void;
}

export function FilterFlyout({
  categories,
  activeFilters,
  onFilterChange,
  onClearCategory: _onClearCategory,
  onClearAll,
}: FilterFlyoutProps) {
  const [open, setOpen] = useState(false);
  const [activeCategoryKey, setActiveCategoryKey] = useState<string>(
    categories[0]?.key ?? '',
  );
  const [search, setSearch] = useState('');
  const flyoutRef = useRef<HTMLDivElement>(null);

  // Total active filter count across all categories
  const totalActive = useMemo(() => {
    let count = 0;
    for (const key of Object.keys(activeFilters)) {
      count += activeFilters[key].size;
    }
    return count;
  }, [activeFilters]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Reset search when switching categories
  const handleCategoryClick = useCallback((key: string) => {
    setActiveCategoryKey(key);
    setSearch('');
  }, []);

  const activeCategory = categories.find((c) => c.key === activeCategoryKey);
  const selectedSet = activeFilters[activeCategoryKey] ?? new Set<string>();

  const filteredOptions = useMemo(() => {
    if (!activeCategory) return [];
    if (!search) return activeCategory.options;
    const q = search.toLowerCase();
    return activeCategory.options.filter((o) =>
      o.label.toLowerCase().includes(q),
    );
  }, [activeCategory, search]);

  return (
    <div className="filter-flyout" ref={flyoutRef}>
      <button
        className={`filter-flyout-trigger${totalActive > 0 ? ' filter-flyout-trigger--active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label="Filter"
        title="Filter"
      >
        <FiFilter size={14} />
        {totalActive > 0 && (
          <span className="filter-flyout-badge">{totalActive}</span>
        )}
      </button>

      {open && (
        <div className="filter-flyout-panel">
          {/* Header */}
          <div className="filter-flyout-header">
            <FiFilter size={13} />
            <span>Filter</span>
            <button
              className="filter-flyout-collapse"
              onClick={() => setOpen(false)}
              aria-label="Close filter"
            >
              <FiChevronUp size={14} />
            </button>
          </div>

          {/* Body — categories left, options right */}
          <div className="filter-flyout-body">
            {/* Category list (left side) */}
            <div className="filter-flyout-categories">
              {categories.map((cat) => {
                const catCount = activeFilters[cat.key]?.size ?? 0;
                const isActive = cat.key === activeCategoryKey;
                return (
                  <button
                    key={cat.key}
                    className={`filter-flyout-category${isActive ? ' filter-flyout-category--active' : ''}`}
                    onClick={() => handleCategoryClick(cat.key)}
                  >
                    {cat.label}
                    {catCount > 0 && <span className="filter-flyout-cat-count">({catCount})</span>}
                  </button>
                );
              })}
            </div>

            {/* Options list (right side) */}
            <div className="filter-flyout-options">
              {activeCategory && activeCategory.options.length > 5 && (
                <div className="filter-flyout-search">
                  <input
                    type="text"
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              <div className="filter-flyout-option-list">
                {filteredOptions.map((opt) => {
                  const checked = selectedSet.has(opt.value);
                  return (
                    <label key={opt.value} className="filter-flyout-option">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          onFilterChange(activeCategoryKey, opt.value, e.target.checked)
                        }
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
                {filteredOptions.length === 0 && (
                  <div className="filter-flyout-no-results">No matches</div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="filter-flyout-footer">
            {totalActive > 0 && onClearAll ? (
              <button className="filter-flyout-clear-btn" onClick={() => onClearAll()}>
                Clear filters
              </button>
            ) : (
              <span />
            )}
            <button className="filter-flyout-apply-btn" onClick={() => setOpen(false)}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
