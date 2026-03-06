import { describe, it, expect } from 'vitest';
import { kickstarterDocs } from '../../data/examples/docs/index';

describe('[@docs-index] docs/index re-export', () => {
  it('re-exports kickstarterDocs from the index', () => {
    expect(kickstarterDocs).toBeDefined();
    expect(typeof kickstarterDocs).toBe('object');
    expect(Object.keys(kickstarterDocs).length).toBeGreaterThan(0);
  });

  it('merges both base and advanced docs', async () => {
    const base = await import('../../data/examples/docs/kickstarter-docs');
    const advanced = await import('../../data/examples/docs/kickstarter-docs-advanced');
    const expectedKeys = [...Object.keys(base.kickstarterDocs), ...Object.keys(advanced.advancedKickstarterDocs)];
    expect(Object.keys(kickstarterDocs).sort()).toEqual(expectedKeys.sort());
  });
});
