# Example Template Engine

## Overview

The template engine lets new Quick Start examples be defined as **typed config objects** — one file per example. A generic runner (`example-runner.ts`) handles all infrastructure boilerplate. Adding a new example requires only a config file + card registration; no new runner code needed.

## Architecture

```
exampleCards.ts          ← card registration (title, description, tags, sql preview)
  └─ runKickstarterExample(def, store, onProgress)   ← example-runner.ts
       ├─ TABLE_SCHEMAS registry    ← DDL factory per schema key
       ├─ DATA_GENERATORS registry  ← data generator per generator key
       └─ createTable()             ← example-helpers.ts (shared with example-setup.ts)

src/data/examples/
  loan-filter.ts          ← KickstarterExampleDef (simple filter)
  loan-aggregate.ts       ← KickstarterExampleDef (tumbling window)
  loan-join.ts            ← KickstarterExampleDef (streaming join, 2 input tables)
  loan-temporal-join.ts   ← KickstarterExampleDef (temporal join, versioned table)
```

## KickstarterExampleDef

```ts
interface TableDef {
  name: string;                              // base name e.g. "LOANS" → "{rid}-LOANS" at runtime
  schema: string;                            // key in TABLE_SCHEMAS registry
  role: 'input' | 'output';
  dataset?: { generator: string; count: number }; // only for input tables
  stream?: 'produce-consume' | 'consume';    // only for tables that get a stream card
}

interface CellDef {
  label: string;   // cell label prefix (e.g. "filter-job" → "{rid}-filter-job")
  sql: string;     // SQL with {TABLE_NAME} placeholders — backticks already in template
}

interface KickstarterExampleDef {
  id: string;
  tables: TableDef[];   // order matters: determines stream card order
  sql: CellDef[];
  completionModal?: Omit<ExampleCompletionModal, 'title'>;
}
```

## Schema Registry

`TABLE_SCHEMAS` maps schema keys to DDL factory functions. Aliases (string values) redirect to another key.

| Key | Purpose | Notes |
|-----|---------|-------|
| `loans-standard` | Input loan stream | `key BYTES` is a payload field |
| `loans-filtered` | Alias → `loans-standard` | Same DDL, separate semantic entry |
| `loans-stats` | Aggregate output | Append-only |
| `customers-risk` | Risk profile lookup | Simple append table |
| `customers-credit` | Versioned credit lookup | `PRIMARY KEY` + `changelog.mode = upsert` + `valid_from` |
| `fraud-alerts` | Streaming join output | Append-only; no changelog.mode |
| `loans-enriched` | Temporal join output | Append-only |

## Generator Registry

`DATA_GENERATORS` maps generator keys to functions that return `Record<string, unknown>[]`.

| Key | Function | Output |
|-----|---------|--------|
| `flat-loans` | `generateFlatLoans(count)` | loan_id, amount, status, created_at, txn_id, customer_id |
| `customers-risk` | `generateCustomerRiskProfiles(count)` | customer_id, name, risk_score, risk_level |
| `customers-credit` | `generateCustomerCreditProfiles(count)` | customer_id, name, credit_score, state, valid_from (2 rows/customer) |

## Template Substitution

SQL cell templates use `{TABLE_NAME}` inside backticks:

```sql
-- In the config file:
INSERT INTO `{LOANS-FILTERED}` SELECT * FROM `{LOANS}`

-- After substitution with rid = "wobbling-narwhal-472":
INSERT INTO `wobbling-narwhal-472-LOANS-FILTERED` SELECT * FROM `wobbling-narwhal-472-LOANS`
```

The runner replaces `{BASE_NAME}` with the resolved name — backticks are already in the template string and are preserved as-is.

## Escape Hatch

Examples requiring artifact upload, function registration, or multi-step API orchestration use **bespoke functions** in `example-setup.ts` instead. The template engine handles ~80% of examples; `example-setup.ts` is the permanent escape hatch for the rest.

Current bespoke examples:
- `setupScalarExtractExample` — uploads JAR, registers Java UDF, creates tables
- `setupTableExplodeExample` — uploads ZIP, registers Python UDFs (gated, coming soon)

## Why TypeScript Config Objects (Not JSON)

- Compile-time type checking on every field
- Direct function references (no runtime parser or eval)
- `completionModal` steps are co-located with the example logic
- Schema/generator keys are validated at import time via TypeScript

---

See also: [example-template-engine-howto.md](example-template-engine-howto.md)
