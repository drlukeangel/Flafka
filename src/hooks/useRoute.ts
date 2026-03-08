import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useLearnStore } from '../store/learnStore';
import type { NavItem } from '../types';

const VALID_NAV_ITEMS: Set<string> = new Set([
  'workspace', 'jobs', 'tree', 'topics', 'schemas', 'snippets',
  'learn', 'artifacts', 'history', 'help', 'settings', 'workspaces',
  'streams',
]);

/** Panel display names for document.title and screen reader announcements */
const PANEL_TITLES: Partial<Record<NavItem, string>> = {
  workspace: 'Editor',
  jobs: 'Jobs',
  tree: 'Explorer',
  topics: 'Topics',
  schemas: 'Schemas',
  snippets: 'Snippets',
  learn: 'Learn',
  artifacts: 'Artifacts',
  history: 'History',
  help: 'Help',
  settings: 'Settings',
  workspaces: 'Workspaces',
  streams: 'Streams',
};

const APP_TITLE = 'Flafka';

/**
 * Parse window.location.pathname into a nav item and optional sub-ID.
 * Also handles legacy hash URLs (#/jobs → /jobs) via replaceState.
 * Extra path segments beyond the sub-ID are silently ignored (intentional).
 */
export function parseRoute(): { navItem: NavItem; subId?: string; detailId?: string } {
  // Legacy hash support: redirect #/jobs → /jobs
  // Decode first, then re-encode to avoid double-encoding already-encoded hash segments
  if (window.location.hash.startsWith('#/')) {
    const raw = window.location.hash.replace(/^#\/?/, '');
    const segments = raw.split('/');
    const navItem = segments[0];
    const subId = segments[1] ? decodeURIComponent(segments[1]) : '';
    const cleanPath = subId ? `/${navItem}/${encodeURIComponent(subId)}` : `/${navItem}`;
    window.history.replaceState(null, '', cleanPath);
    // Fall through to parse the new pathname (replaceState updates location synchronously)
  }

  const pathname = window.location.pathname;
  const segments = pathname.replace(/^\//, '').split('/').filter(Boolean);
  if (segments.length === 0) return { navItem: 'workspace' };

  const first = segments[0];
  const subId = segments[1] ? decodeURIComponent(segments[1]) : undefined;
  const detailId = segments[2] ? decodeURIComponent(segments[2]) : undefined;

  if (VALID_NAV_ITEMS.has(first)) {
    return { navItem: first as NavItem, subId, detailId };
  }
  return { navItem: 'workspace' };
}

/** Build a URL path from a nav item and optional sub-ID + detail-ID. */
export function buildPath(navItem: NavItem, subId?: string | null, detailId?: string | null): string {
  if (navItem === 'workspace') return '/';
  if (subId && detailId) return `/${navItem}/${encodeURIComponent(subId)}/${encodeURIComponent(detailId)}`;
  if (subId) return `/${navItem}/${encodeURIComponent(subId)}`;
  return `/${navItem}`;
}

/** Apply a parsed route to the store — shared by mount and popstate handlers. */
function applyRoute(
  { navItem, subId, detailId }: { navItem: NavItem; subId?: string; detailId?: string },
  actions: {
    setActiveNavItem: (item: NavItem) => void;
    navigateToExampleDetail: (id: string | null) => void;
    navigateToJobDetail: (name: string) => void;
    navigateToTopic: (name: string) => Promise<void>;
    navigateToSchemaSubject: (subject: string) => void;
    navigateToLearnRoute: (subId?: string, detailId?: string) => void;
  },
) {
  if (navItem === 'learn') {
    actions.setActiveNavItem('learn');
    actions.navigateToLearnRoute(subId, detailId);
  } else if (navItem === 'jobs' && subId) {
    actions.navigateToJobDetail(subId);
  } else if (navItem === 'topics' && subId) {
    actions.navigateToTopic(subId).catch((err) =>
      console.error('Failed to navigate to topic:', err)
    );
  } else if (navItem === 'schemas' && subId) {
    actions.navigateToSchemaSubject(subId);
  } else {
    actions.setActiveNavItem(navItem);
    // Clear all deep-link selections when navigating to a non-deep-linked route
    actions.navigateToExampleDetail(null);
  }
}

/** Update document.title and announce route change to screen readers. */
function announceRouteChange(navItem: NavItem, subId?: string | null) {
  const panelName = PANEL_TITLES[navItem] || 'Flafka';
  const title = subId ? `${subId} — ${panelName} — ${APP_TITLE}` : `${panelName} — ${APP_TITLE}`;
  document.title = title;

  // Announce to screen readers via a visually-hidden live region
  let liveRegion = document.getElementById('route-announcer');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'route-announcer';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('role', 'status');
    liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
    document.body.appendChild(liveRegion);
  }
  liveRegion.textContent = subId ? `Navigated to ${panelName}: ${subId}` : `Navigated to ${panelName}`;
}

/**
 * Syncs window.location.pathname with activeNavItem + detail selections.
 * Enables browser back/forward and direct URL navigation.
 *
 * Deep links:
 *   /topics/{topicName}           → Topics panel with topic selected
 *   /schemas/{subjectName}        → Schemas panel with subject loaded
 *   /jobs/{jobName}               → Jobs page with job detail open
 *   /learn                        → Learn page (tracks tab)
 *   /learn/tracks/{trackId}       → Learn page with track detail
 *   /learn/examples/{exampleId}   → Learn page with example detail
 */
export function useRoute() {
  const activeNavItem = useWorkspaceStore((s) => s.activeNavItem);
  const selectedExampleId = useWorkspaceStore((s) => s.selectedExampleId);
  const selectedJobName = useWorkspaceStore((s) => s.selectedJobName);
  const selectedTopic = useWorkspaceStore((s) => s.selectedTopic);
  const selectedSchemaSubject = useWorkspaceStore((s) => s.selectedSchemaSubject);
  const setActiveNavItem = useWorkspaceStore((s) => s.setActiveNavItem);
  const navigateToExampleDetail = useWorkspaceStore((s) => s.navigateToExampleDetail);
  const navigateToJobDetail = useWorkspaceStore((s) => s.navigateToJobDetail);
  const navigateToTopic = useWorkspaceStore((s) => s.navigateToTopic);
  const navigateToSchemaSubject = useWorkspaceStore((s) => s.navigateToSchemaSubject);

  // Learn store state for URL sync
  const learnTab = useLearnStore((s) => s.learnTab);
  const selectedTrackId = useLearnStore((s) => s.selectedTrackId);
  const setLearnTab = useLearnStore((s) => s.setLearnTab);
  const navigateToTrackDetail = useLearnStore((s) => s.navigateToTrackDetail);

  const navigateToLearnRoute = (subId?: string, detailId?: string) => {
    if (subId === 'tracks' && detailId) {
      setLearnTab('tracks');
      navigateToTrackDetail(detailId);
    } else if (subId === 'examples' && detailId) {
      setLearnTab('examples');
      navigateToExampleDetail(detailId);
    } else if (subId === 'tracks') {
      setLearnTab('tracks');
      navigateToTrackDetail(null);
    } else if (subId === 'examples') {
      setLearnTab('examples');
    } else {
      // Default: just go to learn page (examples tab)
      setLearnTab('examples');
    }
  };

  const actions = { setActiveNavItem, navigateToExampleDetail, navigateToJobDetail, navigateToTopic, navigateToSchemaSubject, navigateToLearnRoute };

  // Prevent circular updates: pushState does NOT fire popstate, but this guard
  // is defensive against edge cases (browser extensions, rapid state changes).
  const suppressPopstate = useRef(false);

  // On mount: read URL and apply to store.
  // If URL is / (workspace default), defer to the store's existing activeNavItem
  // so that programmatic navigation (e.g., tests, initial store state) isn't overridden.
  useEffect(() => {
    const route = parseRoute();
    const state = useWorkspaceStore.getState();
    if (route.navItem === 'workspace' && !route.subId) {
      // Default URL — announce whatever the store already has
      announceRouteChange(state.activeNavItem as NavItem);
    } else if (route.navItem !== state.activeNavItem || route.subId) {
      applyRoute(route, actions);
      announceRouteChange(route.navItem, route.subId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Store → URL: when activeNavItem or detail selections change, update path
  useEffect(() => {
    let subId: string | null = null;
    let detailId: string | null = null;

    if (activeNavItem === 'learn') {
      subId = learnTab;
      if (learnTab === 'tracks' && selectedTrackId) {
        detailId = selectedTrackId;
      } else if (learnTab === 'examples' && selectedExampleId) {
        detailId = selectedExampleId;
      }
    } else if (activeNavItem === 'jobs' && selectedJobName) {
      subId = selectedJobName;
    } else if (activeNavItem === 'topics' && selectedTopic) {
      subId = selectedTopic.topic_name;
    } else if (activeNavItem === 'schemas' && selectedSchemaSubject) {
      subId = selectedSchemaSubject.subject;
    }

    const newPath = buildPath(activeNavItem, subId, detailId);
    const currentPath = window.location.pathname;

    if (newPath !== currentPath) {
      suppressPopstate.current = true;
      window.history.pushState(null, '', newPath);
      requestAnimationFrame(() => { suppressPopstate.current = false; });
    }

    announceRouteChange(activeNavItem, subId);
  }, [activeNavItem, selectedExampleId, selectedJobName, selectedTopic, selectedSchemaSubject, learnTab, selectedTrackId]);

  // URL → store: browser back/forward
  useEffect(() => {
    const handlePopstate = () => {
      if (suppressPopstate.current) return;
      const route = parseRoute();
      applyRoute(route, actions);
      announceRouteChange(route.navItem, route.subId);
    };

    window.addEventListener('popstate', handlePopstate);
    return () => {
      window.removeEventListener('popstate', handlePopstate);
    };
  }, [setActiveNavItem, navigateToExampleDetail, navigateToJobDetail, navigateToTopic, navigateToSchemaSubject]); // eslint-disable-line react-hooks/exhaustive-deps
}
