/**
 * @routing
 * useRoute — URL routing hook tests
 *
 * Covers:
 *   - parseRoute() unit tests (URL → { navItem, subId })
 *   - buildPath() unit tests ({ navItem, subId } → URL)
 *   - Round-trip encoding/decoding
 *   - Legacy hash URL migration
 *   - useRoute() integration (mount, store→URL, popstate)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { parseRoute, buildPath, useRoute } from '../../hooks/useRoute';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const {
  mockSetActiveNavItem, mockNavigateToExampleDetail, mockNavigateToJobDetail,
  mockNavigateToTopic, mockNavigateToSchemaSubject,
} = vi.hoisted(() => ({
  mockSetActiveNavItem: vi.fn(),
  mockNavigateToExampleDetail: vi.fn(),
  mockNavigateToJobDetail: vi.fn(),
  mockNavigateToTopic: vi.fn().mockResolvedValue(undefined),
  mockNavigateToSchemaSubject: vi.fn(),
}));

const mockStoreState = vi.hoisted(() => ({
  current: {
    activeNavItem: 'workspace' as string,
    selectedExampleId: null as string | null,
    selectedJobName: null as string | null,
    selectedTopic: null as { topic_name: string } | null,
    selectedSchemaSubject: null as { subject: string } | null,
  },
}));

vi.mock('../../store/workspaceStore', () => {
  const store = {
    get activeNavItem() { return mockStoreState.current.activeNavItem; },
    get selectedExampleId() { return mockStoreState.current.selectedExampleId; },
    get selectedJobName() { return mockStoreState.current.selectedJobName; },
    get selectedTopic() { return mockStoreState.current.selectedTopic; },
    get selectedSchemaSubject() { return mockStoreState.current.selectedSchemaSubject; },
    setActiveNavItem: mockSetActiveNavItem,
    navigateToExampleDetail: mockNavigateToExampleDetail,
    navigateToJobDetail: mockNavigateToJobDetail,
    navigateToTopic: mockNavigateToTopic,
    navigateToSchemaSubject: mockNavigateToSchemaSubject,
  };
  const hook = (selector: (s: unknown) => unknown) =>
    typeof selector === 'function' ? selector(store) : store;
  hook.getState = () => store;
  return { useWorkspaceStore: hook };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let pushStateSpy: ReturnType<typeof vi.spyOn>;
let replaceStateSpy: ReturnType<typeof vi.spyOn>;

function setLocation(pathname: string, hash = '') {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname, hash, search: '' },
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
  replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(
    (_data, _unused, url) => {
      // Simulate replaceState updating location.pathname synchronously
      if (typeof url === 'string') {
        const parsed = new URL(url, 'http://localhost');
        setLocation(parsed.pathname, '');
      }
    }
  );
  mockStoreState.current = {
    activeNavItem: 'workspace',
    selectedExampleId: null,
    selectedJobName: null,
    selectedTopic: null,
    selectedSchemaSubject: null,
  };
  setLocation('/', '');
});

afterEach(() => {
  pushStateSpy.mockRestore();
  replaceStateSpy.mockRestore();
  // Clean up route announcer
  const el = document.getElementById('route-announcer');
  if (el) el.remove();
});

// ---------------------------------------------------------------------------
// parseRoute() unit tests
// ---------------------------------------------------------------------------
describe('[@routing] parseRoute', () => {
  it('T1: returns workspace for /', () => {
    setLocation('/');
    expect(parseRoute()).toEqual({ navItem: 'workspace' });
  });

  it('T2: returns topics for /topics', () => {
    setLocation('/topics');
    expect(parseRoute()).toEqual({ navItem: 'topics' });
  });

  it('T3: returns topics with subId for /topics/my-topic', () => {
    setLocation('/topics/my-topic');
    expect(parseRoute()).toEqual({ navItem: 'topics', subId: 'my-topic' });
  });

  it('T4: decodes percent-encoded sub-IDs', () => {
    setLocation('/topics/my%20topic');
    expect(parseRoute()).toEqual({ navItem: 'topics', subId: 'my topic' });
  });

  it('T5: returns workspace for unknown path', () => {
    setLocation('/bogus');
    expect(parseRoute()).toEqual({ navItem: 'workspace' });
  });

  it('returns jobs with subId', () => {
    setLocation('/jobs/stmt-abc-123');
    expect(parseRoute()).toEqual({ navItem: 'jobs', subId: 'stmt-abc-123' });
  });

  it('returns schemas with subId', () => {
    setLocation('/schemas/loans-value');
    expect(parseRoute()).toEqual({ navItem: 'schemas', subId: 'loans-value' });
  });

  it('returns learn with subId', () => {
    setLocation('/learn/examples');
    expect(parseRoute()).toEqual({ navItem: 'learn', subId: 'examples' });
  });

  it('returns learn with subId and detailId', () => {
    setLocation('/learn/tracks/getting-started');
    expect(parseRoute()).toEqual({ navItem: 'learn', subId: 'tracks', detailId: 'getting-started' });
  });

  it('handles trailing slashes', () => {
    setLocation('/topics/');
    expect(parseRoute()).toEqual({ navItem: 'topics' });
  });

  it('parses 3-segment paths with detailId', () => {
    setLocation('/topics/my-topic/extra/segments');
    expect(parseRoute()).toEqual({ navItem: 'topics', subId: 'my-topic', detailId: 'extra' });
  });

  it('all valid nav items parse correctly', () => {
    const items = ['jobs', 'tree', 'topics', 'schemas', 'snippets', 'learn',
      'artifacts', 'history', 'help', 'settings', 'workspaces', 'streams'];
    for (const item of items) {
      setLocation(`/${item}`);
      expect(parseRoute().navItem).toBe(item);
    }
  });
});

// ---------------------------------------------------------------------------
// buildPath() unit tests
// ---------------------------------------------------------------------------
describe('[@routing] buildPath', () => {
  it('T6: workspace returns /', () => {
    expect(buildPath('workspace')).toBe('/');
  });

  it('T7: topics with subId', () => {
    expect(buildPath('topics', 'my-topic')).toBe('/topics/my-topic');
  });

  it('T8: encodes spaces in sub-IDs', () => {
    expect(buildPath('topics', 'has spaces')).toBe('/topics/has%20spaces');
  });

  it('T9: null subId returns just nav item', () => {
    expect(buildPath('jobs', null)).toBe('/jobs');
  });

  it('encodes special characters', () => {
    expect(buildPath('schemas', 'test/value')).toBe('/schemas/test%2Fvalue');
    expect(buildPath('topics', 'a&b=c')).toBe('/topics/a%26b%3Dc');
  });

  it('empty string subId returns just nav item', () => {
    expect(buildPath('jobs', '')).toBe('/jobs');
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------
describe('[@routing] round-trip encoding', () => {
  it('T10: parse(build(item, subId)) returns original values', () => {
    const cases: [string, string][] = [
      ['topics', 'my-topic'],
      ['schemas', 'loans-value'],
      ['jobs', 'statement-123'],
      ['learn', 'examples'],
      ['topics', 'topic with spaces'],
      ['schemas', 'special/chars&more=yes'],
    ];
    for (const [navItem, subId] of cases) {
      const path = buildPath(navItem as Parameters<typeof buildPath>[0], subId);
      setLocation(path);
      const result = parseRoute();
      expect(result.navItem).toBe(navItem);
      expect(result.subId).toBe(subId);
    }
  });
});

// ---------------------------------------------------------------------------
// Legacy hash migration tests
// ---------------------------------------------------------------------------
describe('[@routing] legacy hash migration', () => {
  it('T11: #/jobs/my-statement redirects to /jobs/my-statement', () => {
    setLocation('/', '#/jobs/my-statement');
    const result = parseRoute();
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/jobs/my-statement');
    expect(result).toEqual({ navItem: 'jobs', subId: 'my-statement' });
  });

  it('T12: #/topics (no sub-ID) redirects to /topics', () => {
    setLocation('/', '#/topics');
    const result = parseRoute();
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/topics');
    expect(result).toEqual({ navItem: 'topics' });
  });

  it('T17: does not double-encode already-encoded hash segments', () => {
    setLocation('/', '#/topics/my%20topic');
    const result = parseRoute();
    // Should decode first then re-encode: my%20topic → "my topic" → my%20topic
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/topics/my%20topic');
    expect(result.subId).toBe('my topic');
  });
});

// ---------------------------------------------------------------------------
// useRoute() integration tests
// ---------------------------------------------------------------------------
describe('[@routing] useRoute hook', () => {
  it('T13: mount with /topics/loans calls navigateToTopic', () => {
    setLocation('/topics/loans');
    renderHook(() => useRoute());
    expect(mockNavigateToTopic).toHaveBeenCalledWith('loans');
  });

  it('mount with /schemas/loans-value calls navigateToSchemaSubject', () => {
    setLocation('/schemas/loans-value');
    renderHook(() => useRoute());
    expect(mockNavigateToSchemaSubject).toHaveBeenCalledWith('loans-value');
  });

  it('mount with /jobs/stmt-1 calls navigateToJobDetail', () => {
    setLocation('/jobs/stmt-1');
    renderHook(() => useRoute());
    expect(mockNavigateToJobDetail).toHaveBeenCalledWith('stmt-1');
  });

  it('/examples is no longer valid — treated as workspace (no navigation)', () => {
    setLocation('/examples/ex-1');
    renderHook(() => useRoute());
    // 'examples' is not a valid nav item anymore, so parseRoute returns workspace
    // Since it's workspace with no subId, the mount effect defers to existing store state
    expect(mockNavigateToExampleDetail).not.toHaveBeenCalled();
    expect(mockSetActiveNavItem).not.toHaveBeenCalled();
  });

  it('T14: store change triggers pushState', () => {
    setLocation('/');
    const { rerender } = renderHook(() => useRoute());
    mockStoreState.current = { ...mockStoreState.current, activeNavItem: 'jobs' };
    rerender();
    expect(pushStateSpy).toHaveBeenCalledWith(null, '', '/jobs');
  });

  it('store change with topic detail updates URL', () => {
    setLocation('/');
    const { rerender } = renderHook(() => useRoute());
    mockStoreState.current = {
      ...mockStoreState.current,
      activeNavItem: 'topics',
      selectedTopic: { topic_name: 'loans' },
    };
    rerender();
    expect(pushStateSpy).toHaveBeenCalledWith(null, '', '/topics/loans');
  });

  it('T15: popstate event applies route to store', () => {
    setLocation('/');
    renderHook(() => useRoute());

    // Simulate pressing back to /schemas/loans-value
    setLocation('/schemas/loans-value');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(mockNavigateToSchemaSubject).toHaveBeenCalledWith('loans-value');
  });

  it('T16: store-driven URL change does not trigger popstate back into store', () => {
    setLocation('/');
    const { rerender } = renderHook(() => useRoute());

    // Simulate store changing to jobs
    mockStoreState.current = { ...mockStoreState.current, activeNavItem: 'jobs' };
    rerender();

    // The pushState happened
    expect(pushStateSpy).toHaveBeenCalledWith(null, '', '/jobs');

    // Reset mocks to check if popstate would re-trigger
    mockSetActiveNavItem.mockClear();

    // Fire a popstate in the same frame (suppressed)
    setLocation('/jobs');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Should NOT have called setActiveNavItem again (suppressed)
    expect(mockSetActiveNavItem).not.toHaveBeenCalled();
  });

  it('updates document.title on navigation', () => {
    setLocation('/topics/loans');
    // Store reflects the navigation so the store→URL effect also announces correctly
    mockStoreState.current = { ...mockStoreState.current, activeNavItem: 'topics', selectedTopic: { topic_name: 'loans' } };
    renderHook(() => useRoute());
    expect(document.title).toContain('Topics');
    expect(document.title).toContain('loans');
  });

  it('creates screen reader announcer element', () => {
    setLocation('/jobs');
    mockStoreState.current = { ...mockStoreState.current, activeNavItem: 'jobs' };
    renderHook(() => useRoute());
    const announcer = document.getElementById('route-announcer');
    expect(announcer).toBeTruthy();
    expect(announcer?.getAttribute('aria-live')).toBe('polite');
    expect(announcer?.textContent).toContain('Jobs');
  });
});
