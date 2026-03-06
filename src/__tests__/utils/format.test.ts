import { describe, it, expect } from 'vitest';
import { formatBytes, formatNumber } from '../../utils/format';

describe('[@format] formatBytes', () => {
  it('returns em-dash for null', () => {
    expect(formatBytes(null)).toBe('\u2014');
  });

  it('returns em-dash for NaN', () => {
    expect(formatBytes(NaN)).toBe('\u2014');
  });

  it('returns em-dash for Infinity', () => {
    expect(formatBytes(Infinity)).toBe('\u2014');
  });

  it('returns em-dash for -Infinity', () => {
    expect(formatBytes(-Infinity)).toBe('\u2014');
  });

  it('returns "0 B" for 0', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes under 1 KB', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(10 * 1048576)).toBe('10 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });

  it('formats terabytes', () => {
    expect(formatBytes(1099511627776)).toBe('1.0 TB');
  });

  it('rounds values >= 10 to integer', () => {
    // 15 KB = 15360 bytes
    expect(formatBytes(15360)).toBe('15 KB');
  });

  it('shows one decimal for values < 10', () => {
    // 5.5 KB = 5632 bytes
    expect(formatBytes(5632)).toBe('5.5 KB');
  });
});

describe('[@format] formatNumber', () => {
  it('returns em-dash for null', () => {
    expect(formatNumber(null)).toBe('\u2014');
  });

  it('returns em-dash for NaN', () => {
    expect(formatNumber(NaN)).toBe('\u2014');
  });

  it('returns em-dash for Infinity', () => {
    expect(formatNumber(Infinity)).toBe('\u2014');
  });

  it('returns "0" for 0', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('returns plain number for values under 1000', () => {
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(50000)).toBe('50.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(2500000)).toBe('2.5M');
  });

  it('handles negative numbers', () => {
    expect(formatNumber(-1500)).toBe('-1.5K');
    expect(formatNumber(-2500000)).toBe('-2.5M');
  });
});
