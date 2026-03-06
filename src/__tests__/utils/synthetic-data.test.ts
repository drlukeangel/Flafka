import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSyntheticRecord, mulberry32 } from '../../utils/synthetic-data';

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
      expect((result.error as string)).toContain('Invalid Protobuf schema: no message definition found');
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

  // =========================================================================
  // mulberry32 RNG
  // =========================================================================

  describe('[@synthetic-data] mulberry32', () => {
    it('produces deterministic values from same seed', () => {
      const rng1 = mulberry32(42);
      const rng2 = mulberry32(42);
      const seq1 = Array.from({ length: 10 }, () => rng1());
      const seq2 = Array.from({ length: 10 }, () => rng2());
      expect(seq1).toEqual(seq2);
    });

    it('produces values in [0, 1) range', () => {
      const rng = mulberry32(123);
      for (let i = 0; i < 100; i++) {
        const val = rng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it('produces different values for different seeds', () => {
      const rng1 = mulberry32(1);
      const rng2 = mulberry32(2);
      const val1 = rng1();
      const val2 = rng2();
      expect(val1).not.toBe(val2);
    });
  });

  // =========================================================================
  // Avro array and map types
  // =========================================================================

  describe('[@synthetic-data] Avro array type', () => {
    it('generates an array of items', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{
          name: 'tags',
          type: { type: 'array', items: 'string' },
        }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(Array.isArray(result.tags)).toBe(true);
      expect((result.tags as unknown[]).length).toBeGreaterThan(0);
    });

    it('generates array with default string items when items is not specified', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{
          name: 'items',
          type: { type: 'array' },
        }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(Array.isArray(result.items)).toBe(true);
    });
  });

  describe('[@synthetic-data] Avro map type', () => {
    it('generates a map with key-value pairs', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{
          name: 'metadata',
          type: { type: 'map', values: 'string' },
        }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(typeof result.metadata).toBe('object');
      expect(result.metadata).not.toBeNull();
      const map = result.metadata as Record<string, unknown>;
      const keys = Object.keys(map);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys[0]).toMatch(/^key_\d+$/);
    });

    it('generates map with default string values when values is not specified', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{
          name: 'props',
          type: { type: 'map' },
        }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(typeof result.props).toBe('object');
    });
  });

  // =========================================================================
  // Avro bytes type
  // =========================================================================

  describe('[@synthetic-data] Avro bytes type', () => {
    it('generates bytes as Uint8Array or Buffer', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'raw_data', type: 'bytes' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      // Should be a typed array or buffer
      expect(result.raw_data).toBeDefined();
    });
  });

  // =========================================================================
  // Avro unknown type
  // =========================================================================

  describe('[@synthetic-data] Avro unknown primitive type', () => {
    it('returns unknown_<type> string for unrecognized types', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'exotic', type: 'fixed' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(result.exotic).toBe('unknown_fixed');
    });
  });

  // =========================================================================
  // Avro named type reference (object with .type string)
  // =========================================================================

  describe('[@synthetic-data] Avro complex type with .type string', () => {
    it('resolves object type with .type property to primitive', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{
          name: 'ref_field',
          type: { type: 'string' },
        }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(typeof result.ref_field).toBe('string');
    });
  });

  // =========================================================================
  // Avro union with only null
  // =========================================================================

  describe('[@synthetic-data] Avro union with only null', () => {
    it('returns null when union contains only null', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'nothing', type: ['null'] }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(result.nothing).toBeNull();
    });
  });

  // =========================================================================
  // Heuristic coercion edge cases
  // =========================================================================

  describe('[@synthetic-data] Heuristic coercion for Avro long type', () => {
    it('coerces date heuristic to epoch millis for long type fields named *_at', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'created_at', type: 'long' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(typeof result.created_at).toBe('number');
      // Should be a reasonable epoch timestamp
      expect(result.created_at as number).toBeGreaterThan(1000000000000);
    });

    it('falls back to type generator for int type fields with string heuristics like name', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'name', type: 'int' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(typeof result.name).toBe('number');
    });
  });

  // =========================================================================
  // Protobuf generation
  // =========================================================================

  describe('[@synthetic-data] Protobuf generation', () => {
    it('generates basic protobuf fields', () => {
      const proto = `syntax = "proto3";
message TestMessage {
  string name = 1;
  int32 count = 2;
  bool active = 3;
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF', 42) as Record<string, unknown>;
      expect(result).not.toHaveProperty('error');
      expect(typeof result.name).toBe('string');
      expect(typeof result.count).toBe('number');
      expect(typeof result.active).toBe('boolean');
    });

    it('generates int64 field', () => {
      const proto = `syntax = "proto3";
message Msg {
  int64 big_number = 1;
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF', 42) as Record<string, unknown>;
      expect(typeof result.big_number).toBe('number');
    });

    it('generates float field', () => {
      const proto = `syntax = "proto3";
message Msg {
  float score = 1;
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF', 42) as Record<string, unknown>;
      expect(typeof result.score).toBe('number');
    });

    it('generates double field', () => {
      const proto = `syntax = "proto3";
message Msg {
  double amount = 1;
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF', 42) as Record<string, unknown>;
      expect(typeof result.amount).toBe('number');
    });

    it('generates bytes field', () => {
      const proto = `syntax = "proto3";
message Msg {
  bytes raw = 1;
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF', 42) as Record<string, unknown>;
      expect(typeof result.raw).toBe('string');
      expect((result.raw as string)).toMatch(/^bytes_/);
    });

    it('generates unknown protobuf type as string', () => {
      const proto = `syntax = "proto3";
message Msg {
  MyCustomType custom = 1;
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF', 42) as Record<string, unknown>;
      expect(result.custom).toBe('unknown_MyCustomType');
    });

    it('generates repeated fields as arrays', () => {
      const proto = `syntax = "proto3";
message Msg {
  repeated string labels = 1;
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF', 42) as Record<string, unknown>;
      // labels gets name heuristic (ends with no special match), so it should be string array
      expect(Array.isArray(result.labels)).toBe(true);
    });

    it('returns error when no message definition found', () => {
      const result = generateSyntheticRecord('syntax = "proto3";', 'PROTOBUF') as Record<string, unknown>;
      expect(result).toHaveProperty('error');
      expect((result.error as string)).toContain('no message definition found');
    });

    it('returns error when message has no parseable fields', () => {
      const proto = `syntax = "proto3";
message Empty {
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF') as Record<string, unknown>;
      expect(result).toHaveProperty('error');
      expect((result.error as string)).toContain('no fields found');
    });

    it('applies heuristic for email field in protobuf', () => {
      const proto = `syntax = "proto3";
message Msg {
  string email = 1;
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF', 42) as Record<string, unknown>;
      expect((result.email as string)).toContain('@');
    });

    it('applies heuristic for status field in protobuf', () => {
      const proto = `syntax = "proto3";
message Msg {
  string status = 1;
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF', 42) as Record<string, unknown>;
      expect(['active', 'inactive', 'pending', 'approved', 'rejected', 'suspended']).toContain(result.status);
    });

    it('coerces date heuristic to epoch for protobuf int64 timestamp field', () => {
      const proto = `syntax = "proto3";
message Msg {
  int64 created_at = 1;
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF', 42) as Record<string, unknown>;
      expect(typeof result.created_at).toBe('number');
      expect(result.created_at as number).toBeGreaterThan(1000000000000);
    });

    it('falls back to type generator when heuristic produces non-date string for int field', () => {
      const proto = `syntax = "proto3";
message Msg {
  int32 name = 1;
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF', 42) as Record<string, unknown>;
      // name heuristic returns "First Last" which is not a date, and field is int32
      // so it should fall through to generateProtobufPrimitive
      expect(typeof result.name).toBe('number');
    });

    it('generates all signed int variants', () => {
      const proto = `syntax = "proto3";
message Msg {
  sint32 a = 1;
  sint64 b = 2;
  uint32 c = 3;
  uint64 d = 4;
  fixed32 e = 5;
  fixed64 f = 6;
  sfixed32 g = 7;
  sfixed64 h = 8;
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF', 42) as Record<string, unknown>;
      for (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        expect(typeof result[key]).toBe('number');
      }
    });

    it('wraps repeated heuristic values in arrays', () => {
      const proto = `syntax = "proto3";
message Msg {
  repeated string email = 1;
}`;
      const result = generateSyntheticRecord(proto, 'PROTOBUF', 42) as Record<string, unknown>;
      // email heuristic should be wrapped in an array since repeated
      expect(Array.isArray(result.email)).toBe(true);
      expect((result.email as string[])[0]).toContain('@');
    });
  });

  // =========================================================================
  // JSON Schema edge cases
  // =========================================================================

  describe('[@synthetic-data] JSON Schema edge cases', () => {
    it('generates integer type', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: { count: { type: 'integer' } },
      });
      const result = generateSyntheticRecord(schema, 'JSON', 42) as Record<string, unknown>;
      expect(typeof result.count).toBe('number');
    });

    it('generates null type', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: { empty: { type: 'null' } },
      });
      const result = generateSyntheticRecord(schema, 'JSON', 42) as Record<string, unknown>;
      expect(result.empty).toBeNull();
    });

    it('generates nested object type', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: {
              inner: { type: 'string' },
            },
          },
        },
      });
      const result = generateSyntheticRecord(schema, 'JSON', 42) as Record<string, unknown>;
      expect(typeof result.nested).toBe('object');
      expect(typeof (result.nested as Record<string, unknown>).inner).toBe('string');
    });

    it('returns empty object for object type without properties', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          data: { type: 'object' },
        },
      });
      const result = generateSyntheticRecord(schema, 'JSON', 42) as Record<string, unknown>;
      expect(result.data).toEqual({});
    });

    it('returns empty array for array type without items', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          list: { type: 'array' },
        },
      });
      const result = generateSyntheticRecord(schema, 'JSON', 42) as Record<string, unknown>;
      expect(result.list).toEqual([]);
    });

    it('returns null for unknown JSON Schema property type', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          exotic: { type: 'custom' },
        },
      });
      const result = generateSyntheticRecord(schema, 'JSON', 42) as Record<string, unknown>;
      expect(result.exotic).toBeNull();
    });

    it('returns null for property without type', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          weird: {},
        },
      });
      const result = generateSyntheticRecord(schema, 'JSON', 42) as Record<string, unknown>;
      // {} has no .type so returns null from default case
      expect(result.weird).toBeNull();
    });

    it('returns error for non-object JSON Schema root', () => {
      const schema = JSON.stringify({ type: 'string' });
      const result = generateSyntheticRecord(schema, 'JSON', 42) as Record<string, unknown>;
      expect(result).toHaveProperty('error');
    });

    it('returns error for invalid JSON schema (null)', () => {
      const result = generateSyntheticRecord('null', 'JSON', 42) as Record<string, unknown>;
      expect(result).toHaveProperty('error');
    });

    it('applies heuristic for name field in JSON Schema', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: { name: { type: 'string' } },
      });
      const result = generateSyntheticRecord(schema, 'JSON', 42) as Record<string, unknown>;
      expect((result.name as string)).toContain(' '); // "First Last"
    });

    it('returns null for null/non-object prop in generateJsonSchemaValue', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: {
          // These will trigger the null check since heuristic won't match
          xyzabc: null,
        },
      });
      const result = generateSyntheticRecord(schema, 'JSON', 42) as Record<string, unknown>;
      expect(result.xyzabc).toBeNull();
    });
  });

  // =========================================================================
  // Unknown schema type fallback
  // =========================================================================

  describe('[@synthetic-data] Unknown schema type fallback', () => {
    it('auto-detects Avro record format for unknown schema type', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'value', type: 'int' }],
      });
      const result = generateSyntheticRecord(schema, 'UNKNOWN', 42) as Record<string, unknown>;
      expect(typeof result.value).toBe('number');
    });

    it('auto-detects JSON Schema format for unknown schema type', () => {
      const schema = JSON.stringify({
        type: 'object',
        properties: { label: { type: 'string' } },
      });
      const result = generateSyntheticRecord(schema, 'UNKNOWN', 42) as Record<string, unknown>;
      expect(typeof result.label).toBe('string');
    });

    it('returns error for unknown schema type when format is unrecognized', () => {
      const schema = JSON.stringify({ something: 'else' });
      const result = generateSyntheticRecord(schema, 'UNKNOWN', 42) as Record<string, unknown>;
      expect(result).toHaveProperty('error');
      expect((result.error as string)).toContain('Unsupported schema type');
    });
  });

  // =========================================================================
  // Heuristic function edge cases
  // =========================================================================

  describe('[@synthetic-data] Heuristic edge cases', () => {
    it('generates first_name heuristic', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'first_name', type: 'string' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(typeof result.first_name).toBe('string');
      // first_name should be a single word (no space)
      expect((result.first_name as string)).not.toContain(' ');
    });

    it('generates last_name heuristic', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'last_name', type: 'string' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(typeof result.last_name).toBe('string');
      expect((result.last_name as string)).not.toContain(' ');
    });

    it('generates username heuristic', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'username', type: 'string' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(typeof result.username).toBe('string');
    });

    it('generates field ending with _email', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'work_email', type: 'string' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect((result.work_email as string)).toContain('@');
    });

    it('generates field ending with _status', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'order_status', type: 'string' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(['active', 'inactive', 'pending', 'approved', 'rejected', 'suspended']).toContain(result.order_status);
    });

    it('generates field named "date"', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'date', type: 'string' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(new Date(result.date as string).toISOString()).toBe(result.date);
    });

    it('generates field named "timestamp"', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'timestamp', type: 'string' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(new Date(result.timestamp as string).toISOString()).toBe(result.timestamp);
    });

    it('generates field named "updated"', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'updated', type: 'string' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(new Date(result.updated as string).toISOString()).toBe(result.updated);
    });

    it('generates field ending with _time', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'start_time', type: 'string' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(new Date(result.start_time as string).toISOString()).toBe(result.start_time);
    });

    it('generates field ending with _date', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'birth_date', type: 'string' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(new Date(result.birth_date as string).toISOString()).toBe(result.birth_date);
    });

    it('generates field ending with _id', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'user_id', type: 'string' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(typeof result.user_id).toBe('string');
      expect((result.user_id as string).length).toBeGreaterThan(0);
    });

    it('generates field ending with _name', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'company_name', type: 'string' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect(typeof result.company_name).toBe('string');
      expect((result.company_name as string)).toContain(' ');
    });

    it('no heuristic for generic field names', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'xyzabc', type: 'string' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      expect((result.xyzabc as string)).toMatch(/^str_/);
    });
  });

  // =========================================================================
  // No seed (uses Math.random)
  // =========================================================================

  describe('[@synthetic-data] No seed path', () => {
    it('generates valid output without seed (uses Math.random)', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{ name: 'value', type: 'int' }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO') as Record<string, unknown>;
      expect(typeof result.value).toBe('number');
    });
  });

  // =========================================================================
  // Avro resolveAvroType — returns null for unrecognized structure
  // =========================================================================

  describe('[@synthetic-data] Avro unrecognized complex type', () => {
    it('returns null for object without known type structure', () => {
      const schema = JSON.stringify({
        type: 'record',
        name: 'T',
        fields: [{
          name: 'weird_field',
          type: { something: 'unusual' },
        }],
      });
      const result = generateSyntheticRecord(schema, 'AVRO', 42) as Record<string, unknown>;
      // resolveAvroType returns null for unrecognized objects
      expect(result.weird_field).toBeNull();
    });
  });
});
