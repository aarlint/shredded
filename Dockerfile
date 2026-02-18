# Stage 1: Build frontend
FROM node:22-alpine AS frontend

WORKDIR /app

COPY package.json ./
RUN npm install

COPY index.html vite.config.js ./
COPY src/ ./src/
COPY public/ ./public/

RUN npm run build

# Stage 2: Production
FROM node:22-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install --production && apk del python3 make g++

COPY server.js db.js ./
COPY --from=frontend /app/dist ./dist/

RUN mkdir -p /app/data/uploads

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
