/**
 * Confluent Schema Registry Client
 *
 * Manages schema subjects (AVRO, JSON Schema, Protobuf) in the Confluent Schema
 * Registry. Supports listing, fetching, registering, versioning, compatibility
 * checking, and deletion of schemas.
 *
 * Key concept: A **subject** is a named scope under which schema versions are
 * registered. By convention, subjects follow the pattern `<topic>-key` or
 * `<topic>-value`, mapping schemas to Kafka topic keys/values.
 *
 * Multi-user isolation: {@link registerSchema} auto-appends a session tag to
 * subject names so each user's schemas are namespaced and filterable.
 */
import { schemaRegistryClient } from './schema-registry-client';
import { getSessionTag } from '../utils/names';
import type { SchemaSubject, SchemaVersion, CompatibilityLevel } from '../types';

/**
 * List all schema subjects registered in the Schema Registry.
 *
 * A subject is a named container for schema versions (e.g. "orders-value",
 * "users-key"). Optionally filter to only subjects containing `filterUniqueId`,
 * which is used for multi-user session isolation — each user only sees schemas
 * tagged with their session ID.
 *
 * @param filterUniqueId - If provided, only return subjects whose name includes this string.
 * @returns Array of subject name strings.
 */
export async function listSubjects(filterUniqueId?: string): Promise<string[]> {
  const response = await schemaRegistryClient.get<string[]>('/subjects');
  const subjects = response.data;
  if (filterUniqueId) {
    return subjects.filter(s => s.includes(filterUniqueId));
  }
  return subjects;
}

/**
 * Fetch the schema definition for a specific subject and version.
 *
 * **AVRO default quirk**: The Confluent Schema Registry API omits the `schemaType`
 * field when the type is AVRO (since AVRO is the default format). This function
 * normalizes the response by explicitly setting `schemaType = 'AVRO'` when the
 * field is absent, so callers can always rely on it being present.
 *
 * @param subject - The schema subject name (e.g. "orders-value").
 * @param version - Version number or `'latest'` (default: `'latest'`).
 * @param options - Optional config with `signal` for AbortController cancellation
 *                  (e.g. when the user navigates away before the request completes).
 * @returns SchemaSubject with id, schema string, schemaType, and subject metadata.
 */
export async function getSchemaDetail(
  subject: string,
  version: number | 'latest' = 'latest',
  options?: { signal?: AbortSignal }
): Promise<SchemaSubject> {
  const response = await schemaRegistryClient.get<SchemaSubject>(
    `/subjects/${encodeURIComponent(subject)}/versions/${version}`,
    options?.signal ? { signal: options.signal } : undefined
  );
  const data = response.data;
  // Confluent SR API omits schemaType for AVRO schemas (AVRO is the default)
  if (!data.schemaType) {
    data.schemaType = 'AVRO';
  }
  return data;
}

/** List all version numbers registered under a subject (e.g. [1, 2, 3]). */
export async function getSchemaVersions(subject: string): Promise<number[]> {
  const response = await schemaRegistryClient.get<number[]>(
    `/subjects/${encodeURIComponent(subject)}/versions`
  );
  return response.data;
}

/**
 * Register a new schema version under a subject.
 *
 * **Auto-tagging for multi-user sandboxing**: The subject name is automatically
 * suffixed with the current session tag (e.g. "-abc123") so that each user's
 * schemas are namespaced. This enables `listSubjects(filterUniqueId)` to return
 * only schemas belonging to the current session. If the subject already ends with
 * the session tag, no duplicate suffix is added.
 *
 * @param subject - Base subject name (e.g. "orders-value"). Will be auto-suffixed.
 * @param schema - The schema definition string (JSON for AVRO/JSON Schema, proto for Protobuf).
 * @param schemaType - Schema format: "AVRO", "JSON", or "PROTOBUF".
 * @returns Object with the globally unique `id` assigned to this schema version.
 */
export async function registerSchema(subject: string, schema: string, schemaType: string): Promise<{ id: number }> {
  // Automatically tag subject with uniqueId for filtering
  const suffix = `-${getSessionTag()}`;
  const finalSubject = subject.endsWith(suffix) ? subject : `${subject}${suffix}`;

  const response = await schemaRegistryClient.post<{ id: number }>(
    `/subjects/${encodeURIComponent(finalSubject)}/versions`,
    { schema, schemaType }
  );
  return response.data;
}

/**
 * Check if a schema is compatible with the existing versions under a subject.
 * Uses the Schema Registry's compatibility checking endpoint.
 *
 * @param subject - The subject name to check against.
 * @param schema - The candidate schema definition string.
 * @param schemaType - Schema format: "AVRO", "JSON", or "PROTOBUF".
 * @param version - Version to check against (default: `'latest'`).
 * @returns Object with `is_compatible` boolean.
 */
export async function validateCompatibility(
  subject: string,
  schema: string,
  schemaType: string,
  version: number | 'latest' = 'latest'
): Promise<{ is_compatible: boolean }> {
  const response = await schemaRegistryClient.post<{ is_compatible: boolean }>(
    `/compatibility/subjects/${encodeURIComponent(subject)}/versions/${version}`,
    { schema, schemaType }
  );
  return response.data;
}

/**
 * Get the effective compatibility level for a subject.
 *
 * Tries subject-level config first. If the subject has no override (404), falls
 * back to the global default compatibility level. Use this when you only need the
 * level value and don't care whether it's inherited or explicit.
 *
 * See also {@link getCompatibilityModeWithSource} if you need to distinguish
 * subject-level vs. global-level origin.
 *
 * @param subject - The schema subject name.
 * @returns The effective CompatibilityLevel (e.g. "BACKWARD", "FULL_TRANSITIVE").
 */
export async function getCompatibilityMode(subject: string): Promise<CompatibilityLevel> {
  try {
    const response = await schemaRegistryClient.get<{ compatibilityLevel: string }>(
      `/config/${encodeURIComponent(subject)}`
    );
    return response.data.compatibilityLevel as CompatibilityLevel;
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number } };
    if (axiosError.response?.status === 404) {
      const globalResponse = await schemaRegistryClient.get<{ compatibilityLevel: string }>('/config');
      return globalResponse.data.compatibilityLevel as CompatibilityLevel;
    }
    throw error;
  }
}

/**
 * Get the compatibility level for a subject **with source attribution**.
 *
 * Like {@link getCompatibilityMode}, but also tells you whether the level comes
 * from a subject-level override (`isGlobal: false`) or the global default
 * (`isGlobal: true`). Use this in the UI when you need to show "inherited" vs.
 * "custom" badges next to the compatibility indicator.
 *
 * @param subject - The schema subject name.
 * @returns Object with `level` (the CompatibilityLevel) and `isGlobal` (true if
 *          inherited from global config, false if set at subject level).
 */
export async function getCompatibilityModeWithSource(
  subject: string
): Promise<{ level: CompatibilityLevel; isGlobal: boolean }> {
  try {
    const response = await schemaRegistryClient.get<{ compatibilityLevel: string }>(
      `/config/${encodeURIComponent(subject)}`
    );
    return { level: response.data.compatibilityLevel as CompatibilityLevel, isGlobal: false };
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number } };
    if (axiosError.response?.status === 404) {
      const globalResponse = await schemaRegistryClient.get<{ compatibilityLevel: string }>('/config');
      return { level: globalResponse.data.compatibilityLevel as CompatibilityLevel, isGlobal: true };
    }
    throw error;
  }
}

/**
 * Set a subject-level compatibility override (e.g. change from BACKWARD to NONE).
 * This overrides the global default for this subject only.
 */
export async function setCompatibilityMode(subject: string, level: CompatibilityLevel): Promise<{ compatibility: string }> {
  const response = await schemaRegistryClient.put<{ compatibility: string }>(
    `/config/${encodeURIComponent(subject)}`,
    { compatibility: level }
  );
  return response.data;
}

/**
 * Find all subjects that reference a specific schema ID (reverse lookup).
 * Useful for understanding which topics share the same schema definition.
 */
export async function getSubjectsForSchemaId(
  id: number,
  options?: { signal?: AbortSignal }
): Promise<string[]> {
  const response = await schemaRegistryClient.get<string[]>(
    `/schemas/ids/${id}/subjects`,
    options?.signal ? { signal: options.signal } : undefined
  );
  return response.data;
}

/** Soft-delete a subject and all its versions. Returns the deleted version numbers. */
export async function deleteSubject(subject: string): Promise<number[]> {
  const response = await schemaRegistryClient.delete<number[]>(
    `/subjects/${encodeURIComponent(subject)}`
  );
  return response.data;
}

/** Soft-delete a specific version of a subject. Returns the deleted version number. */
export async function deleteSchemaVersion(subject: string, version: number): Promise<number> {
  const response = await schemaRegistryClient.delete<number>(
    `/subjects/${encodeURIComponent(subject)}/versions/${version}`
  );
  return response.data;
}

export type { SchemaSubject, SchemaVersion };
