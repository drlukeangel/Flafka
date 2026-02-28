/**
 * SQL Formatter for Flink SQL
 * Formats SQL code by:
 * 1. Preserving protected regions (strings, comments, identifiers)
 * 2. Uppercasing SQL keywords
 * 3. Inserting newlines before major clauses
 * 4. Normalizing whitespace
 */

export function formatSQL(code: string): string {
  if (!code || !code.trim()) return code;

  const protectedRegions: string[] = [];
  let processed = code;

  // 1. Extract block comments /* ... */
  processed = processed.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    const idx = protectedRegions.length;
    protectedRegions.push(match);
    return `__COMMENT_${idx}__`;
  });

  // Extract line comments -- ...
  processed = processed.replace(/--[^\n]*/g, (match) => {
    const idx = protectedRegions.length;
    protectedRegions.push(match);
    return `__COMMENT_${idx}__`;
  });

  // Extract string literals '...' and "..."
  processed = processed.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, (match) => {
    const idx = protectedRegions.length;
    protectedRegions.push(match);
    return `__STRING_${idx}__`;
  });

  // Extract backtick identifiers `...`
  processed = processed.replace(/`[^`]*`/g, (match) => {
    const idx = protectedRegions.length;
    protectedRegions.push(match);
    return `__IDENTIFIER_${idx}__`;
  });

  // 2. Pre-process multi-word keywords into atomic tokens
  const multiWordPairs: [RegExp, string][] = [
    [/\bLEFT\s+JOIN\b/gi, 'LEFT_JOIN'],
    [/\bRIGHT\s+JOIN\b/gi, 'RIGHT_JOIN'],
    [/\bINNER\s+JOIN\b/gi, 'INNER_JOIN'],
    [/\bOUTER\s+JOIN\b/gi, 'OUTER_JOIN'],
    [/\bCROSS\s+JOIN\b/gi, 'CROSS_JOIN'],
    [/\bFULL\s+JOIN\b/gi, 'FULL_JOIN'],
    [/\bGROUP\s+BY\b/gi, 'GROUP_BY'],
    [/\bORDER\s+BY\b/gi, 'ORDER_BY'],
    [/\bLATERAL\s+TABLE\b/gi, 'LATERAL_TABLE'],
    [/\bLATERAL\s+JOIN\b/gi, 'LATERAL_JOIN'],
  ];

  for (const [regex, replacement] of multiWordPairs) {
    processed = processed.replace(regex, replacement);
  }

  // 3. Normalize whitespace - collapse to single spaces, trim
  processed = processed.replace(/\s+/g, ' ').trim();

  // 4. Define SQL keywords and tokens that should be uppercase
  const SQL_KEYWORDS = new Set([
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
    'CROSS', 'FULL', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET',
    'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'CREATE', 'ALTER', 'DROP', 'SHOW', 'DESCRIBE', 'EXPLAIN',
    'WITH', 'AS', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
    'BETWEEN', 'LIKE', 'IS', 'NULL', 'TRUE', 'FALSE',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'UNION', 'INTERSECT', 'EXCEPT', 'ALL', 'DISTINCT',
    'TABLE', 'VIEW', 'INDEX', 'FUNCTION',
    'LATERAL', 'TUMBLE', 'HOP', 'CUMULATE', 'SESSION',
    'WATERMARK', 'PROCTIME', 'ROWTIME', 'TIME', 'TIMESTAMP',
    'MATCH_RECOGNIZE',
  ]);

  const ATOMIC_TOKENS = new Set([
    'LEFT_JOIN', 'RIGHT_JOIN', 'INNER_JOIN', 'OUTER_JOIN',
    'CROSS_JOIN', 'FULL_JOIN', 'GROUP_BY', 'ORDER_BY',
    'LATERAL_TABLE', 'LATERAL_JOIN',
  ]);

  const NEWLINE_BEFORE = new Set([
    'FROM', 'WHERE', 'JOIN', 'LEFT_JOIN', 'RIGHT_JOIN', 'INNER_JOIN',
    'OUTER_JOIN', 'CROSS_JOIN', 'FULL_JOIN', 'GROUP_BY', 'ORDER_BY',
    'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'INTERSECT', 'EXCEPT',
    'MATCH_RECOGNIZE', 'LATERAL_TABLE', 'LATERAL_JOIN',
  ]);

  // 5. Split into words and process
  const words = processed.split(' ');
  const result: string[] = [];

  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    const upper = word.toUpperCase();

    // Check if it's a SQL keyword or atomic token
    if (SQL_KEYWORDS.has(upper) || ATOMIC_TOKENS.has(upper)) {
      word = upper;
    }

    // Insert newline before major clause keywords (not at start)
    if (NEWLINE_BEFORE.has(word.toUpperCase()) && result.length > 0) {
      result.push('\n' + word);
    } else {
      result.push(word);
    }
  }

  let output = result.join(' ');

  // 6. Restore atomic tokens back to spaces
  output = output.replace(/LEFT_JOIN/g, 'LEFT JOIN');
  output = output.replace(/RIGHT_JOIN/g, 'RIGHT JOIN');
  output = output.replace(/INNER_JOIN/g, 'INNER JOIN');
  output = output.replace(/OUTER_JOIN/g, 'OUTER JOIN');
  output = output.replace(/CROSS_JOIN/g, 'CROSS JOIN');
  output = output.replace(/FULL_JOIN/g, 'FULL JOIN');
  output = output.replace(/GROUP_BY/g, 'GROUP BY');
  output = output.replace(/ORDER_BY/g, 'ORDER BY');
  output = output.replace(/LATERAL_TABLE/g, 'LATERAL TABLE');
  output = output.replace(/LATERAL_JOIN/g, 'LATERAL JOIN');

  // 7. Clean up: remove extra spaces around newlines
  output = output.replace(/ *\n */g, '\n');

  // 8. Trim each line and remove extra blank lines
  output = output.split('\n').map(line => line.trim()).join('\n');

  // 9. Restore protected regions
  for (let i = 0; i < protectedRegions.length; i++) {
    output = output.replace(`__COMMENT_${i}__`, protectedRegions[i]);
    output = output.replace(`__STRING_${i}__`, protectedRegions[i]);
    output = output.replace(`__IDENTIFIER_${i}__`, protectedRegions[i]);
  }

  return output;
}
