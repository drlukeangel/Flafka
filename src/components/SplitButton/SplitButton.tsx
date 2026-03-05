/**
 * @split-button
 * SplitButton — Generic split button with dropdown menu.
 *
 * Left side: primary action (icon + label)
 * Chevron right side: dropdown with alternative actions
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import './SplitButton.css';

export interface SplitButtonOption {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface SplitButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  options: SplitButtonOption[];
  className?: string;
  /** Disable the chevron independently (e.g. when all dropdown options are disabled) */
  chevronDisabled?: boolean;
}

export function SplitButton({
  icon,
  label,
  onClick,
  disabled,
  options,
  className = '',
  chevronDisabled,
}: SplitButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // When menu opens, focus first enabled item
  useEffect(() => {
    if (!menuOpen) {
      setFocusedIndex(-1);
      return;
    }
    const firstEnabledIndex = options.findIndex((opt) => !opt.disabled);
    setFocusedIndex(firstEnabledIndex >= 0 ? firstEnabledIndex : -1);
  }, [menuOpen, options]);

  // Manage focus when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0 && menuItemRefs.current[focusedIndex]) {
      menuItemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        chevronRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const handleOptionClick = (option: SplitButtonOption) => {
    setMenuOpen(false);
    option.onClick();
  };

  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!menuOpen || focusedIndex === -1) return;

      let newIndex = focusedIndex;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          // Find next enabled item, wrapping to start
          let nextIndex = focusedIndex + 1;
          while (nextIndex < options.length && options[nextIndex]?.disabled) {
            nextIndex++;
          }
          if (nextIndex >= options.length) {
            nextIndex = 0;
            while (nextIndex < options.length && options[nextIndex]?.disabled) {
              nextIndex++;
            }
          }
          newIndex = nextIndex < options.length ? nextIndex : focusedIndex;
          setFocusedIndex(newIndex);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          // Find previous enabled item, wrapping to end
          let prevIndex = focusedIndex - 1;
          while (prevIndex >= 0 && options[prevIndex]?.disabled) {
            prevIndex--;
          }
          if (prevIndex < 0) {
            prevIndex = options.length - 1;
            while (prevIndex >= 0 && options[prevIndex]?.disabled) {
              prevIndex--;
            }
          }
          newIndex = prevIndex >= 0 ? prevIndex : focusedIndex;
          setFocusedIndex(newIndex);
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const option = options[focusedIndex];
          if (option && !option.disabled) {
            handleOptionClick(option);
          }
          break;
        }
        default:
          break;
      }
    },
    [menuOpen, focusedIndex, options]
  );

  return (
    <div className={`split-btn-wrapper ${className}`} ref={wrapperRef}>
      <div className="split-btn-group">
        <button
          className="split-btn-main"
          onClick={onClick}
          disabled={disabled}
          title={label}
        >
          {icon}
          <span>{label}</span>
        </button>
        <span className="split-btn-divider" />
        <button
          ref={chevronRef}
          className="split-btn-chevron"
          onClick={() => setMenuOpen((prev) => !prev)}
          disabled={chevronDisabled ?? disabled}
          aria-haspopup="true"
          aria-expanded={menuOpen}
          aria-label={`${label} options`}
          title="More options"
        >
          <FiChevronDown size={13} className={menuOpen ? 'split-btn-chevron-icon--open' : ''} />
        </button>
      </div>

      {menuOpen && (
        <div className="split-btn-menu" role="menu" onKeyDown={handleMenuKeyDown}>
          {options.map((option, index) => (
            <button
              key={option.label}
              ref={(el) => {
                menuItemRefs.current[index] = el;
              }}
              className="split-btn-menu-item"
              role="menuitem"
              disabled={option.disabled}
              tabIndex={focusedIndex === index ? 0 : -1}
              onClick={() => handleOptionClick(option)}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
