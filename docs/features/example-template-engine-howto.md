# How to Add a New Quick Start Example

## Simple example (template engine)

Most examples fit the template engine. Use this path when your example:
- Creates tables from existing schema keys (or a new DDL you add)
- Produces data from an existing generator (or a new one you add)
- Runs SQL INSERT + SELECT cells

### Step 1 — Write a YAML spec

```yaml
id: my-example
tables:
  - name: MY-INPUT
    schema: loans-standard       # existing schema key — or add a new one (see below)
    role: input
    dataset: { generator: flat-loans, count: 200 }
    stream: produce-consume      # adds a stream card for this table
  - name: MY-OUTPUT
    schema: loans-filtered       # alias example — or any registered key
    role: output
sql:
  - label: my-job
    sql: |
      INSERT INTO `{MY-OUTPUT}`
      SELECT * FROM `{MY-INPUT}` WHERE status = 'APPROVED'
  - label: view-output
    sql: SELECT * FROM `{MY-OUTPUT}` LIMIT 50
completionModal:
  subtitle: "Your workspace is ready. Follow these steps:"
  steps:
    - { label: Produce test data, detail: "Click ▶ on the MY-INPUT stream card." }
    - { label: Run the job, detail: "Run the INSERT INTO cell." }
    - { label: View results, detail: "Run the SELECT * cell." }
```

### Step 2 — Create the config file

Claude creates `src/data/examples/my-example.ts` from the spec:

```ts
import type { KickstarterExampleDef } from '../../services/example-runner';

export const myExampleDef: KickstarterExampleDef = {
  id: 'my-example',
  tables: [
    {
      name: 'MY-INPUT',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'MY-OUTPUT',
      schema: 'loans-filtered',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'my-job',
      sql: "INSERT INTO `{MY-OUTPUT}`\nSELECT * FROM `{MY-INPUT}` WHERE status = 'APPROVED'",
    },
    {
      label: 'view-output',
      sql: 'SELECT * FROM `{MY-OUTPUT}` LIMIT 50',
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce test data', detail: 'Click ▶ on the MY-INPUT stream card.' },
      { label: 'Run the job', detail: 'Run the INSERT INTO cell.' },
      { label: 'View results', detail: 'Run the SELECT * cell.' },
    ],
  },
};
```

### Step 3 — Register the card in `exampleCards.ts`

```ts
import { myExampleDef } from './examples/my-example';

// Inside getExampleCards(), in the Quick Start section:
{
  id: 'my-example',
  title: 'My Example',
  description: 'One-click setup: creates MY-INPUT and MY-OUTPUT tables, loads 200 records.',
  sql: `INSERT INTO \`{rid}-MY-OUTPUT\`\nSELECT * FROM \`{rid}-MY-INPUT\` WHERE status = 'APPROVED'`,
  tags: ['Quick Start', 'Filter', 'Streaming'],
  completionModal: myExampleDef.completionModal,
  onImport: (onProgress) =>
    runKickstarterExample(myExampleDef, useWorkspaceStore.getState(), onProgress),
},
```

---

## Complex example (escape hatch)

Use `example-setup.ts` when your example needs:
- Artifact upload (JAR/ZIP)
- Function registration (`CREATE FUNCTION`)
- Multi-step API orchestration
- Custom polling or retry logic

Add a new exported `async function setup[Name]Example(store, onProgress)` following the same pattern as `setupScalarExtractExample`. Register the card in `exampleCards.ts` with `onImport: (p) => setupMyExample(store, p)`.

---

## Adding a new table schema

In `src/services/example-runner.ts`, add one entry to `TABLE_SCHEMAS`:

```ts
'my-schema': (n) => `CREATE TABLE \`${n}\` (
  my_field STRING,
  another_field DOUBLE
)`,
```

For an alias (same DDL as an existing schema):
```ts
'my-schema-alias': 'my-schema',   // resolves one level
```

---

## Adding a new data generator

In `src/services/example-runner.ts`:

1. Write the function:
```ts
function generateMyData(count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({
    my_field: `val-${i}`,
    another_field: Math.random() * 100,
  }));
}
```

2. Register it:
```ts
const DATA_GENERATORS: Record<string, (count: number) => Record<string, unknown>[]> = {
  // ... existing entries ...
  'my-data': generateMyData,
};
```

3. Reference it in your config:
```ts
dataset: { generator: 'my-data', count: 50 }
```

---

## Most complex existing example (reference)

`src/data/examples/loan-temporal-join.ts` is the most complex template — it demonstrates:

- **3 tables**: 2 inputs + 1 output
- **Versioned table**: `customers-credit` schema uses `PRIMARY KEY NOT ENFORCED` + `changelog.mode = upsert` + `valid_from STRING`
- **2 stream cards**: CUSTOMERS above LOANS (table order in `tables[]` controls card order — CUSTOMERS must be produced first)
- **Temporal join SQL**: `FOR SYSTEM_TIME AS OF l.\`$rowtime\`` — point-in-time lookup against versioned state
- **2×count rows**: `generateCustomerCreditProfiles(10)` returns 20 rows (2 credit score versions per customer)
- **4 completion steps**: explicit ordering instruction (produce CUSTOMERS before LOANS)

Use this as your template when building examples with multi-table joins, versioned lookups, or ordered stream card production.
