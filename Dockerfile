# Single builder stage with build tools
FROM cgr.dev/chainguard/node:latest-dev AS builder

USER root
RUN apk add --no-cache python3 build-base && npm install -g node-gyp
USER node

WORKDIR /app

# Install all deps (need build tools for better-sqlite3)
COPY package.json ./
RUN npm install

# Build frontend
COPY index.html vite.config.js ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

# Reinstall production-only deps
RUN rm -rf node_modules && npm install --omit=dev

# Production (distroless)
FROM cgr.dev/chainguard/node:latest

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules/
COPY package.json server.js db.js ./
COPY --from=builder /app/dist ./dist/

RUN mkdir -p /app/data/uploads

ENV NODE_ENV=production
EXPOSE 3000
CMD ["server.js"]
