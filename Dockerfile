FROM oven/bun:latest AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun run build

FROM oven/bun:debian AS production
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production
COPY --from=build /app/dist ./dist
COPY server/ ./server/
RUN mkdir -p /app/data
VOLUME /app/data
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "server/index.ts"]
