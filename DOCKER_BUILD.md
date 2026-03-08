# Docker Build & Deployment

## Prerequisites

- Docker installed
- Node.js 22+
- A valid `.env` file with your Confluent Cloud credentials:

```bash
cp .env.example .env
# Fill in your Confluent Cloud credentials
```

## Build Steps

### 1. Install dependencies and build locally

The React app embeds `VITE_*` environment variables at build time from your `.env` file. You must build locally before building the Docker image.

```bash
npm install
npm run build
```

This generates the `dist/` directory with all credentials and assets baked in.

### 2. Build the Docker image

```bash
docker build -t flafka:latest .
```

The Dockerfile copies:
- `dist/` — pre-built React app with embedded env vars
- `.env` — read at container startup to derive nginx proxy URLs
- `nginx.conf` — template with `${VAR}` placeholders for proxy targets
- `docker-entrypoint.sh` — substitutes proxy URLs from `.env` at startup

### 3. Run the container

```bash
docker run -d -p 8080:80 --name flafka flafka:latest
```

No `-e` flags needed — all configuration comes from the `.env` file.

Then open: **http://localhost:8080**

## How It Works

The Docker setup has two layers of configuration:

1. **Build-time** (`npm run build`): Vite reads `.env` and embeds all `VITE_*` variables into the JavaScript bundle. This includes API keys, org/env IDs, and cluster IDs.

2. **Runtime** (`docker-entrypoint.sh`): The entrypoint script reads `.env` and derives nginx reverse proxy URLs from the same variables:

   | Derived URL | Source |
   |-------------|--------|
   | Flink API | `https://flink.${VITE_CLOUD_REGION}.${VITE_CLOUD_PROVIDER}.confluent.cloud` |
   | Confluent API | `${VITE_CONFLUENT_API_URL}` or `https://api.confluent.cloud` |
   | Kafka REST | `${VITE_KAFKA_REST_ENDPOINT}` |
   | Schema Registry | `${VITE_SCHEMA_REGISTRY_URL}` |
   | Telemetry API | `${VITE_TELEMETRY_API_URL}` or `https://api.telemetry.confluent.cloud` |

   These are substituted into `nginx.conf` via `sed` before nginx starts.

## Rebuilding After Code or Config Changes

```bash
npm run build              # Re-embed env vars into JS bundle
docker rm -f flafka        # Remove old container
docker build -t flafka:latest .
docker run -d -p 8080:80 --name flafka flafka:latest
```

## Troubleshooting

**Missing environment variables in browser console**
You forgot to run `npm run build` before `docker build`. The `.env` must be present during the local build so Vite can embed the `VITE_*` values.

**Container exits immediately**
Check logs: `docker logs flafka`. Usually a nginx config error — verify `.env` has valid URLs for `VITE_KAFKA_REST_ENDPOINT` and `VITE_SCHEMA_REGISTRY_URL`.

**502 Bad Gateway on API calls**
The nginx proxy can't reach the upstream. Ensure `proxy_ssl_server_name on` is set in `nginx.conf` (required for HTTPS upstream with SNI).

**Images not loading (broken squirrel logo)**
Images must be in `public/img/` and referenced as `/img/...` (not `/src/img/...`). Run `npm run build` to copy them into `dist/`.

**CORS errors**
Access the app via `http://localhost:8080`, not a different port. All API calls go through the nginx reverse proxy.

## Recent Example Card Changes

- Card reordering: Basics, Windows, Joins, Stateful, Schema, Data Masking, UDFs
- New Data Masking (Pure SQL) example card added
- Schema injection banners for schemaless topic and schema override cards
- UDF completion modals now include wait warnings for function registration
- Close button added to example detail pages
- Workspace limit bumped from 20 to 50
- Notes panel restyled with dark header and light body
