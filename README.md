# Flafka

A feature-rich SQL workspace for [Confluent Cloud Flink](https://www.confluent.io/product/flink/). Write, run, and explore Flink SQL queries with a modern editor, schema browser, stream previews, and more.

![screenshot placeholder](docs/screenshot.png)

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- A **Confluent Cloud** account with Flink enabled and a running compute pool

## Quick Start

```bash
git clone <repo-url> && cd flink-ui
cp .env.example .env   # Fill in your Confluent Cloud credentials
npm install
npm run dev             # Opens http://localhost:5173
```

## Environment Variables

All configuration is done via `.env`. See [`.env.example`](.env.example) for the full list with descriptions.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ORG_ID` | Yes | Confluent Cloud organization ID |
| `VITE_ENV_ID` | Yes | Confluent Cloud environment ID |
| `VITE_COMPUTE_POOL_ID` | Yes | Flink compute pool ID |
| `VITE_FLINK_API_KEY` | Yes | Flink SQL API key |
| `VITE_FLINK_API_SECRET` | Yes | Flink SQL API secret |
| `VITE_CLOUD_PROVIDER` | No | Cloud provider (default: `aws`) |
| `VITE_CLOUD_REGION` | No | Cloud region (default: `us-east-1`) |
| `VITE_METRICS_KEY` | No | Cloud API key for metrics & artifacts |
| `VITE_METRICS_SECRET` | No | Cloud API secret for metrics & artifacts |
| `VITE_SCHEMA_REGISTRY_URL` | No | Schema Registry endpoint |
| `VITE_SCHEMA_REGISTRY_KEY` | No | Schema Registry API key |
| `VITE_SCHEMA_REGISTRY_SECRET` | No | Schema Registry API secret |
| `VITE_KAFKA_CLUSTER_ID` | No | Kafka cluster ID for stream preview |
| `VITE_KAFKA_REST_ENDPOINT` | No | Kafka REST Proxy endpoint |
| `VITE_KAFKA_API_KEY` | No | Kafka API key |
| `VITE_KAFKA_API_SECRET` | No | Kafka API secret |
| `VITE_EMPLOYEE_ID` | No | Optional employee identifier |

## Features

- **SQL Editor** — Monaco-powered editor with syntax highlighting, multi-cursor, and minimap
- **Flink SQL Autocomplete** — keyword, table, and column completions
- **Statement Execution** — run queries, poll for results, cancel running statements
- **Results Table** — virtual-scrolled results with column visibility, sorting, and click-to-copy
- **Schema Browser** — browse catalogs, databases, tables, and column schemas
- **Stream Preview** — consume live Kafka topic messages with Avro/Protobuf/JSON deserialization
- **Statement History** — searchable history with status filters and re-run
- **Artifacts Panel** — manage UDFs and connectors
- **Compute Pool Dashboard** — real-time pool metrics and status
- **Workspaces** — save, load, import/export workspace configurations
- **Examples** — built-in SQL example templates
- **Dark Mode** — system-aware theme with manual toggle
- **Keyboard Shortcuts** — cell navigation, run, cancel, and more

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Vite proxy |
| `npm run build` | Production build (`tsc` + `vite build`) |
| `npm run preview` | Preview production build locally |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run package` | Create `flafka-beta.zip` for distribution |

## Architecture

```
React 19 + TypeScript + Vite + Zustand + Monaco Editor
```

The app connects to Confluent Cloud's Flink SQL REST API through a Vite dev proxy (`/api/flink`). Authentication uses Basic Auth with your Flink API key/secret.

### Key Files

| File | Purpose |
|------|---------|
| `src/store/workspaceStore.ts` | Zustand store — all app state and actions |
| `src/api/flink-api.ts` | Flink SQL API client |
| `src/api/confluent-client.ts` | Axios HTTP client with auth |
| `src/api/telemetry-api.ts` | Metrics and artifact API client |
| `src/config/environment.ts` | Environment variable configuration |
| `src/components/EditorCell/` | Monaco SQL editor cells |
| `src/components/ResultsTable/` | Virtual-scrolled query results |
| `src/components/SchemaPanel/` | Schema browser (catalogs, tables, columns) |
| `src/components/StreamsPanel/` | Kafka topic stream preview |
| `src/components/TreeNavigator/` | Sidebar database object tree |
| `src/App.tsx` | Root layout shell |

### Project Structure

```
src/
  api/              # API clients (Flink SQL, telemetry, Confluent Cloud)
  components/       # React components (one directory per feature)
  config/           # Environment configuration
  data/             # Static data (examples, help topics)
  services/         # Business logic (example runner, helpers)
  store/            # Zustand state management
  types/            # TypeScript type definitions
  utils/            # Utility functions
public/             # Static assets (icons, example files)
```

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [React 19](https://react.dev) | UI framework |
| [TypeScript](https://www.typescriptlang.org) | Type safety |
| [Vite](https://vite.dev) | Build tool and dev server |
| [Zustand](https://zustand.docs.pmnd.rs) | State management |
| [Monaco Editor](https://microsoft.github.io/monaco-editor/) | Code editor |
| [Axios](https://axios-http.com) | HTTP client |
| [@tanstack/react-virtual](https://tanstack.com/virtual) | Virtual scrolling |
| [Vitest](https://vitest.dev) | Unit testing |
| [Playwright](https://playwright.dev) | E2E testing |

## Troubleshooting

**CORS errors in console**
The Vite dev proxy handles CORS. Make sure you're accessing the app through `http://localhost:5173`, not directly hitting the Confluent API.

**"Missing required environment variables"**
Check that your `.env` file exists and has at least `VITE_ORG_ID`, `VITE_ENV_ID`, `VITE_COMPUTE_POOL_ID`, `VITE_FLINK_API_KEY`, and `VITE_FLINK_API_SECRET`.

**Schema browser or streams not loading**
These features require the optional Schema Registry and Kafka REST variables. See `.env.example` for details.

**Build fails with type errors**
Run `npm run build` — TypeScript strict mode is enabled. Check for missing types or unused imports.
