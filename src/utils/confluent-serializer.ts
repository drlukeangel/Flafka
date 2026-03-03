/**
 * Client-side Confluent wire format serializer.
 * Serializes data as AVRO or PROTOBUF binary, prepends the Confluent
 * wire format header (magic byte + 4-byte schema ID), and base64 encodes
 * for use with the REST Proxy's type: 'BINARY'.
 *
 * JSON schemas don't need binary serialization — use type: 'JSON' directly.
 */
import * as protobuf from 'protobufjs';
import avsc from 'avsc';

/**
 * Serialize a record to Confluent wire format, base64 encoded.
 * Returns null if schema type is JSON (use type: 'JSON' directly).
 */
export function serializeToConfluentBinary(
  data: Record<string, unknown>,
  schemaText: string,
  schemaType: 'AVRO' | 'JSON' | 'PROTOBUF' | string,
  schemaId: number
): string | null {
  if (schemaType === 'JSON') return null;

  let payload: Uint8Array;
  if (schemaType === 'AVRO') {
    payload = serializeAvro(data, schemaText);
  } else if (schemaType === 'PROTOBUF') {
    payload = serializeProtobuf(data, schemaText);
  } else {
    return null;
  }

  // Confluent wire format: magic byte (0x00) + 4-byte schema ID (big-endian) + payload
  const header = new Uint8Array(5);
  header[0] = 0x00;
  header[1] = (schemaId >> 24) & 0xff;
  header[2] = (schemaId >> 16) & 0xff;
  header[3] = (schemaId >> 8) & 0xff;
  header[4] = schemaId & 0xff;

  let wireBytes: Uint8Array;
  if (schemaType === 'PROTOBUF') {
    // Protobuf wire format includes a message index array after the header.
    // For single-message .proto files, this is just a single varint 0x00.
    const messageIndex = new Uint8Array([0x00]);
    wireBytes = new Uint8Array(header.length + messageIndex.length + payload.length);
    wireBytes.set(header, 0);
    wireBytes.set(messageIndex, header.length);
    wireBytes.set(payload, header.length + messageIndex.length);
  } else {
    wireBytes = new Uint8Array(header.length + payload.length);
    wireBytes.set(header, 0);
    wireBytes.set(payload, header.length);
  }

  return uint8ArrayToBase64(wireBytes);
}

// ─── Avro Serializer (using avsc) ─────────────────────────────────────────

function serializeAvro(data: Record<string, unknown>, schemaText: string): Uint8Array {
  const schema = JSON.parse(schemaText);
  const type = avsc.Type.forSchema(schema);
  return type.toBuffer(data);
}

// ─── Protobuf Serializer (using protobufjs) ───────────────────────────────

function serializeProtobuf(data: Record<string, unknown>, schemaText: string): Uint8Array {
  const root = protobuf.parse(schemaText, { keepCase: true }).root;
  const messageType = findFirstMessageType(root);
  if (!messageType) {
    throw new Error('No message type found in protobuf schema');
  }
  const errMsg = messageType.verify(data);
  if (errMsg) throw new Error(`Protobuf verification failed: ${errMsg}`);
  const message = messageType.create(data);
  return messageType.encode(message).finish();
}

function findFirstMessageType(namespace: protobuf.NamespaceBase): protobuf.Type | null {
  for (const nested of namespace.nestedArray) {
    if (nested instanceof protobuf.Type) return nested;
    if (nested instanceof protobuf.Namespace) {
      const found = findFirstMessageType(nested);
      if (found) return found;
    }
  }
  return null;
}

// ─── Utility ──────────────────────────────────────────────────────────────

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
