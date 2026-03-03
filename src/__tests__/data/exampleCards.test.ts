import { describe, it, expect, vi } from 'vitest';
import { getExampleCards } from '../../data/exampleCards';
import type { FlinkArtifact } from '../../types';

// Mock store and setup services for Quick Start cards
vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: Object.assign(
    () => ({}),
    { getState: () => ({}) },
  ),
}));
vi.mock('../../services/example-setup', () => ({
  setupScalarExtractExample: vi.fn(),
  setupTableExplodeExample: vi.fn(),
}));

function makeArtifact(overrides: Partial<FlinkArtifact> = {}): FlinkArtifact {
  return {
    id: 'art-123',
    display_name: 'TestArtifact',
    class: 'com.fm.flink.udf.LoanDetailExtractor',
    content_format: 'JAR',
    cloud: 'aws',
    region: 'us-east-1',
    environment: 'env-123',
    description: '',
    documentation_link: '',
    runtime_language: 'JAVA',
    versions: [{ version: 'ver-001', is_draft: false }],
    metadata: { created_at: '2026-01-01', updated_at: '2026-01-01' },
    ...overrides,
  };
}

describe('[@example-cards] getExampleCards', () => {
  it('class === "default" produces <entry-class> placeholder', () => {
    const cards = getExampleCards([makeArtifact({ class: 'default' })]);
    const javaCard = cards.find((c) => c.id === 'create-java-udf')!;
    expect(javaCard.sql).toContain("AS '<entry-class>'");
    expect(javaCard.sql).not.toContain("AS 'default'");
  });

  it('class === "" produces <entry-class> placeholder', () => {
    const cards = getExampleCards([makeArtifact({ class: '' })]);
    const javaCard = cards.find((c) => c.id === 'create-java-udf')!;
    expect(javaCard.sql).toContain("AS '<entry-class>'");
  });

  it('valid FQCN com.fm.flink.udf.LoanDetailExtractor used as-is', () => {
    const cards = getExampleCards([makeArtifact({ class: 'com.fm.flink.udf.LoanDetailExtractor' })]);
    const javaCard = cards.find((c) => c.id === 'create-java-udf')!;
    expect(javaCard.sql).toContain("AS 'com.fm.flink.udf.LoanDetailExtractor'");
    // deriveFnName should produce snake_case of last segment
    expect(javaCard.sql).toContain('loan_detail_extractor');
  });

  it('single-segment class MaskEmail derives lowercase fn name', () => {
    const cards = getExampleCards([makeArtifact({ class: 'MaskEmail' })]);
    const javaCard = cards.find((c) => c.id === 'create-java-udf')!;
    expect(javaCard.sql).toContain("AS 'MaskEmail'");
    expect(javaCard.sql).toContain('maskemail');
  });

  it('no artifacts → fallback class + name', () => {
    const cards = getExampleCards([]);
    const javaCard = cards.find((c) => c.id === 'create-java-udf')!;
    expect(javaCard.sql).toContain("AS '<entry-class>'");
    expect(javaCard.sql).toContain('my_java_udf');
    expect(javaCard.sql).toContain('<artifact-id>');
  });

  it('ZIP class === "default" produces placeholder', () => {
    const cards = getExampleCards([makeArtifact({ content_format: 'ZIP', class: 'default' })]);
    const pyCard = cards.find((c) => c.id === 'create-python-udf')!;
    expect(pyCard.sql).toContain("AS '<entry-class>'");
    expect(pyCard.sql).not.toContain("AS 'default'");
  });

  it('empty versions[] produces <version-id> placeholder', () => {
    const cards = getExampleCards([makeArtifact({ versions: [] })]);
    const javaCard = cards.find((c) => c.id === 'create-java-udf')!;
    expect(javaCard.sql).toContain('<version-id>');
  });

  it('description includes guidance text when class is unresolved', () => {
    const cards = getExampleCards([makeArtifact({ class: 'default' })]);
    const javaCard = cards.find((c) => c.id === 'create-java-udf')!;
    expect(javaCard.description).toContain('Replace <entry-class>');
  });

  it('description does NOT include guidance text when class is valid', () => {
    const cards = getExampleCards([makeArtifact({ class: 'com.example.MyUdf' })]);
    const javaCard = cards.find((c) => c.id === 'create-java-udf')!;
    expect(javaCard.description).not.toContain('Replace <entry-class>');
  });

  // --- Quick Start card tests ---

  it('loan-scalar-extract card exists with correct tags', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'loan-scalar-extract');
    expect(card).toBeDefined();
    expect(card!.tags).toContain('Quick Start');
    expect(card!.tags).toContain('Java');
    expect(card!.tags).toContain('UDF');
  });

  it('loan-scalar-extract card has onImport callback', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'loan-scalar-extract');
    expect(card!.onImport).toBeDefined();
    expect(typeof card!.onImport).toBe('function');
  });

  it('loan-scalar-extract card sql contains LoanDetailExtract', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'loan-scalar-extract');
    expect(card!.sql).toContain('LoanDetailExtract');
  });

  it('loan-table-explode card exists with Python tag', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'loan-table-explode');
    expect(card).toBeDefined();
    expect(card!.tags).toContain('Quick Start');
    expect(card!.tags).toContain('Python');
    expect(card!.onImport).toBeDefined();
  });

  it('loan-table-explode card sql contains LATERAL TABLE', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'loan-table-explode');
    expect(card!.sql).toContain('LATERAL TABLE');
  });
});
