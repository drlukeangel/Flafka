/**
 * Format byte values for human-readable display.
 * Returns "—" for null/NaN/Infinity, "0 B" for 0.
 */
export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '\u2014';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

/**
 * Format large numbers with K/M suffixes.
 * Returns "—" for null/NaN/Infinity, "0" for 0.
 */
export function formatNumber(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '\u2014';
  if (n === 0) return '0';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
