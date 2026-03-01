import { schemaRegistryClient } from './schema-registry-client';
import type { SchemaSubject, SchemaVersion, CompatibilityLevel } from '../types';

export async function listSubjects(): Promise<string[]> {
  const response = await schemaRegistryClient.get<string[]>('/subjects');
  return response.data;
}

export async function getSchemaDetail(subject: string, version: number | 'latest' = 'latest'): Promise<SchemaSubject> {
  const response = await schemaRegistryClient.get<SchemaSubject>(
    `/subjects/${encodeURIComponent(subject)}/versions/${version}`
  );
  const data = response.data;
  // Confluent SR API omits schemaType for AVRO schemas (AVRO is the default)
  if (!data.schemaType) {
    data.schemaType = 'AVRO';
  }
  return data;
}

export async function getSchemaVersions(subject: string): Promise<number[]> {
  const response = await schemaRegistryClient.get<number[]>(
    `/subjects/${encodeURIComponent(subject)}/versions`
  );
  return response.data;
}

export async function registerSchema(subject: string, schema: string, schemaType: string): Promise<{ id: number }> {
  const response = await schemaRegistryClient.post<{ id: number }>(
    `/subjects/${encodeURIComponent(subject)}/versions`,
    { schema, schemaType }
  );
  return response.data;
}

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
 * Item 4: Like getCompatibilityMode but also returns whether the level is inherited
 * from the global default (isGlobal=true) or set at the subject level (isGlobal=false).
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

export async function setCompatibilityMode(subject: string, level: CompatibilityLevel): Promise<{ compatibility: string }> {
  const response = await schemaRegistryClient.put<{ compatibility: string }>(
    `/config/${encodeURIComponent(subject)}`,
    { compatibility: level }
  );
  return response.data;
}

export async function deleteSubject(subject: string): Promise<number[]> {
  const response = await schemaRegistryClient.delete<number[]>(
    `/subjects/${encodeURIComponent(subject)}`
  );
  return response.data;
}

export async function deleteSchemaVersion(subject: string, version: number): Promise<number> {
  const response = await schemaRegistryClient.delete<number>(
    `/subjects/${encodeURIComponent(subject)}/versions/${version}`
  );
  return response.data;
}

export type { SchemaSubject, SchemaVersion };
