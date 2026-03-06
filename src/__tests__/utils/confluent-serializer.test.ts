import { describe, it, expect, vi } from 'vitest';

// Mock protobufjs and avsc
vi.mock('protobufjs', () => {
  class MockType {
    verify = vi.fn(() => null);
    create = vi.fn((data: any) => data);
    encode = vi.fn(() => ({
      finish: () => new Uint8Array([0x08, 0x01]),
    }));
  }
  class MockNamespace {}
  const messageInstance = new MockType();
  return {
    default: {},
    parse: vi.fn(() => ({
      root: {
        nestedArray: [messageInstance],
      },
    })),
    Type: MockType,
    Namespace: MockNamespace,
  };
});

vi.mock('avsc', () => ({
  default: {
    Type: {
      forSchema: vi.fn(() => ({
        toBuffer: vi.fn((data) => {
          // Return a simple buffer representation
          const json = JSON.stringify(data);
          return new Uint8Array(Array.from(json).map((c) => c.charCodeAt(0)));
        }),
      })),
    },
  },
}));

import { serializeToConfluentBinary } from '../../utils/confluent-serializer';

describe('[@confluent-serializer] serializeToConfluentBinary', () => {
  const sampleData = { name: 'test', value: 42 };
  const avroSchema = '{"type":"record","name":"Test","fields":[{"name":"name","type":"string"},{"name":"value","type":"int"}]}';
  const protoSchema = 'syntax = "proto3"; message Test { string name = 1; int32 value = 2; }';

  it('returns null for JSON schema type', () => {
    const result = serializeToConfluentBinary(sampleData, '{}', 'JSON', 100);
    expect(result).toBeNull();
  });

  it('returns null for unknown schema type', () => {
    const result = serializeToConfluentBinary(sampleData, '{}', 'UNKNOWN', 100);
    expect(result).toBeNull();
  });

  it('serializes AVRO data with Confluent wire format header', () => {
    const result = serializeToConfluentBinary(sampleData, avroSchema, 'AVRO', 42);
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');

    // Decode base64 to verify header
    const binary = atob(result!);
    const bytes = Array.from(binary).map((c) => c.charCodeAt(0));

    // Magic byte
    expect(bytes[0]).toBe(0x00);
    // Schema ID = 42 (big-endian 4 bytes)
    expect(bytes[1]).toBe(0);
    expect(bytes[2]).toBe(0);
    expect(bytes[3]).toBe(0);
    expect(bytes[4]).toBe(42);
  });

  it('serializes PROTOBUF data with wire format header and message index', () => {
    const result = serializeToConfluentBinary(sampleData, protoSchema, 'PROTOBUF', 99);
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');

    const binary = atob(result!);
    const bytes = Array.from(binary).map((c) => c.charCodeAt(0));

    // Magic byte
    expect(bytes[0]).toBe(0x00);
    // Schema ID = 99
    expect(bytes[4]).toBe(99);
    // Message index byte (0x00 for single-message .proto)
    expect(bytes[5]).toBe(0x00);
  });

  it('encodes schema ID correctly for large IDs', () => {
    // Schema ID = 256 * 256 = 65536 = 0x00010000
    const result = serializeToConfluentBinary(sampleData, avroSchema, 'AVRO', 65536);
    expect(result).not.toBeNull();

    const binary = atob(result!);
    const bytes = Array.from(binary).map((c) => c.charCodeAt(0));

    expect(bytes[1]).toBe(0);
    expect(bytes[2]).toBe(1);
    expect(bytes[3]).toBe(0);
    expect(bytes[4]).toBe(0);
  });

  it('encodes schema ID = 1 correctly in big-endian', () => {
    const result = serializeToConfluentBinary(sampleData, avroSchema, 'AVRO', 1);
    expect(result).not.toBeNull();

    const binary = atob(result!);
    const bytes = Array.from(binary).map((c) => c.charCodeAt(0));

    expect(bytes[1]).toBe(0);
    expect(bytes[2]).toBe(0);
    expect(bytes[3]).toBe(0);
    expect(bytes[4]).toBe(1);
  });

  it('encodes schema ID = 256 correctly in big-endian', () => {
    const result = serializeToConfluentBinary(sampleData, avroSchema, 'AVRO', 256);
    expect(result).not.toBeNull();

    const binary = atob(result!);
    const bytes = Array.from(binary).map((c) => c.charCodeAt(0));

    expect(bytes[1]).toBe(0);
    expect(bytes[2]).toBe(0);
    expect(bytes[3]).toBe(1);
    expect(bytes[4]).toBe(0);
  });

  it('returns null for empty string schema type', () => {
    const result = serializeToConfluentBinary(sampleData, '{}', '', 100);
    expect(result).toBeNull();
  });
});

describe('[@confluent-serializer] serializeProtobuf error paths', () => {
  const data = { name: 'test', value: 42 };
  const protoSrc = 'syntax = "proto3"; message Test { string name = 1; int32 value = 2; }';

  it('throws when protobuf verification fails', async () => {
    const protobuf = await import('protobufjs');
    const mockRoot = (protobuf.parse as any)().root;
    const mockType = mockRoot.nestedArray[0];
    mockType.verify.mockReturnValueOnce('field "name" is required');

    expect(() => {
      serializeToConfluentBinary(data, protoSrc, 'PROTOBUF', 100);
    }).toThrow('Protobuf verification failed: field "name" is required');
  });
});

describe('[@confluent-serializer] findFirstMessageType edge cases', () => {
  const data = { name: 'test', value: 42 };

  it('throws when no message type found (empty nestedArray)', async () => {
    const protobuf = await import('protobufjs');

    vi.mocked(protobuf.parse as any).mockReturnValueOnce({
      root: {
        nestedArray: [],
      },
    });

    expect(() => {
      serializeToConfluentBinary(data, 'syntax = "proto3";', 'PROTOBUF', 100);
    }).toThrow('No message type found in protobuf schema');
  });
});
