FROM oven/bun:latest AS build
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
RUN bun run build

FROM oven/bun:latest AS production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY server/ ./server/
RUN mkdir -p /app/data
VOLUME /app/data
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "server/index.ts"]
