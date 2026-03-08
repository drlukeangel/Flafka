/**
 * Left sidebar navigation rail — switches between workspace panels
 * (Editor, Topics, Schemas, Jobs, etc). Supports collapsed (icons only)
 * and expanded (icons + labels) modes.
 */

import { useWorkspaceStore } from '../../store/workspaceStore';
import type { NavItem } from '../../types';
import {
  FiCode,
  FiDatabase,
  FiFileText,
  FiClock,
  FiHelpCircle,
  FiSettings,
  FiBookmark,
  FiBookOpen,
  FiList,
  FiPackage,
  FiLayers,
  FiRadio,
  FiMoon,
  FiSun,
} from 'react-icons/fi';
import './NavRail.css';

interface NavRailItemConfig {
  id: NavItem;
  icon: React.ReactNode;
  label: string;
  section: 'workspace' | 'data' | 'tools' | 'settings';
}

const NAV_ITEMS: NavRailItemConfig[] = [
  { id: 'workspace', icon: <FiCode size={18} />, label: 'Workspace', section: 'workspace' },
  { id: 'jobs', icon: <FiList size={18} />, label: 'Jobs', section: 'workspace' },
  { id: 'tree', icon: <FiDatabase size={18} />, label: 'Database Objects', section: 'data' },
  { id: 'topics', icon: <FiRadio size={18} />, label: 'Topics', section: 'data' },
  { id: 'schemas', icon: <FiFileText size={18} />, label: 'Schemas', section: 'data' },
  { id: 'workspaces', icon: <FiLayers size={18} />, label: 'Workspaces', section: 'tools' },
  { id: 'snippets', icon: <FiBookmark size={18} />, label: 'Snippets', section: 'tools' },
  { id: 'history', icon: <FiClock size={18} />, label: 'History', section: 'tools' },
  { id: 'artifacts', icon: <FiPackage size={18} />, label: 'Artifacts', section: 'tools' },
  { id: 'learn', icon: <FiBookOpen size={18} />, label: 'Learn', section: 'tools' },
  { id: 'help', icon: <FiHelpCircle size={18} />, label: 'Help', section: 'tools' },
  { id: 'settings', icon: <FiSettings size={18} />, label: 'Settings', section: 'settings' },
];

const SECTION_LABELS: Record<string, string> = {
  workspace: 'Workspace',
  data: 'Data',
  tools: 'Tools',
  settings: 'Settings',
};

export function NavRail() {
  const activeNavItem = useWorkspaceStore((s) => s.activeNavItem);
  const navExpanded = useWorkspaceStore((s) => s.navExpanded);
  const setActiveNavItem = useWorkspaceStore((s) => s.setActiveNavItem);
  const theme = useWorkspaceStore((s) => s.theme);
  const toggleTheme = useWorkspaceStore((s) => s.toggleTheme);


  // Group items by section
  const sections = ['workspace', 'data', 'tools', 'settings'] as const;
  const grouped = sections.map((section) => ({
    key: section,
    label: SECTION_LABELS[section],
    items: NAV_ITEMS.filter((item) => item.section === section),
  }));

  const handleItemClick = (item: NavItem) => {
    // If clicking the active item that has a side panel, toggle back to workspace
    if (item === activeNavItem && item !== 'workspace') {
      setActiveNavItem('workspace');
    } else {
      setActiveNavItem(item);
    }
  };


  return (
    <nav
      className={`nav-rail${navExpanded ? ' nav-rail--expanded' : ''}`}
      aria-label="Main navigation"
    >
      {grouped.map((section, sectionIndex) => (
        <div key={section.key}>
          {section.key === 'settings' && <div className="nav-rail-spacer" />}
          {sectionIndex > 0 && section.key !== 'settings' && (
            <div className="nav-rail-divider" />
          )}
          <div className="nav-rail-section">
            <div className="nav-rail-section-header">{section.label}</div>
            {section.items.map((item) => (
              <button
                key={item.id}
                className={`nav-rail-item${activeNavItem === item.id ? ' nav-rail-item--active' : ''}`}
                onClick={() => handleItemClick(item.id)}
                title={!navExpanded ? item.label : undefined}
                aria-label={item.label}
                aria-current={activeNavItem === item.id ? 'page' : undefined}
              >
                <span className="nav-rail-item-icon">{item.icon}</span>
                <span className="nav-rail-item-label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="nav-rail-section">

        <button
          className="nav-rail-item"
          onClick={toggleTheme}
          title={!navExpanded ? (theme === 'light' ? 'Dark mode' : 'Light mode') : undefined}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-pressed={theme === 'dark'}
        >
          <span className="nav-rail-item-icon">
            {theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
          </span>
          <span className="nav-rail-item-label">
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </span>
        </button>
      </div>
    </nav>
  );
}
