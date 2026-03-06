import React from 'react';

const SQL_KEYWORDS = /\b(SELECT|INSERT|INTO|FROM|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|UNION|ALL|DISTINCT|AS|ON|AND|OR|NOT|IN|IS|NULL|CASE|WHEN|THEN|ELSE|END|CREATE|TABLE|FUNCTION|USING|JAR|LATERAL|WITH|INTERVAL|DESCRIPTOR|FOR|SYSTEM_TIME|OF|PRIMARY|KEY|ENFORCED|TUMBLE|BYTES|STRING|INT|BIGINT|DOUBLE|BOOLEAN|TIMESTAMP|DROP|ALTER|SHOW|DESCRIBE|SET|RESET|EXPLAIN|VALUES)\b/gi;
const STRING_LITERAL = /'[^']*'/g;
const NUMBER_LITERAL = /\b\d+(\.\d+)?\b/g;
const COMMENT = /--.*$/gm;

interface Token {
  text: string;
  type: 'keyword' | 'string' | 'number' | 'comment' | 'default';
  start: number;
}

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  const used = new Set<number>();

  const mark = (regex: RegExp, type: Token['type']) => {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(sql)) !== null) {
      let overlap = false;
      for (let i = m.index; i < m.index + m[0].length; i++) {
        if (used.has(i)) { overlap = true; break; }
      }
      if (!overlap) {
        tokens.push({ text: m[0], type, start: m.index });
        for (let i = m.index; i < m.index + m[0].length; i++) used.add(i);
      }
    }
  };

  mark(COMMENT, 'comment');
  mark(STRING_LITERAL, 'string');
  mark(SQL_KEYWORDS, 'keyword');
  mark(NUMBER_LITERAL, 'number');

  tokens.sort((a, b) => a.start - b.start);

  const result: Token[] = [];
  let pos = 0;
  for (const t of tokens) {
    if (t.start > pos) {
      result.push({ text: sql.slice(pos, t.start), type: 'default', start: pos });
    }
    result.push(t);
    pos = t.start + t.text.length;
  }
  if (pos < sql.length) {
    result.push({ text: sql.slice(pos), type: 'default', start: pos });
  }
  return result;
}

const colorMap: Record<Token['type'], string> = {
  keyword: 'var(--color-info, #3B82F6)',
  string: 'var(--color-success, #22C55E)',
  number: 'var(--color-warning, #F59E0B)',
  comment: 'var(--color-text-secondary)',
  default: 'var(--color-text-primary)',
};

export const SqlHighlight: React.FC<{ sql: string }> = ({ sql }) => (
  <pre
    style={{
      margin: 0,
      padding: '8px 10px',
      fontSize: 15,
      fontFamily: 'monospace',
      lineHeight: 1.5,
      background: 'var(--color-surface-secondary)',
      borderRadius: 4,
      overflow: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}
  >
    <code>
      {tokenize(sql).map((t, i) => (
        <span key={i} style={{ color: colorMap[t.type] }}>{t.text}</span>
      ))}
    </code>
  </pre>
);
