import type { ConceptContent } from '../../types/learn';

export const schemaGovernanceContent: ConceptContent = {
  animation: 'schema-governance',
  sections: [
    {
      heading: 'Schema Registry: The Contract Enforcer',
      body: 'Schema Registry is a centralized service in Confluent Cloud that stores and manages schemas for your Kafka topics. Every time a producer writes data, the schema can be registered and validated against the registry. Consumers retrieve the schema to deserialize correctly. This creates a shared contract between producers and consumers that prevents the "I changed a field and everything broke" nightmare. Schema Registry supports Avro, JSON Schema, and Protobuf, and for Flink SQL the integration is seamless -- Flink automatically retrieves schemas and maps them to SQL column types, so you rarely need to define columns manually.',
    },
    {
      heading: 'Compatibility Modes: BACKWARD, FORWARD, FULL',
      body: 'Schema Registry enforces compatibility rules that govern how schemas can evolve. BACKWARD compatibility (the default) means new consumers can read old data -- you can add optional fields with defaults or remove fields, but you cannot add required fields. FORWARD compatibility means old consumers can read new data -- you can add fields but cannot remove required ones. FULL compatibility is the intersection of both: old and new consumers can read old and new data. FULL is the safest but most restrictive mode, allowing only changes like adding optional fields with defaults. For mission-critical topics where producers and consumers evolve on different schedules, FULL compatibility is the way to go.',
    },
    {
      heading: 'Schema Evolution Without the Pain',
      body: 'Real systems evolve, and your schemas have to evolve with them. The simplest change is adding an optional field with a default value -- compatible under all modes, invisible to consumers that do not know about it. Removing a field requires more care: safe under BACKWARD, forbidden under FORWARD. The smart play is to deprecate the field first, confirm no consumers depend on it, then remove it in a later version. Renaming a field is not a compatible change in any mode. Instead, add the new name, populate both old and new during a transition period, then drop the old one once everyone has migrated. For drastic changes like altering a field type, consider creating a new topic and using a Flink SQL pipeline to transform and migrate data from old to new.',
    },
    {
      heading: 'Why Governance Matters for Streaming',
      body: 'In batch world, a bad schema change might break a nightly job that someone fixes the next morning. In streaming, a bad schema change breaks a pipeline that is supposed to run 24/7, and the blast radius is every downstream consumer, join, and materialized view that depends on it. Data governance through Schema Registry turns implicit assumptions into explicit, enforced contracts. Teams that own topics publish schemas. Consumers rely on those contracts. If an upstream team needs to make an incompatible change, the registry rejects it and forces a deliberate migration conversation instead of a silent production outage. On Confluent Cloud, you can layer on schema rules for field-level constraints and metadata tags for marking fields as PII, making governance not just structural but semantic.',
    },
  ],
};
