# Flafka

Flafka is a browser-based SQL workspace for running [Apache Flink SQL](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/table/sql/overview/) and ksqlDB queries against [Confluent Cloud](https://www.confluent.io/confluent-cloud/). Think of it as a notebook-style editor where you write SQL statements, execute them against a remote Flink compute pool, and see results streamed back in real time. It is built with React, TypeScript, and Vite.

## Quick Start

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd flink-ui
   ```

2. **Create your environment file**

   ```bash
   cp .env.example .env
   ```

3. **Fill in your Confluent Cloud credentials** in `.env`. At minimum you need the five required variables listed in the next section. You can find these values in the Confluent Cloud web console under your organization, environment, and compute pool settings.

4. **Install dependencies**

   ```bash
   npm install
   ```

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   The app opens automatically at [http://localhost:5173](http://localhost:5173).

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Variables are grouped by purpose.

### Required

These are the minimum credentials needed for the app to connect and run queries.

| Variable | Description |
|----------|-------------|
| `VITE_ORG_ID` | Your Confluent Cloud organization ID (starts with `org-`) |
| `VITE_ENV_ID` | Your Confluent Cloud environment ID (starts with `env-`) |
| `VITE_COMPUTE_POOL_ID` | Your Flink compute pool ID (starts with `lfcp-`) |
| `VITE_FLINK_API_KEY` | API key for the Flink SQL API (create one in Confluent Cloud under your environment's API keys) |
| `VITE_FLINK_API_SECRET` | API secret that pairs with the key above |
| `VITE_FLINK_CATALOG` | Flink catalog name (typically matches your environment name; default: `default`) |
| `VITE_FLINK_DATABASE` | Flink database name (typically matches your Kafka cluster name; default: `public`) |

### Optional -- Cloud Region

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_CLOUD_PROVIDER` | `aws` | Cloud provider where your environment runs (`aws`, `gcp`, or `azure`) |
| `VITE_CLOUD_REGION` | `us-east-1` | Cloud region of your environment |

### Optional -- Metrics and Artifact Management

Required for the compute pool dashboard and UDF artifact uploads.

| Variable | Description |
|----------|-------------|
| `VITE_METRICS_KEY` | Cloud API key (service account scoped) for metrics and artifact APIs |
| `VITE_METRICS_SECRET` | Cloud API secret for the key above |

### Optional -- Schema Registry

Required for the schema browser and topic detail views.

| Variable | Description |
|----------|-------------|
| `VITE_SCHEMA_REGISTRY_URL` | Schema Registry endpoint (e.g. `https://psrc-xxxxx.us-east-1.aws.confluent.cloud`) |
| `VITE_SCHEMA_REGISTRY_KEY` | Schema Registry API key |
| `VITE_SCHEMA_REGISTRY_SECRET` | Schema Registry API secret |

### Optional -- Kafka REST Proxy

Required for stream preview (consuming live topic messages).

| Variable | Description |
|----------|-------------|
| `VITE_KAFKA_CLUSTER_ID` | Kafka cluster ID (starts with `lkc-`) |
| `VITE_KAFKA_REST_ENDPOINT` | Kafka REST Proxy endpoint (e.g. `https://pkc-xxxxx.us-east-1.aws.confluent.cloud:443`) |
| `VITE_KAFKA_API_KEY` | Kafka API key |
| `VITE_KAFKA_API_SECRET` | Kafka API secret |

### Optional -- ksqlDB Engine

Enable per-cell ksqlDB execution alongside Flink SQL.

| Variable | Description |
|----------|-------------|
| `VITE_KSQL_ENABLED` | Set to `true` to show the engine selector on SQL cells (default: `false`) |
| `VITE_KSQL_ENDPOINT` | ksqlDB cluster endpoint (e.g. `https://pksqlc-xxxxx.us-east-1.aws.confluent.cloud:443`) |
| `VITE_KSQL_API_KEY` | ksqlDB API key |
| `VITE_KSQL_API_SECRET` | ksqlDB API secret |

### Optional -- Other

| Variable | Description |
|----------|-------------|
| `VITE_UNIQUE_ID` | Tags all created resources (topics, schemas, jobs) with this ID so you only see your own resources in multi-user environments |
| `VITE_ADMIN_SECRET` | Set to `FLAFKA` to enable admin mode (bypasses unique-ID filtering, grants manage permissions on all resources) |
| `VITE_FLINK_API_URL` | Override the default Flink API endpoint (for private link / VPC peering) |
| `VITE_CONFLUENT_API_URL` | Override the default Confluent Cloud API endpoint |
| `VITE_TELEMETRY_API_URL` | Override the default telemetry API endpoint |

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server with API proxies on port 5173 |
| `npm run build` | Production build (runs TypeScript compiler then Vite build) |
| `npm run lint` | Run ESLint across the project |
| `npm test` | Run tests in watch mode (re-runs on file changes) |
| `npm run test:coverage` | Run tests once and generate a coverage report in `coverage/` |
| `npm run test:ui` | Open the Vitest browser UI for interactive test exploration |

## Project Structure

```
src/
  api/              Axios HTTP clients and API call functions
  components/       React components (one folder per feature)
  config/           Environment variable configuration
  data/             Static data (SQL examples, help topics)
  services/         Business logic (example runner, helpers)
  store/            Zustand state management (single store)
  types/            TypeScript type definitions
  utils/            Utility functions (formatting, names, export)
  __tests__/        All test files (mirrors src/ structure)
docs/               Documentation (features, roadmap, tech stack)
public/             Static assets (icons, example files)
```

## Architecture Overview

The data flow through the app looks like this:

```
React UI  -->  Zustand Store  -->  API Layer (axios)  -->  Vite Dev Proxy  -->  Confluent Cloud
```

**Why a proxy?** Browsers enforce CORS (Cross-Origin Resource Sharing), which prevents JavaScript from calling a different domain directly. Confluent Cloud's APIs do not allow browser-origin requests. The Vite dev server acts as a middleman: your browser talks to `localhost:5173/api/flink`, and Vite forwards that request to `https://flink.<region>.<provider>.confluent.cloud` on the server side, where CORS does not apply. The browser never sees a cross-origin request.

Each proxy route strips its prefix and forwards to the real API. For example, a request to `/api/flink/sql/v1/statements` becomes a request to `https://flink.us-east-1.aws.confluent.cloud/sql/v1/statements`.

## Key Files

| File | What it does |
|------|--------------|
| `src/App.tsx` | Root layout shell -- tab bar, sidebar, and main content area |
| `src/store/workspaceStore.ts` | Single Zustand store holding all application state and actions |
| `src/api/flink-api.ts` | Functions for executing SQL, polling results, listing statements |
| `src/api/confluent-client.ts` | Creates the `confluentClient`, `fcpmClient`, and `telemetryClient` axios instances |
| `src/config/environment.ts` | Reads `VITE_*` env vars and exports a typed `env` object |
| `src/types/index.ts` | All shared TypeScript interfaces and types |
| `src/components/EditorCell/EditorCell.tsx` | Monaco-powered SQL editor cell |
| `src/components/ResultsTable/ResultsTable.tsx` | Virtual-scrolled query results table |
| `src/components/TreeNavigator/TreeNavigator.tsx` | Sidebar tree browser for catalogs, databases, and tables |
| `vite.config.ts` | Vite configuration including all proxy routes |

## API Clients

The app uses six axios client instances, each pointing at a different Vite proxy route. All authentication is Basic Auth (base64-encoded `key:secret`).

| Client | Proxy Route | Target API | Auth Credentials | Purpose |
|--------|-------------|------------|-----------------|---------|
| `confluentClient` | `/api/flink` | Flink SQL REST API | `FLINK_API_KEY/SECRET` | Execute SQL, poll results, list statements |
| `fcpmClient` | `/api/fcpm` | Confluent Cloud Management API | `METRICS_KEY/SECRET` | Compute pool status and metrics |
| `telemetryClient` | `/api/telemetry` | Confluent Telemetry API | `METRICS_KEY/SECRET` | Compute pool usage metrics |
| `artifactClient` | `/api/artifact` | Confluent Artifact API | `METRICS_KEY/SECRET` | UDF and connector artifact management |
| `schemaRegistryClient` | `/api/schema-registry` | Schema Registry | `SCHEMA_REGISTRY_KEY/SECRET` | Schema lookups for topic detail views |
| `kafkaRestClient` | `/api/kafka` | Kafka REST Proxy | `KAFKA_API_KEY/SECRET` | Consume topic messages for stream preview |

The client source files live in `src/api/`:

- `confluent-client.ts` -- exports `confluentClient`, `fcpmClient`, `telemetryClient`
- `artifact-client.ts` -- exports `artifactClient`
- `schema-registry-client.ts` -- exports `schemaRegistryClient`
- `kafka-rest-client.ts` -- exports `kafkaRestClient`

## State Management

All application state lives in a single Zustand store at `src/store/workspaceStore.ts`. Key concepts:

- **Workspaces and tabs**: The app supports multiple workspaces, each appearing as a tab. Each workspace contains its own SQL statements, results, and editor state.
- **Per-tab state**: When you switch tabs, the store tracks which workspace is active and restores its state.
- **Persistence**: The store uses Zustand's `persist` middleware to save workspace data to `localStorage`, so your work survives page refreshes.
- **Actions**: All state mutations (add statement, execute query, update results) are defined as actions inside the store. Components call these actions; they never mutate state directly.

## Testing

Tests use **Vitest** (a Vite-native test runner with a Jest-compatible API) and **React Testing Library**.

**Run all tests:**

```bash
npm test
```

**Run a subset using markers:**

Test files use marker tags in their `describe` blocks (e.g. `describe('[@store] workspace actions', ...)`). You can target specific markers:

```bash
npm test -- -t "@store" --run        # Run store tests once
npm test -- -t "@api" --run          # Run API tests once
npm test -- -t "@results-table"      # Run results table tests in watch mode
```

**Generate a coverage report:**

```bash
npm run test:coverage
```

Test files live in `src/__tests__/` and mirror the source structure. For more details on the testing approach and conventions, see [docs/TESTING-GUIDE.md](docs/TESTING-GUIDE.md).

## Troubleshooting

**Blank page or "Missing required environment variables" in console**
Your `.env` file is missing or incomplete. Make sure it exists at the project root and contains at least `VITE_ORG_ID`, `VITE_ENV_ID`, `VITE_COMPUTE_POOL_ID`, `VITE_FLINK_API_KEY`, and `VITE_FLINK_API_SECRET`.

**CORS errors in the browser console**
You are probably hitting the Confluent API directly instead of going through the Vite proxy. Make sure you access the app at `http://localhost:5173` (not a different port) and that `npm run dev` is running.

**Schema browser or stream preview not loading**
These features need the optional Schema Registry and Kafka REST variables. Check that `VITE_SCHEMA_REGISTRY_URL`, `VITE_KAFKA_REST_ENDPOINT`, and their associated keys/secrets are set in `.env`.

**Tests failing unexpectedly**
Try running just the failing test's marker to isolate it:
```bash
npm test -- -t "@marker-name" --run
```
If all tests fail, check that dependencies are installed (`npm install`) and that no import paths are broken.

**Build fails with type errors**
TypeScript strict mode is enabled. Run `npm run build` to see the full error output. Common causes are missing type annotations or unused imports.

## Further Reading

| Document | Description |
|----------|-------------|
| [docs/TECH-STACK.md](docs/TECH-STACK.md) | Full technology stack with version numbers and rationale |
| [docs/FEATURES.md](docs/FEATURES.md) | Detailed feature list and descriptions |
| [docs/TESTING-GUIDE.md](docs/TESTING-GUIDE.md) | Testing conventions, marker system, and coverage targets |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Current and planned feature work |
