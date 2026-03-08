# Flafka

Flafka is a browser-based SQL workspace for running [Apache Flink SQL](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/table/sql/overview/) and [ksqlDB](https://ksqldb.io/) queries against [Confluent Cloud](https://www.confluent.io/confluent-cloud/).

- **Notebook-style SQL editor** -- write, execute, and iterate on SQL statements with Monaco-powered cells, each independently targeting Flink or ksqlDB
- **Real-time streaming results** -- results stream back as they arrive, with virtual-scrolled tables, cursor pagination, and live topic preview
- **Learning Center** -- 49 guided examples, 7 learning tracks, and interactive concept lessons to go from zero to streaming SQL

## Quick Start

**Prerequisites:** Node.js 22+ and npm.

```bash
# 1. Clone the repository
git clone <repo-url>
cd flink-ui

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# Edit .env with your Confluent Cloud credentials (see below)

# 4. Start the dev server
npm run dev
```

The app opens at [http://localhost:5173](http://localhost:5173).

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Variables are grouped by purpose.

### Required

These are the minimum credentials needed for the app to connect and run queries.

| Variable | Description |
|----------|-------------|
| `VITE_ORG_ID` | Confluent Cloud organization ID (starts with `org-`) |
| `VITE_ENV_ID` | Confluent Cloud environment ID (starts with `env-`) |
| `VITE_COMPUTE_POOL_ID` | Flink compute pool ID (starts with `lfcp-`) |
| `VITE_FLINK_API_KEY` | API key for the Flink SQL API |
| `VITE_FLINK_API_SECRET` | API secret for the key above |
| `VITE_FLINK_CATALOG` | Flink catalog name (typically your environment name; default: `default`) |
| `VITE_FLINK_DATABASE` | Flink database name (typically your Kafka cluster name; default: `public`) |

### Optional -- Cloud Region

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_CLOUD_PROVIDER` | `aws` | Cloud provider (`aws`, `gcp`, or `azure`) |
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
| `VITE_UNIQUE_ID` | Tags all created resources with this ID for multi-user isolation |
| `VITE_ADMIN_SECRET` | Set to `FLAFKA` to enable admin mode (bypasses unique-ID filtering, grants manage permissions) |
| `VITE_ENVIRONMENT` | `dev` for testing-friendly defaults (1 partition, 1hr retention); `production` for standard defaults |
| `VITE_FLINK_API_URL` | Override the default Flink API endpoint (for private link / VPC peering) |
| `VITE_CONFLUENT_API_URL` | Override the default Confluent Cloud API endpoint |
| `VITE_TELEMETRY_API_URL` | Override the default telemetry API endpoint |

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server with API proxies on port 5173 |
| `npm run build` | Production build (TypeScript compiler then Vite build) |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run unit tests in watch mode (Vitest) |
| `npm run test:run` | Run unit tests once and exit |
| `npm run test:ui` | Open the Vitest browser UI for interactive test exploration |
| `npm run test:coverage` | Run unit tests once and generate a coverage report in `coverage/` |
| `npm run test:e2e` | Run end-to-end tests (Playwright, headless Chromium) |
| `npm run test:e2e:headed` | Run E2E tests with a visible browser window |
| `npm run lint` | Run ESLint across the project |
| `npm run package` | Package the app for distribution (runs `scripts/package.sh`) |

## Docker Deployment

The Docker image serves the pre-built React app with Nginx. Nginx replaces the Vite dev server proxy in production, forwarding `/api/*` requests to Confluent Cloud.

### Build and Run

```bash
# 1. Build the React app (reads .env for VITE_* vars baked into the JS bundle)
npm run build

# 2. Build the Docker image
docker build -t flafka .

# 3. Run the container
docker run -p 80:80 flafka
```

The app is served at [http://localhost](http://localhost).

### How It Works

The Dockerfile is a single-stage build based on `nginx:alpine`. It does not run `npm install` or `npm run build` inside the container -- the React app must be built on the host where `.env` supplies the `VITE_*` variables that Vite embeds into the JavaScript bundle at build time.

At container startup, `docker-entrypoint.sh`:
1. Reads the `.env` file (copied into the image at `/app/.env`)
2. Derives reverse-proxy upstream URLs from the env vars (Flink API, Kafka REST, Schema Registry, etc.)
3. Substitutes `${VAR}` placeholders in the Nginx config template with the real URLs
4. Starts Nginx

This means the `.env` file serves double duty: Vite reads it at build time for frontend config, and the entrypoint reads it at runtime for proxy routing. No `docker run -e` flags are required -- everything comes from `.env`.

### Nginx Proxy Routes

Nginx mirrors the same proxy routes as the Vite dev server:

| Route | Upstream |
|-------|----------|
| `/api/flink/` | Flink SQL REST API |
| `/api/fcpm/` | Confluent Cloud Management API |
| `/api/artifact/` | Confluent Artifact API |
| `/api/kafka/` | Kafka REST Proxy |
| `/api/schema-registry/` | Schema Registry |
| `/api/telemetry/` | Telemetry / Metrics API |

Each route strips its `/api/<service>/` prefix before forwarding. Static assets under `/assets/` are cached for 1 year with immutable headers; `index.html` is never cached.

### Testing Against Docker

Set `PLAYWRIGHT_BASE_URL` to point E2E tests at the container instead of the dev server:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8080 npm run test:e2e
```

## Testing

### Unit Tests (Vitest)

Tests use Vitest with jsdom and React Testing Library. Test files live in `src/__tests__/` and mirror the source structure.

```bash
npm test                          # Watch mode
npm run test:run                  # Run once
npm run test:coverage             # Run once + coverage report
```

Test files use marker tags in `describe` blocks (e.g. `describe('[@store] workspace actions', ...)`). Target specific markers:

```bash
npm test -- -t "@store" --run     # Store tests only
npm test -- -t "@api" --run       # API tests only
```

For conventions and coverage targets, see [docs/TESTING-GUIDE.md](docs/TESTING-GUIDE.md).

### End-to-End Tests (Playwright)

E2E tests run in headless Chromium. Playwright auto-starts the dev server when testing against `localhost:5173`.

```bash
npm run test:e2e                  # Headless
npm run test:e2e:headed           # Visible browser
```

Test files live in `e2e/`. Configuration is in `playwright.config.ts`.

## Project Structure

```
src/
  api/              Axios HTTP clients and API call functions
  components/       React components (one folder per feature)
  config/           Environment variable configuration
  data/             Static data (SQL examples, learning tracks, help topics)
  hooks/            Custom React hooks (routing, etc.)
  services/         Business logic (example runner, helpers)
  store/            Zustand state management
    engines/        SQL engine adapters (Flink, ksqlDB)
  types/            TypeScript type definitions
  utils/            Utility functions (formatting, names, export)
  __tests__/        Unit tests (mirrors src/ structure)
e2e/                Playwright end-to-end tests
docs/               Documentation (features, roadmap, testing guide)
public/             Static assets (icons, example files)
scripts/            Build and packaging scripts
```

## Architecture Overview

```
React UI  -->  Zustand Store  -->  API Layer (Axios)  -->  Vite Dev Proxy  -->  Confluent Cloud
                                                      -->  Nginx (prod)   -->  Confluent Cloud
```

**Why a proxy?** Browsers enforce CORS, which prevents JavaScript from calling a different domain directly. Confluent Cloud APIs do not allow browser-origin requests. The proxy (Vite in dev, Nginx in production) acts as a middleman: the browser talks to `localhost/api/flink`, and the proxy forwards the request to Confluent Cloud on the server side where CORS does not apply.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 19, TypeScript 5.9 |
| Build | Vite 7.3 |
| State | Zustand 5 (persisted to localStorage) |
| Editor | Monaco Editor (via @monaco-editor/react) |
| HTTP | Axios |
| Styling | Tailwind CSS 4, PostCSS |
| Virtualization | @tanstack/react-virtual |
| Serialization | avsc (Avro), protobufjs (Protobuf) |
| Unit Tests | Vitest 4, React Testing Library, jsdom |
| E2E Tests | Playwright 1.58 (Chromium) |
| Production Server | Nginx (Alpine Docker image) |

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root layout shell -- tab bar, sidebar, main content |
| `src/store/workspaceStore.ts` | Zustand store with all application state and actions |
| `src/api/flink-api.ts` | Flink SQL API: execute, poll, fetch results |
| `src/api/ksql-api.ts` | ksqlDB REST API: DDL, DML, push/pull queries |
| `src/config/environment.ts` | Reads `VITE_*` env vars, exports typed `env` object |
| `src/types/index.ts` | Shared TypeScript interfaces and types |
| `src/components/EditorCell/EditorCell.tsx` | Monaco SQL editor cell |
| `src/components/ResultsTable/ResultsTable.tsx` | Virtual-scrolled query results |
| `src/components/TreeNavigator/TreeNavigator.tsx` | Sidebar catalog/database/table browser |
| `vite.config.ts` | Vite config with all proxy routes |

## Troubleshooting

**Blank page or "Missing required environment variables" in console**
Your `.env` file is missing or incomplete. Make sure it contains at least `VITE_ORG_ID`, `VITE_ENV_ID`, `VITE_COMPUTE_POOL_ID`, `VITE_FLINK_API_KEY`, and `VITE_FLINK_API_SECRET`.

**CORS errors in the browser console**
You are hitting the Confluent API directly instead of going through the proxy. Access the app at `http://localhost:5173` (dev) or through Nginx (production).

**Schema browser or stream preview not loading**
These features need the optional Schema Registry and Kafka REST variables. Check that `VITE_SCHEMA_REGISTRY_URL`, `VITE_KAFKA_REST_ENDPOINT`, and their associated keys/secrets are set.

**Tests failing unexpectedly**
Run the failing test's marker in isolation: `npm test -- -t "@marker-name" --run`. If all tests fail, verify dependencies are installed (`npm install`).

**Build fails with type errors**
TypeScript strict mode is enabled. Run `npm run build` to see the full error output.

## Further Reading

| Document | Description |
|----------|-------------|
| [docs/TECH-STACK.md](docs/TECH-STACK.md) | Full technology stack with version numbers and rationale |
| [docs/FEATURES.md](docs/FEATURES.md) | Detailed feature list and descriptions |
| [docs/TESTING-GUIDE.md](docs/TESTING-GUIDE.md) | Testing conventions, marker system, and coverage targets |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Current and planned feature work |
