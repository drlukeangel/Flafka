import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SqlHighlight } from '../../components/ExampleDetailView/SqlHighlight';

describe('[@sql-highlight] SqlHighlight', () => {
  it('renders SQL text inside a pre > code structure', () => {
    const { container } = render(<SqlHighlight sql="SELECT 1" />);
    const pre = container.querySelector('pre');
    expect(pre).toBeInTheDocument();
    const code = pre?.querySelector('code');
    expect(code).toBeInTheDocument();
  });

  it('highlights SQL keywords', () => {
    const { container } = render(<SqlHighlight sql="SELECT * FROM users" />);
    const spans = container.querySelectorAll('code span');
    const texts = Array.from(spans).map((s) => s.textContent);
    expect(texts).toContain('SELECT');
    expect(texts).toContain('FROM');
  });

  it('highlights string literals', () => {
    const { container } = render(<SqlHighlight sql="WHERE name = 'Alice'" />);
    const spans = Array.from(container.querySelectorAll('code span'));
    const stringSpan = spans.find((s) => s.textContent === "'Alice'");
    expect(stringSpan).toBeDefined();
  });

  it('highlights number literals', () => {
    const { container } = render(<SqlHighlight sql="LIMIT 100" />);
    const spans = Array.from(container.querySelectorAll('code span'));
    const numSpan = spans.find((s) => s.textContent === '100');
    expect(numSpan).toBeDefined();
  });

  it('highlights comments', () => {
    const { container } = render(<SqlHighlight sql="-- this is a comment\nSELECT 1" />);
    const spans = Array.from(container.querySelectorAll('code span'));
    const commentSpan = spans.find((s) => s.textContent?.includes('-- this is a comment'));
    expect(commentSpan).toBeDefined();
  });

  it('handles empty SQL string', () => {
    const { container } = render(<SqlHighlight sql="" />);
    const code = container.querySelector('code');
    expect(code).toBeInTheDocument();
  });

  it('renders non-keyword text as default tokens', () => {
    const { container } = render(<SqlHighlight sql="my_column" />);
    const spans = Array.from(container.querySelectorAll('code span'));
    expect(spans.length).toBeGreaterThan(0);
    expect(spans[0].textContent).toBe('my_column');
  });

  it('handles mixed SQL with keywords, strings, numbers, and identifiers', () => {
    const sql = "SELECT name, age FROM users WHERE status = 'ACTIVE' AND age > 18";
    const { container } = render(<SqlHighlight sql={sql} />);
    const spans = Array.from(container.querySelectorAll('code span'));
    const allText = spans.map((s) => s.textContent).join('');
    expect(allText).toBe(sql);
  });
});
