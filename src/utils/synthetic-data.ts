/**
 * Phase 13.1 — Synthetic Data Generator
 * Generates fake records based on Avro or JSON Schema definitions.
 */

// Seeded random number generator (mulberry32)
export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Name pools for heuristic generation
const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
const STATUSES = ['active', 'inactive', 'pending', 'approved', 'rejected', 'suspended'];
const DOMAINS = ['example.com', 'test.org', 'demo.io', 'sample.net'];

/**
 * Generate a synthetic record based on a schema definition.
 * @param schemaText - The raw schema text (JSON string for Avro/JSON Schema)
 * @param schemaType - 'AVRO', 'JSON', or other
 * @param seed - Optional seed for deterministic output
 * @returns Generated record object, or { error: string } on failure
 */
export function generateSyntheticRecord(
  schemaText: string,
  schemaType: 'AVRO' | 'JSON' | string,
  seed?: number
): object {
  const rng = seed !== undefined ? mulberry32(seed) : () => Math.random();

  if (schemaType === 'PROTOBUF') {
    return generateFromProtobuf(schemaText, rng);
  }

  try {
    const parsed = JSON.parse(schemaText);

    if (schemaType === 'AVRO') {
      return generateFromAvro(parsed, rng);
    } else if (schemaType === 'JSON') {
      return generateFromJsonSchema(parsed, rng);
    } else {
      // Try Avro first, fall back to JSON Schema
      if (parsed.type === 'record' && Array.isArray(parsed.fields)) {
        return generateFromAvro(parsed, rng);
      }
      if (parsed.type === 'object' && parsed.properties) {
        return generateFromJsonSchema(parsed, rng);
      }
      return { error: `Unsupported schema type: ${schemaType}` };
    }
  } catch (e) {
    return { error: `Failed to parse schema: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function generateFromAvro(schema: any, rng: () => number): object {
  if (!schema || schema.type !== 'record' || !Array.isArray(schema.fields)) {
    return { error: 'Invalid Avro schema: missing "fields" array or type is not "record"' };
  }

  const result: Record<string, unknown> = {};
  for (const field of schema.fields) {
    result[field.name] = generateAvroValue(field.name, field.type, rng);
  }
  return result;
}

function generateAvroValue(fieldName: string, type: any, rng: () => number): unknown {
  // Check field name heuristics first
  const heuristic = applyHeuristic(fieldName, rng);
  if (heuristic !== undefined) {
    // Coerce heuristic to match Avro type (e.g. ISO string → epoch millis for long)
    const primitiveType = typeof type === 'string' ? type : undefined;
    if (primitiveType === 'long' && typeof heuristic === 'string') {
      const ts = Date.parse(heuristic);
      if (!isNaN(ts)) return ts;
    }
    if ((primitiveType === 'int' || primitiveType === 'long') && typeof heuristic === 'string') {
      return resolveAvroType(type, rng); // fall back to type generator
    }
    return heuristic;
  }

  return resolveAvroType(type, rng);
}

function resolveAvroType(type: any, rng: () => number): unknown {
  if (typeof type === 'string') {
    return generateAvroPrimitive(type, rng);
  }

  if (Array.isArray(type)) {
    // Union type — e.g. ["null", "string"]
    // 80% chance of null if null is in the union, 20% chance of the other type
    const hasNull = type.includes('null');
    const nonNullTypes = type.filter((t: any) => t !== 'null');

    if (hasNull && rng() < 0.8) {
      return null;
    }

    if (nonNullTypes.length > 0) {
      const chosen = nonNullTypes[Math.floor(rng() * nonNullTypes.length)];
      return resolveAvroType(chosen, rng);
    }
    return null;
  }

  if (typeof type === 'object') {
    if (type.type === 'record' && Array.isArray(type.fields)) {
      // Nested record (recursive)
      const nested: Record<string, unknown> = {};
      for (const field of type.fields) {
        nested[field.name] = generateAvroValue(field.name, field.type, rng);
      }
      return nested;
    }

    if (type.type === 'enum' && Array.isArray(type.symbols)) {
      return type.symbols[Math.floor(rng() * type.symbols.length)];
    }

    if (type.type === 'array') {
      const itemType = type.items || 'string';
      const length = Math.floor(rng() * 3) + 1;
      return Array.from({ length }, () => resolveAvroType(itemType, rng));
    }

    if (type.type === 'map') {
      const valueType = type.values || 'string';
      const count = Math.floor(rng() * 3) + 1;
      const map: Record<string, unknown> = {};
      for (let i = 0; i < count; i++) {
        map[`key_${i}`] = resolveAvroType(valueType, rng);
      }
      return map;
    }

    // Named type reference or complex type with .type
    if (typeof type.type === 'string') {
      return resolveAvroType(type.type, rng);
    }
  }

  return null;
}

function generateAvroPrimitive(type: string, rng: () => number): unknown {
  switch (type) {
    case 'string':
      return `str_${Math.floor(rng() * 10000)}`;
    case 'int':
      return Math.floor(rng() * 1000);
    case 'long':
      return Math.floor(rng() * 1000000);
    case 'float':
      return Math.round(rng() * 1000 * 100) / 100;
    case 'double':
      return Math.round(rng() * 100000 * 100) / 100;
    case 'boolean':
      return rng() > 0.5;
    case 'null':
      return null;
    case 'bytes': {
      const str = `bytes_${Math.floor(rng() * 10000)}`;
      return typeof globalThis.Buffer !== 'undefined'
        ? globalThis.Buffer.from(str)
        : new TextEncoder().encode(str);
    }
    default:
      return `unknown_${type}`;
  }
}

function generateFromJsonSchema(schema: any, rng: () => number): object {
  if (!schema || typeof schema !== 'object') {
    return { error: 'Invalid JSON schema' };
  }

  if (schema.type === 'object' && schema.properties) {
    const result: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      const heuristic = applyHeuristic(key, rng);
      if (heuristic !== undefined) {
        result[key] = heuristic;
      } else {
        result[key] = generateJsonSchemaValue(prop as any, rng);
      }
    }
    return result;
  }

  return { error: 'JSON schema must have type "object" with "properties"' };
}

function generateJsonSchemaValue(prop: any, rng: () => number): unknown {
  if (!prop || typeof prop !== 'object') return null;

  switch (prop.type) {
    case 'string':
      return `str_${Math.floor(rng() * 10000)}`;
    case 'number':
    case 'integer':
      return Math.floor(rng() * 1000);
    case 'boolean':
      return rng() > 0.5;
    case 'array':
      if (prop.items) {
        const length = Math.floor(rng() * 3) + 1;
        return Array.from({ length }, () => generateJsonSchemaValue(prop.items, rng));
      }
      return [];
    case 'object':
      if (prop.properties) {
        return generateFromJsonSchema(prop, rng);
      }
      return {};
    case 'null':
      return null;
    default:
      return null;
  }
}

function generateFromProtobuf(schemaText: string, rng: () => number): object {
  // Parse .proto text to extract message fields
  const messageMatch = schemaText.match(/message\s+\w+\s*\{([^}]+)\}/);
  if (!messageMatch) {
    return { error: 'Invalid Protobuf schema: no message definition found' };
  }

  const body = messageMatch[1];
  const result: Record<string, unknown> = {};

  // Match field lines: "type name = number;"
  const fieldRegex = /^\s*(repeated\s+)?(\w+)\s+(\w+)\s*=\s*\d+\s*;/gm;
  let match;

  while ((match = fieldRegex.exec(body)) !== null) {
    const isRepeated = !!match[1];
    const fieldType = match[2];
    const fieldName = match[3];

    const heuristic = applyHeuristic(fieldName, rng);
    if (heuristic !== undefined) {
      // Coerce heuristic to match protobuf type (e.g. ISO string → epoch millis for int64)
      const isIntType = ['int32', 'int64', 'sint32', 'sint64', 'uint32', 'uint64', 'fixed32', 'fixed64', 'sfixed32', 'sfixed64'].includes(fieldType);
      if (isIntType && typeof heuristic === 'string') {
        const ts = Date.parse(heuristic);
        if (!isNaN(ts)) {
          result[fieldName] = isRepeated ? [ts] : ts;
          continue;
        }
        // Non-date string for int field — fall through to type generator
      } else {
        result[fieldName] = isRepeated ? [heuristic] : heuristic;
        continue;
      }
    }

    const value = generateProtobufPrimitive(fieldType, rng);
    result[fieldName] = isRepeated
      ? Array.from({ length: Math.floor(rng() * 3) + 1 }, () => generateProtobufPrimitive(fieldType, rng))
      : value;
  }

  if (Object.keys(result).length === 0) {
    return { error: 'Protobuf schema parsed but no fields found' };
  }

  return result;
}

function generateProtobufPrimitive(type: string, rng: () => number): unknown {
  switch (type) {
    case 'string':
      return `str_${Math.floor(rng() * 10000)}`;
    case 'int32':
    case 'sint32':
    case 'uint32':
    case 'fixed32':
    case 'sfixed32':
      return Math.floor(rng() * 1000);
    case 'int64':
    case 'sint64':
    case 'uint64':
    case 'fixed64':
    case 'sfixed64':
      return Math.floor(rng() * 1000000);
    case 'float':
      return Math.round(rng() * 1000 * 100) / 100;
    case 'double':
      return Math.round(rng() * 100000 * 100) / 100;
    case 'bool':
      return rng() > 0.5;
    case 'bytes':
      return `bytes_${Math.floor(rng() * 10000)}`;
    default:
      return `unknown_${type}`;
  }
}

function applyHeuristic(fieldName: string, rng: () => number): unknown | undefined {
  const lower = fieldName.toLowerCase();

  // ID fields
  if (lower === 'id' || lower.endsWith('_id') || lower.endsWith('id')) {
    return crypto.randomUUID ? crypto.randomUUID() : `id-${Math.floor(rng() * 1000000)}`;
  }

  // Name fields
  if (lower === 'name' || lower.endsWith('_name') || lower === 'first_name' || lower === 'last_name' || lower === 'username') {
    const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    if (lower === 'first_name') return first;
    if (lower === 'last_name') return last;
    return `${first} ${last}`;
  }

  // Email fields
  if (lower === 'email' || lower.endsWith('_email')) {
    const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)].toLowerCase();
    const domain = DOMAINS[Math.floor(rng() * DOMAINS.length)];
    return `${first}${Math.floor(rng() * 100)}@${domain}`;
  }

  // Status fields
  if (lower === 'status' || lower.endsWith('_status')) {
    return STATUSES[Math.floor(rng() * STATUSES.length)];
  }

  // Date/time fields
  if (lower === 'date' || lower.endsWith('_at') || lower.endsWith('_time') || lower.endsWith('_date') || lower === 'timestamp' || lower === 'created' || lower === 'updated') {
    const now = Date.now();
    const offset = Math.floor(rng() * 30 * 24 * 60 * 60 * 1000); // within 30 days
    return new Date(now - offset).toISOString();
  }

  // No heuristic matched
  return undefined;
}
