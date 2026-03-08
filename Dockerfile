# ---- Production stage ----
# Serves the pre-built React app with Nginx.
# Nginx proxies /api/* requests to Confluent Cloud (replaces Vite dev proxy).
#
# Prerequisites: run `npm run build` locally first (reads .env for VITE_* vars).
#
# This is a single-stage Dockerfile. There is no multi-stage build because the
# React app must be built on the host (where .env supplies VITE_* vars that Vite
# embeds into the JavaScript bundle at build time). The resulting dist/ folder is
# then copied into the image as static assets.
FROM nginx:alpine

# --- Static assets layer ---
# Copy the pre-built React app into nginx's default serving directory.
# These files already contain all VITE_* environment values baked in by Vite,
# so no runtime variable substitution is needed for the front-end bundle.
COPY dist /usr/share/nginx/html

# --- Environment file layer ---
# The .env file is copied into the container so the entrypoint script can read
# it at startup and derive reverse-proxy upstream URLs (Flink API, Kafka REST,
# Schema Registry, etc.) without requiring docker run -e flags.
COPY .env /app/.env

# --- Nginx config template layer ---
# nginx.conf contains ${VAR} placeholders (e.g., ${FLINK_API_URL}) that the
# entrypoint script substitutes with real values derived from .env. The file is
# stored as a .template so the original is preserved for re-processing.
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# --- Entrypoint script layer ---
# docker-entrypoint.sh reads .env, computes upstream URLs, runs sed to replace
# placeholders in the nginx config template, writes the final config, and then
# exec's nginx. This keeps all runtime configuration in one place (.env).
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose the default HTTP port that nginx listens on.
EXPOSE 80

# Use the entrypoint script instead of the default nginx command so that
# environment-based config substitution runs before nginx starts.
ENTRYPOINT ["/docker-entrypoint.sh"]
