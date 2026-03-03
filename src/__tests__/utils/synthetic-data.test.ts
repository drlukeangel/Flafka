import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSyntheticRecord } from '../../utils/synthetic-data';

describe('[@synthetic-data] Synthetic Data Generator', () => {
  describe('Avro schema generation', () => {
    const avroSchema = JSON.stringify({
      type: 'record',
      name: 'TestRecord',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'string' },
      ],
    });

    it('generates id field with UUID-like heuristic', () => {
      const result = generateSyntheticRecord(avroSchema, 'AVRO') as Record<string, unknown>;
      expect(result).not.toHaveProperty('error');
      expect(typeof result.id).toBe('string');
      expect((result.id as string).length).toBeGreaterThan(0);
    });

    it('generates name field with heuristic', () => {
      const result = generateSyntheticRecord(avroSchema, 'AVRO') as Record<string, unknown>;
      expect(typeof result.name).toBe('string');
      expect((result.name as string).includes(' ')).toBe(true); // "First Last"
    });

    it('generates email field with heuristic', () => {
      const result = generateSyntheticRecord(avroSchema, 'AVRO') as Record<string, unknown>;
      expect(typeof result.email).toBe('string');
      expect((result.email as string)).toContain('@');
    });

    it('generates status field with heuristic', () => {
      const result = generateSyntheticRecord(avroSchema, 'AVRO') as Record<string, unknown>;
      expect(typeof result.status).toBe('string');
      expect(['active', 'inactive', 'pending', 'approved', 'rejected', 'suspended']).toContain(result.status);
    });

    it('generates date field with ISO string heuristic', () => {
      const result = generateSyntheticRecord(avroSchema, 'AVRO') as Record<string, unknown>;
      expect(typeof result.created_at).toBe('string');
      // Should be a valid ISO date
      expect(new Date(result.created_at as string).toISOString()).toBe(result.created_at);
    });
  });

  describe('Avro primitive types', () => {
    it('generates int value', () => {
      const schema = JSON.stringify({
        type: 'record', name: 'T', fields: [{ name: 'count', type: 'int' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO') as Record<string, unknown>;
      expect(typeof result.count).toBe('number');
      expect(Number.isInteger(result.count)).toBe(true);
    });

    it('generates long value', () => {
      const schema = JSON.stringify({
        type: 'record', name: 'T', fields: [{ name: 'big_count', type: 'long' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO') as Record<string, unknown>;
      expect(typeof result.big_count).toBe('number');
    });

    it('generates float value', () => {
      const schema = JSON.stringify({
        type: 'record', name: 'T', fields: [{ name: 'score', type: 'float' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO') as Record<string, unknown>;
      expect(typeof result.score).toBe('number');
    });

    it('generates double value', () => {
      const schema = JSON.stringify({
        type: 'record', name: 'T', fields: [{ name: 'amount', type: 'double' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO') as Record<string, unknown>;
      expect(typeof result.amount).toBe('number');
    });

    it('generates boolean value', () => {
      const schema = JSON.stringify({
        type: 'record', name: 'T', fields: [{ name: 'active', type: 'boolean' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO') as Record<string, unknown>;
      expect(typeof result.active).toBe('boolean');
    });

    it('generates null value', () => {
      const schema = JSON.stringify({
        type: 'record', name: 'T', fields: [{ name: 'nothing', type: 'null' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO') as Record<string, unknown>;
      expect(result.nothing).toBeNull();
    });
  });

  describe('Avro union types', () => {
    it('generates union ["null","string"] with ~80/20 distribution', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'optional_val', type: ['null', 'string'] }],
      });

      let nullCount = 0;
      const samples = 100;
      for (let i = 0; i < samples; i++) {
        const result = generateSyntheticRecord(schema, 'AVRO', i * 1000) as Record<string, unknown>;
        if (result.optional_val === null) nullCount++;
      }

      // Should be roughly 80% null (allow 60-95% tolerance)
      expect(nullCount).toBeGreaterThanOrEqual(60);
      expect(nullCount).toBeLessThanOrEqual(95);
    });
  });

  describe('Avro nested record', () => {
    it('generates nested record recursively', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'Outer',
        fields: [{
          name: 'address',
          type: {
            type: 'record',
            name: 'Address',
            fields: [
              { name: 'street', type: 'string' },
              { name: 'city', type: 'string' },
            ],
          },
        }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO') as Record<string, unknown>;
      expect(typeof result.address).toBe('object');
      const addr = result.address as Record<string, unknown>;
      expect(typeof addr.street).toBe('string');
      expect(typeof addr.city).toBe('string');
    });
  });

  describe('Avro enum', () => {
    it('picks valid enum value', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{
          name: 'color',
          type: { type: 'enum', name: 'Color', symbols: ['RED', 'GREEN', 'BLUE'] },
        }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO') as Record<string, unknown>;
      expect(['RED', 'GREEN', 'BLUE']).toContain(result.color);
    });
  });

  describe('JSON Schema generation', () => {
    it('generates basic JSON Schema types', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          label: { type: 'string' },
          count: { type: 'number' },
          active: { type: 'boolean' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      });
      const result = generateSyntheticRecord(schema, 'JSON') as Record<string, unknown>;
      expect(typeof result.label).toBe('string');
      expect(typeof result.count).toBe('number');
      expect(typeof result.active).toBe('boolean');
      expect(Array.isArray(result.tags)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('returns error for invalid Avro (missing fields key)', () => {
      const schema = JSON.stringify({ type: 'record', name: 'Bad' });
      const result = generateSyntheticRecord(schema, 'AVRO') as Record<string, unknown>;
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });

    it('returns error for invalid JSON schema text', () => {
      const result = generateSyntheticRecord('not valid json{{{', 'JSON') as Record<string, unknown>;
      expect(result).toHaveProperty('error');
    });

    it('returns error for Protobuf schema type', () => {
      const result = generateSyntheticRecord('syntax = "proto3";', 'PROTOBUF') as Record<string, unknown>;
      expect(result).toHaveProperty('error');
      expect((result.error as string)).toContain('Protobuf not supported');
    });
  });

  describe('Determinism', () => {
    it('same seed produces identical output (AC-4.8)', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [
          { name: 'value', type: 'int' },
          { name: 'flag', type: 'boolean' },
          { name: 'score', type: 'double' },
        ],
      });

      const result1 = generateSyntheticRecord(schema, 'AVRO', 42);
      const result2 = generateSyntheticRecord(schema, 'AVRO', 42);

      expect(result1).toEqual(result2);
    });
  });
});
