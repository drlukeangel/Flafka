import { describe, it, expect } from 'vitest';
import { formatSQL } from '../../utils/sqlFormatter';

describe('formatSQL', () => {
  it('returns empty/whitespace code unchanged', () => {
    expect(formatSQL('')).toBe('');
    expect(formatSQL('   ')).toBe('   ');
  });

  it('uppercases SQL keywords', () => {
    const result = formatSQL('select * from users');
    expect(result).toContain('SELECT');
    expect(result).toContain('FROM');
  });

  it('inserts newlines before major clauses', () => {
    const result = formatSQL('select * from users where id = 1 order by name');
    expect(result).toBe('SELECT *\nFROM users\nWHERE id = 1\nORDER BY name');
  });

  it('preserves string literals', () => {
    const result = formatSQL("select 'hello world' from users");
    expect(result).toContain("'hello world'");
  });

  it('preserves line comments', () => {
    const result = formatSQL('select * -- this is a comment\nfrom users');
    expect(result).toContain('-- this is a comment');
  });

  it('preserves block comments', () => {
    const result = formatSQL('select * /* block comment */ from users');
    expect(result).toContain('/* block comment */');
  });

  it('preserves backtick identifiers', () => {
    const result = formatSQL('select `my column` from users');
    expect(result).toContain('`my column`');
  });

  it('handles GROUP BY and ORDER BY as atomic units', () => {
    const result = formatSQL('select name from users group by name order by name');
    expect(result).toContain('\nGROUP BY');
    expect(result).toContain('\nORDER BY');
    // GROUP and BY should not be on separate lines
    expect(result).not.toMatch(/GROUP\n/);
  });

  it('handles JOIN variants with newlines', () => {
    const result = formatSQL('select * from a left join b on a.id = b.id inner join c on a.id = c.id');
    expect(result).toContain('\nLEFT JOIN');
    expect(result).toContain('\nINNER JOIN');
  });

  it('does NOT insert newline before WITH', () => {
    const result = formatSQL('with cte as (select 1) select * from cte');
    // WITH should stay at start or inline, not get a newline before it
    expect(result).not.toMatch(/\nWITH/);
  });

  it('is idempotent', () => {
    const input = 'select name, count(*) from users where active = true group by name order by count(*) desc';
    const first = formatSQL(input);
    const second = formatSQL(first);
    expect(first).toBe(second);
  });

  it('handles FULL JOIN', () => {
    const result = formatSQL('select * from a full join b on a.id = b.id');
    expect(result).toContain('\nFULL JOIN');
  });

  it('handles MATCH_RECOGNIZE', () => {
    const result = formatSQL('select * from clicks match_recognize (partition by user_id)');
    expect(result).toContain('MATCH_RECOGNIZE');
  });

  it('does not uppercase content inside string literals', () => {
    const result = formatSQL("select 'select from where' from users");
    expect(result).toContain("'select from where'");
  });

  it('handles empty/null gracefully', () => {
    expect(formatSQL('')).toBe('');
    expect(formatSQL('   ')).toBe('   ');
  });

  it('handles RIGHT JOIN', () => {
    const result = formatSQL('select * from a right join b on a.id = b.id');
    expect(result).toContain('\nRIGHT JOIN');
  });

  it('handles LATERAL TABLE', () => {
    const result = formatSQL('select * from table lateral table (my_func(col))');
    expect(result).toContain('LATERAL TABLE');
  });

  it('handles multiple clauses with correct newline insertion', () => {
    const result = formatSQL('select col1, col2 from table1 where col1 > 5 group by col1 having count(*) > 1 order by col1 limit 10');
    const lines = result.split('\n');
    expect(lines[0]).toBe('SELECT col1, col2');
    expect(lines[1]).toBe('FROM table1');
    expect(lines[2]).toBe('WHERE col1 > 5');
    expect(lines[3]).toBe('GROUP BY col1');
    expect(lines[4]).toBe('HAVING count(*) > 1');
    expect(lines[5]).toBe('ORDER BY col1');
    expect(lines[6]).toBe('LIMIT 10');
  });

  it('handles UNION with newline', () => {
    const result = formatSQL('select col1 from table1 union select col1 from table2');
    expect(result).toContain('\nUNION');
  });
});
