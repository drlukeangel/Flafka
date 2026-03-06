import { describe, it, expect } from 'vitest';
import { kickstarterDocs } from '../../data/examples/docs/kickstarter-docs';

describe('[@kickstarter-docs] kickstarterDocs', () => {
  it('exports a non-empty record of documentation entries', () => {
    expect(Object.keys(kickstarterDocs).length).toBeGreaterThan(0);
  });

  it('contains expected example IDs', () => {
    const ids = Object.keys(kickstarterDocs);
    expect(ids).toContain('hello-flink');
    expect(ids).toContain('good-jokes');
    expect(ids).toContain('loan-filter');
    expect(ids).toContain('loan-aggregate');
    expect(ids).toContain('loan-join');
    expect(ids).toContain('loan-temporal-join');
    expect(ids).toContain('loan-scalar-extract');
    expect(ids).toContain('loan-tradeline-java');
  });

  it('every entry has a subtitle string', () => {
    for (const [id, doc] of Object.entries(kickstarterDocs)) {
      expect(doc.subtitle, `${id} missing subtitle`).toBeTruthy();
      expect(typeof doc.subtitle).toBe('string');
    }
  });

  it('hello-flink has dataFlow with linear layout', () => {
    const doc = kickstarterDocs['hello-flink'];
    expect(doc.dataFlow).toBeDefined();
    expect(doc.dataFlow!.layout).toBe('linear');
    expect(doc.dataFlow!.nodes.length).toBeGreaterThan(0);
    expect(doc.dataFlow!.edges.length).toBeGreaterThan(0);
  });

  it('loan-filter has ddlBlocks and sqlBlocks', () => {
    const doc = kickstarterDocs['loan-filter'];
    expect(doc.ddlBlocks).toBeDefined();
    expect(doc.ddlBlocks!.length).toBeGreaterThan(0);
    expect(doc.sqlBlocks).toBeDefined();
    expect(doc.sqlBlocks!.length).toBeGreaterThan(0);
  });

  it('loan-filter has topics with input and output types', () => {
    const doc = kickstarterDocs['loan-filter'];
    expect(doc.topics).toBeDefined();
    const types = doc.topics!.map((t) => t.type);
    expect(types).toContain('input');
    expect(types).toContain('output');
  });

  it('loan-join has crossReference', () => {
    const doc = kickstarterDocs['loan-join'];
    expect(doc.crossReference).toBeDefined();
    expect(doc.crossReference!.cardId).toBe('loan-temporal-join');
  });

  it('loan-temporal-join has crossReference back to loan-join', () => {
    const doc = kickstarterDocs['loan-temporal-join'];
    expect(doc.crossReference).toBeDefined();
    expect(doc.crossReference!.cardId).toBe('loan-join');
  });

  it('entries with concepts have term and explanation', () => {
    for (const [id, doc] of Object.entries(kickstarterDocs)) {
      if (doc.concepts) {
        for (const c of doc.concepts) {
          expect(c.term, `${id} concept missing term`).toBeTruthy();
          expect(c.explanation, `${id} concept missing explanation`).toBeTruthy();
        }
      }
    }
  });

  it('entries with whatHappensIf have question and answer', () => {
    for (const [id, doc] of Object.entries(kickstarterDocs)) {
      if (doc.whatHappensIf) {
        for (const qa of doc.whatHappensIf) {
          expect(qa.question, `${id} QA missing question`).toBeTruthy();
          expect(qa.answer, `${id} QA missing answer`).toBeTruthy();
        }
      }
    }
  });
});
