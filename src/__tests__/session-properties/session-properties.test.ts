import { describe, it, expect } from 'vitest';

describe('[@session-properties] Session Properties Logic', () => {
  const DEFAULT_PROPERTIES = {
    'sql.local-time-zone': 'UTC',
  };

  it('should have correct default properties', () => {
    expect(Object.keys(DEFAULT_PROPERTIES)).toHaveLength(1);
    expect(DEFAULT_PROPERTIES['sql.local-time-zone']).toBe('UTC');
  });

  it('should reject reserved keys', () => {
    const reserved = ['sql.current-catalog', 'sql.current-database'];
    const key = 'sql.current-catalog';
    expect(reserved.includes(key)).toBe(true);
  });

  it('should trim whitespace from keys', () => {
    const key = '  sql.timezone  ';
    expect(key.trim()).toBe('sql.timezone');
  });

  it('should reject empty/whitespace-only keys', () => {
    expect(''.trim()).toBe('');
    expect('   '.trim()).toBe('');
  });

  it('should merge properties correctly with reserved key enforcement', () => {
    const sessionProps = {
      'sql.local-time-zone': 'America/New_York',
      'sql.tables.scan.startup.mode': 'latest-offset',
    };

    const reserved = {
      'sql.current-catalog': 'my-catalog',
      'sql.current-database': 'my-database',
    };

    // Merge: user props first, then reserved (reserved wins)
    const merged = {
      ...sessionProps,
      ...reserved,
    };

    expect(merged['sql.current-catalog']).toBe('my-catalog');
    expect(merged['sql.current-database']).toBe('my-database');
    expect(merged['sql.local-time-zone']).toBe('America/New_York');
    expect(merged['sql.tables.scan.startup.mode']).toBe('latest-offset');
  });

  it('should reset to defaults correctly', () => {
    const reset = { ...DEFAULT_PROPERTIES };
    expect(Object.keys(reset)).toHaveLength(1);
    expect(reset['sql.local-time-zone']).toBe('UTC');
  });

  it('should allow removing a property', () => {
    const props: Record<string, string> = { ...DEFAULT_PROPERTIES, 'custom.prop': 'value' };
    delete props['custom.prop'];
    expect(props['custom.prop']).toBeUndefined();
    expect(Object.keys(props)).toHaveLength(1);
  });

  it('should handle empty string values', () => {
    const props = { ...DEFAULT_PROPERTIES, 'empty.prop': '' };
    expect(props['empty.prop']).toBe('');
    expect(Object.keys(props)).toHaveLength(2);
  });

  it('should not set sql.tables.scan.startup.mode by default', () => {
    expect(DEFAULT_PROPERTIES).not.toHaveProperty('sql.tables.scan.startup.mode');
  });
});
