import { describe, it, expect, vi } from 'vitest';
import { getExampleCards } from '../../data/exampleCards';

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
  setupAggregateUdfExample: vi.fn(),
  setupValidationExample: vi.fn(),
  setupPiiMaskingExample: vi.fn(),
  setupAsyncEnrichmentExample: vi.fn(),
}));
vi.mock('../../services/example-runner', () => ({
  runKickstarterExample: vi.fn(),
}));

describe('[@example-cards] getExampleCards', () => {
  it('getExampleCards returns 50 kickstart cards total', () => {
    const cards = getExampleCards([]);
    expect(cards.length).toBe(50);
    expect(cards.every((c) => c.category === 'kickstart')).toBe(true);
  });

  it('all kickstart cards have a group field set', () => {
    const cards = getExampleCards([]);
    for (const card of cards) {
      expect(card.group, `card ${card.id} missing group`).toBeDefined();
      expect(card.group!.length, `card ${card.id} has empty group`).toBeGreaterThan(0);
    }
  });

  it('5 new view cards exist with view: true and group Views', () => {
    const cards = getExampleCards([]);
    const viewIds = ['view-golden-record', 'view-credit-risk', 'view-ai-drift', 'view-early-warning', 'view-mbs-pricing'];
    for (const id of viewIds) {
      const card = cards.find((c) => c.id === id);
      expect(card, `view card ${id} missing`).toBeDefined();
      expect(card!.view).toBe(true);
      expect(card!.group).toBe('Views');
      expect(card!.category).toBe('kickstart');
      expect(typeof card!.onImport).toBe('function');
    }
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
  it('Coming Soon cards have comingSoon string and no onImport', () => {
    const cards = getExampleCards([]);
    const comingSoonIds = ['loan-table-explode'];
    for (const id of comingSoonIds) {
      const card = cards.find((c) => c.id === id);
      expect(card, `card ${id} should exist`).toBeDefined();
      expect(typeof card!.comingSoon).toBe('string');
      expect(card!.onImport).toBeUndefined();
    }
  });

  it('kickstart cards with onImport have category kickstart', () => {
    const cards = getExampleCards([]);
    const kickstartIds = ['hello-flink', 'hello-ksqldb', 'good-jokes', 'ksql-dynamic-routing', 'ksql-dynamic-routing-json', 'loan-filter',
      'loan-coborrower-unnest', 'loan-multi-region-merge', 'loan-event-fanout',
      'loan-aggregate', 'loan-hop-window', 'loan-session-window', 'loan-top-n',
      'loan-cumulate-window', 'loan-late-payments',
      'loan-join', 'loan-temporal-join',
      'loan-property-lookup', 'loan-borrower-payments', 'loan-routing-json', 'loan-routing-avro',
      'loan-dedup', 'loan-cdc-pipeline', 'loan-running-aggregate', 'loan-change-detection',
      'loan-pattern-match', 'loan-interval-join', 'loan-stream-enrichment',
      'loan-time-range-stats',
      'loan-schemaless-topic', 'loan-schema-override', 'loan-data-masking',
      'loan-scalar-extract', 'loan-tradeline-java',
      'loan-aggregate-udf', 'loan-validation', 'loan-pii-masking', 'loan-async-enrichment',
      'view-golden-record', 'view-credit-risk', 'view-ai-drift', 'view-early-warning', 'view-mbs-pricing',
      'kafka-produce-consume', 'kafka-startup-modes', 'kafka-changelog-modes',
      'kafka-value-formats', 'kafka-schema-evolution', 'confluent-connector-bridge'];
    for (const id of kickstartIds) {
      const card = cards.find((c) => c.id === id);
      expect(card, `card ${id} should exist`).toBeDefined();
      expect(card!.category).toBe('kickstart');
      expect(typeof card!.onImport).toBe('function');
    }
  });

  it('all cards have non-empty id and title', () => {
    const cards = getExampleCards([]);
    for (const card of cards) {
      expect(card.id.length).toBeGreaterThan(0);
      expect(card.title.length).toBeGreaterThan(0);
    }
  });

  it('all kickstart UDF cards with onImport have completionModal defined', () => {
    const cards = getExampleCards([]);
    const udfCards = cards.filter((c) => c.udf && c.category === 'kickstart' && c.onImport);
    udfCards.forEach((card) => {
      expect(card.completionModal).toBeDefined();
    });
  });

  it('schema cards have schema: true', () => {
    const cards = getExampleCards([]);
    const schemaCards = cards.filter((c) => c.id === 'loan-schemaless-topic' || c.id === 'loan-schema-override');
    schemaCards.forEach((card) => {
      expect(card.schema).toBe(true);
    });
  });

  it('loan-data-masking card exists', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'loan-data-masking');
    expect(card).toBeDefined();
    expect(card!.category).toBe('kickstart');
    expect(card!.tags).toContain('Security');
  });

  it('kickstart cards are ordered: basics before windows before joins before stateful before schema before UDFs', () => {
    const cards = getExampleCards([]);
    const kickstartCards = cards.filter((c) => c.category === 'kickstart');
    const ids = kickstartCards.map((c) => c.id);

    // Basics should come before windows
    const helloIdx = ids.indexOf('hello-flink');
    const aggregateIdx = ids.indexOf('loan-aggregate');
    expect(helloIdx).toBeLessThan(aggregateIdx);

    // Windows before joins
    const hopIdx = ids.indexOf('loan-hop-window');
    const joinIdx = ids.indexOf('loan-join');
    expect(hopIdx).toBeLessThan(joinIdx);

    // Joins before stateful
    const dedupIdx = ids.indexOf('loan-dedup');
    expect(joinIdx).toBeLessThan(dedupIdx);

    // Stateful before schema
    const schemalessIdx = ids.indexOf('loan-schemaless-topic');
    expect(dedupIdx).toBeLessThan(schemalessIdx);

    // Schema before UDFs
    const scalarIdx = ids.indexOf('loan-scalar-extract');
    expect(schemalessIdx).toBeLessThan(scalarIdx);

    // UDFs before Views
    const viewIdx = ids.indexOf('view-golden-record');
    expect(scalarIdx).toBeLessThan(viewIdx);
  });

  it('all UDF cards have udf: true flag', () => {
    const cards = getExampleCards([]);
    const udfCardIds = ['loan-scalar-extract', 'loan-tradeline-java', 'loan-table-explode', 'loan-aggregate-udf', 'loan-validation', 'loan-pii-masking', 'loan-async-enrichment'];
    udfCardIds.forEach((id) => {
      const card = cards.find((c) => c.id === id);
      expect(card?.udf).toBe(true);
    });
  });

  it('6 new Kafka/Confluent cards exist with correct groups', () => {
    const cards = getExampleCards([]);
    const kafkaIds = [
      { id: 'kafka-produce-consume', group: 'Kafka' },
      { id: 'kafka-startup-modes', group: 'Kafka' },
      { id: 'kafka-changelog-modes', group: 'Kafka' },
      { id: 'kafka-value-formats', group: 'Kafka' },
      { id: 'kafka-schema-evolution', group: 'Kafka' },
      { id: 'confluent-connector-bridge', group: 'Confluent' },
    ];
    for (const { id, group } of kafkaIds) {
      const card = cards.find((c) => c.id === id);
      expect(card, `card ${id} should exist`).toBeDefined();
      expect(card!.group).toBe(group);
      expect(card!.category).toBe('kickstart');
      expect(typeof card!.onImport).toBe('function');
    }
  });

  it('Kafka cards have Quick Start tag', () => {
    const cards = getExampleCards([]);
    const kafkaIds = ['kafka-produce-consume', 'kafka-startup-modes', 'kafka-changelog-modes',
      'kafka-value-formats', 'kafka-schema-evolution', 'confluent-connector-bridge'];
    for (const id of kafkaIds) {
      const card = cards.find((c) => c.id === id)!;
      expect(card.tags, `${id} missing Quick Start tag`).toContain('Quick Start');
    }
  });

  it('Kafka beginner cards have Beginner skill level', () => {
    const cards = getExampleCards([]);
    const beginnerIds = ['kafka-produce-consume', 'kafka-startup-modes'];
    for (const id of beginnerIds) {
      const card = cards.find((c) => c.id === id)!;
      expect(card.skillLevel).toBe('Beginner');
    }
  });

  it('Kafka intermediate cards have Intermediate skill level', () => {
    const cards = getExampleCards([]);
    const intermediateIds = ['kafka-changelog-modes', 'kafka-value-formats', 'kafka-schema-evolution', 'confluent-connector-bridge'];
    for (const id of intermediateIds) {
      const card = cards.find((c) => c.id === id)!;
      expect(card.skillLevel).toBe('Intermediate');
    }
  });

  // --- ksqlDB JSON Routing card tests ---

  it('ksql-dynamic-routing-json card exists with correct metadata', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'ksql-dynamic-routing-json');
    expect(card, 'ksql-dynamic-routing-json card should exist').toBeDefined();
    expect(card!.category).toBe('kickstart');
    expect(card!.group).toBe('Joins');
    expect(card!.skillLevel).toBe('Advanced');
    expect(card!.stateful).toBe(true);
  });

  it('ksql-dynamic-routing-json card has ksqlDB and JSON tags', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'ksql-dynamic-routing-json')!;
    expect(card.tags).toContain('Quick Start');
    expect(card.tags).toContain('ksqlDB');
    expect(card.tags).toContain('JSON');
    expect(card.tags).toContain('EXPLODE');
  });

  it('ksql-dynamic-routing-json card has onImport and completionModal', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'ksql-dynamic-routing-json')!;
    expect(typeof card.onImport).toBe('function');
    expect(card.completionModal).toBeDefined();
    expect(card.completionModal!.steps.length).toBeGreaterThanOrEqual(5);
  });

  it('ksql-dynamic-routing-json card sql contains EXPLODE', () => {
    const cards = getExampleCards([]);
    const card = cards.find((c) => c.id === 'ksql-dynamic-routing-json')!;
    expect(card.sql).toContain('EXPLODE');
  });

  it('both ksqlDB routing variants exist (Avro + JSON)', () => {
    const cards = getExampleCards([]);
    const avro = cards.find((c) => c.id === 'ksql-dynamic-routing');
    const json = cards.find((c) => c.id === 'ksql-dynamic-routing-json');
    expect(avro, 'Avro ksqlDB routing card should exist').toBeDefined();
    expect(json, 'JSON ksqlDB routing card should exist').toBeDefined();
    // Both should be in the Joins group
    expect(avro!.group).toBe('Joins');
    expect(json!.group).toBe('Joins');
  });
});
