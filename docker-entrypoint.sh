#!/bin/sh
set -e

# Read .env file if it exists
if [ -f /app/.env ]; then
  export $(grep -v '^#' /app/.env | grep -v '^\s*$' | xargs)
fi

# Derive proxy URLs from .env values (same logic as vite.config.ts)
CLOUD_REGION="${VITE_CLOUD_REGION:-us-east-1}"
CLOUD_PROVIDER="${VITE_CLOUD_PROVIDER:-aws}"
FLINK_API_URL="${VITE_FLINK_API_URL:-https://flink.${CLOUD_REGION}.${CLOUD_PROVIDER}.confluent.cloud}"
CONFLUENT_API_URL="${VITE_CONFLUENT_API_URL:-https://api.confluent.cloud}"
KAFKA_REST_ENDPOINT="${VITE_KAFKA_REST_ENDPOINT:-http://localhost}"
SR_URL="${VITE_SCHEMA_REGISTRY_URL:-http://localhost}"
TELEMETRY_API_URL="${VITE_TELEMETRY_API_URL:-https://api.telemetry.confluent.cloud}"

# Substitute into nginx config template
sed \
  -e "s|\${FLINK_API_URL}|${FLINK_API_URL}|g" \
  -e "s|\${CONFLUENT_API_URL}|${CONFLUENT_API_URL}|g" \
  -e "s|\${KAFKA_REST_ENDPOINT}|${KAFKA_REST_ENDPOINT}|g" \
  -e "s|\${SR_URL}|${SR_URL}|g" \
  -e "s|\${TELEMETRY_API_URL}|${TELEMETRY_API_URL}|g" \
  /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g "daemon off;"
