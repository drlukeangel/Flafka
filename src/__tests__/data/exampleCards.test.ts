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
  setupJavaTableExplodeExample: vi.fn(),
}));
vi.mock('../../services/example-runner', () => ({
  runKickstarterExample: vi.fn(),
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

  it('loan-table-explode card exists with Python tag (Coming Soon)', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'loan-table-explode');
    expect(card).toBeDefined();
    expect(card!.tags).toContain('Quick Start');
    expect(card!.tags).toContain('Python');
  });

  it('loan-tradeline-java card exists with Java tag and onImport', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'loan-tradeline-java');
    expect(card).toBeDefined();
    expect(card!.tags).toContain('Quick Start');
    expect(card!.tags).toContain('Java');
    expect(typeof card!.onImport).toBe('function');
  });

  it('loan-tradeline-java card sql contains LATERAL TABLE', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'loan-tradeline-java')!;
    expect(card.sql).toContain('LATERAL TABLE');
  });

  it('loan-tradeline-java card has completionModal with >= 3 steps', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'loan-tradeline-java')!;
    expect(card.completionModal).toBeDefined();
    expect(card.completionModal!.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('loan-table-explode card sql contains LATERAL TABLE', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'loan-table-explode');
    expect(card!.sql).toContain('LATERAL TABLE');
  });

  // --- New Quick Start cards (template engine) ---

  it('four new Quick Start cards exist with correct IDs', () => {
    const cards = getExampleCards([]);
    const ids = ['loan-filter', 'loan-aggregate', 'loan-join', 'loan-temporal-join'];
    for (const id of ids) {
      expect(cards.find((c) => c.id === id), `card ${id} missing`).toBeDefined();
    }
  });

  it('each new Quick Start card has "Quick Start" tag', () => {
    const cards = getExampleCards([]);
    const ids = ['loan-filter', 'loan-aggregate', 'loan-join', 'loan-temporal-join'];
    for (const id of ids) {
      const card = cards.find((c) => c.id === id)!;
      expect(card.tags, `${id} missing Quick Start tag`).toContain('Quick Start');
    }
  });

  it('each new Quick Start card has onImport defined', () => {
    const cards = getExampleCards([]);
    const ids = ['loan-filter', 'loan-aggregate', 'loan-join', 'loan-temporal-join'];
    for (const id of ids) {
      const card = cards.find((c) => c.id === id)!;
      expect(typeof card.onImport, `${id} missing onImport`).toBe('function');
    }
  });

  it('each new Quick Start card has completionModal with >= 3 steps', () => {
    const cards = getExampleCards([]);
    const ids = ['loan-filter', 'loan-aggregate', 'loan-join', 'loan-temporal-join'];
    for (const id of ids) {
      const card = cards.find((c) => c.id === id)!;
      expect(card.completionModal, `${id} missing completionModal`).toBeDefined();
      expect(card.completionModal!.steps.length, `${id} has fewer than 3 steps`).toBeGreaterThanOrEqual(3);
    }
  });

  it('loan-table-explode card has comingSoon string (non-empty)', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'loan-table-explode')!;
    expect(typeof card.comingSoon).toBe('string');
    expect(card.comingSoon!.length).toBeGreaterThan(0);
  });

  it('loan-table-explode card has onImport undefined (gated)', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'loan-table-explode')!;
    expect(card.onImport).toBeUndefined();
  });

  it('new cards appear before UDF example cards in order', () => {
    const cards = getExampleCards([]);
    const filterIdx = cards.findIndex((c) => c.id === 'loan-filter');
    const scalarIdx = cards.findIndex((c) => c.id === 'loan-scalar-extract');
    expect(filterIdx).toBeGreaterThanOrEqual(0);
    expect(scalarIdx).toBeGreaterThanOrEqual(0);
    expect(filterIdx).toBeLessThan(scalarIdx);
  });
});

// ---------------------------------------------------------------------------
// [@coverage-boost] exampleCards — additional coverage for uncovered branches
// ---------------------------------------------------------------------------

describe('[@coverage-boost] exampleCards edge cases', () => {
  it('ZIP artifact used for python UDF card when present', () => {
    const zipArt = makeArtifact({
      id: 'art-zip-1',
      content_format: 'ZIP',
      class: 'my_module.my_func',
      runtime_language: 'PYTHON',
      versions: [{ version: 'ver-zip-1' }],
    });
    const cards = getExampleCards([zipArt]);
    const pyCard = cards.find((c) => c.id === 'create-python-udf')!;
    expect(pyCard.sql).toContain('art-zip-1');
    expect(pyCard.sql).toContain('ver-zip-1');
  });

  it('ZIP fallback to anyArtifact when no ZIP artifact but JAR exists', () => {
    const jarArt = makeArtifact({
      id: 'art-jar-only',
      content_format: 'JAR',
      versions: [{ version: 'ver-jar-1' }],
    });
    const cards = getExampleCards([jarArt]);
    const pyCard = cards.find((c) => c.id === 'create-python-udf')!;
    // zipId falls back to anyArtifact (the JAR)
    expect(pyCard.sql).toContain('art-jar-only');
    expect(pyCard.sql).toContain('ver-jar-1');
  });

  it('both JAR and ZIP artifacts resolve independently', () => {
    const jarArt = makeArtifact({
      id: 'art-jar-2',
      content_format: 'JAR',
      class: 'com.example.JavaUdf',
      versions: [{ version: 'ver-j2' }],
    });
    const zipArt = makeArtifact({
      id: 'art-zip-2',
      content_format: 'ZIP',
      class: 'python_module',
      runtime_language: 'PYTHON',
      versions: [{ version: 'ver-z2' }],
    });
    const cards = getExampleCards([jarArt, zipArt]);
    const javaCard = cards.find((c) => c.id === 'create-java-udf')!;
    const pyCard = cards.find((c) => c.id === 'create-python-udf')!;
    expect(javaCard.sql).toContain('art-jar-2');
    expect(javaCard.sql).toContain('ver-j2');
    expect(javaCard.sql).toContain("AS 'com.example.JavaUdf'");
    expect(pyCard.sql).toContain('art-zip-2');
    expect(pyCard.sql).toContain('ver-z2');
    expect(pyCard.sql).toContain("AS 'python_module'");
  });

  it('deriveFnName converts CamelCase last segment to snake_case', () => {
    const art = makeArtifact({ class: 'com.example.MaskEmailAddress' });
    const cards = getExampleCards([art]);
    const javaCard = cards.find((c) => c.id === 'create-java-udf')!;
    expect(javaCard.sql).toContain('mask_email_address');
  });

  it('deriveFnName handles Python-style identifier (no dots)', () => {
    const art = makeArtifact({
      content_format: 'ZIP',
      class: 'my_python_func',
      runtime_language: 'PYTHON',
    });
    const cards = getExampleCards([art]);
    const pyCard = cards.find((c) => c.id === 'create-python-udf')!;
    expect(pyCard.sql).toContain("AS 'my_python_func'");
    // deriveFnName returns lowercase of valid identifier
    expect(pyCard.sql).toContain('my_python_func');
  });

  it('deriveFnName returns fallback for non-identifier non-dotted class', () => {
    // A class string with special chars that is not a valid identifier and has no dots
    const art = makeArtifact({ class: '123-bad-class!' });
    const cards = getExampleCards([art]);
    const javaCard = cards.find((c) => c.id === 'create-java-udf')!;
    // isUnresolvedClass returns false (not empty, not 'default'), so deriveFnName is called
    // deriveFnName: no dots, regex test fails for '123-bad-class!' => returns fallback 'my_java_udf'
    expect(javaCard.sql).toContain('my_java_udf');
  });

  it('isUnresolvedClass treats null/undefined as unresolved', () => {
    const art = makeArtifact({ class: undefined as unknown as string });
    const cards = getExampleCards([art]);
    const javaCard = cards.find((c) => c.id === 'create-java-udf')!;
    expect(javaCard.sql).toContain("AS '<entry-class>'");
    expect(javaCard.sql).toContain('my_java_udf');
  });

  it('Coming Soon cards have comingSoon string and no onImport', () => {
    const cards = getExampleCards([]);
    const comingSoonIds = ['loan-dedup', 'loan-top-n', 'loan-aggregate-udf', 'loan-validation',
      'loan-hop-window', 'loan-session-window', 'loan-pii-masking', 'loan-async-enrichment', 'loan-cdc-pipeline'];
    for (const id of comingSoonIds) {
      const card = cards.find((c) => c.id === id);
      expect(card, `card ${id} should exist`).toBeDefined();
      expect(typeof card!.comingSoon).toBe('string');
      expect(card!.onImport).toBeUndefined();
    }
  });

  it('snippet cards have no onImport', () => {
    const cards = getExampleCards([]);
    const snippetIds = ['hello-world', 'show-functions'];
    for (const id of snippetIds) {
      const card = cards.find((c) => c.id === id);
      expect(card).toBeDefined();
      expect(card!.category).toBe('snippet');
      expect(card!.onImport).toBeUndefined();
    }
  });

  it('kickstart cards with onImport have category kickstart', () => {
    const cards = getExampleCards([]);
    const kickstartIds = ['hello-flink', 'good-jokes', 'loan-filter', 'loan-aggregate',
      'loan-join', 'loan-temporal-join', 'loan-scalar-extract', 'loan-tradeline-java'];
    for (const id of kickstartIds) {
      const card = cards.find((c) => c.id === id);
      expect(card).toBeDefined();
      expect(card!.category).toBe('kickstart');
      expect(typeof card!.onImport).toBe('function');
    }
  });

  it('python UDF description mentions display_name when ZIP artifact has valid class', () => {
    const zipArt = makeArtifact({
      display_name: 'MyPythonPackage',
      content_format: 'ZIP',
      class: 'my_module.process',
      runtime_language: 'PYTHON',
    });
    const cards = getExampleCards([zipArt]);
    const pyCard = cards.find((c) => c.id === 'create-python-udf')!;
    expect(pyCard.description).toContain('MyPythonPackage');
    expect(pyCard.description).not.toContain('Replace <entry-class>');
  });

  it('python UDF description includes guidance when ZIP class is unresolved', () => {
    const zipArt = makeArtifact({
      display_name: 'MyZip',
      content_format: 'ZIP',
      class: '',
    });
    const cards = getExampleCards([zipArt]);
    const pyCard = cards.find((c) => c.id === 'create-python-udf')!;
    expect(pyCard.description).toContain('MyZip');
    expect(pyCard.description).toContain('Replace <entry-class>');
  });

  it('no artifacts: python UDF shows upload guidance', () => {
    const cards = getExampleCards([]);
    const pyCard = cards.find((c) => c.id === 'create-python-udf')!;
    expect(pyCard.description).toContain('Upload a ZIP artifact first');
  });

  it('JAR with empty versions uses <version-id> placeholder', () => {
    const art = makeArtifact({ versions: [] });
    const cards = getExampleCards([art]);
    const javaCard = cards.find((c) => c.id === 'create-java-udf')!;
    expect(javaCard.sql).toContain('<version-id>');
  });

  it('ZIP with empty versions falls back to anyArtifact version', () => {
    const jarArt = makeArtifact({
      content_format: 'JAR',
      versions: [{ version: 'ver-fallback' }],
    });
    // No ZIP artifact — falls back to anyArtifact (JAR)
    const cards = getExampleCards([jarArt]);
    const pyCard = cards.find((c) => c.id === 'create-python-udf')!;
    expect(pyCard.sql).toContain('ver-fallback');
  });

  it('all cards have non-empty id and title', () => {
    const cards = getExampleCards([]);
    for (const card of cards) {
      expect(card.id.length).toBeGreaterThan(0);
      expect(card.title.length).toBeGreaterThan(0);
    }
  });
});
