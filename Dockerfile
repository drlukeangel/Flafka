# ---- Build stage ----
# Compiles TypeScript and bundles the React app into static files.
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first (cached unless package files change)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ---- Production stage ----
# Serves the static build with a lightweight web server.
# Nginx proxies /api/* requests to Confluent Cloud (replaces Vite dev proxy).
FROM nginx:alpine

# Copy built assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config (handles SPA routing + API proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
